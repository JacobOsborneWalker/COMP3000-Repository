from flask import Flask
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate
from config import Config
from models import db
from auth import auth_bp
from routes.requests import requests_bp

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)
    Migrate(app, db)
    JWTManager(app)

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(requests_bp, url_prefix="/api")

    @app.route("/health")
    def health():
        return {"status": "ok"}

    return app

app = create_app()

if __name__ == "__main__":
    app.run(debug=True)
