# pi config - configuration for the scanners


## need to update when fix server
import os

SERVER_URL =  os.getenv("SERVER_URL", "https://unevaporated-conner-gewgawed.ngrok-free.dev")
SCANNER_UID = os.getenv("SCANNER_UID", "SCAN-001")
API_KEY = os.getenv("API_KEY", "56cdc2286309de6d338dfc22136a9cc2ea918321c43034697b8db9ba534c9bad")
CHECKIN_INTERVAL = int(os.getenv("CHECKIN_INTERVAL", "60"))
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "30"))
FAKE_RESULTS_PATH = os.path.join(os.path.dirname(__file__), "fake_results.json")