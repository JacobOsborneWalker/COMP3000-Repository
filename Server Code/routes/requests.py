##requests - scan request creation, listing, approval and decline

import json
import random
import os
from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity
from models import db, User, ScanRequest, ScanResult, DetectedDevice, KnownDevice
from auth_middleware import require_roles
from datetime import datetime

requests_bp = Blueprint("requests", __name__)

# current results stand in for Pi
RESULTS_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "Node Code", "results.json")


def _load_results():
    with open(RESULTS_PATH, "r") as f:
        return json.load(f)


def _verify_password(user_id: int, password: str) -> bool:
    user = User.query.get(user_id)
    if not user:
        return False
    return user.check_password(password)


def _generate_result(scan_request, node_uid=None, node_label=None):
    """Generate one ScanResult for a single node."""
    pool = _load_results()
    matching = [t for t in pool if t.get("scan_type") == scan_request.scan_type]
    template = random.choice(matching if matching else pool)
    now = datetime.utcnow()

    suspicious_count = sum(1 for d in template["devices"] if d.get("flags", "") != "")
    has_rogue = any(d.get("flags") == "Rogue AP" for d in template["devices"])

    result = ScanResult(
        scan_request_id = scan_request.id,
        node_uid        = node_uid,
        node_label      = node_label,
        total_devices   = len(template["devices"]),
        suspicious      = suspicious_count,
        rogue_ap        = has_rogue,
        bandwidth       = template["bandwidth"],
        created_at      = now
    )
    db.session.add(result)
    db.session.flush()

    known_macs    = {kd.mac.upper() for kd in KnownDevice.query.all()}
    total_deauth  = 0
    unknown_assoc = 0

    for d in template["devices"]:
        deauth = d.get("deauth_count", 0) or 0
        total_deauth += deauth
        assoc = d.get("associated_bssid")
        if assoc and assoc.upper() not in known_macs:
            unknown_assoc += 1

        device = DetectedDevice(
            scan_result_id   = result.id,
            signal           = d["signal"],
            channel          = str(d["channel"]),
            time_seen        = now,
            first_seen       = now,
            last_seen        = now,
            flags            = d.get("flags", ""),
            frame_count      = d.get("frame_count"),
            signal_variance  = d.get("signal_variance"),
            beacon_interval  = d.get("beacon_interval"),
            probe_ssids      = ",".join(d["probe_ssids"]) if d.get("probe_ssids") else None,
            ssid_history     = ",".join(d["ssid_history"]) if d.get("ssid_history") else None,
            associated_bssid = d.get("associated_bssid"),
            deauth_count     = deauth,
        )
        device.mac    = d["mac"].upper()
        device.vendor = d["vendor"]
        db.session.add(device)

    result.total_deauth_frames  = total_deauth
    result.unknown_associations = unknown_assoc
    return result


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

    # generate one result per node stored on the request
    node_uids   = scan_request.node_uids.split(",")   if scan_request.node_uids   else [None]
    node_labels = scan_request.node_labels.split("|") if scan_request.node_labels else [None]

    result_ids = []
    for i, uid in enumerate(node_uids):
        label  = node_labels[i] if i < len(node_labels) else uid
        result = _generate_result(scan_request, node_uid=uid, node_label=label)
        result_ids.append(result.id)

    db.session.commit()
    return jsonify({"message": f"Request {req_id} approved", "result_ids": result_ids})


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