## handles scan request

from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity
from models import db, ScanRequest, User
from auth_middleware import require_roles

requests_bp = Blueprint("requests", __name__)

@requests_bp.route("/requests", methods=["POST"])
@require_roles(["staff", "admin"])
def create_request():
    data = request.json
    user_id = get_jwt_identity()

    user = User.query.get(user_id)

    new_request = ScanRequest(
        title=data["title"],
        description=data.get("description"),
        requester_id=user.id
    )

    db.session.add(new_request)
    db.session.commit()

    return jsonify({"message": "Scan request submitted"}), 201


@requests_bp.route("/requests", methods=["GET"])
@require_roles()
def get_requests():
    requests = ScanRequest.query.all()

    return jsonify([
        {
            "id": r.id,
            "title": r.title,
            "status": r.status,
            "requested_by": r.requester.username
        }
        for r in requests
    ])
