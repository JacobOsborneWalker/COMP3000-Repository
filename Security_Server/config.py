## config file - stores environment variables

import os
from dotenv import load_dotenv

load_dotenv()

basedir = os.path.abspath(os.path.dirname(__file__))

class Config:
    # --- Server ---
    SERVER_IP = os.getenv("SERVER_IP", "10.137.45.9")
    SERVER_PORT = int(os.getenv("SERVER_PORT", 5000))

    # --- Database ---
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        "sqlite:///" + os.path.join(basedir, "mockdb.sqlite")
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # --- Auth ---
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret")