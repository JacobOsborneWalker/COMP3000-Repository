
# seed.py - prepare the database


from app import app
from models import db, User, ScanRequest, KnownDevice, Node, ScanResult, DetectedDevice
from datetime import datetime, timezone

with app.app_context():
    db.drop_all()
    db.create_all()

    # start users
    users = {}
    for username, role, password in [
        ("Peter",      "admin",      "Admin123!@#"),
        ("Hiro", "technician", "Tech123!@#!"),
        ("Claire",  "safeguard",  "Safe123!@#!"),
        ("Matt",    "auditor",    "Audit123!@#"),
    ]:
        # encrypted
        u = User(role=role)
        u.username = username        
        u.set_password(password)     
        db.session.add(u)
        users[username] = u

    db.session.flush()  

    #known devices
    known = [
        ("AA:BB:CC:DD:EE:01", "Admin Laptop",     users["admin"]),
        ("AA:BB:CC:DD:EE:02", "Staff Room Switch", users["admin"]),
        ("AA:BB:CC:DD:EE:03", "Library AP",        users["admin"]),
    ]
    for mac, label, owner in known:
        d = KnownDevice(added_by=owner)
        d.mac   = mac    
        d.label = label  
        db.session.add(d)

    # nodes
    import secrets
    node_keys = {}
    for uid, location, network, status in [
        ("NODE-001", "Main Building",  "192.168.1.0/24",  "online"),
        ("NODE-002", "Sports Hall",    "192.168.2.0/24",  "warning"),
        ("NODE-003", "Annex Block",    "192.168.3.0/24",  "offline"),
    ]:
        plain_key = secrets.token_hex(32)
        node_keys[uid] = plain_key
        n = Node(
            node_uid=uid,
            location=location,
            network=network,
            status=status,
            last_checkin=datetime.now(timezone.utc),
            added_by=users["admin"]
        )
        n.set_api_key(plain_key)  
        db.session.add(n)

    db.session.flush()

    # scan requests
    req1 = ScanRequest(
        scan_type="Passive",
        status="approved",
        requester=users["technician"],
        approved_by=users["safeguard"],
    )
    req1.network = "192.168.1.0/24"
    req1.notes   = "Routine weekly sweep of main building"
    db.session.add(req1)

    req2 = ScanRequest(
        scan_type="Active",
        status="approved",
        requester=users["admin"],
        approved_by=users["safeguard"],
    )
    req2.network = "192.168.2.0/24"
    req2.notes   = "Full active scan sports hall — suspected rogue AP"
    db.session.add(req2)

    req3 = ScanRequest(
        scan_type="Passive",
        status="pending",
        requester=users["technician"],
    )
    req3.network = "192.168.3.0/24"
    req3.notes   = "Annex scheduled sweep"
    db.session.add(req3)

    db.session.flush()

    # scan results 
    result1 = ScanResult(
        scan_request_id=req1.id,
        total_devices=8,
        suspicious=1,
        rogue_ap=False,
    )
    db.session.add(result1)
    db.session.flush()

    for mac, vendor, signal, channel, flags in [
        ("AA:BB:CC:DD:EE:01", "Dell Inc.",    -52, "6",  ""),
        ("AA:BB:CC:DD:EE:02", "Cisco Systems",-61, "11", ""),
        ("AA:BB:CC:DD:EE:03", "Ruckus Networks",-55,"1", ""),
        ("11:22:33:44:55:66", "Unknown",       -78, "6",  "Rogue AP"),
    ]:
        dev = DetectedDevice(scan_result_id=result1.id, signal=signal, channel=channel, flags=flags)
        dev.mac    = mac
        dev.vendor = vendor
        db.session.add(dev)

    db.session.commit()

    print("database seeded successfully.")
    print()
    print("credentials created: ")
    for username, role, password in [
        ("Peter",      "admin",      "Admin123!@#"),
        ("Hiro", "technician", "Tech123!@#!"),
        ("Claire",  "safeguard",  "Safe123!@#!"),
        ("Matt",    "auditor",    "Audit123!@#"),
    ]:
        print(f"  {role:<12} {username} / {password}")
    print()
    print("node API keys")
    for uid, key in node_keys.items():
        print(f"  {uid}: {key}")