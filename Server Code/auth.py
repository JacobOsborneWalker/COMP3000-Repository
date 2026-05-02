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

# change own password
@auth_bp.route("/change-password", methods=["POST"])
@jwt_required()
def change_password():
    from auth_middleware import get_current_user_id
    data = request.get_json(silent=True) or {}
    current_password = data.get("current_password", "")
    new_password     = data.get("new_password", "")

    if not current_password or not new_password:
        return jsonify({"error": "both fields are required"}), 400

    user = User.query.get_or_404(get_current_user_id())

    if not user.check_password(current_password):
        return jsonify({"error": "current password is incorrect"}), 403

    try:
        user.set_password(new_password)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    db.session.commit()
    _write_audit("password_change", user_id=user.id)
    return jsonify({"message": "password changed successfully"}), 200


# list all users (admin only)
@auth_bp.route("/users", methods=["GET"])
@jwt_required()
def list_users():
    from auth_middleware import get_current_role, get_current_user_id
    if get_current_role() != "admin":
        return jsonify({"error": "admin only"}), 403

    users = User.query.order_by(User.id).all()
    return jsonify([
        {
            "id":           u.id,
            "username":     u.username,
            "role":         u.role,
            "last_login":   u.last_login.isoformat() if u.last_login else None,
            "failed_logins": u.failed_logins or 0,
            "locked":       u.is_locked(),
            "created_at":   u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]), 200


# update a user's role (admin only)
@auth_bp.route("/users/<int:user_id>/role", methods=["PATCH"])
@jwt_required()
def update_user_role(user_id):
    from auth_middleware import get_current_role, get_current_user_id
    if get_current_role() != "admin":
        return jsonify({"error": "admin only"}), 403

    if get_current_user_id() == user_id:
        return jsonify({"error": "you cannot change your own role"}), 400

    data = request.get_json(silent=True) or {}
    new_role = data.get("role", "").strip()
    valid_roles = {"admin", "safeguard", "technician", "auditor"}
    if new_role not in valid_roles:
        return jsonify({"error": f"role must be one of: {', '.join(sorted(valid_roles))}"}), 400

    user = User.query.get_or_404(user_id)
    old_role = user.role
    user.role = new_role
    db.session.commit()
    _write_audit("role_change", user_id=get_current_user_id(),
                 detail=f"changed {user.username} from {old_role} to {new_role}")
    return jsonify({"message": f"Role updated to {new_role}"}), 200


# reset a user's password (admin only)
@auth_bp.route("/users/<int:user_id>/password", methods=["PATCH"])
@jwt_required()
def reset_user_password(user_id):
    from auth_middleware import get_current_role, get_current_user_id
    if get_current_role() != "admin":
        return jsonify({"error": "admin only"}), 403

    if get_current_user_id() == user_id:
        return jsonify({"error": "use the standard password change flow for your own account"}), 400

    data = request.get_json(silent=True) or {}
    new_password = data.get("password", "")
    try:
        user = User.query.get_or_404(user_id)
        user.set_password(new_password)
        db.session.commit()
        _write_audit("password_reset", user_id=get_current_user_id(),
                     detail=f"reset password for user {user.username}")
        return jsonify({"message": "Password reset successfully"}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


# unlock a locked account (admin only)
@auth_bp.route("/users/<int:user_id>/unlock", methods=["POST"])
@jwt_required()
def unlock_user(user_id):
    from auth_middleware import get_current_role, get_current_user_id
    if get_current_role() != "admin":
        return jsonify({"error": "admin only"}), 403

    user = User.query.get_or_404(user_id)
    user.failed_logins = 0
    user.locked_until  = None
    db.session.commit()
    _write_audit("account_unlock", user_id=get_current_user_id(),
                 detail=f"unlocked account for {user.username}")
    return jsonify({"message": "Account unlocked"}), 200