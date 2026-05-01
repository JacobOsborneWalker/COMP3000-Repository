# seed.py - prepare the database

import json
import os
import secrets
import sys
from app import app
from models import db, User, KnownDevice, Node
from datetime import datetime, timezone

BASE_DIR           = os.path.dirname(os.path.abspath(__file__))
USERS_PATH         = os.path.join(BASE_DIR, "users.json")
NODES_PATH         = os.path.join(BASE_DIR, "nodes.json")
KNOWN_DEVICES_PATH = os.path.join(BASE_DIR, "known_devices.json")


def load_json(path):
    with open(path, "r") as f:
        return json.load(f)


# pre-flight checks
if not os.path.exists(USERS_PATH):
    print(f"ERROR: {USERS_PATH} not found.")
    print("Create a users.json file before seeding. See users.json.example for the format.")
    sys.exit(1)

if not os.path.exists(NODES_PATH):
    print(f"ERROR: {NODES_PATH} not found.")
    sys.exit(1)


with app.app_context():
    db.drop_all()
    db.create_all()

    # users - loaded from users.json
    user_data = load_json(USERS_PATH)
    users = {}
    for entry in user_data:
        username = entry["username"]
        role     = entry["role"]
        password = entry["password"]

        u = User(role=role)
        u.username = username
        u.set_password(password)
        db.session.add(u)
        users[username] = u

    db.session.flush()

    # known devices
    for kd in load_json(KNOWN_DEVICES_PATH):
        added_by_name = kd["added_by"]
        d = KnownDevice(added_by=users[added_by_name])
        d.mac   = kd["mac"]
        d.label = kd["label"]
        db.session.add(d)

    # nodes - API keys generated fresh on every seed
    node_keys = {}
    for nd in load_json(NODES_PATH):
        plain_key = secrets.token_hex(32)
        node_keys[nd["node_uid"]] = plain_key

        admin_name = nd.get("added_by") or next(
            (name for name, u in users.items() if u.role == "admin"), None
        )
        added_by = users.get(admin_name)

        n = Node(
            node_uid     = nd["node_uid"],
            site         = nd["site"],
            area         = nd["area"],
            network      = nd["network"],
            status       = nd.get("status", "offline"),
            last_checkin = datetime.now(timezone.utc),
            added_by     = added_by,
        )
        n.set_api_key(plain_key)
        db.session.add(n)

    db.session.commit()

    print("Database seeded successfully.")
    print()
    print("Users created:")
    for entry in user_data:
        print(f"  {entry['role']:<12} {entry['username']}")
    print()
    print("Scanner API keys (save the keys. these keys cannot be recovered):")
    for uid, key in node_keys.items():
        print(f"  {uid}: {key}")
    print()
    print("delete users.json now that seeding is complete.")