# pi config - configuration for the scanners
import os

SERVER_URL = os.getenv("SERVER_URL", "https://unevaporated-conner-gewgawed.ngrok-free.dev")

## scanners
SCANNER_UID = os.getenv("SCANNER_UID", "SCAN-001")
#SCANNER_UID = os.getenv("SCANNER_UID", "SCAN-002")
#SCANNER_UID = os.getenv("SCANNER_UID", "SCAN-003")
#SCANNER_UID = os.getenv("SCANNER_UID", "SCAN-004")


## api key

API_KEY = os.getenv("API_KEY", " 02501de7f0273aace614fad85b09b47bd8dbff92e00e565e236862072f000595")
# Pi-A: 4ab670952e380500a2c5ee04b3008e7ab7680ceb369771e1db935d427a86878c
# Pi-B: 4f6859e9e0119313a71d04c4487561d40f088ef3aa2bc40ddeda7bc5acc499c5
#Pi-C: 0b93b91c3ac8a884aed47b6cd8af5a404b1b0db8cde5da393938223ec1e617c3


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