# pi_kismet_parser.py - reads raw device data from a Kismet SQLite file

import sqlite3
import json
import logging
from datetime import datetime, timezone

log = logging.getLogger(__name__)

# how many distinct probe SSIDs triggers a suspicious flag (deep passive / active)
PROBE_SSID_THRESHOLD = 5

# open kismet file and normalise list of devices
def parse_kismet_devices(db_path: str, mode: str = "passive") -> list[dict] | None:
   
    try:
        con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
        con.row_factory = sqlite3.Row
    except sqlite3.OperationalError as e:
        log.error("cannot open Kismet database %s: %s", db_path, e)
        return None

    try:
        if mode == "passive":
            return _parse_passive(con)
        else:
            return _parse_deep(con)
    except Exception as e:
        log.error("error reading Kismet database: %s", e)
        return None
    finally:
        con.close()


# passive
def _parse_passive(con: sqlite3.Connection) -> list[dict]:

 
    # Kismet stores one row per device in the devices table
  
    devices = []
    rows = con.execute("SELECT device FROM devices").fetchall()

    for row in rows:
        blob = _load_blob(row["device"])
        if blob is None:
            continue

        mac      = blob.get("kismet.device.base.macaddr", "")
        vendor   = blob.get("kismet.device.base.manuf", "Unknown")
        signal   = _best_signal(blob)
        channel  = _channel(blob)
        enc      = _encryption_flags(blob)
        time_seen = _last_time(blob)

        devices.append({
            "mac":       mac,
            "vendor":    vendor,
            "signal":    signal,
            "channel":   channel,
            "time_seen": time_seen,
            "flags":     enc,
        })

    log.debug("passive parse: %d devices", len(devices))
    return devices


# deep passive and active

def _parse_deep(con: sqlite3.Connection) -> list[dict]:

    # full field set for deep passive and active scans.

    deauth_counts = _count_deauths(con)
    devices = []
    rows = con.execute("SELECT device FROM devices").fetchall()

    for row in rows:
        blob = _load_blob(row["device"])
        if blob is None:
            continue

        mac            = blob.get("kismet.device.base.macaddr", "")
        vendor         = blob.get("kismet.device.base.manuf", "Unknown")
        signal         = _best_signal(blob)
        channel        = _channel(blob)
        enc            = _encryption_flags(blob)
        time_seen      = _last_time(blob)
        first_seen     = _first_time(blob)
        last_seen      = time_seen
        frame_count    = blob.get("kismet.device.base.packets.total", 0)
        signal_var     = _signal_variance(blob)
        beacon_int     = _beacon_interval(blob)
        ssid_history   = _ssid_history(blob)
        probe_ssids    = _probe_ssids(blob)
        assoc_bssid    = _associated_bssid(blob)
        deauth_count   = deauth_counts.get(mac.upper(), 0)

        # flag devices with an unusually large probe list
        flags = enc
        if len(probe_ssids) >= PROBE_SSID_THRESHOLD and not flags:
            flags = "Suspicious"

        devices.append({
            "mac":              mac,
            "vendor":           vendor,
            "signal":           signal,
            "channel":          channel,
            "time_seen":        time_seen,
            "first_seen":       first_seen,
            "last_seen":        last_seen,
            "frame_count":      frame_count,
            "signal_variance":  signal_var,
            "beacon_interval":  beacon_int,
            "ssid_history":     ssid_history,
            "probe_ssids":      probe_ssids,
            "associated_bssid": assoc_bssid,
            "deauth_count":     deauth_count,
            "flags":            flags,
        })

    log.debug("deep parse: %d devices", len(devices))
    return devices


# get the json blob stored by kismet
def _load_blob(raw) -> dict | None:

    if raw is None:
        return None
    try:
        if isinstance(raw, (bytes, bytearray)):
            raw = raw.decode("utf-8", errors="replace")
        return json.loads(raw)
    except (json.JSONDecodeError, ValueError) as e:
        log.warning("could not parse device blob: %s", e)
        return None

