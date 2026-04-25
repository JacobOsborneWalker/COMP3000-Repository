# pi uploader.py - packages completed scan results and uploads them 

import logging
from datetime import datetime, timezone

from pi_client import submit_results, checkin
from pi_config import SCANNER_UID

log = logging.getLogger(__name__)

# upload scan
def upload_scan(scan_request_id: str, node_label: str, scan_result: dict) -> bool:

    if not scan_result:
        log.error("upload_scan called with empty result for request %s", scan_request_id)
        return False

    devices   = scan_result.get("devices", [])
    bandwidth = scan_result.get("bandwidth", "Unknown")
    scan_type = scan_result.get("scan_type", "Unknown")

    if not devices:
        log.warning("no devices in result for request %s – uploading empty payload", scan_request_id)

   # enrich devices 
    now = datetime.now(timezone.utc).isoformat()
    enriched = []
    for dev in devices:
        d = dict(dev)

        # time seen
        if not d.get("time_seen"):
            d["time_seen"] = now

        # flag field to string
        if d.get("flags") is None:
            d["flags"] = ""
        enriched.append(d)

    # summary content 

    total      = len(enriched)
    suspicious = sum(1 for d in enriched if "Suspicious" in (d.get("flags") or ""))
    rogue_ap   = any("Rogue AP" in (d.get("flags") or "") for d in enriched)
    open_nets  = sum(1 for d in enriched if "Open" in (d.get("flags") or ""))

    log.info(
        "packaging result for request %s | type=%s bw=%s devices=%d suspicious=%d rogue_ap=%s",
        scan_request_id, scan_type, bandwidth, total, suspicious, rogue_ap
    )

    # upload 

    try:
        success = submit_results(
            scan_request_id = scan_request_id,
            node_uid        = SCANNER_UID,
            node_label      = node_label,
            devices         = enriched,
            bandwidth       = bandwidth,
        )
    except Exception as e:
        log.error("unexpected error during upload for request %s: %s", scan_request_id, e)
        checkin(status="warning", error=f"upload exception: {e}")
        return False

    if success:
        _log_summary(scan_request_id, scan_type, total, suspicious, rogue_ap, open_nets)
    else:
        log.warning("upload failed for request %s", scan_request_id)
        checkin(status="warning", error=f"result upload failed for {scan_request_id}")

    return success


# logg smmary 
def _log_summary(req_id, scan_type, total, suspicious, rogue_ap, open_nets):
    lines = [
        f"upload ok | request={req_id}",
        f"  scan_type  : {scan_type}",
        f"  total      : {total}",
        f"  suspicious : {suspicious}",
        f"  rogue_ap   : {rogue_ap}",
        f"  open_nets  : {open_nets}",
    ]
    for line in lines:
        log.info(line)

    # escalate to an alert checkin if anything was flagged
    if rogue_ap:
        checkin(
            status = "warning",
            alert  = f"Rogue AP detected during {scan_type} scan (request {req_id})"
        )
    elif suspicious:
        checkin(
            status = "warning",
            alert  = f"{suspicious} suspicious device(s) found during {scan_type} scan (request {req_id})"
        )