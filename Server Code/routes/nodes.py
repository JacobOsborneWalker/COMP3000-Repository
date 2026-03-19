## nodes - scanner health registry

from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity
from models import db, Node, NodeAlert, NodeError, ScanRequest
from auth_middleware import require_roles
from datetime import datetime

nodes_bp = Blueprint("nodes", __name__)


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


# pi check in endpoint
@nodes_bp.route("/nodes/<string:node_uid>/checkin", methods=["POST"])
def node_checkin(node_uid):
    node = Node.query.filter_by(node_uid=node_uid).first_or_404()
    data = request.get_json() or {}

    node.status      = data.get("status", "online")
    node.last_checkin = datetime.utcnow()

    # report error
    if data.get("error"):
        err = NodeError(node_id=node.id, message=data["error"])
        db.session.add(err)

    # report alert
    if data.get("alert"):
        alert = NodeAlert(node_id=node.id, message=data["alert"])
        db.session.add(alert)

    db.session.commit()
    return jsonify({"message": "Check-in received"})


# resolve alert
@nodes_bp.route("/nodes/alerts/<int:alert_id>/resolve", methods=["POST"])
@require_roles(["admin", "safeguard"])
def resolve_alert(alert_id):
    alert = NodeAlert.query.get_or_404(alert_id)
    alert.resolved = True
    db.session.commit()
    return jsonify({"message": "Alert resolved"})


def _node_summary(n):
    unresolved_alerts = [a for a in n.alerts if not a.resolved]
    return {
        "id":           n.id,
        "node_uid":     n.node_uid,
        "site":         n.site,
        "area":         n.area,
        "network":      n.network,
        "status":       n.status,
        "last_checkin": n.last_checkin.isoformat() if n.last_checkin else None,
        "alert_count":  len(unresolved_alerts),
        "alerts":       [{"id": a.id, "message": a.message} for a in unresolved_alerts]
    }