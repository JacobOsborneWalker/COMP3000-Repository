## nodes - scanner health registry

from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity
from models import db, Node, NodeAlert, NodeError, ScanRequest, ScanResult, DetectedDevice, KnownDevice
from auth_middleware import require_roles
from datetime import datetime, timezone, timedelta


nodes_bp = Blueprint("nodes", __name__)


def _authenticate_node(node_uid: str):
    _UNAUTH = (None, (jsonify({"error": "invalid node credentials"}), 401))
    api_key = request.headers.get("X-API-Key", "")
    if not api_key:
        return _UNAUTH
    node = Node.query.filter_by(node_uid=node_uid).first()
    if not node or not node.check_api_key(api_key):
        return _UNAUTH
    return node, None


# registered scanners
@nodes_bp.route("/nodes", methods=["GET"])
@require_roles()
def get_nodes():
    nodes = Node.query.order_by(Node.site, Node.area).all()
    return jsonify([_node_summary(n) for n in nodes])


# register new scanner
@nodes_bp.route("/nodes", methods=["POST"])
@require_roles(["admin"])
def register_node():
    data = request.get_json()
    user_id = int(get_jwt_identity())

    site    = data.get("site", "").strip()
    area    = data.get("area", "").strip()
    network = data.get("network", "").strip()

    if not site or not area or not network:
        return jsonify({"error": "Site, area, and network are required"}), 400

    # generate node id
    last = Node.query.order_by(Node.id.desc()).first()
    next_num = (last.id + 1) if last else 1
    node_uid = f"SCAN{next_num:03d}"

    node = Node(
        node_uid    = node_uid,
        site        = site,
        area        = area,
        network     = network,
        status      = "unknown",
        added_by_id = user_id
    )
    db.session.add(node)
    db.session.commit()

    return jsonify({"message": "Scanner registered", "node_uid": node_uid, "id": node.id}), 201


# remove a scanner
@nodes_bp.route("/nodes/<int:node_id>", methods=["DELETE"])
@require_roles(["admin"])
def remove_node(node_id):
    node = Node.query.get_or_404(node_id)
    db.session.delete(node)
    db.session.commit()
    return jsonify({"message": "Scanner removed"})


# scanner details
@nodes_bp.route("/nodes/<int:node_id>/detail", methods=["GET"])
@require_roles()
def get_node_detail(node_id):
    node = Node.query.get_or_404(node_id)
    node_network = node.network  # decrypt once

    # filter in Python since network is encrypted
    all_requests = ScanRequest.query.order_by(ScanRequest.created_at.desc()).all()
    node_requests = [r for r in all_requests if r.network == node_network]

    recent_scans    = [r for r in node_requests if r.status == "approved"][:5]
    pending_scans   = [r for r in node_requests if r.status == "pending"]
    recent_errors   = node.errors[:5]

    return jsonify({
        "id":           node.id,
        "node_uid":     node.node_uid,
        "site":         node.site,
        "area":         node.area,
        "network":      node_network,
        "status":       node.status,
        "last_checkin": node.last_checkin.isoformat() if node.last_checkin else None,
        "alerts": [
            {"id": a.id, "message": a.message, "resolved": a.resolved,
             "created_at": a.created_at.isoformat()}
            for a in node.alerts if not a.resolved
        ],
        "recent_scans": [
            {
                "id":           s.id,
                "scan_type":    s.scan_type,
                "status":       s.status,
                "requested_by": s.requester.username,
                "approved_by":  s.approved_by.username if s.approved_by else None,
                "created_at":   s.created_at.isoformat(),
                "result_id":    s.results[0].id if s.results else None
            }
            for s in recent_scans
        ],
        "pending_scans": [
            {
                "id":           s.id,
                "scan_type":    s.scan_type,
                "status":       s.status,
                "requested_by": s.requester.username,
                "scheduled_at": s.scheduled_at.isoformat() if s.scheduled_at else None,
                "created_at":   s.created_at.isoformat()
            }
            for s in pending_scans
        ],
        "recent_errors": [
            {"message": e.message, "created_at": e.created_at.isoformat()}
            for e in recent_errors
        ]
    })


# pi poll endpoint
@nodes_bp.route("/nodes/<string:node_uid>/poll", methods=["GET"])
def poll_approved_scans(node_uid):
    node, err = _authenticate_node(node_uid)
    if err:
        return err

    all_approved = ScanRequest.query.filter_by(status="approved").all()
    waiting = [
        r for r in all_approved
        if node_uid in (r.node_uids or "").split(",")
        and not any(res.node_uid == node_uid for res in r.results)
    ]

    return jsonify({
        "scans": [
            {
                "id":          r.id,
                "scan_type":   r.scan_type,
                "node_label":  node_uid,
                "approved_by": r.approved_by.username if r.approved_by else None,
            }
            for r in waiting
        ]
    }), 200


