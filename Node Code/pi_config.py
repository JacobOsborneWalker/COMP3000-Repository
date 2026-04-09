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