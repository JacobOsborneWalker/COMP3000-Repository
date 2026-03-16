## retention.py - automatic data purge after configurable retention window

import logging
import os
from datetime import datetime, timezone, timedelta

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from models import (
    db,
    ScanResult,
    ScanRequest,
    DetectedDevice,
    AuditLog,
    NodeAlert,
    NodeError,
    TokenBlocklist,
)

log = logging.getLogger(__name__)

# helper
def _retention_cutoff() -> datetime:
    days = int(os.getenv("RETENTION_DAYS", "90"))
    return datetime.now(timezone.utc) - timedelta(days=days)


def _token_cutoff(app) -> datetime:
    expires = app.config.get("JWT_ACCESS_TOKEN_EXPIRES", timedelta(minutes=30))
    print("cuttof working")
    return datetime.now(timezone.utc) - expires - timedelta(minutes=5)


# purge data
def run_purge(app):
    with app.app_context():
        cutoff        = _retention_cutoff()
        token_cutoff  = _token_cutoff(app)

        totals = {
            "detected_devices": 0,
            "scan_results":     0,
            "scan_requests":    0,
            "audit_logs":       0,
            "node_alerts":      0,
            "node_errors":      0,
            "blocklist_tokens": 0,
        }

        try:
       
            old_result_ids = [
                row.id
                for row in ScanResult.query
                    .with_entities(ScanResult.id)
                    .filter(ScanResult.created_at < cutoff)
                    .all()
            ]

            if old_result_ids:
                deleted = (
                    DetectedDevice.query
                    .filter(DetectedDevice.scan_result_id.in_(old_result_ids))
                    .delete(synchronize_session=False)
                )
                totals["detected_devices"] = deleted

                # scan results
                deleted = (
                    ScanResult.query
                    .filter(ScanResult.id.in_(old_result_ids))
                    .delete(synchronize_session=False)
                )
                totals["scan_results"] = deleted

            # scan requests
            expired_requests = (
                ScanRequest.query
                .filter(ScanRequest.created_at < cutoff)
                .filter(ScanRequest.status.in_(["declined", "cancelled", "approved"]))
                .all()
            )
            for req in expired_requests:
                if not req.results:          
                    db.session.delete(req)
                    totals["scan_requests"] += 1

            # audit logs
            totals["audit_logs"] = (
                AuditLog.query
                .filter(AuditLog.created_at < cutoff)
                .delete(synchronize_session=False)
            )

           # node alerts
            hard_cutoff = datetime.now(timezone.utc) - timedelta(
                days=int(os.getenv("RETENTION_DAYS", "90")) * 2
            )
            totals["node_alerts"] = (
                NodeAlert.query
                .filter(
                    (NodeAlert.resolved == True) & (NodeAlert.created_at < cutoff)
                    | (NodeAlert.created_at < hard_cutoff)
                )
                .delete(synchronize_session=False)
            )

            # node errors
            totals["node_errors"] = (
                NodeError.query
                .filter(NodeError.created_at < cutoff)
                .delete(synchronize_session=False)
            )

            # token blocklist
            totals["blocklist_tokens"] = (
                TokenBlocklist.query
                .filter(TokenBlocklist.revoked_at < token_cutoff)
                .delete(synchronize_session=False)
            )

            db.session.commit()

            log.info(
                cutoff.date(),
                totals["detected_devices"],
                totals["scan_results"],
                totals["scan_requests"],
                totals["audit_logs"],
                totals["node_alerts"],
                totals["node_errors"],
                totals["blocklist_tokens"],
            )

        except Exception:
            db.session.rollback()
            log.exception("purge failed.")



# bootstrap
def start_retention_scheduler(app):

    scheduler = BackgroundScheduler(daemon=True)

    scheduler.add_job(
        func     = run_purge,
        trigger  = IntervalTrigger(hours=24),
        args     = [app],
        id       = "data_retention_purge",
        name     = "daily data retention purge",
        replace_existing = True,
    )

    scheduler.start()
    log.info(
        os.getenv("RETENTION_DAYS", "90"),
    )
    return scheduler