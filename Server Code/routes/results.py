## results page - scan results and detected devices

from flask import Blueprint, request, jsonify
from models import db, ScanResult, DetectedDevice, KnownDevice, ScanRequest
from auth_middleware import require_roles
from datetime import datetime

results_bp = Blueprint("results", __name__)


@results_bp.route("/results", methods=["GET"])
@require_roles()
def get_results():
    requests = ScanRequest.query.filter(
        ScanRequest.status.in_(["approved", "completed"])
    ).order_by(ScanRequest.created_at.desc()).all()

    return jsonify([
        {
            "id":           req.id,
            "network":      req.network,
            "scan_type":    req.scan_type,
            "requested_by": req.requester.username,
            "approved_by":  req.approved_by.username if req.approved_by else None,
            "created_at":   req.results[0].created_at.isoformat() if req.results else req.created_at.isoformat(),
            "node_labels":  req.node_labels.split("|") if req.node_labels else [],
            "node_count":   len(req.results),
            "result_ids":   [r.id for r in req.results],
        }
        for req in requests if req.results
    ])


@results_bp.route("/results/<int:result_id>", methods=["GET"])
@require_roles()
def get_result_detail(result_id):
    r = ScanResult.query.get_or_404(result_id)

    known_macs    = {d.mac.upper(): d.label for d in KnownDevice.query.all()}
    known_mac_set = set(known_macs.keys())

    devices = []
    for d in r.devices:
        mac_upper = d.mac.upper()
        devices.append({
            "mac":               d.mac,
            "vendor":            d.vendor,
            "signal":            d.signal,
            "channel":           d.channel,
            # new field names matching models.py
            "time_first_seen":   d.time_first_seen.isoformat()  if d.time_first_seen  else None,
            "time_last_seen":    d.time_last_seen.isoformat()   if d.time_last_seen   else None,
            "time_seen_seconds": d.time_seen_seconds,
            "flags":             d.flags,
            "frame_count":       d.frame_count,
            "signal_variance":   d.signal_variance,
            "beacon_interval":   d.beacon_interval,
            # probe_ssids no longer stored (UK GDPR) — count only
            "probe_count":       d.probe_count or 0,
            "ssid_history":      d.ssid_history.split(",") if d.ssid_history else [],
            "associated_bssid":  d.associated_bssid,
            "deauth_count":      d.deauth_count,
            "known":             mac_upper in known_mac_set,
            "label":             known_macs.get(mac_upper, None),
        })

    # recalculate summary figures live so they always reflect the current
    # known devices list rather than the values stored at scan time.
    live_suspicious = sum(
        1 for d in devices
        if d.get("flags")
        and d["mac"].upper() not in known_mac_set
    )
    live_rogue_ap = any(
        d.get("flags") == "Rogue AP"
        and d["mac"].upper() not in known_mac_set
        for d in devices
    )
    live_total_deauth = sum(
        d.get("deauth_count") or 0
        for d in devices
        if d["mac"].upper() not in known_mac_set
    )
    live_unknown_assoc = sum(
        1 for d in devices
        if d.get("associated_bssid")
        and d["associated_bssid"].upper() not in known_mac_set
        and d["mac"].upper() not in known_mac_set
    )

    return jsonify({
        "metadata": {
            "id":           r.id,
            "node_uid":     r.node_uid,
            "node_label":   r.node_label,
            "network":      r.scan_request.network,
            "scan_type":    r.scan_request.scan_type,
            "requested_by": r.scan_request.requester.username,
            "approved_by":  r.scan_request.approved_by.username if r.scan_request.approved_by else None,
            "created_at":   r.created_at.isoformat(),
        },
        "devices": devices,
        "summary": {
            "total_devices":        r.total_devices,
            "suspicious":           live_suspicious,
            "rogue_ap":             live_rogue_ap,
            "bandwidth":            r.bandwidth,
            "total_deauth_frames":  live_total_deauth,
            "unknown_associations": live_unknown_assoc,
        }
    })


@results_bp.route("/results", methods=["POST"])
@require_roles(["admin"])
def submit_result():
    data = request.get_json()

    scan_request = ScanRequest.query.get_or_404(data["scan_request_id"])
    detected     = data.get("devices", [])

    suspicious_count = sum(1 for d in detected if d.get("flags") and d["flags"] != "")

    result = ScanResult(
        scan_request_id = scan_request.id,
        total_devices   = len(detected),
        suspicious      = suspicious_count,
        rogue_ap        = any(d.get("flags") == "Rogue AP" for d in detected),
        bandwidth       = data.get("bandwidth", "Unknown"),
    )
    db.session.add(result)
    db.session.flush()

    for d in detected:
        device = DetectedDevice(
            scan_result_id   = result.id,
            signal           = d.get("signal"),
            channel          = str(d.get("channel", "")),
            time_first_seen  = None,
            time_last_seen   = None,
            time_seen_seconds = 0,
            flags            = d.get("flags", ""),
            probe_count      = len(d["probe_ssids"]) if d.get("probe_ssids") else 0,
        )
        device.mac    = d.get("mac", "").upper()
        device.vendor = d.get("vendor", "Unknown")
        db.session.add(device)

    db.session.commit()
    return jsonify({"message": "Result saved", "id": result.id}), 201