## known devices - admin-managed known device registry

from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity
from models import db, KnownDevice
from auth_middleware import require_roles
import re

known_devices_bp = Blueprint("known_devices", __name__)

MAC_REGEX = re.compile(r"^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$")


@known_devices_bp.route("/known-devices", methods=["GET"])
@require_roles()
def get_known_devices():
    devices = KnownDevice.query.order_by(KnownDevice.added_at.desc()).all()
    return jsonify([
        {
            "id":       d.id,
            "mac":      d.mac,
            "label":    d.label,
            "added_by": d.added_by.username,
            "added_at": d.added_at.isoformat()
        }
        for d in devices
    ])


@known_devices_bp.route("/known-devices", methods=["POST"])
@require_roles(["admin"])
def add_known_device():
    data = request.get_json()
    mac   = data.get("mac", "").strip().upper()
    label = data.get("label", "").strip()

    if not mac or not label:
        return jsonify({"error": "MAC address and label are required"}), 400

    if not MAC_REGEX.match(mac):
        return jsonify({"error": "Invalid MAC address format"}), 400

    already_exists = any(d.mac.upper() == mac for d in KnownDevice.query.all())
    if already_exists:
        return jsonify({"error": "This MAC address is already registered"}), 409

    user_id = int(get_jwt_identity())
    device = KnownDevice(added_by_id=user_id)
    device.mac   = mac
    device.label = label
    db.session.add(device)
    db.session.commit()

    return jsonify({"message": "Device added", "id": device.id}), 201


@known_devices_bp.route("/known-devices/<int:device_id>", methods=["DELETE"])
@require_roles(["admin"])
def remove_known_device(device_id):
    device = KnownDevice.query.get_or_404(device_id)
    db.session.delete(device)
    db.session.commit()
    return jsonify({"message": "Device removed"})