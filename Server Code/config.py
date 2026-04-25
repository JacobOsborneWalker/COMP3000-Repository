## config file - stores environment variables

import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

def _require(key: str) -> str:
    value = os.getenv(key)
    if not value:
        raise EnvironmentError(
            "required environment variable"
        )
    return value


basedir = os.path.abspath(os.path.dirname(__file__))


class Config:
    # database
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        "sqlite:///" + os.path.join(basedir, "mockdb.sqlite")
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # secrets
    SECRET_KEY     = _require("SECRET_KEY")
    JWT_SECRET_KEY = _require("JWT_SECRET_KEY")

    # JWT hardening
    _expiry_minutes = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES", "30"))
    JWT_ACCESS_TOKEN_EXPIRES  = timedelta(minutes=_expiry_minutes)
    JWT_TOKEN_LOCATION         = ["headers"]
    JWT_HEADER_NAME            = "Authorisation"
    JWT_HEADER_TYPE            = "Bearer"

    # reject tokens
    JWT_ALGORITHM              = "HS256"
    JWT_DECODE_ALGORITHMS      = ["HS256"]

    # rate limiting
    RATELIMIT_DEFAULT          = os.getenv("RATE_LIMIT", "10") + " per minute"
    RATELIMIT_STORAGE_URL      = "memory://"
    RATELIMIT_STRATEGY         = "fixed-window"

    # security header
    TALISMAN_CONFIG = {
        "force_https": False,            
        "strict_transport_security": True,
        "strict_transport_security_max_age": 31536000,
        "content_security_policy": {
            "default-src": "'self'",
            "script-src":  "'self' 'unsafe-inline'",  
            "style-src":   "'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src":    "'self' https://fonts.gstatic.com",
            "img-src":     "'self' data:",
            "connect-src": "'self'",
        },
        "referrer_policy": "strict-origin-when-cross-origin",
        "content_security_policy_nonce_in": [],
        "frame_options": "DENY",         
        "force_file_save": False,
    }

    # session cookies
    SESSION_COOKIE_HTTPONLY  = True
    SESSION_COOKIE_SAMESITE  = "Lax"
    SESSION_COOKIE_SECURE    = False