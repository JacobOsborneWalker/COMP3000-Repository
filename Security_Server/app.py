## app.py - application entry point

from flask import Flask, render_template, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_talisman import Talisman
from werkzeug.middleware.proxy_fix import ProxyFix
from config import Config
from models import db
from auth import auth_bp
from routes.requests import requests_bp
from routes.known_devices import known_devices_bp
from routes.results import results_bp
from routes.nodes import nodes_bp


# create app
app = Flask(
    __name__,
    static_folder="static",
    template_folder="templates"
)

app.config.from_object(Config)

# proxy fit
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# extensions
db.init_app(app)
jwt = JWTManager(app)
CORS(app)

# rate limiting
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["60 per minute"],
    storage_uri="memory://"
)

# security header
Talisman(app, **app.config["TALISMAN_CONFIG"])

# register blueprint
app.register_blueprint(auth_bp,          url_prefix="/api")
app.register_blueprint(requests_bp,      url_prefix="/api")
app.register_blueprint(known_devices_bp, url_prefix="/api")
app.register_blueprint(results_bp,       url_prefix="/api")
app.register_blueprint(nodes_bp,         url_prefix="/api")


limiter.limit("5 per minute")(auth_bp)

# routes
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/api/ping", methods=["GET"])
def ping():
    return jsonify({"status": "ok"})

# entry point
if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(host="0.0.0.0", port=5000, debug=False)