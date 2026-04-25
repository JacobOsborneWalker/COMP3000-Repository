# pi analyser - analyses scan results for suspicious patterns and flags threats

import logging
from collections import defaultdict

log = logging.getLogger(__name__)


## threshhold
# number of distinct probe SSIDs 
PROBE_COUNT_THRESHOLD = 5

# signal variance 
# potentially spoofed
SIGNAL_VARIANCE_THRESHOLD = 10.0

# beacon interval 
BEACON_INTERVAL_EXPECTED = 100
BEACON_INTERVAL_TOLERANCE = 20    

# number of distinct SSIDs advertised from one MAC 
MULTI_SSID_THRESHOLD = 2

# number of deauth frames received before being flagged
DEAUTH_THRESHOLD = 5



def analyse_devices(devices: list[dict], scan_type: str = "Deep Passive") -> list[dict]:

    log.info("analysing %d devices (%s)", len(devices), scan_type)


    known_ap_bssids  = _known_ap_map(devices)   
    flagged_bssids   = _flagged_bssids(devices)  

    for dev in devices:
        flags = set(_split_flags(dev.get("flags", "")))

        flags |= _check_probe_ssids(dev)
        flags |= _check_signal_variance(dev)
        flags |= _check_beacon_interval(dev)
        flags |= _check_multi_ssid(dev)
        flags |= _check_association(dev, flagged_bssids)
        flags |= _check_deauths(dev)
        flags |= _check_evil_twin(dev, known_ap_bssids)

        dev["flags"] = _join_flags(flags)

    summary = _build_summary(devices)
    log.info(
        "analysis complete – %d suspicious, %d rogue APs, %d clean",
        summary["suspicious"], summary["rogue_ap"], summary["clean"]
    )
    return devices



# check probe SSID
def _check_probe_ssids(dev: dict) -> set[str]:
 
    probes = dev.get("probe_ssids") or []
    if len(probes) >= PROBE_COUNT_THRESHOLD:
        log.debug("%s flagged: %d probe SSIDs", dev.get("mac"), len(probes))
        return {"Suspicious"}
    return set()


# check signal variance
def _check_signal_variance(dev: dict) -> set[str]:
 
    var = dev.get("signal_variance")
    if var is not None and var > SIGNAL_VARIANCE_THRESHOLD:
        log.debug("%s flagged: signal variance %.1f", dev.get("mac"), var)
        return {"Suspicious"}
    return set()


# check beacon intervals
def _check_beacon_interval(dev: dict) -> set[str]:

    bi = dev.get("beacon_interval")
    if bi is None:
        return set()
    deviation = abs(bi - BEACON_INTERVAL_EXPECTED)
    if deviation > BEACON_INTERVAL_TOLERANCE:
        log.debug("%s flagged: beacon interval %dms", dev.get("mac"), bi)
        return {"Suspicious"}
    return set()


# check multiple SSIDs
def _check_multi_ssid(dev: dict) -> set[str]:
 
    history = dev.get("ssid_history") or []
    unique  = len(set(history))
    if unique >= MULTI_SSID_THRESHOLD:
        log.debug("%s flagged: %d SSIDs from one MAC", dev.get("mac"), unique)
        return {"Rogue AP"}
    return set()


# check associations
def _check_association(dev: dict, flagged_bssids: set[str]) -> set[str]:

    assoc = (dev.get("associated_bssid") or "").upper()
    if assoc and assoc in flagged_bssids:
        log.debug(
            "%s flagged: associated with flagged BSSID %s",
            dev.get("mac"), assoc
        )
        return {"Suspicious"}
    return set()


# check deauths
def _check_deauths(dev: dict) -> set[str]:
   
    count = dev.get("deauth_count") or 0
    if count >= DEAUTH_THRESHOLD:
        log.debug("%s flagged: %d deauths received", dev.get("mac"), count)
        return {"Suspicious"}
    return set()


# check evil twins
def _check_evil_twin(dev: dict, known_ap_bssids: dict[str, set[str]]) -> set[str]:

    mac     = (dev.get("mac") or "").upper()
    history = set(dev.get("ssid_history") or [])

    if not history:
        return set()

    for bssid, ssids in known_ap_bssids.items():
        if bssid == mac:
            continue
        if ssids & history:

            # another =mac with same SSID 
            log.warning(
                "evil twin suspected: %s and %s both advertise %s",
                mac, bssid, ssids & history
            )
            return {"Rogue AP"}
    return set()



def _known_ap_map(devices: list[dict]) -> dict[str, set[str]]:
    ap_map: dict[str, set[str]] = defaultdict(set)
    for dev in devices:
        mac     = (dev.get("mac") or "").upper()
        history = dev.get("ssid_history") or []
        if mac and history:
            ap_map[mac].update(history)
    return dict(ap_map)


def _flagged_bssids(devices: list[dict]) -> set[str]:
    return {
        (dev.get("mac") or "").upper()
        for dev in devices
        if dev.get("flags")
    }


def _split_flags(flags_str: str) -> list[str]:
    return [f.strip() for f in flags_str.split(",") if f.strip()]


def _join_flags(flags: set[str]) -> str:

    ordered = []
    if "Rogue AP" in flags:
        ordered.append("Rogue AP")
    if "Suspicious" in flags:
        ordered.append("Suspicious")
    others = sorted(flags - {"Rogue AP", "Suspicious"})
    return ", ".join(ordered + others)


def _build_summary(devices: list[dict]) -> dict:
    suspicious = sum(1 for d in devices if "Suspicious" in (d.get("flags") or ""))
    rogue_ap   = sum(1 for d in devices if "Rogue AP"   in (d.get("flags") or ""))
    clean      = len(devices) - suspicious - rogue_ap
    return {"suspicious": suspicious, "rogue_ap": rogue_ap, "clean": max(clean, 0)}