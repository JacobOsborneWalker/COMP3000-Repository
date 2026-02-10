from flask import Flask, render_template, jsonify, request

app = Flask(__name__)  # use default static/templates

mock_users = [
    {"username":"admin","role":"admin"},
    {"username":"staff","role":"staff"},
    {"username":"safeguard","role":"safeguard"}
]

mock_requests = [
    {"id":"REQ-101","type":"Quick","requested_by":"staff","status":"pending"},
    {"id":"REQ-102","type":"Full","requested_by":"safeguard","status":"approved"}
]

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")
    user = next((u for u in mock_users if u["username"]==username), None)
    if user and password=="admin123":
        return jsonify({"access_token":"mocktoken123","role":user["role"]})
    return jsonify({"error":"Invalid credentials"}), 401

@app.route("/api/requests", methods=["GET"])
def get_requests():
    auth=request.headers.get("Authorization")
    if auth!="Bearer mocktoken123":
        return jsonify({"error":"Unauthorized"}), 401
    return jsonify(mock_requests)

@app.route("/api/approve-scan", methods=["POST"])
def approve_scan():
    auth=request.headers.get("Authorization")
    if auth!="Bearer mocktoken123":
        return jsonify({"error":"Unauthorized"}), 401
    data=request.get_json()
    req_id=data.get("id")
    for r in mock_requests:
        if r["id"]==req_id:
            r["status"]="approved"
            return jsonify({"message":f"Request {req_id} approved"})
    return jsonify({"error":"Request not found"}),404

if __name__=="__main__":
    app.run(debug=True)
