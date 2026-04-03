# pi scanner - runs the scans and returns the data

import json 
import random
import logging
from datetime import datetime, timezone
from pi_config import RESULTS_PATH

log = logging.getLogger(__name__)


# runs scan for given type 
def run_scan(scan_type):
    log.info("starting scan ", scan_type)

    try:
        with open(RESULTS_PATH, "r") as f:
            pool = json.load(f)
    # rerror
    except (FileNotFoundError, json.JSONDecodeError) as e:
        log.error("could not load results", e)
        return None
    
    # pick template matching the scan type
    matching = [t for t in pool if t.get("scan_type") == scan_type]
    template = random.choice(matching if matching else pool)

    now = datetime.now(timezone.utc).isoformat()

    # fill in timestamps
    devices = []
    for d in template["devices"]:
        device = dict(d)
        if device.get("time_seen") == "auto":
            device["time_seen"] = now
        if device.get("first_seen") == "auto":
            device["first_seen"] = now
        if device.get("last_seen") == "auto":
            device["last_seen"] = now
        devices.append(device)
    
    log.info("%s scan complete. %d devices found", scan_type, len(devices))

    return {
        "devices": devices,
        "bandwidth": template.get("bandwidth", "Unknown"),
    }