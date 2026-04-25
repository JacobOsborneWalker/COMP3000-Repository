# pi config - configuration for the scanners
import os

SERVER_URL = os.getenv("SERVER_URL", "https://unevaporated-conner-gewgawed.ngrok-free.dev")

## scanners
SCANNER_UID = os.getenv("SCANNER_UID", "SCAN-001")
#SCANNER_UID = os.getenv("SCANNER_UID", "SCAN-002")
#SCANNER_UID = os.getenv("SCANNER_UID", "SCAN-003")
#SCANNER_UID = os.getenv("SCANNER_UID", "SCAN-004")


## api key

API_KEY = os.getenv("API_KEY", "56cdc2286309de6d338dfc22136a9cc2ea918321c43034697b8db9ba534c9bad")
# 3c2355e8d35c502bb2f83b28662fa1e8b54d8bfa5a76d7e20480f396386dab3d
# 3859abd9454aef49cd0eb3e45ba65e2134b0ccaf762c31c1cd274ef6c09f7c3e
# ea5525df11fc9e0d9570f19d8834ad4c5182f4c2012bdddeb63baae03ec1a66d
# d7636b37634d797c5dd107573e1553bc3a91f391542579dd4b14d063e2d4185c

CHECKIN_INTERVALS = int(os.getenv("CHECKIN_INTERVALS", "60"))
POLL_INTERVALS    = int(os.getenv("POLL_INTERVALS",    "30"))

# kisment

KISMET_INTERFACE = os.getenv("KISMET_INTERFACE", "wlan0")

KISMET_DATA_DIR = os.getenv("KISMET_DATA_DIR", "/tmp/kismet_data")

SCAN_DURATIONS = {
    "Passive":      int(os.getenv("PASSIVE_DURATION",      "120")),
    "Deep Passive": int(os.getenv("DEEP_PASSIVE_DURATION", "600")),
    "Active":       int(os.getenv("ACTIVE_DURATION",       "300")),
}

# fake path if needed
FAKE_RESULTS_PATH = os.path.join(os.path.dirname(__file__), "fake_results.json")