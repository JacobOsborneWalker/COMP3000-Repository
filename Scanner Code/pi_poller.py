# pi poller - checks for approved scan requests and runs them

import logging
from pi_client import get_approved_scans, checkin
from pi_scanner import run_scan
from pi_uploader import upload_scan
from pi_config import SCANNER_UID

log = logging.getLogger(__name__)

processed = set()


def poll_and_run():
    # check for approved scans
    approved = get_approved_scans()

    if not approved:
        log.debug("no approved scans waiting")
        return

    for scan in approved:
        req_id = scan.get("id")

        if req_id in processed:
            continue

        scan_type  = scan.get("scan_type", "Passive")
        node_label = scan.get("node_label") or scan.get("approved_by") or SCANNER_UID

        log.info("running scan for request %s type %s", req_id, scan_type)
        result = run_scan(scan_type)

        if result is None:
            checkin(
                status="warning",
                error=f"could not complete scan for request {req_id}"
            )
            continue

        success = upload_scan(
            scan_request_id = req_id,
            node_label      = node_label,
            scan_result     = result,
        )

        if success:
            processed.add(req_id)