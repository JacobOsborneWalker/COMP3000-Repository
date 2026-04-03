# pi poller - checks for approved scan requests and runs them

import logging
from pi_client import get_approved_scans, submit_results, checkin
from pi_scanner import run_scan
from pi_config import SCANNER_UID

log = logging.getLogger(__name__)

# track requests to prevent running same scan twice
processed = set()


# check the server for apporved scan requests and run them
def poll_and_run():
    approved = get_approved_scans()

    # not approved
    if not approved:
        log.debug("no approved scans waiting")
        return

    for scan in approved:
        req_id = scan.get("id")

        if req_id in processed:
            continue

        scan_type = scan.get("scan_type", "Passive")
        node_label = scan.get("node_label") or scan.get("approved_by") or SCANNER_UID
        log.info("running scan for request %s type %s", req_id, scan_type)
        result = run_scan(scan_type)

        # error
        if result is None:
            checkin(
                status="warnings",
                error="could not load scann data"
            )
            continue

        success = submit_results(
            scan_request_id = req_id,
            node_uid = SCANNER_UID,
            node_label = node_label,
            devices = result["devices"],
            bandwidth = result["bandwidth"],
        )

        if success:
            processed.add(req_id)
        else:
            checkin(
                status = "warning",
                error = "result upload failed"
            )