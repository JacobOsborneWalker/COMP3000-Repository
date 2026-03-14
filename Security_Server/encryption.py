
# encryption.py

import os
import base64
import logging
from cryptography.fernet import Fernet, InvalidToken

log = logging.getLogger(__name__)

# load key

def _load_key() -> Fernet:
    
    raw = os.getenv("FIELD_ENCRYPTION_KEY")
    if not raw:
        raise EnvironmentError(
            "field encryption key not set"
        )
    try:
        return Fernet(raw.encode())
    except Exception:
        raise ValueError("feeld encryption key is not valid")


# initialise
try:
    _fernet = _load_key()
except EnvironmentError as e:
    log.warning("Encryption not ready")
    _fernet = None


# public api

def encrypt(value: str | None) -> str | None:
    if value is None:
        return None
    if _fernet is None:
        raise RuntimeError("encryption key not loaded")
    return _fernet.encrypt(value.encode()).decode()


def decrypt(value: str | None) -> str | None:
    if value is None:
        return None
    if _fernet is None:
        raise RuntimeError("encryption key not loaded")
    try:
        return _fernet.decrypt(value.encode()).decode()
    except InvalidToken:
        log.warning("could not decrypt value")
        return value


def encrypt_if_changed(new_value: str | None, existing_encrypted: str | None) -> str | None:

    if new_value is None:
        return None
    if existing_encrypted is not None:
        current = decrypt(existing_encrypted)
        if current == new_value:
            return existing_encrypted  
    return encrypt(new_value)