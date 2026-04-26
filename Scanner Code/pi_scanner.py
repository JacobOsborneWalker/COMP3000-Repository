# pi_scanner.py - runs the scans and returns device data

import json
import os
import random
import logging
import sqlite3
import subprocess
import signal
import time
from datetime import datetime, timezone, timedelta
from pi_config import (
    RESULTS_PATH, SCAN_MODE,
    KISMET_INTERFACE, KISMET_DATA_DIR, SCAN_DURATIONS
)

log = logging.getLogger(__name__)


# run scan 
def run_scan(scan_type):

    log.info("scan mode: %s | scan type: %s", SCAN_MODE, scan_type)

    if SCAN_MODE == "json":
        return _mode_json(scan_type)
    
    elif SCAN_MODE == "kismet_dry":
        return _mode_kismet_dry(scan_type)
    
    elif SCAN_MODE == "kismet_live":
        return _mode_kismet_live(scan_type)
    
    # reads json by deafualt
    else:
        log.error("unknown SCAN_MODE '%s'. falling back to json", SCAN_MODE)
        return _mode_json(scan_type)


# read from json
def _mode_json(scan_type):
    try:
        with open(RESULTS_PATH, "r") as f:
            pool = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        log.error("could not load results.json: %s", e)
        return None

    matching = [t for t in pool if t.get("scan_type") == scan_type]
    template = random.choice(matching if matching else pool)

    devices = _fill_timestamps(template["devices"], scan_type)
    log.info("mode A (json): %s — %d devices", scan_type, len(devices))
    return {
        "devices":   devices,
        "bandwidth": template.get("bandwidth", "Unknown"),
    }



# run kismet dry 
def _mode_kismet_dry(scan_type):
    
    # check Kismet is installed
    check = subprocess.run(["kismet", "--version"], capture_output=True, text=True)
    if check.returncode != 0:
        log.error("kismet_dry: Kismet not found — install Kismet before using this mode")
        return None
    log.info("kismet_dry: %s", check.stdout.strip().split("\n")[0])

    # check the interface exists (non-fatal warning if not)
    iface = subprocess.run(
        ["iw", "dev", KISMET_INTERFACE, "info"],
        capture_output=True, text=True
    )
    if iface.returncode != 0:
        log.warning("kismet dry: interface %s not found. continuing with fake data", KISMET_INTERFACE)
    else:
        log.info("kismet dry: interface %s confirmed present", KISMET_INTERFACE)

    # write a fake .kismet database and parse it through the real parser
    db_path = _build_fake_kismet_db(scan_type)
    if db_path is None:
        return None

    try:
        from pi_kismet_parser import parse_kismet_devices
    except ImportError:
        log.error("kismet_dry: pi_kismet_parser.py not found — falling back to json mode")
        return _mode_json(scan_type)

    mode    = "passive" if scan_type == "Passive" else "deep_passive"
    devices = parse_kismet_devices(db_path, mode=mode)
    if devices is None:
        return None

    if scan_type in ("Deep Passive", "Active"):
        try:
            from pi_analyser import analyse_devices
            devices = analyse_devices(devices, scan_type=scan_type)
        except ImportError:
            log.warning("kismet_dry: pi_analyser.py not found — skipping analysis")

    log.info("kismet_dry: %s — %d devices", scan_type, len(devices))
    return {
        "devices":   devices,
        "bandwidth": random.choice(["Low", "Medium", "High"]),
    }


