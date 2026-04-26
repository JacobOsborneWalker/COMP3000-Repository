# pi_config.py - configuration for the scanners

import os

SERVER_URL = os.getenv("SERVER_URL", "https://unevaporated-conner-gewgawed.ngrok-free.dev")


SCANNER_UID = os.getenv("SCANNER_UID", "Test Laptop")
#SCANNER_UID = os.getenv("SCANNER_UID", "Pi Scanner A")
#SCANNER_UID = os.getenv("SCANNER_UID", "Pi Scanner B")
#SCANNER_UID = os.getenv("SCANNER_UID", "Pi Scanner C")


API_KEY = os.getenv("API_KEY", "9b77cef98be0bb313466a38a00ca8063254b6ada5dc315e26e26d446a4d66150")

#Test Laptop: 9b77cef98be0bb313466a38a00ca8063254b6ada5dc315e26e26d446a4d66150
#Pi-A: 00d576f6744d1ee97c9369ef715cf66576d7f50967eba06ad5e66a1325a8f341
#Pi-B: 2c7bebb872df7a83a2bc613958c026af54abfe6e5432294a4155c5c4cf7d457f
#Pi-C: d66ec1a64324a12d0ba2b7ccc41333735c01fa28968b2d04cb123af1429b064b


CHECKIN_INTERVALS = int(os.getenv("CHECKIN_INTERVALS", "60"))
POLL_INTERVALS    = int(os.getenv("POLL_INTERVALS",    "30"))


# select scan mode
SCAN_MODE = os.getenv("SCAN_MODE", "json")
# SCAN_MODE = os.getenv("SCAN_MODE", "kismet_dry")
# SCAN_MODE = os.getenv("SCAN_MODE", "kismet_live")



RESULTS_PATH = os.path.join(os.path.dirname(__file__), "results.json")


KISMET_INTERFACE = os.getenv("KISMET_INTERFACE", "wlan1")
KISMET_DATA_DIR  = os.getenv("KISMET_DATA_DIR",  "/tmp/kismet_data")

SCAN_DURATIONS = {
    "Passive":      int(os.getenv("PASSIVE_DURATION",      "120")),
    "Deep Passive": int(os.getenv("DEEP_PASSIVE_DURATION", "600")),
    "Active":       int(os.getenv("ACTIVE_DURATION",       "300")),
}