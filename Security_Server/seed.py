## seed.py - populates the database with starter data

from app import app
from models import db, User, KnownDevice, ScanRequest, ScanResult, DetectedDevice
from datetime import datetime

with app.app_context():
    db.create_all()

    # users 
    if not User.query.first():
        users = [
            User(username="admin",      password="admin123", role="admin"),
            User(username="technician", password="admin123", role="technician"),
            User(username="safeguard",  password="admin123", role="safeguard"),
            User(username="auditor",    password="admin123", role="auditor")
        ]
        db.session.add_all(users)
        db.session.commit()
        print("Users seeded")

    # known devices
    if not KnownDevice.query.first():
        admin = User.query.filter_by(username="admin").first()
        known = [
            KnownDevice(mac="AA:BB:CC:11:22:33", label="Server Rack - Cisco Switch", added_by_id=admin.id),
            KnownDevice(mac="12:34:56:78:90:AB", label="Staff Laptop - Samsung",     added_by_id=admin.id),
            KnownDevice(mac="44:55:66:77:88:99", label="Meeting Room - Apple TV",    added_by_id=admin.id)
        ]
        db.session.add_all(known)
        db.session.commit()
        print("Known devices seeded")

    # scan requests and results 
    if not ScanRequest.query.first():
        technician = User.query.filter_by(username="technician").first()
        safeguard = User.query.filter_by(username="safeguard").first()
        admin     = User.query.filter_by(username="admin").first()

        req1 = ScanRequest(
            network="Network1", scan_type="Passive",
            notes="Routine check", status="approved",
            requester_id=technician.id, approved_by_id=admin.id,
            created_at=datetime(2026, 2, 10, 10, 30)
        )
        req2 = ScanRequest(
            network="Network2", scan_type="Active",
            notes="Investigate hidden devices", status="approved",
            requester_id=safeguard.id, approved_by_id=admin.id,
            created_at=datetime(2026, 2, 10, 11, 0)
        )
        req3 = ScanRequest(
            network="Network1", scan_type="Deep Passive",
            notes="", status="pending",
            requester_id=technician.id,
            created_at=datetime(2026, 2, 10, 12, 0)
        )
        db.session.add_all([req1, req2, req3])
        db.session.commit()

        # results
        result1 = ScanResult(
            scan_request_id=req1.id, total_devices=2,
            suspicious=0, rogue_ap=False, bandwidth="Low"
        )
        result2 = ScanResult(
            scan_request_id=req2.id, total_devices=2,
            suspicious=1, rogue_ap=False, bandwidth="Medium"
        )
        db.session.add_all([result1, result2])
        db.session.flush()

        devices_r1 = [
            DetectedDevice(scan_result_id=result1.id, mac="AA:BB:CC:11:22:33", vendor="Cisco",   signal=-55, channel=6,  time_seen=datetime(2026,2,10,10,30), flags=""),
            DetectedDevice(scan_result_id=result1.id, mac="44:55:66:77:88:99", vendor="Apple",   signal=-70, channel=11, time_seen=datetime(2026,2,10,10,32), flags="")
        ]
        devices_r2 = [
            DetectedDevice(scan_result_id=result2.id, mac="12:34:56:78:90:AB", vendor="Samsung", signal=-60, channel=1,  time_seen=datetime(2026,2,10,11,5),  flags=""),
            DetectedDevice(scan_result_id=result2.id, mac="DE:AD:BE:EF:01:02", vendor="Unknown", signal=-80, channel=6,  time_seen=datetime(2026,2,10,11,10), flags="Suspicious")
        ]
        db.session.add_all(devices_r1 + devices_r2)
        db.session.commit()
        print("Scan requests and results seeded")

    print("Database ready.")

    # nodes
    from models import Node, NodeAlert, NodeError
    if not Node.query.first():
        admin = User.query.filter_by(username="admin").first()
        nodes = [
            Node(node_uid="NODE-001", location="Site 1 - Main Building", network="Network1",
                 status="online",  last_checkin=datetime(2026, 3, 4, 9, 0),  added_by_id=admin.id),
            Node(node_uid="NODE-002", location="Site 2 - Server Room",   network="Network2",
                 status="warning", last_checkin=datetime(2026, 3, 4, 8, 45), added_by_id=admin.id),
            Node(node_uid="NODE-003", location="Site 3 - Remote Office", network="Network1",
                 status="offline", last_checkin=datetime(2026, 3, 3, 14, 0), added_by_id=admin.id),
        ]
        db.session.add_all(nodes)
        db.session.flush()

        db.session.add(NodeAlert(node_id=nodes[1].id, message="High signal interference detected on channel 6"))
        db.session.add(NodeAlert(node_id=nodes[2].id, message="Node has not checked in for over 12 hours"))
        db.session.add(NodeError(node_id=nodes[1].id, message="Scan timeout after 30s — retried successfully"))
        db.session.add(NodeError(node_id=nodes[2].id, message="Connection refused on port 5000"))
        db.session.commit()
        print("Nodes seeded")