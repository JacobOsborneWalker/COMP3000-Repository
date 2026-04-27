##requests - scan request creation, listing, approval and decline

from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity
from models import db, User, ScanRequest
from auth_middleware import require_roles
from datetime import datetime

requests_bp = Blueprint("requests", __name__)


def _verify_password(user_id: int, password: str) -> bool:
    user = User.query.get(user_id)
    if not user:
        return False
    return user.check_password(password)

# create scan request
@requests_bp.route("/requests", methods=["POST"])
@require_roles(["technician", "admin"])
def create_request():
    data    = request.get_json()
    user_id = int(get_jwt_identity())

    scan_type   = data.get("scan_type", "")
    notes       = data.get("notes", "").strip()
    password    = data.get("password", "")
    node_uids   = data.get("node_uids", [])    
    node_labels = data.get("node_labels", [])  
    networks    = data.get("networks", [])     

    if isinstance(node_uids, str):   node_uids   = [node_uids]
    if isinstance(node_labels, str): node_labels = [node_labels]
    if isinstance(networks, str):    networks    = [networks]

    if not networks and data.get("network"):
        networks = [data.get("network")]

    if not networks or not scan_type:
        return jsonify({"error": "At least one node and a scan type are required"}), 400

    if scan_type == "Active" and not notes:
        return jsonify({"error": "A justification is required for Active scans"}), 400

    if scan_type == "Active":
        if not password:
            return jsonify({"error": "Password confirmation is required for Active scans"}), 400
        if not _verify_password(user_id, password):
            return jsonify({"error": "Incorrect password"}), 403

    scheduled_at = None
    if data.get("scheduled_at"):
        try:
            scheduled_at = datetime.fromisoformat(data["scheduled_at"])
        except ValueError:
            return jsonify({"error": "Invalid date format"}), 400

    new_request = ScanRequest(
        scan_type    = scan_type,
        scheduled_at = scheduled_at,
        requester_id = user_id,
        status       = "pending",
        node_uids    = ",".join(node_uids)   if node_uids   else None,
        node_labels  = "|".join(node_labels) if node_labels else None,
    )
    new_request.network = networks[0] if networks else ""
    new_request.notes   = notes or None
    db.session.add(new_request)
    db.session.commit()

    return jsonify({"message": "Scan request submitted", "id": new_request.id}), 201


# get all requests
@requests_bp.route("/requests", methods=["GET"])
@require_roles()
def get_requests():
    scan_requests = ScanRequest.query.order_by(ScanRequest.created_at.desc()).all()
    return jsonify([
        {
            "id":           r.id,
            "network":      r.network,
            "scan_type":    r.scan_type,
            "notes":        r.notes,
            "status":       r.status,
            "scheduled_at": r.scheduled_at.isoformat() if r.scheduled_at else None,
            "created_at":   r.created_at.isoformat(),
            "requested_by": r.requester.username,
            "approved_by":  r.approved_by.username if r.approved_by else None,
            "result_ids":   [res.id for res in r.results],
            "node_uids":    r.node_uids.split(",")  if r.node_uids   else [],
            "node_labels":  r.node_labels.split("|") if r.node_labels else [],
        }
        for r in scan_requests
    ])


# approve requests
@requests_bp.route("/requests/<int:req_id>/approve", methods=["POST"])
@require_roles(["admin", "safeguard"])
def approve_request(req_id):
    data    = request.get_json() or {}
    user_id = int(get_jwt_identity())

    scan_request = ScanRequest.query.get_or_404(req_id)

    if scan_request.status != "pending":
        return jsonify({"error": "request is not pending"}), 400

    if scan_request.requester_id == user_id:
        return jsonify({"error": "you cannot authorise this request"}), 403

    if scan_request.scan_type == "Active":
        password = data.get("password", "")
        if not password:
            return jsonify({"error": "Password confirmation is required to approve an Active scan"}), 400
        if not _verify_password(user_id, password):
            return jsonify({"error": "Incorrect password"}), 403

    scan_request.status         = "approved"
    scan_request.approved_by_id = user_id
    db.session.commit()

    # the scanner will poll for this request and submit results when complete
    return jsonify({"message": f"Request {req_id} approved"})


# decline requests
@requests_bp.route("/requests/<int:req_id>/decline", methods=["POST"])
@require_roles(["admin", "safeguard"])
def decline_request(req_id):
    user_id      = int(get_jwt_identity())
    scan_request = ScanRequest.query.get_or_404(req_id)

    if scan_request.status != "pending":
        return jsonify({"error": "request is not pending"}), 400

    if scan_request.requester_id == user_id:
        return jsonify({"error": "You cannot decline this request"}), 403

    scan_request.status         = "declined"
    scan_request.approved_by_id = user_id
    db.session.commit()
    return jsonify({"message": f"Request {req_id} declined"})

# cancel requests
@requests_bp.route("/requests/<int:req_id>/cancel", methods=["POST"])
@require_roles()
def cancel_request(req_id):
    user_id      = int(get_jwt_identity())
    scan_request = ScanRequest.query.get_or_404(req_id)

    if scan_request.requester_id != user_id:
        return jsonify({"error": "you can only cancel your own requests"}), 403

    if scan_request.status != "pending":
        return jsonify({"error": "only pending requests can be cancelled"}), 400

    scan_request.status = "cancelled"
    db.session.commit()
    return jsonify({"message": f"Request {req_id} cancelled"})