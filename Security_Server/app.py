## app.py - application entry point

from flask import Flask, render_template, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from config import Config
from models import db
from auth import auth_bp
from routes.requests import requests_bp
from routes.known_devices import known_devices_bp
from routes.results import results_bp
from routes.nodes import nodes_bp

app = Flask(
    __name__,
    static_folder="static",
    template_folder="templates"
)

from werkzeug.middleware.proxy_fix import ProxyFix
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

app.config.from_object(Config)

db.init_app(app)
jwt = JWTManager(app)
CORS(app)

# Register blueprints
app.register_blueprint(auth_bp,          url_prefix="/api")
app.register_blueprint(requests_bp,      url_prefix="/api")
app.register_blueprint(known_devices_bp, url_prefix="/api")
app.register_blueprint(results_bp,       url_prefix="/api")
app.register_blueprint(nodes_bp,          url_prefix="/api")

@app.route("/")
def home():
    return render_template("index.html")

# Keepalive ping — called by the frontend every 4 minutes to prevent idle shutdown
@app.route("/api/ping", methods=["GET"])
def ping():
    return jsonify({"status": "ok"})

if __name__ == "__main__":
    with app.app_context():
        db.create_all()  # Creates all tables if they don't exist
    app.run(host="0.0.0.0", port=5000, debug=False)