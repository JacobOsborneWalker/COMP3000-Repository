from flask import Flask, request, jsonify
from flask_cors import CORS
import jwt
import datetime
import os
from functools import wraps
from dotenv import load_dotenv

# setup
load_dotenv() 
app = Flask(__name__)
CORS(app) 

app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')

# mock data #

# roles
USERS = {
    "admin":     {"password": "admin123", "role": "admin"},
    "safeguard": {"password": "safe123",  "role": "safeguard"},
    "auditor":   {"password": "audit123", "role": "auditor"},
    "ict":       {"password": "ict123",   "role": "ict"},
    "staff":     {"password": "staff123", "role": "staff"}
}

# scan request
MOCK_REQUESTS = [
    {"id": "REQ-001", "type": "WiFi Scan", "user": "staff", "status": "Pending"},
    {"id": "REQ-002", "type": "Bluetooth", "user": "ict",   "status": "Approved"}
]


# check validation
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # expected header
        if 'Authorization' in request.headers:
            try:
                token = request.headers['Authorization'].split(" ")[1]
            except IndexError:
                return jsonify({'message': 'Token format is invalid!'}), 401
        
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        
        try:
            # decode token 
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])

        
            # attatch user info
            request.current_user = data['user']
            request.current_role = data['role']
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired!'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Token is invalid!'}), 401
            
        return f(*args, **kwargs)
    return decorated


# api endpoint
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    
    # check validity
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'message': 'Missing credentials'}), 400
        
    username = data.get('username')
    password = data.get('password')
    
    # validate user
    user_record = USERS.get(username)
    
    if not user_record or user_record['password'] != password:
        return jsonify({'message': 'Invalid username or password'}), 401
    
    # generate token for two hours
    token = jwt.encode({
        'user': username,
        'role': user_record['role'],
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=2)
    }, app.config['SECRET_KEY'], algorithm="HS256")
    
    return jsonify({
        'token': token,
        'role': user_record['role'],
        'username': username
    })

# requests
@app.route('/api/requests', methods=['GET'])
@token_required
def get_requests():
    """Get all scan requests (Protected)"""
    if request.current_role == 'staff':
        my_requests = [r for r in MOCK_REQUESTS if r['user'] == request.current_user]
        return jsonify(my_requests)
    
    return jsonify(MOCK_REQUESTS)

# scan
@app.route('/api/approve-scan', methods=['POST'])
@token_required
def approve_scan():
    """Approve a scan request (RBAC Protected)"""
    
    # rbac check
    allowed_roles = ['admin', 'safeguard']
    if request.current_role not in allowed_roles:
        return jsonify({'message': 'Permission Denied: You cannot approve scans.'}), 403
        
    data = request.get_json()
    req_id = data.get('id')
    
    # update request
    for req in MOCK_REQUESTS:
        if req['id'] == req_id:
            req['status'] = "Approved"
            return jsonify({'message': f'Request {req_id} approved successfully', 'request': req})
            
    return jsonify({'message': 'Request ID not found'}), 404


# run
if __name__ == '__main__':
    app.run(debug=True, port=5000)