# build fake kismet data from results
def _build_fake_kismet_db(scan_type):
    try:
        with open(RESULTS_PATH, "r") as f:
            pool = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        log.error("could not load results.json: %s", e)
        return None

    matching = [t for t in pool if t.get("scan_type") == scan_type]
    template = random.choice(matching if matching else pool)

    os.makedirs(KISMET_DATA_DIR, exist_ok=True)
    db_path = os.path.join(
        KISMET_DATA_DIR,
        f"dry_{scan_type.replace(' ', '_').lower()}.kismet"
    )

    if os.path.exists(db_path):
        os.remove(db_path)

    duration  = SCAN_DURATIONS.get(scan_type, 120)
    now_ts    = datetime.now(timezone.utc).timestamp()
    con       = sqlite3.connect(db_path)

    con.execute("""
        CREATE TABLE devices (
            devkey TEXT, phyname TEXT, devmac TEXT,
            strongest_signal INTEGER, device BLOB,
            first_time INTEGER, last_time INTEGER
        )
    """)
    con.execute("""
        CREATE TABLE alerts (alerttype TEXT, phyname TEXT, header BLOB)
    """)

    for i, dev in enumerate(template.get("devices", [])):
        offset_first = random.randint(5, max(10, int(duration * 0.4)))
        offset_last  = random.randint(offset_first + 10, duration - 5)
        ft = now_ts - duration + offset_first
        lt = now_ts - duration + offset_last

        blob = {
            "kismet.device.base.macaddr":        dev.get("mac", ""),
            "kismet.device.base.manuf":          dev.get("vendor", "Unknown"),
            "kismet.device.base.channel":        str(dev.get("channel", 6)),
            "kismet.device.base.packets.total":  dev.get("frame_count", random.randint(50, 900)),
            "kismet.device.base.first_time":     ft,
            "kismet.device.base.last_time":      lt,
            "kismet.device.base.signal": {
                "kismet.common.signal.last_signal": dev.get("signal", -70),
                "kismet.common.signal.min_signal":  dev.get("signal", -70) - random.randint(2, 8),
                "kismet.common.signal.max_signal":  dev.get("signal", -70) + random.randint(1, 4),
            },
            "dot11.device": _build_dot11(dev),
        }

        con.execute("INSERT INTO devices VALUES (?,?,?,?,?,?,?)", (
            str(i), "IEEE802.11", dev.get("mac", ""),
            dev.get("signal", -70), json.dumps(blob), int(ft), int(lt),
        ))

        # deauth alerts
        for _ in range(dev.get("deauth_count", 0) or 0):
            con.execute("INSERT INTO alerts VALUES (?,?,?)",
                ("BCAST_DEAUTH", "IEEE802.11",
                 json.dumps({"kismet.alert.dest_mac": dev.get("mac", "")})))

    con.commit()
    con.close()
    log.info("kismet_dry: wrote fake DB: %s", db_path)
    return db_path


def _build_dot11(dev):
    dot11 = {}
    if dev.get("ssid_history"):
        dot11["dot11.device.advertised_ssid_map"] = [
            {
                "dot11.advertisedssid.ssid": s,
                "dot11.advertisedssid.beacon_info": {
                    "dot11.beacon.interval": dev.get("beacon_interval") or 100
                }
            }
            for s in dev["ssid_history"]
        ]
    if dev.get("probe_ssids"):
        dot11["dot11.device.probed_ssid_map"] = [
            {"dot11.probedssid.ssid": s} for s in dev["probe_ssids"]
        ]
    if dev.get("associated_bssid"):
        dot11["dot11.device.last_bssid"] = dev["associated_bssid"]
    return dot11



# full kismet capture
def _mode_kismet_live(scan_type):

    try:
        from pi_kismet_parser import parse_kismet_devices
        from pi_analyser import analyse_devices
    except ImportError as e:
        log.error("kismet live: missing dependency: %s", e)
        return None

    duration = SCAN_DURATIONS.get(scan_type, 120)
    prefix   = scan_type.replace(" ", "_").lower()

    proc, db_path = _start_kismet(prefix)
    try:
        log.info("kismet live: capturing for %ds", duration)
        time.sleep(duration)
    finally:
        _stop_kismet(proc)

    mode    = "passive" if scan_type == "Passive" else "deep_passive"
    devices = parse_kismet_devices(db_path, mode=mode)
    if devices is None:
        return None

    if scan_type == "Active":
        ip_targets = [d["ip"] for d in devices if d.get("ip")]
        nmap_hosts = _run_nmap(ip_targets)
        devices    = _merge_nmap(devices, nmap_hosts)

    if scan_type in ("Deep Passive", "Active"):
        devices = analyse_devices(devices, scan_type=scan_type)

    log.info("kismet_live: %s — %d devices", scan_type, len(devices))
    return {
        "devices":   devices,
        "bandwidth": _determine_bandwidth(db_path, duration),
    }

