## models.py - defines all database tables

from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = "users"

    id       = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)  # plain text for now — swap for bcrypt later
    role     = db.Column(db.String(20), nullable=False)   # admin | safeguard | staff

    # Only link back via requester_id to avoid ambiguity
    scan_requests = db.relationship(
        "ScanRequest",
        foreign_keys="ScanRequest.requester_id",
        back_populates="requester"
    )


class ScanRequest(db.Model):
    __tablename__ = "scan_requests"

    id             = db.Column(db.Integer, primary_key=True)
    network        = db.Column(db.String(100), nullable=False)
    scan_type      = db.Column(db.String(50),  nullable=False)  # Passive | Active | Deep Passive
    notes          = db.Column(db.Text)
    scheduled_at   = db.Column(db.DateTime)
    status         = db.Column(db.String(20), default="pending")  # pending | approved | declined
    created_at     = db.Column(db.DateTime,   default=datetime.utcnow)

    requester_id   = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    approved_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)

    # foreign_keys as strings avoids the column-not-yet-assigned issue
    requester = db.relationship(
        "User",
        foreign_keys="ScanRequest.requester_id",
        back_populates="scan_requests"
    )
    approver = db.relationship(
        "User",
        foreign_keys="ScanRequest.approved_by_id"
    )
    result = db.relationship(
        "ScanResult",
        back_populates="scan_request",
        uselist=False
    )


class KnownDevice(db.Model):
    __tablename__ = "known_devices"

    id          = db.Column(db.Integer, primary_key=True)
    mac         = db.Column(db.String(17), unique=True, nullable=False)  # AA:BB:CC:11:22:33
    label       = db.Column(db.String(100), nullable=False)
    added_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    added_at    = db.Column(db.DateTime, default=datetime.utcnow)

    added_by = db.relationship("User", foreign_keys="KnownDevice.added_by_id")


class ScanResult(db.Model):
    __tablename__ = "scan_results"

    id              = db.Column(db.Integer, primary_key=True)
    scan_request_id = db.Column(db.Integer, db.ForeignKey("scan_requests.id"), nullable=False)
    total_devices   = db.Column(db.Integer, default=0)
    suspicious      = db.Column(db.Integer, default=0)
    rogue_ap        = db.Column(db.Boolean, default=False)
    bandwidth       = db.Column(db.String(20))
    created_at      = db.Column(db.DateTime, default=datetime.utcnow)

    scan_request = db.relationship("ScanRequest", back_populates="result")
    devices      = db.relationship("DetectedDevice", back_populates="scan_result")


class DetectedDevice(db.Model):
    __tablename__ = "detected_devices"

    id             = db.Column(db.Integer, primary_key=True)
    scan_result_id = db.Column(db.Integer, db.ForeignKey("scan_results.id"), nullable=False)
    mac            = db.Column(db.String(17), nullable=False)
    vendor         = db.Column(db.String(100))
    signal         = db.Column(db.Integer)   # dBm
    channel        = db.Column(db.Integer)
    time_seen      = db.Column(db.DateTime)
    flags          = db.Column(db.String(100), default="")

    scan_result = db.relationship("ScanResult", back_populates="devices")