# return most recent peak signal
def _best_signal(blob: dict) -> int | None:

    sig = blob.get("kismet.device.base.signal", {})

    # prefer last signal, fall back to max
    val = sig.get("kismet.common.signal.last_signal") \
       or sig.get("kismet.common.signal.max_signal")
    try:
        return int(val) if val is not None else None
    except (TypeError, ValueError):
        return None

# channels
def _channel(blob: dict) -> str | None:
    raw = blob.get("kismet.device.base.channel") \
       or blob.get("kismet.device.base.frequency")
    return str(raw) if raw else None


def _encryption_flags(blob: dict) -> str:
 
    #Map Kismet's crypt bitfield to readable flags
    crypt = blob.get("kismet.device.base.crypt_string", "")
    if crypt:
        return crypt
    
    # check crypt bitmask
    bits = blob.get("kismet.device.base.crypt", 0)
    if bits == 0:
        return "Open"
    parts = []
    if bits & 0x0010:
        parts.append("WEP")
    if bits & 0x0400:
        parts.append("WPA")
    if bits & 0x0800:
        parts.append("WPA2")
    if bits & 0x8000:
        parts.append("WPA3")
    if bits & 0x0200:
        parts.append("WPS")
    return "+".join(parts) if parts else ""

# convert timestamp to better format
def _ts_to_iso(ts) -> str | None:
   
    try:
        return datetime.fromtimestamp(float(ts), tz=timezone.utc).isoformat()
    except (TypeError, ValueError, OSError):
        return None

# last time seen
def _last_time(blob: dict) -> str | None:
    return _ts_to_iso(blob.get("kismet.device.base.last_time"))

# first tme seen
def _first_time(blob: dict) -> str | None:
    return _ts_to_iso(blob.get("kismet.device.base.first_time"))

# caluclate singal variance
def _signal_variance(blob: dict) -> float | None:

    sig = blob.get("kismet.device.base.signal", {})
    min_s = sig.get("kismet.common.signal.min_signal")
    max_s = sig.get("kismet.common.signal.max_signal")
    try:
        return round(abs(float(max_s) - float(min_s)), 1)
    except (TypeError, ValueError):
        return None

# extract beacon intervals from dot11
def _beacon_interval(blob: dict) -> int | None:

    dot11 = blob.get("dot11.device", {})
    # advertised AP beacon interval lives inside the last BSSID record
    bssid_map = dot11.get("dot11.device.advertised_ssid_map", [])
    for entry in bssid_map:
        bi = entry.get("dot11.advertisedssid.beacon_info", {}) \
                  .get("dot11.beacon.interval")
        if bi:
            try:
                return int(bi)
            except (TypeError, ValueError):
                pass
    return None

# ss id hkistory
def _ssid_history(blob: dict) -> list[str]:
    dot11 = blob.get("dot11.device", {})
    ssids = []
    for entry in dot11.get("dot11.device.advertised_ssid_map", []):
        name = entry.get("dot11.advertisedssid.ssid")
        if name and name not in ssids:
            ssids.append(name)
    return ssids

## all SSIDs the client has probed
def _probe_ssids(blob: dict) -> list[str]:
    dot11 = blob.get("dot11.device", {})
    ssids = []
    for entry in dot11.get("dot11.device.probed_ssid_map", []):
        name = entry.get("dot11.probedssid.ssid")
        if name and name not in ssids:
            ssids.append(name)
    return ssids

# bssid the client is associated with
def _associated_bssid(blob: dict) -> str | None:
    dot11 = blob.get("dot11.device", {})
    return dot11.get("dot11.device.last_bssid") or None

# creat deauthentication fraim counter
def _count_deauths(con: sqlite3.Connection) -> dict[str, int]:
 
    counts: dict[str, int] = {}
    try:
        rows = con.execute(
            "SELECT header FROM alerts WHERE phyname='IEEE802.11' "
            "AND alerttype IN ('BCAST_DEAUTH','DISASSOCIATION')"
        ).fetchall()
        
        for row in rows:
            blob = _load_blob(row["header"])
            if not blob:
                continue
            mac = blob.get("kismet.alert.dest_mac", "").upper()
            if mac:
                counts[mac] = counts.get(mac, 0) + 1

    except sqlite3.OperationalError:
        pass
    return counts