# start kismet
def _start_kismet(prefix):
    os.makedirs(KISMET_DATA_DIR, exist_ok=True)
    db_path = os.path.join(
        KISMET_DATA_DIR,
        f"{prefix}_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.kismet"
    )
    cmd = [
        "kismet", "--no-ncurses",
        "-c", KISMET_INTERFACE,
        "--log-prefix", KISMET_DATA_DIR + "/",
        "--log-title",  prefix,
        "--log-types",  "kismet",
    ]
    log.info("starting Kismet: %s", " ".join(cmd))
    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                            preexec_fn=os.setsid)
    time.sleep(5)
    return proc, db_path

# stop kismet
def _stop_kismet(proc):
    try:
        os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
        proc.wait(timeout=15)
        log.info("Kismet stopped cleanly")
    except Exception as e:
        log.warning("problem stopping Kismet: %s", e)
        proc.kill()

# run nmap
def _run_nmap(targets):
    if not targets:
        return []
    import xml.etree.ElementTree as ET
    try:
        proc = subprocess.run(
            ["nmap", "-sn", "-oX", "-"] + targets,
            capture_output=True, text=True, timeout=120
        )
        root  = ET.fromstring(proc.stdout)
        hosts = []
        for host in root.findall("host"):
            status = host.find("status")
            if status is None or status.get("state") != "up":
                continue
            addr_el = host.find("address[@addrtype='ipv4']")
            mac_el  = host.find("address[@addrtype='mac']")
            hosts.append({
                "ip":     addr_el.get("addr")  if addr_el is not None else None,
                "mac":    mac_el.get("addr")   if mac_el  is not None else None,
                "vendor": mac_el.get("vendor") if mac_el  is not None else None,
            })
        return hosts
    except Exception as e:
        log.warning("Nmap error: %s", e)
        return []

# merge nmap to devices
def _merge_nmap(devices, nmap_hosts):
    nmap_by_mac = {h["mac"].upper(): h for h in nmap_hosts if h.get("mac")}
    for dev in devices:
        mac = (dev.get("mac") or "").upper()
        if mac in nmap_by_mac:
            dev["ip"]         = nmap_by_mac[mac].get("ip")
            dev["open_ports"] = nmap_by_mac[mac].get("open_ports", [])
    return devices

# determine bandwidth
def _determine_bandwidth(db_path, duration):
    size = os.path.getsize(db_path) if os.path.exists(db_path) else 0
    rate = size / max(duration, 1)
    if rate < 5_000:
        return "Low"
    if rate < 20_000:
        return "Medium"
    return "High"


# replase auto timestamp with realistic times
def _fill_timestamps(devices, scan_type):
  
    duration   = SCAN_DURATIONS.get(scan_type, 120)
    scan_end   = datetime.now(timezone.utc)
    scan_start = scan_end - timedelta(seconds=duration)

    result = []
    for d in devices:
        dev = dict(d)
        dev.pop("time_seen", None)

        offset_first = random.randint(0, max(1, int(duration * 0.6)))
        offset_last  = random.randint(offset_first + 5, duration)

        first_dt = scan_start + timedelta(seconds=offset_first)
        last_dt  = scan_start + timedelta(seconds=offset_last)

        if dev.get("first_seen") == "auto" or "first_seen" not in dev:
            dev["first_seen"] = first_dt.isoformat()
        if dev.get("last_seen") == "auto" or "last_seen" not in dev:
            dev["last_seen"]  = last_dt.isoformat()

        try:
            fs = datetime.fromisoformat(dev["first_seen"])
            ls = datetime.fromisoformat(dev["last_seen"])
            dev["total_time_seen"] = max(0, int((ls - fs).total_seconds()))
        except (ValueError, TypeError):
            dev["total_time_seen"] = 0

        result.append(dev)

    return result