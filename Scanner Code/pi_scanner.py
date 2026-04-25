# pi scanner - runs the scans and returns the data

import subprocess
import logging
import time
import os
import signal
from datetime import datetime, timezone

from pi_kismet_parser import parse_kismet_devices
from pi_analyser import analyse_devices
from pi_config import KISMET_INTERFACE, KISMET_DATA_DIR, SCAN_DURATIONS

log = logging.getLogger(__name__)

# durations
PASSIVE_DURATION      = SCAN_DURATIONS.get("Passive",      120)
DEEP_PASSIVE_DURATION = SCAN_DURATIONS.get("Deep Passive", 600)
ACTIVE_DURATION       = SCAN_DURATIONS.get("Active",       300)


# start kismet
def _start_kismet(log_prefix: str) -> tuple[subprocess.Popen, str]:
    os.makedirs(KISMET_DATA_DIR, exist_ok=True)
    db_path = os.path.join(KISMET_DATA_DIR, f"{log_prefix}_{_now_stamp()}.kismet")

    cmd = [
        "kismet",
        "--no-ncurses",
        "-c", KISMET_INTERFACE,
        "--log-prefix", KISMET_DATA_DIR + "/",
        "--log-title", log_prefix,
        "--log-types", "kismet",   
    ]

    log.info("starting Kismet: %s", " ".join(cmd))
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        preexec_fn=os.setsid,   
    )

    # let kismet initialise 
    time.sleep(5)
    return proc, db_path


# send sigterm
def _stop_kismet(proc: subprocess.Popen):

    try:
        os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
        proc.wait(timeout=15)
        log.info("Kismet stopped cleanly")
    except Exception as e:
        log.warning("problem stopping Kismet: %s", e)
        proc.kill()


# nmap scan 
def _run_nmap(targets: list[str]) -> list[dict]:

    if not targets:
        return []

    results = []
    target_str = " ".join(targets)
    cmd = ["nmap", "-sn", "-oX", "-", target_str]

    log.info("running Nmap against %d hosts", len(targets))
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        results = _parse_nmap_xml(proc.stdout)
        log.info("Nmap found %d responsive hosts", len(results))
    except FileNotFoundError:
        log.warning("Nmap not found – skipping active host sweep")
    except subprocess.TimeoutExpired:
        log.warning("Nmap timed out")
    except Exception as e:
        log.error("Nmap error: %s", e)

    return results

# xml parser 
def _parse_nmap_xml(xml_text: str) -> list[dict]:
    import xml.etree.ElementTree as ET
    hosts = []
    try:
        root = ET.fromstring(xml_text)
        for host in root.findall("host"):
            status = host.find("status")
            if status is None or status.get("state") != "up":
                continue
            addr_el = host.find("address[@addrtype='ipv4']")
            mac_el  = host.find("address[@addrtype='mac']")
            entry = {
                "ip":     addr_el.get("addr")  if addr_el is not None else None,
                "mac":    mac_el.get("addr")   if mac_el  is not None else None,
                "vendor": mac_el.get("vendor") if mac_el  is not None else None,
            }
            ports = []
            for p in host.findall(".//port"):
                state = p.find("state")
                if state is not None and state.get("state") == "open":
                    ports.append(int(p.get("portid", 0)))
            if ports:
                entry["open_ports"] = ports
            hosts.append(entry)
    except ET.ParseError as e:
        log.warning("could not parse Nmap XML: %s", e)
    return hosts


def _now_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _merge_nmap(devices: list[dict], nmap_hosts: list[dict]) -> list[dict]:
    nmap_by_mac = {h["mac"].upper(): h for h in nmap_hosts if h.get("mac")}
    for dev in devices:
        mac = (dev.get("mac") or "").upper()
        if mac in nmap_by_mac:
            dev["ip"]         = nmap_by_mac[mac].get("ip")
            dev["open_ports"] = nmap_by_mac[mac].get("open_ports", [])
    return devices


def _determine_bandwidth(db_path: str, duration: int) -> str:

    size = os.path.getsize(db_path) if os.path.exists(db_path) else 0

    # rough heuristic of file size per second
    rate = size / max(duration, 1)
    if rate < 5_000:
        return "Low"
    if rate < 20_000:
        return "Medium"
    return "High"


# run the scan 
def run_scan(scan_type: str) -> dict | None:

    log.info("starting %s scan", scan_type)
    scan_type_norm = scan_type.strip()

    if scan_type_norm == "Passive":
        return _run_passive(PASSIVE_DURATION)
    elif scan_type_norm == "Deep Passive":
        return _run_deep_passive(DEEP_PASSIVE_DURATION)
    elif scan_type_norm == "Active":
        return _run_active(ACTIVE_DURATION)
    else:
        log.error("unknown scan type: %s", scan_type)
        return None


# passive scans 
def _run_passive(duration: int) -> dict | None:
    proc, db_path = _start_kismet("passive")
    try:
        log.info("passive scan running for %ds", duration)
        time.sleep(duration)
    finally:
        _stop_kismet(proc)

    devices = parse_kismet_devices(db_path, mode="passive")
    if devices is None:
        return None

    # strip field 
    for dev in devices:
        dev.pop("probe_ssids",      None)
        dev.pop("signal_variance",  None)
        dev.pop("beacon_interval",  None)
        dev.pop("ssid_history",     None)
        dev.pop("associated_bssid", None)
        dev.pop("deauth_count",     None)
        dev.pop("frame_count",      None)

    bandwidth = _determine_bandwidth(db_path, duration)
    log.info("passive scan complete – %d devices", len(devices))
    return {"scan_type": "Passive", "devices": devices, "bandwidth": bandwidth}

#deep passive
def _run_deep_passive(duration: int) -> dict | None:

    proc, db_path = _start_kismet("deep_passive")
    try:
        log.info("deep passive scan running for %ds", duration)
        time.sleep(duration)
    finally:
        _stop_kismet(proc)

    devices = parse_kismet_devices(db_path, mode="deep_passive")
    if devices is None:
        return None

    devices = analyse_devices(devices, scan_type="Deep Passive")

    bandwidth = _determine_bandwidth(db_path, duration)
    log.info("deep passive scan complete – %d devices", len(devices))
    return {"scan_type": "Deep Passive", "devices": devices, "bandwidth": bandwidth}


# active scan 
def _run_active(duration: int) -> dict | None:
    proc, db_path = _start_kismet("active")
    try:
        log.info("active scan running for %ds", duration)
        time.sleep(duration)
    finally:
        _stop_kismet(proc)

    devices = parse_kismet_devices(db_path, mode="active")
    if devices is None:
        return None

    # build target IP list from devices that advertised an IP
    ip_targets = [d["ip"] for d in devices if d.get("ip")]
    nmap_hosts = _run_nmap(ip_targets)
    devices = _merge_nmap(devices, nmap_hosts)

    devices = analyse_devices(devices, scan_type="Active")

    bandwidth = _determine_bandwidth(db_path, duration)
    log.info("active scan complete – %d devices", len(devices))
    return {"scan_type": "Active", "devices": devices, "bandwidth": bandwidth}