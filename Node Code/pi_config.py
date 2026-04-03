# pi config - configuration for the scanners


## need to update when fix server
import os

SERVER_URL =  os.getenv("SERVER_URL", "put here when server working")
SCANNER_UID = os.getenv("SCANNER_UID", "SCAN-001")
API_KEY = os.getenv("API_KEY", "put the key here when i seed the db again")
CHECKIN_INTERVALS = int(os.getenv("CHECKIN_INTERVALS", "60"))
POLL_INTERVALS = int(os.getenv("POLL_INTERVALS", "30"))
RESULTS_PATH = os.path.join(os.path.dirname(__file__), "faake_results.json")