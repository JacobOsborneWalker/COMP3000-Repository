
## auth_middleware - controls access to routes


from functools import wraps
from flask import jsonify, request
from flask_jwt_extended import verify_jwt_in_request, get_jwt, get_jwt_identity
from models import db, TokenBlocklist, AuditLog


# blocklist checkk
def _is_revoked(jti: str) -> bool:
    return db.session.query(
        TokenBlocklist.query.filter_by(jti=jti).exists()
    ).scalar()



# audit helper
def audit(action: str, target: str = None, detail: str = None, user_id: int = None):
    entry = AuditLog(
        user_id    = user_id,
        action     = action,
        target     = target,
        detail     = detail,
        ip_address = request.remote_addr,
    )
    db.session.add(entry)


# role decorator
def require_roles(allowed_roles: list = None):

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()

            # nlocklist check
            if _is_revoked(claims["jti"]):
                return jsonify({"error": "token has been revoked"}), 401

            role = claims.get("role")

            if allowed_roles and role not in allowed_roles:
                return jsonify({"error": "no valid permission for this"}), 403

            return fn(*args, **kwargs)
        return wrapper
    return decorator


def get_current_user_id() -> int:
    return int(get_jwt_identity())


def get_current_role() -> str:
    return get_jwt().get("role")