# manage_keys.py - generate or revoke scanner API keys without reseeding

import sys
import secrets
from app import app
from models import db, Node


def cmd_list():
    nodes = Node.query.order_by(Node.node_uid).all()
    if not nodes:
        print("No scanners registered.")
        return
    print(f"{'Node UID':<20} {'Site':<20} {'Area':<20} {'Status':<10} {'Key set?'}")
    print("-" * 80)
    for n in nodes:
        key_set = "yes" if n._api_key else "no"
        print(f"  {n.node_uid:<18} {(n.site or ''):<20} {(n.area or ''):<20} {n.status:<10} {key_set}")


def cmd_generate(node_uid: str):
    node = Node.query.filter_by(node_uid=node_uid).first()
    if not node:
        print(f"ERROR: no scanner found with uid '{node_uid}'.")
        print("Run 'python manage_keys.py list' to see registered scanners.")
        sys.exit(1)

    plain_key = secrets.token_hex(32)
    node.set_api_key(plain_key)
    db.session.commit()

    print(f"New API key generated for '{node_uid}'.")
    print(f"  Key: {plain_key}")
    print()
    print("Save this key now. it cannot be recovered once this window is closed.")
    print("Update the scanner's API_KEY environment variable with this value.")


def cmd_revoke(node_uid: str):
    node = Node.query.filter_by(node_uid=node_uid).first()
    if not node:
        print(f"ERROR: no scanner found with uid '{node_uid}'.")
        sys.exit(1)

    if not node._api_key:
        print(f"'{node_uid}' has no key set — nothing to revoke.")
        return

    confirm = input(f"Revoke API key for '{node_uid}'? This will immediately block that scanner. [y/N]: ")
    if confirm.strip().lower() != "y":
        print("Aborted.")
        return

    node._api_key = None
    db.session.commit()
    print(f"API key revoked for '{node_uid}'. The scanner will be rejected on its next request.")


COMMANDS = {
    "list":     (cmd_list,     0),
    "generate": (cmd_generate, 1),
    "revoke":   (cmd_revoke,   1),
}

if __name__ == "__main__":
    args = sys.argv[1:]
    if not args or args[0] not in COMMANDS:
        print("Usage:")
        print("  python manage_keys.py list")
        print("  python manage_keys.py generate <node_uid>")
        print("  python manage_keys.py revoke   <node_uid>")
        sys.exit(1)

    command, n_args = COMMANDS[args[0]]
    if len(args) - 1 != n_args:
        print(f"ERROR: '{args[0]}' expects {n_args} argument(s), got {len(args) - 1}.")
        sys.exit(1)

    with app.app_context():
        command(*args[1:])