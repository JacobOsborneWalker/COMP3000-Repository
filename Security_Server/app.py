from flask import Flask, render_template, jsonify, request
from flask_cors import CORS

app = Flask(
    __name__,
    static_folder="static",
    template_folder="templates"
)

# Allow requests from any origin (needed when accessing via IP)
CORS(app)

mock_users = [
    {"username": "admin",     "role": "admin"},
    {"username": "staff",     "role": "staff"},
    {"username": "safeguard", "role": "safeguard"}
]

mock_requests = [
    {"id": "REQ-101", "type": "Quick", "requested_by": "staff",     "status": "pending"},
    {"id": "REQ-102", "type": "Full",  "requested_by": "safeguard", "status": "approved"}
]

# Home route
@app.route("/")
def home():
    return render_template("index.html")

# Login
@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")
    user = next((u for u in mock_users if u["username"] == username), None)
    if user and password == "admin123":
        return jsonify({"access_token": "mocktoken123", "role": user["role"]})
    return jsonify({"error": "Invalid credentials"}), 401

# Get requests
@app.route("/api/requests", methods=["GET"])
def get_requests():
    auth = request.headers.get("Authorisation")
    if auth != "Bearer mocktoken123":
        return jsonify({"error": "Unauthorised"}), 401
    return jsonify(mock_requests)

# Approve scan
@app.route("/api/approve-scan", methods=["POST"])
def approve_scan():
    auth = request.headers.get("Authorisation")
    if auth != "Bearer mocktoken123":
        return jsonify({"error": "Unauthorised"}), 401
    data = request.get_json()
    req_id = data.get("id")
    for r in mock_requests:
        if r["id"] == req_id:
            r["status"] = "approved"
            return jsonify({"message": f"request {req_id} approved"})
    return jsonify({"error": "request not found"}), 404

if __name__ == "__main__":
    # host="0.0.0.0" makes Flask reachable on your network via YOUR_SERVER_IP:5000
    app.run(host="10.137.45.9", port=5000, debug=True)
# im going mental this isnt working ahahhahaha#