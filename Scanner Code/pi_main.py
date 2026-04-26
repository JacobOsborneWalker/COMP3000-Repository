# pi_main.py - entry point for the pi scanner

import time
import logging
from pi_config import CHECKIN_INTERVALS, POLL_INTERVALS, SCANNER_UID, SCAN_MODE
from pi_client import checkin
from pi_poller import poll_and_run

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


def main():
    log.info("scanner %s starting", SCANNER_UID)
    log.info("scan mode: %s", SCAN_MODE)

    checkin(status="online")

    checkin_counter = 0
    poll_counter    = 0

    while True:
        time.sleep(1)

        checkin_counter += 1
        poll_counter    += 1

        if checkin_counter >= CHECKIN_INTERVALS:
            checkin(status="online")
            checkin_counter = 0

        if poll_counter >= POLL_INTERVALS:
            try:
                poll_and_run()
            except Exception as e:
                log.error("unexpected error in poll_and_run: %s", e)
                checkin(status="warning", error=str(e))
            poll_counter = 0


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log.info("scanner shutting down")
        checkin(status="offline")