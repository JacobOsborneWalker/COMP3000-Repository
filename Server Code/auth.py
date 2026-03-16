## auth - handles login and JWT token creation

from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    get_jwt,
    get_jwt_identity,
)
from models import db, User, TokenBlocklist, AuditLog
from datetime import datetime, timezone

auth_bp = Blueprint("auth", __name__)


def _write_audit(action: str, user_id=None, detail: str = None):
    entry = AuditLog(
        user_id    = user_id,
        action     = action,
        ip_address = request.remote_addr,
        detail     = detail,
    )
    db.session.add(entry)
    db.session.commit()


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True)
    if not data or "username" not in data or "password" not in data:
        return jsonify({"error": "missing credentials"}), 400

    username = str(data["username"]).strip()
    password = str(data["password"])

    user = None
    for u in User.query.all():
        if u.username == username:
            user = u
            break

    # account lockout check
    if user and user.is_locked():
        _write_audit("login_blocked", user_id=user.id, detail="account locked")
        return jsonify({"error": "account temporarily locked. Try again soon"}), 403

    # password check
    if user and user.check_password(password):
        user.record_successful_login()
        db.session.commit()

        access_token = create_access_token(
            identity=str(user.id),
            additional_claims={"role": user.role}
        )
        _write_audit("login_success", user_id=user.id)
        return jsonify({"access_token": access_token, "role": user.role}), 200

    # failed login
    if user:
        user.record_failed_login()
        db.session.commit()

    _write_audit(
        "login_failure",
        user_id=user.id if user else None,
        detail=f"failed attempt for username input: {username[:30]}"
    )
    return jsonify({"error": "invalid username or password"}), 401


@auth_bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():

    jti     = get_jwt()["jti"]
    user_id = get_jwt_identity()

    blocked = TokenBlocklist(jti=jti)
    db.session.add(blocked)
    db.session.commit()

    _write_audit("logout", user_id=int(user_id))
    return jsonify({"message": "logged out successfully"}), 200


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    user_id = int(get_jwt_identity())
    user    = User.query.get_or_404(user_id)
    return jsonify(user.to_dict()), 200

## ahahahah i hope this works