# pi check in endpoint
@nodes_bp.route("/nodes/<string:node_uid>/checkin", methods=["POST"])
def node_checkin(node_uid):
    node, err = _authenticate_node(node_uid)
    if err:
        return err

    data = request.get_json() or {}
    node.status       = data.get("status", "online")
    node.last_checkin = datetime.now(timezone.utc)

    if data.get("error"):
        db.session.add(NodeError(node_id=node.id, message=data["error"]))
    if data.get("alert"):
        db.session.add(NodeAlert(node_id=node.id, message=data["alert"]))

    db.session.commit()
    return jsonify({"message": "Check-in received"})


# pi result submission endpoint
@nodes_bp.route("/nodes/<string:node_uid>/result", methods=["POST"])
def submit_node_result(node_uid):
    from models import ScanRequest, ScanResult, DetectedDevice, KnownDevice
    from datetime import datetime, timezone

    node, err = _authenticate_node(node_uid)
    if err:
        return err

    data = request.get_json() or {}
    req_id = data.get("scan_request_id")
    if not req_id:
        return jsonify({"error": "scan_request_id is required"}), 400

    scan_request = ScanRequest.query.get_or_404(req_id)
    if scan_request.status not in ("approved", "completed"):
        return jsonify({"error": "scan request is not approved"}), 400

    # prevent duplicate submission from the same node
    if any(res.node_uid == node_uid for res in scan_request.results):
        return jsonify({"error": "result already submitted for this node"}), 409

    detected    = data.get("devices", [])
    now         = datetime.now(timezone.utc)
    known_macs  = {d.mac.upper() for d in KnownDevice.query.all()}

    suspicious_count = sum(1 for d in detected if d.get("flags"))
    has_rogue        = any(d.get("flags") == "Rogue AP" for d in detected)
    total_deauth     = sum(d.get("deauth_count", 0) or 0 for d in detected)
    unknown_assoc    = sum(
        1 for d in detected
        if d.get("associated_bssid") and d["associated_bssid"].upper() not in known_macs
    )

    result = ScanResult(
        scan_request_id      = scan_request.id,
        node_uid             = data.get("node_uid", node_uid),
        node_label           = data.get("node_label"),
        total_devices        = len(detected),
        suspicious           = suspicious_count,
        rogue_ap             = has_rogue,
        bandwidth            = data.get("bandwidth", "Unknown"),
        total_deauth_frames  = total_deauth,
        unknown_associations = unknown_assoc,
        created_at           = now,
    )
    db.session.add(result)
    db.session.flush()

    for d in detected:
        def _parse_dt(val):
            if not val or val == "auto":
                return now
            try:
                return datetime.fromisoformat(val)
            except (ValueError, TypeError):
                return now

        time_first = _parse_dt(d.get("time_first_seen"))
        time_last  = _parse_dt(d.get("time_last_seen"))

        device = DetectedDevice(
            scan_result_id    = result.id,
            signal            = d.get("signal"),
            channel           = str(d.get("channel", "")),
            time_first_seen   = time_first,
            time_last_seen    = time_last,
            time_seen_seconds = d.get("time_seen_seconds") or max(int((time_last - time_first).total_seconds()), 0),
            flags             = d.get("flags", ""),
            frame_count       = d.get("frame_count"),
            signal_variance   = d.get("signal_variance"),
            beacon_interval   = d.get("beacon_interval"),
            probe_count       = d.get("probe_count") or 0,
            ssid_history      = ",".join(d["ssid_history"]) if d.get("ssid_history") else None,
            associated_bssid  = d.get("associated_bssid"),
            deauth_count      = d.get("deauth_count", 0),
        )
        device.mac    = d.get("mac", "").upper()
        device.vendor = d.get("vendor", "Unknown")
        db.session.add(device)

    db.session.commit()

    # mark complete once every assigned node has submitted
    expected  = [uid for uid in (scan_request.node_uids or "").split(",") if uid]
    submitted = [res.node_uid for res in scan_request.results]
    if expected and all(uid in submitted for uid in expected):
        scan_request.status = "completed"
        db.session.commit()

    return jsonify({"message": "Result saved", "id": result.id}), 201


# resolve alert
@nodes_bp.route("/nodes/alerts/<int:alert_id>/resolve", methods=["POST"])
@require_roles(["admin", "safeguard"])
def resolve_alert(alert_id):
    alert = NodeAlert.query.get_or_404(alert_id)
    alert.resolved = True
    db.session.commit()
    return jsonify({"message": "Alert resolved"})



_OFFLINE_THRESHOLD = timedelta(minutes=3)

def _node_summary(n):
    unresolved_alerts = [a for a in n.alerts if not a.resolved]

    if n.last_checkin is None:
        effective_status = "offline"
    else:
        last_checkin_utc = n.last_checkin.replace(tzinfo=timezone.utc)
        time_since = datetime.now(timezone.utc) - last_checkin_utc
        if time_since > _OFFLINE_THRESHOLD:
            effective_status = "offline"
        else:
            effective_status = n.status

    return {
        "id":           n.id,
        "node_uid":     n.node_uid,
        "site":         n.site,
        "area":         n.area,
        "network":      n.network,
        "status":       effective_status,
        "last_checkin": n.last_checkin.isoformat() if n.last_checkin else None,
        "alert_count":  len(unresolved_alerts),
        "alerts":       [{"id": a.id, "message": a.message} for a in unresolved_alerts]
    }