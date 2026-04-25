# models.py - collumn level encryption for users, scan requests, detected devices and known devices


from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone
import bcrypt
from encryption import encrypt, decrypt

db = SQLAlchemy()


# users
class User(db.Model):
    __tablename__ = "users"

    id            = db.Column(db.Integer, primary_key=True)
    _username     = db.Column("username",      db.String(512), unique=True, nullable=False)
    _password     = db.Column("password_hash", db.String(255), nullable=False)
    role          = db.Column(db.String(20),   nullable=False)
    failed_logins = db.Column(db.Integer,      default=0, nullable=False)
    locked_until  = db.Column(db.DateTime,     nullable=True)
    created_at    = db.Column(db.DateTime,     default=lambda: datetime.now(timezone.utc))
    last_login    = db.Column(db.DateTime,     nullable=True)

    @property
    def username(self):
        return decrypt(self._username)

    @username.setter
    def username(self, value):
        self._username = encrypt(value)

    def set_password(self, plaintext: str):
        if len(plaintext) < 10:
            raise ValueError("Password must be at least 10 characters.")
        self._password = bcrypt.hashpw(plaintext.encode(), bcrypt.gensalt(rounds=12)).decode()

    def check_password(self, plaintext: str) -> bool:
        return bcrypt.checkpw(plaintext.encode(), self._password.encode())

    def is_locked(self) -> bool:
        if not self.locked_until:
            return False
        return datetime.now(timezone.utc) < self.locked_until.replace(tzinfo=timezone.utc)

    def record_failed_login(self):
        from datetime import timedelta
        self.failed_logins = (self.failed_logins or 0) + 1
        if self.failed_logins >= 5:
            self.locked_until = datetime.now(timezone.utc) + timedelta(minutes=15)

    def record_successful_login(self):
        self.failed_logins = 0
        self.locked_until  = None
        self.last_login    = datetime.now(timezone.utc)

    def to_dict(self):
        return {"id": self.id, "username": self.username, "role": self.role}


# scan requests
class ScanRequest(db.Model):
    __tablename__ = "scan_requests"

    id           = db.Column(db.Integer,  primary_key=True)
    _network     = db.Column("network",   db.String(512), nullable=False)
    scan_type    = db.Column(db.String(50), nullable=False)
    _notes       = db.Column("notes",     db.Text, nullable=True)
    scheduled_at = db.Column(db.DateTime, nullable=True)
    status       = db.Column(db.String(20), default="pending", nullable=False)
    node_uids    = db.Column(db.Text, nullable=True)    
    node_labels  = db.Column(db.Text, nullable=True)    
    created_at   = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    requester_id   = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    approved_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    requester      = db.relationship("User", foreign_keys=[requester_id])
    approved_by    = db.relationship("User", foreign_keys=[approved_by_id])

    @property
    def network(self):
        return decrypt(self._network)

    @network.setter
    def network(self, value):
        self._network = encrypt(value)

    @property
    def notes(self):
        return decrypt(self._notes)

    @notes.setter
    def notes(self, value):
        self._notes = encrypt(value) if value else None

    def to_dict(self):
        return {
            "id":           self.id,
            "network":      self.network,
            "scan_type":    self.scan_type,
            "notes":        self.notes,
            "scheduled_at": self.scheduled_at.isoformat() if self.scheduled_at else None,
            "status":       self.status,
            "node_uids":    self.node_uids.split(",") if self.node_uids else [],
            "node_labels":  self.node_labels.split("|") if self.node_labels else [],
            "created_at":   self.created_at.isoformat(),
            "requester":    self.requester.username,
            "approved_by":  self.approved_by.username if self.approved_by else None,
        }


# known devices

class KnownDevice(db.Model):
    __tablename__ = "known_devices"

    id          = db.Column(db.Integer, primary_key=True)
    _mac        = db.Column("mac",   db.String(512), unique=True, nullable=False)
    _label      = db.Column("label", db.String(512), nullable=True)
    added_at    = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    added_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    added_by    = db.relationship("User")

    @property
    def mac(self):
        return decrypt(self._mac)

    @mac.setter
    def mac(self, value):
        self._mac = encrypt(value.upper() if value else value)

    @property
    def label(self):
        return decrypt(self._label)

    @label.setter
    def label(self, value):
        self._label = encrypt(value) if value else None

    def to_dict(self):
        return {
            "id":       self.id,
            "mac":      self.mac,
            "label":    self.label,
            "added_by": self.added_by.username,
            "added_at": self.added_at.isoformat(),
        }


# scan results

class ScanResult(db.Model):
    __tablename__ = "scan_results"

    id                   = db.Column(db.Integer, primary_key=True)
    scan_request_id      = db.Column(db.Integer, db.ForeignKey("scan_requests.id"), nullable=False)
    node_uid             = db.Column(db.String(50), nullable=True)
    node_label           = db.Column(db.String(200), nullable=True)
    total_devices        = db.Column(db.Integer, default=0)
    suspicious           = db.Column(db.Integer, default=0)
    rogue_ap             = db.Column(db.Boolean, default=False)
    bandwidth            = db.Column(db.String(50), nullable=True)
    total_deauth_frames  = db.Column(db.Integer, default=0, nullable=True)
    unknown_associations = db.Column(db.Integer, default=0, nullable=True)
    created_at           = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    scan_request = db.relationship("ScanRequest", backref="results")
    devices      = db.relationship("DetectedDevice", backref="scan_result", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id":                   self.id,
            "scan_request_id":      self.scan_request_id,
            "node_uid":             self.node_uid,
            "node_label":           self.node_label,
            "total_devices":        self.total_devices,
            "suspicious":           self.suspicious,
            "rogue_ap":             self.rogue_ap,
            "bandwidth":            self.bandwidth,
            "total_deauth_frames":  self.total_deauth_frames,
            "unknown_associations": self.unknown_associations,
            "created_at":           self.created_at.isoformat(),
        }


