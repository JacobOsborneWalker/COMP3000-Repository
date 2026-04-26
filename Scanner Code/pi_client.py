# pi client - handles communication with server

import requests
import logging
from pi_config import SERVER_URL, SCANNER_UID, API_KEY

log = logging.getLogger(__name__)

HEADERS = {
    "Content-Type": "application/json",
    "X-Node-UID": SCANNER_UID,
    "X-API-Key": API_KEY,
}

# checkin
def checkin(status="online", error=None, alert=None):
    payload = {"status": status}
    if error:
        payload["error"] = error
    if alert:
        payload["alert"] = alert

    try:
        resp = requests.post(
            f"{SERVER_URL}/api/nodes/{SCANNER_UID}/checkin",
            json=payload,
            headers=HEADERS,
            timeout=10
        )
        if resp.status_code == 200:
            log.info("check in ok")
        else:
            log.warning("check in issues: status %s", resp.status_code)
    except requests.RequestException as e:
        log.error("check in failed: %s", e)


# get approved scans waiting for this scanner
def get_approved_scans():
    try:
        resp = requests.get(

            f"{SERVER_URL}/api/nodes/{SCANNER_UID}/poll",
            headers=HEADERS,
            timeout=10
        )
        if resp.status_code != 200:
            log.warning("could not get approved scans: status %s", resp.status_code)
            return []

        data = resp.json()
        return data.get("scans", [])

    except requests.RequestException as e:
        log.error("poll failed: %s", e)
        return []


# submit completed scans to server
def submit_results(scan_request_id, node_uid, node_label, devices, bandwidth):
    suspicious_count = sum(1 for d in devices if d.get("flags"))
    has_rogue = any(d.get("flags") == "Rogue AP" for d in devices)

    payload = {
        "scan_request_id": scan_request_id,
        "node_uid": node_uid,
        "node_label": node_label,
        "bandwidth": bandwidth,
        "total_devices": len(devices),
        "suspicious": suspicious_count,
        "rogue_ap": has_rogue,
        "devices": devices,
    }
    try:
        resp = requests.post(
            f"{SERVER_URL}/api/nodes/{SCANNER_UID}/result",
            json=payload,
            headers=HEADERS,
            timeout=15
        )
        if resp.status_code == 201:
            log.info("results submitted for request %s", scan_request_id)
            return True
        else:
            log.warning("result submission failed: status %s", resp.status_code)
            return False

    except requests.RequestException as e:
        log.error("result submission error: %s", e)
        return False