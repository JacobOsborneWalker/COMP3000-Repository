# pi_config.py - configuration for the scanners

import os

SERVER_URL = os.getenv("SERVER_URL", "https://unevaporated-conner-gewgawed.ngrok-free.dev")


SCANNER_UID = os.getenv("SCANNER_UID", "Test Laptop")
#SCANNER_UID = os.getenv("SCANNER_UID", "Pi Scanner A")
#SCANNER_UID = os.getenv("SCANNER_UID", "Pi Scanner B")
#SCANNER_UID = os.getenv("SCANNER_UID", "Pi Scanner C")


API_KEY = os.getenv("API_KEY", "9b77cef98be0bb313466a38a00ca8063254b6ada5dc315e26e26d446a4d66150")

#Test Laptop: db69b405b380ae18af7cb29d33fbeede396476617f3e9b9ecf28daf5af2303a7
#Pi-A: 77ece471189855b8031dba4f4e34d269a36c29f9aa5d842efa7cced75910e99b
#Pi-B: 623c3d0b235fcc61c19715e9f2b0acd8134dc91cc123b40c317b7fad6432dcea
#Pi-C: 26d6f0812bdabc10d9aecbfb4b4832bc320a38ace62f43c51556bfeb435f52dc

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