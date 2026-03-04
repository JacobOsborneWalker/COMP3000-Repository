##requests - scan request creation, listing, approval and decline

import json
import random
import os
from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity
from models import db, ScanRequest, ScanResult, DetectedDevice
from auth_middleware import require_roles
from datetime import datetime

requests_bp = Blueprint("requests", __name__)

# current results stand in for Pi
FAKE_RESULTS_PATH = os.path.join(os.path.dirname(__file__), "..", "fake_results.json")


def _load_fake_results():
    with open(FAKE_RESULTS_PATH, "r") as f:
        return json.load(f)


# generate results 
def _generate_result(scan_request):
    """Pick a random result template and save it to the DB."""
    pool = _load_fake_results()
    template = random.choice(pool)
    now = datetime.utcnow()

    suspicious_count = sum(1 for d in template["devices"] if d.get("flags", "") != "")
    has_rogue = any(d.get("flags") == "Rogue AP" for d in template["devices"])

    result = ScanResult(
        scan_request_id = scan_request.id,
        total_devices   = len(template["devices"]),
        suspicious      = suspicious_count,
        rogue_ap        = has_rogue,
        bandwidth       = template["bandwidth"],
        created_at      = now
    )
    db.session.add(result)
    db.session.flush()  

    for d in template["devices"]:
        device = DetectedDevice(
            scan_result_id = result.id,
            mac            = d["mac"].upper(),
            vendor         = d["vendor"],
            signal         = d["signal"],
            channel        = d["channel"],
            time_seen      = now,
            flags          = d.get("flags", "")
        )
        db.session.add(device)

    return result


# create new scan 
@requests_bp.route("/requests", methods=["POST"])
@require_roles(["staff", "admin"])
def create_request():
    data = request.get_json()
    user_id = int(get_jwt_identity())

    scheduled_at = None
    if data.get("scheduled_at"):
        try:
            scheduled_at = datetime.fromisoformat(data["scheduled_at"])
        except ValueError:
            return jsonify({"error": "Invalid date format"}), 400
        

    # new scan type
    new_request = ScanRequest(
        network      = data.get("network", ""),
        scan_type    = data.get("scan_type", ""),
        notes        = data.get("notes", ""),
        scheduled_at = scheduled_at,
        requester_id = user_id,
        status       = "pending"
    )
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
            "approved_by":  r.approver.username if r.approver else None,
            "result_id":    r.result.id if r.result else None
        }
        for r in scan_requests
    ])


# approve requests
@requests_bp.route("/requests/<int:req_id>/approve", methods=["POST"])
@require_roles(["admin", "safeguard"])
def approve_request(req_id):
    user_id = int(get_jwt_identity())
    scan_request = ScanRequest.query.get_or_404(req_id)

    if scan_request.status != "pending":
        return jsonify({"error": "Request is not pending"}), 400

    scan_request.status         = "approved"
    scan_request.approved_by_id = user_id

    result = _generate_result(scan_request)
    db.session.commit()

    return jsonify({"message": f"Request {req_id} approved", "result_id": result.id})


# decline requests 
@requests_bp.route("/requests/<int:req_id>/decline", methods=["POST"])
@require_roles(["admin", "safeguard"])
def decline_request(req_id):
    user_id = int(get_jwt_identity())
    scan_request = ScanRequest.query.get_or_404(req_id)

    if scan_request.status != "pending":
        return jsonify({"error": "Request is not pending"}), 400

    scan_request.status         = "declined"
    scan_request.approved_by_id = user_id
    db.session.commit()

    return jsonify({"message": f"Request {req_id} declined"})