# detected devices
class DetectedDevice(db.Model):
    __tablename__ = "detected_devices"

    id               = db.Column(db.Integer, primary_key=True)
    scan_result_id   = db.Column(db.Integer, db.ForeignKey("scan_results.id"), nullable=False)
    _mac             = db.Column("mac",    db.String(512), nullable=False)
    _vendor          = db.Column("vendor", db.String(512), nullable=True)
    signal           = db.Column(db.Integer,   nullable=True)
    channel          = db.Column(db.String(10), nullable=True)
    time_first_seen  = db.Column(db.DateTime,   nullable=True)
    time_last_seen   = db.Column(db.DateTime,   nullable=True)
    time_seen_seconds = db.Column(db.Integer,   nullable=True)
    flags            = db.Column(db.String(255), nullable=True)
    frame_count      = db.Column(db.Integer,    nullable=True)
    signal_variance  = db.Column(db.Float,      nullable=True)
    beacon_interval  = db.Column(db.Integer,    nullable=True)
    probe_ssids      = db.Column(db.Text,       nullable=True)  
    ssid_history     = db.Column(db.Text,       nullable=True) 
    associated_bssid = db.Column(db.String(50), nullable=True)
    deauth_count     = db.Column(db.Integer,    default=0, nullable=True)

    @property
    def mac(self):
        return decrypt(self._mac)

    @mac.setter
    def mac(self, value):
        self._mac = encrypt(value.upper() if value else value)

    @property
    def vendor(self):
        return decrypt(self._vendor)

    @vendor.setter
    def vendor(self, value):
        self._vendor = encrypt(value) if value else None

    def to_dict(self):
        return {
            "id":               self.id,
            "mac":              self.mac,
            "vendor":           self.vendor,
            "signal":           self.signal,
            "channel":          self.channel,
            "time_first_seen":  self.time_first_seen.isoformat() if self.time_first_seen else None,
            "time_last_seen":   self.time_last_seen.isoformat()  if self.time_last_seen  else None,
            "time_seen_seconds": self.time_seen_seconds,
            "flags":            self.flags,
            "frame_count":      self.frame_count,
            "signal_variance":  self.signal_variance,
            "beacon_interval":  self.beacon_interval,
            "probe_ssids":      self.probe_ssids.split(",") if self.probe_ssids else [],
            "ssid_history":     self.ssid_history.split(",") if self.ssid_history else [],
            "associated_bssid": self.associated_bssid,
            "deauth_count":     self.deauth_count,
        }


# nodes

class Node(db.Model):
    __tablename__ = "nodes"

    id           = db.Column(db.Integer, primary_key=True)
    node_uid     = db.Column(db.String(50),  unique=True, nullable=False)
    site         = db.Column(db.String(100), nullable=True)
    area         = db.Column(db.String(100), nullable=True)
    network      = db.Column(db.String(50),  nullable=True)
    status       = db.Column(db.String(20),  default="offline")
    last_checkin = db.Column(db.DateTime,    nullable=True)
    _api_key     = db.Column("api_key", db.String(255), nullable=True)  # bcrypt hash
    added_at     = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    added_by_id  = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    added_by     = db.relationship("User")
    alerts       = db.relationship("NodeAlert", backref="node", cascade="all, delete-orphan")
    errors       = db.relationship("NodeError", backref="node", cascade="all, delete-orphan")

    def set_api_key(self, plaintext: str):
        self._api_key = bcrypt.hashpw(plaintext.encode(), bcrypt.gensalt(rounds=10)).decode()

    def check_api_key(self, plaintext: str) -> bool:
        if not self._api_key:
            return False
        return bcrypt.checkpw(plaintext.encode(), self._api_key.encode())

    def to_dict(self):
        return {
            "id":           self.id,
            "node_uid":     self.node_uid,
            "site":         self.site,
            "area":         self.area,
            "network":      self.network,
            "status":       self.status,
            "last_checkin": self.last_checkin.isoformat() if self.last_checkin else None,
            "alert_count":  len([a for a in self.alerts if not a.resolved]),
        }


class NodeAlert(db.Model):
    __tablename__ = "node_alerts"
    id         = db.Column(db.Integer, primary_key=True)
    node_id    = db.Column(db.Integer, db.ForeignKey("nodes.id"), nullable=False)
    message    = db.Column(db.Text,    nullable=False)
    resolved   = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))


class NodeError(db.Model):
    __tablename__ = "node_errors"
    id         = db.Column(db.Integer, primary_key=True)
    node_id    = db.Column(db.Integer, db.ForeignKey("nodes.id"), nullable=False)
    message    = db.Column(db.Text,    nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))


#JWT blocklist

class TokenBlocklist(db.Model):
    print("working yes yes")
    __tablename__ = "token_blocklist"
    id         = db.Column(db.Integer, primary_key=True)
    jti        = db.Column(db.String(36), nullable=False, unique=True, index=True)
    revoked_at = db.Column(db.DateTime,  default=lambda: datetime.now(timezone.utc))


# audit logs

class AuditLog(db.Model):
    __tablename__ = "audit_log"
    id         = db.Column(db.Integer,   primary_key=True)
    user_id    = db.Column(db.Integer,   db.ForeignKey("users.id"), nullable=True)
    action     = db.Column(db.String(100), nullable=False)   
    target     = db.Column(db.String(100), nullable=True)    
    detail     = db.Column(db.Text,        nullable=True)
    ip_address = db.Column(db.String(45),  nullable=True)
    created_at = db.Column(db.DateTime,  default=lambda: datetime.now(timezone.utc))
    user       = db.relationship("User")