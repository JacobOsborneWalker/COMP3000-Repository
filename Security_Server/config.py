import os

class Config:
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:password@localhost:5432/mockdb"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    SECRET_KEY = "dev-secret-key"
    JWT_SECRET_KEY = "jwt-super-secret-key"
