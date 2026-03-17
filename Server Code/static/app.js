document.addEventListener("DOMContentLoaded", () => {

    const API_URL = "/api";
    let currentUser = null;

    const loginScreen    = document.getElementById("loginScreen");
    const loginUser      = document.getElementById("loginUser");
    const loginPass      = document.getElementById("loginPass");
    const loginError     = document.getElementById("loginError");
    const loginBtn       = document.getElementById("loginBtn");
    const app            = document.getElementById("app");
    const userInfo       = document.getElementById("userInfo");
    const btnLogout      = document.getElementById("btnLogout");
    const btnAdminQuick  = document.getElementById("btnAdminQuick");
    const tilesContainer = document.getElementById("tiles");
    const submitScanBtn  = document.getElementById("submitScanBtn");

    // roles
    const rolePages = {
        admin:      ["createScan", "approval", "results", "nodes", "admin", "dashboard"],
        safeguard:  ["approval", "results", "nodes", "dashboard"],
        technician: ["createScan", "results", "nodes", "dashboard"],
        auditor:    ["results", "nodes", "dashboard"]
    };


    // icons and pages
    const tileDefs = [
        { title: "Create Scan",      icon: "wifi_tethering",      page: "createScan" },
        { title: "Approve Requests", icon: "assignment_turned_in", page: "approval"   },
        { title: "Scan Results",     icon: "wifi",                 page: "results"    },
        { title: "Node Health",      icon: "memory",               page: "nodes"      }
    ];

    loginBtn.addEventListener("click", handleLogin);
    btnLogout.addEventListener("click", logout);
    loginPass.addEventListener("keydown", e => { if (e.key === "Enter") handleLogin(); });
    if (submitScanBtn) submitScanBtn.addEventListener("click", submitScan);


     // dom helper
    function el(tag, className, text) {
        const e = document.createElement(tag);
        if (className) e.className = className;
        if (text !== undefined) e.textContent = text;
        return e;
    }

    // add a row of plain text
    function addRow(tbody, cells) {
        const tr = tbody.insertRow();
        cells.forEach(val => {
            tr.insertCell().textContent = val ?? "";
        });
        return tr;
    }

    // add a single message row
    function emptyRow(tbody, colspan, message) {
        const td = tbody.insertRow().insertCell();
        td.colSpan = colspan;
        td.className = "table-loading";
        td.textContent = message;
    }

    // clear a tbody
    function clearTable(selector, loadingMsg, colspan) {
        const tbody = document.querySelector(selector);
        if (!tbody) return null;
        tbody.innerHTML = "";
        if (loadingMsg) emptyRow(tbody, colspan, loadingMsg);
        return tbody;
    }

    // create a button 
    function btn(label, className, onClick) {
        const b = el("button", className, label);
        b.onclick = onClick;
        return b;
    }

    // format a datetime string for display
    function fmtDate(str) {
        if (!str) return "N/A";
        return str.slice(0, 16).replace("T", " ");
    }



    // api
    function getToken() {
        return localStorage.getItem("authToken");
    }

    function apiFetch(path, options = {}) {
        return fetch(`${API_URL}${path}`, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                "Authorisation": `Bearer ${getToken()}`
            }
        }).then(r => r.json().then(data => ({ status: r.status, data })));
    }


    // handle login
    function handleLogin() {
        const username = loginUser.value.trim();
        const password = loginPass.value;

        if (!username || !password) {
            showLoginError("Please enter a username and password.");
            return;
        }

        fetch(`${API_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        })
        .then(r => r.json().then(data => ({ status: r.status, data })))
        .then(resp => {
            if (resp.status === 200) {
                localStorage.setItem("authToken", resp.data.access_token);
                setupSession(username, resp.data.role);
            } else {
                showLoginError(resp.data.error || "Login failed.");
            }
        })
        // flask not running
        .catch(() => showLoginError("Cannot reach server. is Flask running?"));
    }

    function showLoginError(msg) {
        loginError.textContent = msg;
        loginError.classList.remove("hidden");
    }

    // login erro
    function setupSession(name, role) {
        currentUser = { name, role };
        userInfo.textContent = `${name} (${role})`;
        loginScreen.classList.add("hidden");
        app.classList.remove("hidden");
        btnAdminQuick.classList.toggle("hidden", role !== "admin");
        btnAdminQuick.onclick = () => showPage("admin");
        buildTiles(role);
        showPage("dashboard");
        startKeepalive();
    }


    // logout
    function logout() {
        stopKeepalive();
        apiFetch("/logout", { method: "POST" }).catch(() => {});
        localStorage.removeItem("authToken");
        currentUser = null;
        app.classList.add("hidden");
        loginScreen.classList.remove("hidden");
        loginPass.value = "";
        loginError.classList.add("hidden");
        document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
    }


    // keepalive
    let keepaliveInterval = null;

    function startKeepalive() {
        keepaliveInterval = setInterval(() => {
            fetch(`${API_URL}/ping`).catch(() => {});
        }, 240000);
    }

    function stopKeepalive() {
        clearInterval(keepaliveInterval);
        keepaliveInterval = null;
    }


    // built tiles
    function buildTiles(role) {
        tilesContainer.innerHTML = "";
        tileDefs.forEach(tile => {
            if (!rolePages[role].includes(tile.page)) return;
            const div = el("div", "tile");
            div.append(el("span", "material-icons", tile.icon), el("h3", null, tile.title));
            div.onclick = () => showPage(tile.page);
            tilesContainer.appendChild(div);
        });
    }

    function showPage(id) {
        document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
        const page = document.getElementById(id);
        if (page) page.classList.remove("hidden");

        if (id === "createScan") setupCreateScanPage();
        if (id === "approval")   loadApprovalPage();
        if (id === "results")    loadResultsPage();
        if (id === "nodes")      loadNodesPage();
        if (id === "admin")      loadAdminPage();
    }


    // create scan page
    function setupCreateScanPage() {
        const select = document.getElementById("scanTypeSelect");
        if (!select) return;

        select.innerHTML = '<option value="">Select Type</option>';
        
        // descriptions
        const scanDescriptions = {
            "Passive":      "Listens passively for broadcast frames. No packets are sent. Suitable for routine monitoring.",
            "Active":       "Sends probe requests to elicit responses from nearby devices. More thorough but more detectable. Requires justification and password confirmation.",
            "Deep Passive": "Extended passive capture with behavioural analysis — probe patterns, beacon anomalies, signal variance, deauth volume, and client association mapping. Runs for a longer window."
        };

        const allTypes = [
            { value: "Passive",      label: "Passive Scan" },
            { value: "Active",       label: "Active Scan" },
            { value: "Deep Passive", label: "Deep Passive Scan" }
        ];
        const techTypes = [
            { value: "Passive", label: "Passive Scan (Routine)" }
        ];

        const types = currentUser.role === "technician" ? techTypes : allTypes;
        types.forEach(t => {
            const opt = el("option", null, t.label);
            opt.value = t.value;
            select.appendChild(opt);
        });


        let descBox = document.getElementById("scanTypeDesc");
        if (!descBox) {
            descBox = document.createElement("p");
            descBox.id = "scanTypeDesc";
            descBox.className = "schedule-hint";
            select.parentNode.appendChild(descBox);
        }

        const notesLabel = document.querySelector("label[for='scanNotes']");
        select.onchange = function() {
            descBox.textContent = scanDescriptions[this.value] || "";
            if (!notesLabel) return;
            if (this.value === "Active") {
                notesLabel.innerHTML = 'Justification <span style="color:var(--danger)">* required for Active scans</span>';
            } else {
                notesLabel.textContent = "Notes";
            }
        };
    }

    function submitScan() {
        const network   = document.getElementById("networkSelect").value;
        const scan_type = document.getElementById("scanTypeSelect").value;
        const notes     = document.getElementById("scanNotes").value.trim();
        const scanDate  = document.getElementById("scanDate").value;
        const scanHour  = document.getElementById("scanHour").value;
        const scanMin   = document.getElementById("scanMinute").value;

        if (!network || !scan_type) {
            alert("Please select a network and scan type.");
            return;
        }

        if (scan_type === "Active" && !notes) {
            alert("Active scans require a justification in the Notes field.");
            document.getElementById("scanNotes").focus();
            return;
        }

        let scheduled_at = null;
        if (scanDate && scanHour && scanMin) {
            scheduled_at = `${scanDate}T${scanHour}:${scanMin}:00`;
        } else if (scanDate || scanHour || scanMin) {
            alert("Please fill in the full schedule (date, hour and minute) or leave all blank.");
            return;
        }

        const doSubmit = (password) => {
            apiFetch("/requests", {
                method: "POST",
                body: JSON.stringify({ network, scan_type, notes, scheduled_at, password })
            }).then(resp => {
                if (resp.status === 201) {
                    alert(`Scan submitted — your ID is #${resp.data.id}`);
                    clearScanForm();
                } else {
                    alert(resp.data.error || "Failed to submit scan.");
                }
            });
        };

        if (scan_type === "Active") {
            showPasswordModal(
                "Active Scan - Password Confirmation",
                "Active scans require additional authorisation. Please re-enter your password to continue.",
                doSubmit
            );
        } else {
            doSubmit(null);
        }
    }

    function clearScanForm() {
        ["networkSelect", "scanTypeSelect", "scanNotes", "scanDate", "scanHour", "scanMinute"]
            .forEach(id => { document.getElementById(id).value = ""; });
        const descBox = document.getElementById("scanTypeDesc");
        if (descBox) descBox.textContent = "";
        const notesLabel = document.querySelector("label[for='scanNotes']");
        if (notesLabel) notesLabel.textContent = "Notes";
    }



    // approval page
    function loadApprovalPage() {
        apiFetch("/requests").then(resp => {
            if (resp.status !== 200) return;
            renderPendingTable(resp.data.filter(r => r.status === "pending"));
            renderHistoryTable(resp.data.filter(r => r.status !== "pending"));
        });
    }

    function renderPendingTable(requests) {
        const tbody = clearTable("#pendingTable tbody");
        if (!tbody) return;

        if (requests.length === 0) {
            emptyRow(tbody, 7, "No pending requests");
            return;
        }

        requests.forEach(r => {
            const isSelf     = r.requested_by === currentUser.name;
            const canApprove = ["admin", "safeguard"].includes(currentUser.role);
            const time       = fmtDate(r.scheduled_at || r.created_at);

            const tr = addRow(tbody, [r.id, r.requested_by, r.network, r.scan_type, time, r.notes || "N/A"]);
            const actionCell = tr.insertCell();

            if (isSelf) {
                actionCell.appendChild(btn("Cancel", "cancel-btn", () => cancelScanRequest(r.id)));
                actionCell.appendChild(el("span", "self-request-note", " Awaiting another user to approve"));
            } else if (canApprove) {
                actionCell.appendChild(btn("Approve", "", () => approveScanRequest(r.id, r.scan_type)));
                actionCell.appendChild(btn("Decline", "", () => declineScanRequest(r.id)));
            } else {
                actionCell.appendChild(el("span", "self-request-note", "Awaiting approval"));
            }
        });
    }

    function renderHistoryTable(requests) {
        const tbody = clearTable("#historyTable tbody");
        if (!tbody) return;

        if (requests.length === 0) {
            emptyRow(tbody, 5, "No history yet");
            return;
        }

        requests.forEach(r => {
            const tr = tbody.insertRow();

            tr.insertCell().textContent = r.id;

            const statusCell = tr.insertCell();
            statusCell.textContent = r.status.charAt(0).toUpperCase() + r.status.slice(1);
            statusCell.classList.add(r.status === "approved" ? "status-approved" : "status-declined");

            [r.requested_by, r.approved_by || "N/A", `${r.network} | ${r.scan_type}`].forEach(val => {
                tr.insertCell().textContent = val;
            });
        });
    }

    function approveScanRequest(id, scanType) {
        const doApprove = (password) => {
            apiFetch(`/requests/${id}/approve`, {
                method: "POST",
                body: JSON.stringify({ password })
            }).then(resp => {
                if (resp.status === 200) {
                    alert(`Request #${id} approved.`);
                    loadApprovalPage();
                } else {
                    alert(resp.data.error || "Failed to approve.");
                }
            });
        };

        if (scanType === "Active") {
            showPasswordModal(
                "Approve Active Scan - Password Confirmation",
                `Approving an Active scan requires password confirmation. Please re-enter your password to approve request #${id}.`,
                doApprove
            );
        } else {
            if (!confirm(`Approve request #${id}?`)) return;
            doApprove(null);
        }
    }

    function declineScanRequest(id) {
        if (!confirm(`Decline request #${id}?`)) return;
        apiFetch(`/requests/${id}/decline`, { method: "POST" }).then(resp => {
            if (resp.status === 200) {
                alert(`Request #${id} declined.`);
                loadApprovalPage();
            } else {
                alert(resp.data.error || "Failed to decline.");
            }
        });
    }

    function cancelScanRequest(id) {
        if (!confirm(`Cancel request #${id}? This cannot be undone.`)) return;
        apiFetch(`/requests/${id}/cancel`, { method: "POST" }).then(resp => {
            if (resp.status === 200) {
                alert(`Request #${id} cancelled.`);
                loadApprovalPage();
            } else {
                alert(resp.data.error || "Failed to cancel.");
            }
        });
    }


    // results page
    function loadResultsPage() {
        apiFetch("/results").then(resp => {
            if (resp.status !== 200) return;
            populateScanSelect(resp.data);
        });
    }

    function populateScanSelect(scans) {
        const old = document.getElementById("scanSelect");
        const fresh = old.cloneNode(false);
        fresh.innerHTML = '<option value="">-- Choose Scan --</option>';

        scans.forEach(s => {
            const opt = el("option", null, `#${s.id} | ${fmtDate(s.created_at)} | ${s.scan_type} | ${s.network}`);
            opt.value = s.id;
            fresh.appendChild(opt);
        });

        fresh.onchange = function() {
            if (this.value) displayScanResults(this.value);
        };

        old.parentNode.replaceChild(fresh, old);
    }

    function displayScanResults(resultId) {
        apiFetch(`/results/${resultId}`).then(resp => {
            if (resp.status !== 200) return;
            const { metadata, devices, summary } = resp.data;
            const isRich = metadata.scan_type === "Active" || metadata.scan_type === "Deep Passive";

            const metaTbody = clearTable("#scanMetadataTable tbody");
            if (metaTbody) {
                addRow(metaTbody, [
                    `#${metadata.id}`, metadata.requested_by, metadata.approved_by || "N/A",
                    metadata.network, metadata.scan_type, fmtDate(metadata.created_at)
                ]);
            }

            // devices table 
            const devicesTable = document.getElementById("devicesTable");
            const devicesTbody = clearTable("#devicesTable tbody");

            const baseHeaders = ["MAC", "Vendor", "Signal (dBm)", "Channel", "Time Seen", "Flags", "Status"];
            const richHeaders  = ["Frame Count", "Signal Variance", "Beacon Interval", "Probe SSIDs", "SSID History", "Associated BSSID", "Deauth Frames"];
            const headers = isRich ? [...baseHeaders, ...richHeaders] : baseHeaders;

            const thead = devicesTable.querySelector("thead");
            thead.innerHTML = "";
            const headerRow = thead.insertRow();
            headers.forEach(h => {
                const th = document.createElement("th");
                th.textContent = h;
                headerRow.appendChild(th);
            });

            if (devicesTbody) {
                devices.forEach(d => {
                    const tr = addRow(devicesTbody, [
                        d.mac, d.vendor, d.signal, d.channel,
                        fmtDate(d.time_seen), d.flags || "None"
                    ]);
                    if (!d.known) tr.classList.add("unknown-device");

                    const badge = el("span", d.known ? "badge known" : "badge unknown");
                    badge.textContent = d.known ? `Known: ${d.label}` : "Unknown Device";
                    tr.insertCell().appendChild(badge);

                    if (isRich) {
                        addCellText(tr, d.frame_count != null ? d.frame_count : "N/A");

                        const varCell = tr.insertCell();
                        if (d.signal_variance != null) {
                            varCell.textContent = d.signal_variance.toFixed(1);
                            if (d.signal_variance > 10) varCell.classList.add("flag-warning");
                        } else {
                            varCell.textContent = "N/A";
                        }

                        const beaconCell = tr.insertCell();
                        if (d.beacon_interval != null) {
                            beaconCell.textContent = `${d.beacon_interval} ms`;
                            if (d.beacon_interval !== 100) beaconCell.classList.add("flag-warning");
                        } else {
                            beaconCell.textContent = "N/A";
                        }

                        const probeCell = tr.insertCell();
                        const probeCount = d.probe_ssids ? d.probe_ssids.length : 0;
                        probeCell.textContent = probeCount > 0 ? `${probeCount} SSIDs` : "None";
                        probeCell.title = d.probe_ssids ? d.probe_ssids.join(", ") : "";
                        if (probeCount >= 5) probeCell.classList.add("flag-warning");

                        const histCell = tr.insertCell();
                        const histCount = d.ssid_history ? d.ssid_history.length : 0;
                        histCell.textContent = histCount > 0 ? d.ssid_history.join(", ") : "None";

                        addCellText(tr, d.associated_bssid || "None");

                        const deauthCell = tr.insertCell();
                        deauthCell.textContent = d.deauth_count != null ? d.deauth_count : 0;
                        if (d.deauth_count > 0) deauthCell.classList.add("flag-danger");
                    }
                });
            }

            // summary table
            const summaryTable = document.getElementById("summaryTable");
            const summaryTbody = clearTable("#summaryTable tbody");

            const baseSummaryHeaders = ["Total Devices", "Suspicious", "Rogue AP", "Bandwidth"];
            const richSummaryHeaders = ["Total Deauth Frames", "Unknown Associations"];
            const summaryHeaders = isRich ? [...baseSummaryHeaders, ...richSummaryHeaders] : baseSummaryHeaders;

            const summaryThead = summaryTable.querySelector("thead");
            summaryThead.innerHTML = "";
            const summaryHeaderRow = summaryThead.insertRow();
            summaryHeaders.forEach(h => {
                const th = document.createElement("th");
                th.textContent = h;
                summaryHeaderRow.appendChild(th);
            });

            if (summaryTbody) {
                const baseCells = [
                    summary.total_devices, summary.suspicious,
                    summary.rogue_ap ? "Yes" : "No", summary.bandwidth
                ];
                const richCells = isRich ? [
                    summary.total_deauth_frames || 0,
                    summary.unknown_associations || 0
                ] : [];
                addRow(summaryTbody, [...baseCells, ...richCells]);
            }

            window._currentScanData = { metadata, devices, summary };
        });
    }

    // add a plain text
    function addCellText(tr, text) {
        tr.insertCell().textContent = text;
    }

    document.getElementById("exportCSV").addEventListener("click", () => {
        const d = window._currentScanData;
        if (!d) { alert("Select a scan first."); return; }

        const m = d.metadata;
        const rows = [
            "data:text/csv;charset=utf-8,",
            "Request ID,Requested By,Approved By,Network,Scan Type,Timestamp",
            `${m.id},${m.requested_by},${m.approved_by || ""},${m.network},${m.scan_type},${m.created_at}`,
            "",
            "Device MAC,Vendor,Signal,Channel,Time Seen,Flags,Status",
            ...d.devices.map(dev =>
                `${dev.mac},${dev.vendor},${dev.signal},${dev.channel},${dev.time_seen || ""},${dev.flags || ""},${dev.known ? "Known" : "Unknown"}`
            ),
            "",
            "Total Devices,Suspicious,Rogue AP,Bandwidth",
            `${d.summary.total_devices},${d.summary.suspicious},${d.summary.rogue_ap ? "Yes" : "No"},${d.summary.bandwidth}`
        ];
        const csv = rows.join("\n");

        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csv));
        link.setAttribute("download", `scan_${d.metadata.id}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    });

    document.getElementById("exportJSON").addEventListener("click", () => {
        const d = window._currentScanData;
        if (!d) { alert("Select a scan first."); return; }

        const blob = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `scan_${d.metadata.id}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
    });

    document.getElementById("exportPDF").addEventListener("click", () => {
        alert("PDF export not yet implemented.");
    });


    // admin page
    function loadAdminPage() {
        apiFetch("/known-devices").then(resp => {
            if (resp.status !== 200) return;
            renderKnownDevices(resp.data);
        });
    }

    function renderKnownDevices(devices) {
        const container = document.getElementById("knownDevicesSection");
        if (!container) return;
        container.innerHTML = "";

        container.appendChild(el("h3", null, "Known Device Registry"));

        const table = el("table");
        table.id = "knownDevicesTable";
        const headerRow = table.createTHead().insertRow();
        ["MAC Address", "Label", "Added By", "Added At", "Action"].forEach(h => {
            headerRow.insertCell().textContent = h;
        });
        const tbody = table.createTBody();

        if (devices.length === 0) {
            emptyRow(tbody, 5, "No devices registered");
        } else {
            devices.forEach(d => {
                const tr = addRow(tbody, [d.mac, d.label, d.added_by, fmtDate(d.added_at)]);
                tr.insertCell().appendChild(btn("Remove", "danger-btn", () => removeKnownDevice(d.id, d.label)));
            });
        }

        container.appendChild(table);

        // add device form
        const form = el("div", "add-device-form");
        form.appendChild(el("h4", null, "Add Known Device"));

        const macGroup = el("div", "form-group");
        macGroup.appendChild(el("label", null, "MAC Address"));
        const macInput = el("input");
        macInput.type = "text"; macInput.id = "newDeviceMAC"; macInput.placeholder = "e.g. AA:BB:CC:11:22:33";
        macGroup.appendChild(macInput);

        const labelGroup = el("div", "form-group");
        labelGroup.appendChild(el("label", null, "Label"));
        const labelInput = el("input");
        labelInput.type = "text"; labelInput.id = "newDeviceLabel"; labelInput.placeholder = "e.g. Reception Laptop";
        labelGroup.appendChild(labelInput);

        form.append(macGroup, labelGroup, btn("Add Device", "primary-btn", addKnownDevice));
        container.appendChild(form);
    }

    function addKnownDevice() {
        const mac   = document.getElementById("newDeviceMAC").value.trim().toUpperCase();
        const label = document.getElementById("newDeviceLabel").value.trim();

        if (!mac || !label) { alert("Please fill in both fields."); return; }
        if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(mac)) {
            alert("Invalid MAC format — use AA:BB:CC:11:22:33");
            return;
        }

        apiFetch("/known-devices", {
            method: "POST",
            body: JSON.stringify({ mac, label })
        }).then(resp => {
            if (resp.status === 201) {
                loadAdminPage();
            } else {
                alert(resp.data.error || "Failed to add device.");
            }
        });
    }

    function removeKnownDevice(id, label) {
        if (!confirm(`Remove "${label}" from known devices?`)) return;
        apiFetch(`/known-devices/${id}`, { method: "DELETE" }).then(resp => {
            if (resp.status === 200) {
                loadAdminPage();
            } else {
                alert(resp.data.error || "Failed to remove device.");
            }
        });
    }


    // node page
    function loadNodesPage() {
        const btnReg = document.getElementById("btnRegisterNode");
        if (btnReg) btnReg.classList.toggle("hidden", currentUser.role !== "admin");

        const tbody = clearTable("#nodesTable tbody", "Loading nodes...", 6);
        if (!tbody) return;

        apiFetch("/nodes").then(resp => {
            tbody.innerHTML = "";

            if (resp.status !== 200) {
                emptyRow(tbody, 6, "Failed to load nodes — check server connection");
                return;
            }
            if (resp.data.length === 0) {
                emptyRow(tbody, 6, "No nodes registered");
                return;
            }

            const statusClasses = {
                online: "status-online", offline: "status-offline",
                warning: "status-warning", unknown: "status-unknown"
            };

            resp.data.forEach(n => {
                const tr = tbody.insertRow();
                tr.classList.add("clickable-row");
                tr.title = "Click to view detail";

                [n.node_uid, n.location, n.network].forEach(val => {
                    tr.insertCell().textContent = val;
                });

                const statusCell = tr.insertCell();
                statusCell.appendChild(el("span", `status-badge ${statusClasses[n.status] || "status-unknown"}`, n.status));

                tr.insertCell().textContent = n.last_checkin ? fmtDate(n.last_checkin) : "Never";

                const alertBadge = el("span", n.alert_count > 0 ? "badge unknown" : "badge known");
                alertBadge.textContent = n.alert_count > 0
                    ? `${n.alert_count} alert${n.alert_count > 1 ? "s" : ""}`
                    : "None";
                tr.insertCell().appendChild(alertBadge);

                tr.onclick = () => loadNodeDetail(n.id, n.node_uid, n.location);
            });
        });
    }

    function loadNodeDetail(nodeId, uid, location) {
        const panel = document.getElementById("nodeDetailPanel");
        document.getElementById("nodeDetailTitle").textContent = `${uid} - ${location}`;
        panel.classList.remove("hidden");
        panel.scrollIntoView({ behavior: "smooth" });

        ["#nodeScansTable tbody", "#nodeScheduledTable tbody",
         "#nodeErrorsTable tbody", "#nodeAlertsTable tbody"].forEach(sel => {
            clearTable(sel, "Loading...", 3);
        });

        apiFetch(`/nodes/${nodeId}/detail`).then(resp => {
            if (resp.status !== 200) {
                ["#nodeScansTable tbody", "#nodeScheduledTable tbody",
                 "#nodeErrorsTable tbody", "#nodeAlertsTable tbody"].forEach(sel => {
                    clearTable(sel, "Failed to load", 3);
                });
                return;
            }

            const d = resp.data;

            const scansTbody = clearTable("#nodeScansTable tbody");
            if (d.recent_scans.length === 0) {
                emptyRow(scansTbody, 3, "No scans yet");
            } else {
                d.recent_scans.forEach(s => addRow(scansTbody, [`#${s.id}`, s.scan_type, fmtDate(s.created_at)]));
            }

            const schedTbody = clearTable("#nodeScheduledTable tbody");
            if (d.scheduled_scans.length === 0) {
                emptyRow(schedTbody, 3, "No scheduled scans");
            } else {
                d.scheduled_scans.forEach(s => addRow(schedTbody, [`#${s.id}`, s.scan_type, fmtDate(s.scheduled_at)]));
            }

            const errorsTbody = clearTable("#nodeErrorsTable tbody");
            if (d.recent_errors.length === 0) {
                emptyRow(errorsTbody, 2, "No errors recorded");
            } else {
                d.recent_errors.forEach(e => addRow(errorsTbody, [e.message, fmtDate(e.created_at)]));
            }

            const alertsTbody = clearTable("#nodeAlertsTable tbody");
            const canResolve = ["admin", "safeguard"].includes(currentUser.role);
            if (d.alerts.length === 0) {
                emptyRow(alertsTbody, 3, "No active alerts");
            } else {
                d.alerts.forEach(a => {
                    const tr = addRow(alertsTbody, [a.message, fmtDate(a.created_at)]);
                    const actionCell = tr.insertCell();
                    if (canResolve) {
                        actionCell.appendChild(btn("Resolve", "", () => resolveAlert(a.id, nodeId)));
                    } else {
                        actionCell.textContent = "N/A";
                    }
                });
            }
        });
    }

    function resolveAlert(alertId, nodeId) {
        apiFetch(`/nodes/alerts/${alertId}/resolve`, { method: "POST" }).then(resp => {
            if (resp.status !== 200) { alert(resp.data.error || "Failed to resolve alert."); return; }
            const uid = document.getElementById("nodeDetailTitle").textContent.split(" - ")[0];
            loadNodesPage();
            apiFetch(`/nodes/${nodeId}/detail`).then(r => {
                if (r.status === 200) loadNodeDetail(nodeId, uid, r.data.location);
            });
        });
    }

    function toggleRegisterForm() {
        document.getElementById("registerNodeForm").classList.toggle("hidden");
    }

    function registerNode() {
        const location = document.getElementById("nodeLocation").value.trim();
        const network  = document.getElementById("nodeNetwork").value;
        if (!location || !network) { alert("Please fill in location and network."); return; }

        apiFetch("/nodes", {
            method: "POST",
            body: JSON.stringify({ location, network })
        }).then(resp => {
            if (resp.status === 201) {
                alert(`Node registered — ID: ${resp.data.node_uid}`);
                document.getElementById("nodeLocation").value = "";
                document.getElementById("nodeNetwork").value  = "";
                toggleRegisterForm();
                loadNodesPage();
            } else {
                alert(resp.data.error || "Failed to register node.");
            }
        });
    }

    const btnReg = document.getElementById("btnRegisterNode");
    if (btnReg) btnReg.addEventListener("click", toggleRegisterForm);

    window.registerNode       = registerNode;
    window.closeNodeDetail    = () => document.getElementById("nodeDetailPanel").classList.add("hidden");
    window.toggleRegisterForm = toggleRegisterForm;


    // load admin page
    function showPasswordModal(title, message, onConfirm) {
        const existing = document.getElementById("pwdModalOverlay");
        if (existing) existing.remove();

        const overlay    = el("div");    overlay.id   = "pwdModalOverlay";
        const box        = el("div");    box.id        = "pwdModalBox";
        const heading    = el("h3", null, title);
        const para       = el("p",  null, message);
        const input      = el("input"); input.id = "pwdModalInput"; input.type = "password"; input.placeholder = "Enter your password"; input.autocomplete = "current-password";
        const errorMsg   = el("div");   errorMsg.id   = "pwdModalError";
        const btnRow     = el("div");   btnRow.id      = "pwdModalBtns";
        const cancelBtn  = el("button"); cancelBtn.id  = "pwdModalCancel";  cancelBtn.textContent  = "Cancel";
        const confirmBtn = el("button"); confirmBtn.id = "pwdModalConfirm"; confirmBtn.textContent = "Confirm";

        const close = () => overlay.remove();
        const confirm = () => {
            if (!input.value) {
                input.classList.add("error");
                errorMsg.textContent = "Please enter your password.";
                return;
            }
            close();
            onConfirm(input.value);
        };

        cancelBtn.onclick  = close;
        confirmBtn.onclick = confirm;
        input.addEventListener("keydown", e => { if (e.key === "Enter") confirm(); });
        overlay.addEventListener("click", e => { if (e.target === overlay) close(); });

        btnRow.append(cancelBtn, confirmBtn);
        box.append(heading, para, input, errorMsg, btnRow);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        input.focus();
    }

});