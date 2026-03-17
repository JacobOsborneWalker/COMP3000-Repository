## results page - scan results and detected devices

from flask import Blueprint, request, jsonify
from models import db, ScanResult, DetectedDevice, KnownDevice, ScanRequest
from auth_middleware import require_roles
from datetime import datetime

results_bp = Blueprint("results", __name__)


@results_bp.route("/results", methods=["GET"])
@require_roles()
def get_results():
    results = ScanResult.query.order_by(ScanResult.created_at.desc()).all()
    return jsonify([
        {
            "id":              r.id,
            "scan_request_id": r.scan_request_id,
            "network":         r.scan_request.network,
            "scan_type":       r.scan_request.scan_type,
            "requested_by":    r.scan_request.requester.username,
            "approved_by":     r.scan_request.approved_by.username if r.scan_request.approved_by else None,
            "total_devices":   r.total_devices,
            "suspicious":      r.suspicious,
            "rogue_ap":        r.rogue_ap,
            "bandwidth":       r.bandwidth,
            "created_at":      r.created_at.isoformat()
        }
        for r in results
    ])


@results_bp.route("/results/<int:result_id>", methods=["GET"])
@require_roles()
def get_result_detail(result_id):
    r = ScanResult.query.get_or_404(result_id)

    
    known_macs = {d.mac.upper(): d.label for d in KnownDevice.query.all()}

    devices = []
    for d in r.devices:
        mac_upper = d.mac.upper()
        devices.append({
            "mac":              d.mac,
            "vendor":           d.vendor,
            "signal":           d.signal,
            "channel":          d.channel,
            "time_seen":        d.time_seen.isoformat() if d.time_seen else None,
            "first_seen":       d.first_seen.isoformat() if d.first_seen else None,
            "last_seen":        d.last_seen.isoformat() if d.last_seen else None,
            "flags":            d.flags,
            "frame_count":      d.frame_count,
            "signal_variance":  d.signal_variance,
            "beacon_interval":  d.beacon_interval,
            "probe_ssids":      d.probe_ssids.split(",") if d.probe_ssids else [],
            "ssid_history":     d.ssid_history.split(",") if d.ssid_history else [],
            "associated_bssid": d.associated_bssid,
            "deauth_count":     d.deauth_count,
            "known":            mac_upper in known_macs,
            "label":            known_macs.get(mac_upper, None)
        })

    return jsonify({
        "metadata": {
            "id":           r.id,
            "network":      r.scan_request.network,
            "scan_type":    r.scan_request.scan_type,
            "requested_by": r.scan_request.requester.username,
            "approved_by":  r.scan_request.approved_by.username if r.scan_request.approved_by else None,
            "created_at":   r.created_at.isoformat()
        },
        "devices": devices,
        "summary": {
            "total_devices":        r.total_devices,
            "suspicious":           r.suspicious,
            "rogue_ap":             r.rogue_ap,
            "bandwidth":            r.bandwidth,
            "total_deauth_frames":  r.total_deauth_frames,
            "unknown_associations": r.unknown_associations
        }
    })


@results_bp.route("/results", methods=["POST"])
@require_roles(["admin"])
def submit_result():
    data = request.get_json()

    scan_request = ScanRequest.query.get_or_404(data["scan_request_id"])

    known_macs = {d.mac.upper() for d in KnownDevice.query.all()}

    detected = data.get("devices", [])
    suspicious_count = sum(1 for d in detected if d.get("flags") and d["flags"] != "")

    result = ScanResult(
        scan_request_id = scan_request.id,
        total_devices   = len(detected),
        suspicious      = suspicious_count,
        rogue_ap        = any(d.get("flags") == "Rogue AP" for d in detected),
        bandwidth       = data.get("bandwidth", "Unknown")
    )

    db.session.add(result)
    db.session.flush()  

    for d in detected:
        time_seen = None
        if d.get("time_seen"):
            try:
                time_seen = datetime.fromisoformat(d["time_seen"])
            except ValueError:
                pass

        device = DetectedDevice(
            scan_result_id = result.id,
            mac            = d.get("mac", "").upper(),
            vendor         = d.get("vendor", "Unknown"),
            signal         = d.get("signal"),
            channel        = d.get("channel"),
            time_seen      = time_seen,
            flags          = d.get("flags", "")
        )
        db.session.add(device)

    db.session.commit()

    return jsonify({"message": "Result saved", "id": result.id}), 201