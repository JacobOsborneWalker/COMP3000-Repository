# pi_main.py - entry point for the pi scanner

# test test 123

import time
import logging
from pi_config import CHECKIN_INTERVALS, POLL_INTERVALS, SCANNER_UID
from pi_client import checkin
from pi_poller import poll_and_run

logging.basicConfig(
    level = logging.INFO,
)

log = logging.getLogger(__name__)


def main():
    print("running main")
    log.info("scanner %s starting", SCANNER_UID)
    # chicken at every checkpoint hahaha
    checkin(status="online")

    checkin_counter = 0
    poll_counter = 0

    while True:
        time.sleep(1)

        checkin_counter = checkin_counter + 1
        poll_counter = poll_counter + 1 

        # checkin with server on intervals
        if checkin_counter >= CHECKIN_INTERVALS:
            checkin(status = "online")
            checkin_counter = 0

        # poll for approved scans
        if poll_counter >= POLL_INTERVALS:
            try:
                poll_and_run()
            except Exception as e:
                log.error("unexcpected error")
                checkin(status = "warning", error = str(e))
            
            poll_counter = 0

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log.info ("scanner shutting down")
        checkin(status = "offline")