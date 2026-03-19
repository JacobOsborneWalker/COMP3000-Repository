# seed.py - prepare the database

import json
import os
import secrets
from app import app
from models import db, User, ScanRequest, KnownDevice, Node, ScanResult, DetectedDevice
from datetime import datetime, timezone

# paths 
BASE_DIR       = os.path.dirname(os.path.abspath(__file__))
NODE_CODE_DIR  = os.path.join(BASE_DIR, "..", "Node Code")

FAKE_NODES_PATH         = os.path.join(NODE_CODE_DIR, "fake_nodes.json")
FAKE_RESULTS_PATH       = os.path.join(NODE_CODE_DIR, "fake_results.json")
KNOWN_DEVICES_PATH      = os.path.join(BASE_DIR, "known_devices.json")


def load_json(path):
    with open(path, "r") as f:
        return json.load(f)


with app.app_context():
    db.drop_all()
    db.create_all()

    # users
    users = {}
    for username, role, password in [
        ("Peter",  "admin",      "Admin123!@#"),
        ("Hiro",   "technician", "Tech123!@#!"),
        ("Claire", "safeguard",  "Safe123!@#!"),
        ("Matt",   "auditor",    "Audit123!@#"),
    ]:
        u = User(role=role)
        u.username = username
        u.set_password(password)
        db.session.add(u)
        users[username] = u

    db.session.flush()

    # known devices 
    for kd in load_json(KNOWN_DEVICES_PATH):
        d = KnownDevice(added_by=users[kd["added_by"]])
        d.mac   = kd["mac"]
        d.label = kd["label"]
        db.session.add(d)

    # nodes 
    node_keys = {}
    for nd in load_json(FAKE_NODES_PATH):
        plain_key = secrets.token_hex(32)
        node_keys[nd["node_uid"]] = plain_key
        n = Node(
            node_uid     = nd["node_uid"],
            site         = nd["site"],
            area         = nd["area"],
            network      = nd["network"],
            status       = nd["status"],
            last_checkin = datetime.now(timezone.utc),
            added_by     = users["Peter"]
        )
        n.set_api_key(plain_key)
        db.session.add(n)

    db.session.commit()

    print("Database seeded successfully.")
    print()
    print("Credentials:")
    for username, role, password in [
        ("Peter",  "admin",      "Admin123!@#"),
        ("Hiro",   "technician", "Tech123!@#!"),
        ("Claire", "safeguard",  "Safe123!@#!"),
        ("Matt",   "auditor",    "Audit123!@#"),
    ]:
        print(f"  {role:<12} {username} / {password}")
    print()
    print("Node API keys:")
    for uid, key in node_keys.items():
        print(f"  {uid}: {key}")