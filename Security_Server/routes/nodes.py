## nodes - node health registry

from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity
from models import db, Node, NodeAlert, NodeError, ScanRequest
from auth_middleware import require_roles
from datetime import datetime

nodes_bp = Blueprint("nodes", __name__)


# registered nodes
@nodes_bp.route("/nodes", methods=["GET"])
@require_roles()
def get_nodes():
    nodes = Node.query.order_by(Node.location).all()
    return jsonify([_node_summary(n) for n in nodes])


# create new node
@nodes_bp.route("/nodes", methods=["POST"])
@require_roles(["admin"])
def register_node():
    data = request.get_json()
    user_id = int(get_jwt_identity())

    location = data.get("location", "").strip()
    network  = data.get("network", "").strip()

    if not location or not network:
        return jsonify({"error": "Location and network are required"}), 400

    # generate node id
    last = Node.query.order_by(Node.id.desc()).first()
    next_num = (last.id + 1) if last else 1
    node_uid = f"NODE-{next_num:03d}"

    node = Node(
        node_uid    = node_uid,
        location    = location,
        network     = network,
        status      = "unknown",
        added_by_id = user_id
    )
    db.session.add(node)
    db.session.commit()

    return jsonify({"message": "Node registered", "node_uid": node_uid, "id": node.id}), 201


# remove a node
@nodes_bp.route("/nodes/<int:node_id>", methods=["DELETE"])
@require_roles(["admin"])
def remove_node(node_id):
    node = Node.query.get_or_404(node_id)
    db.session.delete(node)
    db.session.commit()
    return jsonify({"message": "Node removed"})


# node details
@nodes_bp.route("/nodes/<int:node_id>/detail", methods=["GET"])
@require_roles()
def get_node_detail(node_id):
    node = Node.query.get_or_404(node_id)

    # Recent scans on this node's network (approved, most recent 5)
    recent_scans = ScanRequest.query.filter_by(
        network=node.network, status="approved"
    ).order_by(ScanRequest.created_at.desc()).limit(5).all()

    # Scheduled scans on this network (pending with a scheduled_at)
    scheduled_scans = ScanRequest.query.filter_by(
        network=node.network, status="pending"
    ).filter(ScanRequest.scheduled_at != None).order_by(
        ScanRequest.scheduled_at.asc()
    ).all()

    # Recent errors (last 5)
    recent_errors = node.errors[:5]

    return jsonify({
        "id":          node.id,
        "node_uid":    node.node_uid,
        "location":    node.location,
        "network":     node.network,
        "status":      node.status,
        "last_checkin": node.last_checkin.isoformat() if node.last_checkin else None,
        "alerts": [
            {"id": a.id, "message": a.message, "resolved": a.resolved,
             "created_at": a.created_at.isoformat()}
            for a in node.alerts if not a.resolved
        ],
        "recent_scans": [
            {"id": s.id, "scan_type": s.scan_type,
             "created_at": s.created_at.isoformat()}
            for s in recent_scans
        ],
        "scheduled_scans": [
            {"id": s.id, "scan_type": s.scan_type,
             "scheduled_at": s.scheduled_at.isoformat()}
            for s in scheduled_scans
        ],
        "recent_errors": [
            {"message": e.message, "created_at": e.created_at.isoformat()}
            for e in recent_errors
        ]
    })


# --- Pi check-in endpoint (called by the Pi itself to report status) ---
@nodes_bp.route("/nodes/<string:node_uid>/checkin", methods=["POST"])
def node_checkin(node_uid):
    node = Node.query.filter_by(node_uid=node_uid).first_or_404()
    data = request.get_json() or {}

    node.status      = data.get("status", "online")
    node.last_checkin = datetime.utcnow()

    # If Pi reports an error, log it
    if data.get("error"):
        err = NodeError(node_id=node.id, message=data["error"])
        db.session.add(err)

    # If Pi reports an alert, log it
    if data.get("alert"):
        alert = NodeAlert(node_id=node.id, message=data["alert"])
        db.session.add(alert)

    db.session.commit()
    return jsonify({"message": "Check-in received"})


# --- Resolve an alert (admin/safeguard) ---
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
        "location":     n.location,
        "network":      n.network,
        "status":       n.status,
        "last_checkin": n.last_checkin.isoformat() if n.last_checkin else None,
        "alert_count":  len(unresolved_alerts),
        "alerts":       [{"id": a.id, "message": a.message} for a in unresolved_alerts]
    }