document.addEventListener("DOMContentLoaded", () => {
    let currentUser = null;

    const API_URL = "http://10.137.45.9:5000/api";

    const loginBtn     = document.getElementById("loginBtn");
    const loginUser    = document.getElementById("loginUser");
    const loginPass    = document.getElementById("loginPass");
    const loginError   = document.getElementById("loginError");
    const app          = document.getElementById("app");
    const loginScreen  = document.getElementById("loginScreen");
    const tilesContainer = document.getElementById("tiles");
    const userInfo     = document.getElementById("userInfo");
    const btnLogout    = document.getElementById("btnLogout");
    const btnAdminQuick = document.getElementById("btnAdminQuick");
    const submitScanBtn = document.getElementById("submitScanBtn");

    const rolePages = {
        admin:      ["createScan", "approval", "results", "nodes", "admin", "dashboard"],
        safeguard:  ["approval", "results", "nodes", "dashboard"],
        technician: ["createScan", "results", "nodes", "dashboard"],
        auditor:    ["results", "nodes", "dashboard"]
    };

    const tileDefs = [
        { id: "t-create",  title: "Create Scan",     icon: "wifi_tethering",       page: "createScan" },
        { id: "t-approve", title: "Approve Requests", icon: "assignment_turned_in", page: "approval"   },
        { id: "t-results", title: "Scan Results",     icon: "wifi",                 page: "results"    },
        { id: "t-nodes",   title: "Node Health",      icon: "memory",               page: "nodes"      }
    ];

    loginBtn.addEventListener("click", handleLogin);
    btnLogout.addEventListener("click", logout);
    if (submitScanBtn) submitScanBtn.addEventListener("click", submitScan);

    // authentication helper
    function getToken() { return localStorage.getItem("authToken"); }

    function authHeaders() {
        return {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${getToken()}`
        };
    }

    function apiFetch(path, options = {}) {
        const { headers: _, ...rest } = options;
        return fetch(`${API_URL}${path}`, {
            ...rest,
            headers: authHeaders()
        }).then(r => r.json().then(data => ({ status: r.status, data })));
    }

    // login
    function handleLogin() {
        const username = loginUser.value.trim();
        const password = loginPass.value.trim();
        if (!username || !password) {
            loginError.textContent = "Enter username/password";
            loginError.classList.remove("hidden");
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
                localStorage.setItem("authUser", JSON.stringify({ name: username, role: resp.data.role }));
                setupSession(username, resp.data.role);
            } else {
                loginError.textContent = resp.data.error || "Login failed";
                loginError.classList.remove("hidden");
            }
        })
        .catch(() => {
            loginError.textContent = "Cannot reach server — check IP or that Flask is running";
            loginError.classList.remove("hidden");
        });
    }

    function setupSession(name, role) {
        currentUser = { name, role };
        userInfo.textContent = `${name} (${role})`;
        loginScreen.classList.add("hidden");
        app.classList.remove("hidden");
        btnAdminQuick.classList.toggle("hidden", role !== "admin");
        btnAdminQuick.onclick = () => showPage("admin");
        buildTilesForRole(role);
        showPage("dashboard");
        loadData();
    }

    function logout() {
        localStorage.removeItem("authToken");
        localStorage.removeItem("authUser");
        currentUser = null;
        app.classList.add("hidden");
        loginScreen.classList.remove("hidden");
        document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
    }

    function buildTilesForRole(role) {
        tilesContainer.innerHTML = "";
        tileDefs.forEach(tile => {
            if (rolePages[role].includes(tile.page)) {
                const div = document.createElement("div");
                div.className = "tile";
                div.innerHTML = `<span class="material-icons">${tile.icon}</span><h3>${tile.title}</h3>`;
                div.onclick = () => showPage(tile.page);
                tilesContainer.appendChild(div);
            }
        });
    }

    function showPage(id) {
        document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
        const page = document.getElementById(id);
        if (page) page.classList.remove("hidden");
        if (id === "approval")   loadApprovalPage();
        if (id === "results")    loadResultsPage();
        if (id === "admin")      loadAdminPage();
        if (id === "createScan") populateScanTypes();
        if (id === "nodes")      loadNodesPage();
    }

    // load data
    function loadData() {
        loadMockNodes();
    }


    // scan type options
    function populateScanTypes() {
        const select = document.getElementById("scanTypeSelect");
        if (!select) return;
        select.innerHTML = '<option value="">Select Type</option>';


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
            const opt = document.createElement("option");
            opt.value = t.value;
            opt.textContent = t.label;
            select.appendChild(opt);
        });
    }

    // create scan 
    function submitScan() {
        const network   = document.getElementById("networkSelect").value;
        const scan_type = document.getElementById("scanTypeSelect").value;
        const notes     = document.getElementById("scanNotes").value;
        const scanDate  = document.getElementById("scanDate").value;
        const scanHour  = document.getElementById("scanHour").value;
        const scanMin   = document.getElementById("scanMinute").value;

        if (!network || !scan_type) {
            alert("Please select a network and scan type.");
            return;
        }

        let scheduled_at = null;
        if (scanDate && scanHour && scanMin) {
            scheduled_at = `${scanDate}T${scanHour}:${scanMin}:00`;
        } else if (scanDate || scanHour || scanMin) {
            alert("Please fill in the full schedule (date, hour and minute) or leave all blank.");
            return;
        }

        apiFetch("/requests", {
            method: "POST",
            body: JSON.stringify({ network, scan_type, notes, scheduled_at })
        }).then(resp => {
            if (resp.status === 201) {
                alert(`Scan request submitted successfully.\nYour Scan ID is: #${resp.data.id}`);
                document.getElementById("networkSelect").value  = "";
                document.getElementById("scanTypeSelect").value = "";
                document.getElementById("scanNotes").value      = "";
                document.getElementById("scanDate").value       = "";
                document.getElementById("scanHour").value       = "";
                document.getElementById("scanMinute").value     = "";
            } else {
                alert(resp.data.error || "Failed to submit scan request.");
            }
        });
    }

    // approval page
    function loadApprovalPage() {
        apiFetch("/requests").then(resp => {
            if (resp.status !== 200) return;
            const all      = resp.data;
            const pending  = all.filter(r => r.status === "pending");
            const history  = all.filter(r => r.status !== "pending");
            renderPendingScans(pending);
            renderHistoryScans(history);
        });
    }

    function renderPendingScans(requests) {
        const tbody = document.querySelector("#pendingTable tbody");
        tbody.innerHTML = "";
        if (requests.length === 0) {
            tbody.innerHTML = "<tr><td colspan='7' style='text-align:center;color:#888'>No pending requests</td></tr>";
            return;
        }
        requests.forEach(r => {
            const isSelf = r.requested_by === currentUser.name;
            const canApprove = ["admin", "safeguard"].includes(currentUser.role);
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${r.id}</td>
                <td>${r.requested_by}</td>
                <td>${r.network}</td>
                <td>${r.scan_type}</td>
                <td>${r.scheduled_at ? r.scheduled_at.replace("T", " ").slice(0,16) : r.created_at.replace("T"," ").slice(0,16)}</td>
                <td>${r.notes || "—"}</td>
                <td>
                    ${isSelf
                        ? `<button class="cancel-btn" onclick="cancelScanRequest(${r.id})">Cancel</button>
                           <span class="self-request-note">Awaiting another user to approve</span>`
                        : canApprove
                            ? `<button onclick="approveScanRequest(${r.id})">Approve</button>
                               <button onclick="declineScanRequest(${r.id})">Decline</button>`
                            : `<span class="self-request-note">Awaiting approval</span>`
                    }
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderHistoryScans(requests) {
        const tbody = document.querySelector("#historyTable tbody");
        tbody.innerHTML = "";
        if (requests.length === 0) {
            tbody.innerHTML = "<tr><td colspan='5' style='text-align:center;color:#888'>No history yet</td></tr>";
            return;
        }
        requests.forEach(r => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${r.id}</td>
                <td style="color:${r.status === 'approved' ? '#28a745' : '#dc3545'}; font-weight:600">
                    ${r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                </td>
                <td>${r.requested_by}</td>
                <td>${r.approved_by || "—"}</td>
                <td>${r.network} | ${r.scan_type}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.approveScanRequest = function(id) {
        if (!confirm(`Approve request #${id}? This will generate scan results.`)) return;
        apiFetch(`/requests/${id}/approve`, { method: "POST" }).then(resp => {
            if (resp.status === 200) {
                alert(`Request #${id} approved. Scan results generated.`);
                loadApprovalPage();
            } else {
                alert(resp.data.error || "Failed to approve.");
            }
        });
    };

    window.declineScanRequest = function(id) {
        if (!confirm(`Decline request #${id}?`)) return;
        apiFetch(`/requests/${id}/decline`, { method: "POST" }).then(resp => {
            if (resp.status === 200) {
                alert(`Request #${id} declined.`);
                loadApprovalPage();
            } else {
                alert(resp.data.error || "Failed to decline.");
            }
        });
    };

    window.cancelScanRequest = function(id) {
        if (!confirm(`Cancel your scan request #${id}? This cannot be undone.`)) return;
        apiFetch(`/requests/${id}/cancel`, { method: "POST" }).then(resp => {
            if (resp.status === 200) {
                alert(`Request #${id} cancelled.`);
                loadApprovalPage();
            } else {
                alert(resp.data.error || "Failed to cancel.");
            }
        });
    };

    // results page
    function loadResultsPage() {
        apiFetch("/results").then(resp => {
            if (resp.status !== 200) return;
            populateScanSelect(resp.data);
        });
    }

    function populateScanSelect(scans) {
        const select = document.getElementById("scanSelect");
        select.innerHTML = '<option value="">-- Choose Scan --</option>';

        // Clear old listener 
        const newSelect = select.cloneNode(true);
        select.parentNode.replaceChild(newSelect, select);

        scans.forEach(s => {
            const opt = document.createElement("option");
            opt.value = s.id;
            opt.textContent = `#${s.id} | ${s.created_at.slice(0,16).replace("T"," ")} | ${s.scan_type} | ${s.network}`;
            newSelect.appendChild(opt);
        });

        newSelect.addEventListener("change", function() {
            if (this.value) displayScanResults(this.value);
        });
    }

    function displayScanResults(resultId) {
        apiFetch(`/results/${resultId}`).then(resp => {
            if (resp.status !== 200) return;
            const { metadata, devices, summary } = resp.data;

            // metadata
            document.querySelector("#scanMetadataTable tbody").innerHTML = `<tr>
                <td>#${metadata.id}</td>
                <td>${metadata.requested_by}</td>
                <td>${metadata.approved_by || "—"}</td>
                <td>${metadata.network}</td>
                <td>${metadata.scan_type}</td>
                <td>${metadata.created_at.slice(0,16).replace("T"," ")}</td>
            </tr>`;

            // devices
            const devicesBody = document.querySelector("#devicesTable tbody");
            devicesBody.innerHTML = "";
            devices.forEach(d => {
                const tr = document.createElement("tr");
                if (!d.known) tr.classList.add("unknown-device");
                tr.innerHTML = `
                    <td>${d.mac}</td>
                    <td>${d.vendor}</td>
                    <td>${d.signal}</td>
                    <td>${d.channel}</td>
                    <td>${d.time_seen ? d.time_seen.slice(0,16).replace("T"," ") : "—"}</td>
                    <td>${d.flags || "—"}</td>
                    <td>${d.known
                        ? `<span class="badge known">✓ Known — ${d.label}</span>`
                        : `<span class="badge unknown">⚠ Unknown Device</span>`
                    }</td>
                `;
                devicesBody.appendChild(tr);
            });

            // summary
            document.querySelector("#summaryTable tbody").innerHTML = `<tr>
                <td>${summary.total_devices}</td>
                <td>${summary.suspicious}</td>
                <td>${summary.rogue_ap ? "Yes" : "No"}</td>
                <td>${summary.bandwidth}</td>
            </tr>`;

            // export
            window._currentScanData = { metadata, devices, summary };
        });
    }

    // exports
    document.getElementById("exportCSV").addEventListener("click", () => {
        const d = window._currentScanData;
        if (!d) { alert("Select a scan first"); return; }
        let csv = "data:text/csv;charset=utf-8,";
        csv += "Request ID,Requested By,Approved By,Network,Scan Type,Timestamp\n";
        csv += `${d.metadata.id},${d.metadata.requested_by},${d.metadata.approved_by || ""},${d.metadata.network},${d.metadata.scan_type},${d.metadata.created_at}\n\n`;
        csv += "Device MAC,Vendor,Signal,Channel,Time Seen,Flags,Status\n";
        d.devices.forEach(dev => {
            csv += `${dev.mac},${dev.vendor},${dev.signal},${dev.channel},${dev.time_seen || ""},${dev.flags || ""},${dev.known ? "Known" : "UNKNOWN"}\n`;
        });
        csv += `\nTotal Devices,Suspicious,Rogue AP,Bandwidth\n${d.summary.total_devices},${d.summary.suspicious},${d.summary.rogue_ap ? "Yes" : "No"},${d.summary.bandwidth}\n`;
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csv));
        link.setAttribute("download", `scan_${d.metadata.id}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    document.getElementById("exportJSON").addEventListener("click", () => {
        const d = window._currentScanData;
        if (!d) { alert("Select a scan first"); return; }
        const blob = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `scan_${d.metadata.id}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    document.getElementById("exportPDF").addEventListener("click", () => {
        alert("PDF export not implemented yet.");
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
        container.innerHTML = `
            <h3>Known Device Registry</h3>
            <table id="knownDevicesTable">
                <thead>
                    <tr><th>MAC Address</th><th>Label / Description</th><th>Added By</th><th>Added At</th><th>Action</th></tr>
                </thead>
                <tbody>
                    ${devices.length === 0
                        ? `<tr><td colspan="5" style="text-align:center;color:#888">No devices registered</td></tr>`
                        : devices.map(d => `
                            <tr>
                                <td>${d.mac}</td>
                                <td>${d.label}</td>
                                <td>${d.added_by}</td>
                                <td>${d.added_at.slice(0,16).replace("T"," ")}</td>
                                <td><button class="danger-btn" onclick="removeKnownDevice(${d.id}, '${d.label}')">Remove</button></td>
                            </tr>
                        `).join("")
                    }
                </tbody>
            </table>
            <div class="add-device-form">
                <h4>Add Known Device</h4>
                <div class="form-group">
                    <label>MAC Address</label>
                    <input type="text" id="newDeviceMAC" placeholder="e.g. AA:BB:CC:11:22:33">
                </div>
                <div class="form-group">
                    <label>Label / Description</label>
                    <input type="text" id="newDeviceLabel" placeholder="e.g. Reception Laptop - Dell">
                </div>
                <button class="primary-btn" onclick="addKnownDevice()">Add Device</button>
            </div>
        `;
    }

    window.addKnownDevice = function() {
        const mac   = document.getElementById("newDeviceMAC").value.trim().toUpperCase();
        const label = document.getElementById("newDeviceLabel").value.trim();
        if (!mac || !label) { alert("Please fill in both fields."); return; }
        const macRegex = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;
        if (!macRegex.test(mac)) { alert("Invalid MAC format. Use AA:BB:CC:11:22:33"); return; }

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
    };

    window.removeKnownDevice = function(id, label) {
        if (!confirm(`Remove "${label}" from known devices?`)) return;
        apiFetch(`/known-devices/${id}`, { method: "DELETE" }).then(resp => {
            if (resp.status === 200) {
                loadAdminPage();
            } else {
                alert(resp.data.error || "Failed to remove device.");
            }
        });
    };

    const MOCK_NODES = [
        {
            id: 1, node_uid: "NODE-001", location: "Site 1 - Main Building",
            network: "Network1", status: "online",
            last_checkin: "2026-03-04T09:00:00", alert_count: 0, alerts: []
        },
        {
            id: 2, node_uid: "NODE-002", location: "Site 2 - Server Room",
            network: "Network2", status: "warning",
            last_checkin: "2026-03-04T08:45:00", alert_count: 1,
            alerts: [{ id: 1, message: "High signal interference detected on channel 6" }]
        },
        {
            id: 3, node_uid: "NODE-003", location: "Site 3 - Remote Office",
            network: "Network1", status: "offline",
            last_checkin: "2026-03-03T14:00:00", alert_count: 1,
            alerts: [{ id: 2, message: "Node has not checked in for over 12 hours" }]
        }
    ];

    const MOCK_NODE_DETAILS = {
        1: {
            id: 1, node_uid: "NODE-001", location: "Site 1 - Main Building",
            network: "Network1", status: "online",
            last_checkin: "2026-03-04T09:00:00", alerts: [],
            recent_scans: [
                { id: 1, scan_type: "Passive",      created_at: "2026-02-10T10:30:00" },
                { id: 3, scan_type: "Deep Passive",  created_at: "2026-02-10T12:00:00" }
            ],
            scheduled_scans: [
                { id: 5, scan_type: "Passive", scheduled_at: "2026-03-05T08:00:00" }
            ],
            recent_errors: []
        },
        2: {
            id: 2, node_uid: "NODE-002", location: "Site 2 - Server Room",
            network: "Network2", status: "warning",
            last_checkin: "2026-03-04T08:45:00",
            alerts: [{ id: 1, message: "High signal interference on channel 6", created_at: "2026-03-04T08:45:00" }],
            recent_scans: [
                { id: 2, scan_type: "Active", created_at: "2026-02-10T11:00:00" }
            ],
            scheduled_scans: [],
            recent_errors: [
                { message: "Scan timeout after 30s — retried successfully", created_at: "2026-03-04T08:40:00" }
            ]
        },
        3: {
            id: 3, node_uid: "NODE-003", location: "Site 3 - Remote Office",
            network: "Network1", status: "offline",
            last_checkin: "2026-03-03T14:00:00",
            alerts: [{ id: 2, message: "Node has not checked in for over 12 hours", created_at: "2026-03-04T07:00:00" }],
            recent_scans: [],
            scheduled_scans: [],
            recent_errors: [
                { message: "Connection refused on port 5000", created_at: "2026-03-03T14:05:00" },
                { message: "Network unreachable — retrying in 60s", created_at: "2026-03-03T15:00:00" }
            ]
        }
    };

    // node health
    function loadNodesPage() {
        const btnReg = document.getElementById("btnRegisterNode");
        if (btnReg) btnReg.classList.toggle("hidden", currentUser.role !== "admin");

        apiFetch("/nodes").then(resp => {
            const tbody = document.querySelector("#nodesTable tbody");
            if (!tbody) return;
            const nodes = (resp.status === 200 && resp.data.length > 0) ? resp.data : MOCK_NODES;
            tbody.innerHTML = "";
            nodes.forEach(n => {
                const tr = document.createElement("tr");
                tr.style.cursor = "pointer";
                tr.title = "Click to view detail";
                const statusClass = {
                    online: "status-online", offline: "status-offline",
                    warning: "status-warning", unknown: "status-unknown"
                }[n.status] || "status-unknown";

                const alertCell = n.alert_count > 0
                    ? `<span class="badge unknown">⚠ ${n.alert_count} alert${n.alert_count > 1 ? "s" : ""}</span>`
                    : `<span class="badge known">✓ None</span>`;

                tr.innerHTML = `
                    <td><strong>${n.node_uid}</strong></td>
                    <td>${n.location}</td>
                    <td>${n.network}</td>
                    <td><span class="status-badge ${statusClass}">${n.status}</span></td>
                    <td>${n.last_checkin ? n.last_checkin.slice(0,16).replace("T"," ") : "Never"}</td>
                    <td>${alertCell}</td>
                `;
                tr.onclick = () => loadNodeDetail(n.id, n.node_uid, n.location);
                tbody.appendChild(tr);
            });
        });
    }


    // load node detail
    function loadNodeDetail(nodeId, uid, location) {
        const panel = document.getElementById("nodeDetailPanel");
        document.getElementById("nodeDetailTitle").textContent = `${uid} — ${location}`;
        panel.classList.remove("hidden");
        panel.scrollIntoView({ behavior: "smooth" });

        apiFetch(`/nodes/${nodeId}/detail`).then(resp => {
            const d = (resp.status === 200) ? resp.data : MOCK_NODE_DETAILS[nodeId] || MOCK_NODE_DETAILS[1];

            const scansTbody = document.querySelector("#nodeScansTable tbody");
            scansTbody.innerHTML = d.recent_scans.length === 0
                ? "<tr><td colspan='3' class='table-loading'>No scans yet</td></tr>"
                : d.recent_scans.map(s => `<tr>
                    <td>#${s.id}</td>
                    <td>${s.scan_type}</td>
                    <td>${s.created_at.slice(0,16).replace("T"," ")}</td>
                </tr>`).join("");

            const schedTbody = document.querySelector("#nodeScheduledTable tbody");
            schedTbody.innerHTML = d.scheduled_scans.length === 0
                ? "<tr><td colspan='3' class='table-loading'>No scheduled scans</td></tr>"
                : d.scheduled_scans.map(s => `<tr>
                    <td>#${s.id}</td>
                    <td>${s.scan_type}</td>
                    <td>${s.scheduled_at.slice(0,16).replace("T"," ")}</td>
                </tr>`).join("");

            const errorsTbody = document.querySelector("#nodeErrorsTable tbody");
            errorsTbody.innerHTML = d.recent_errors.length === 0
                ? "<tr><td colspan='2' class='table-loading'>No errors recorded</td></tr>"
                : d.recent_errors.map(e => `<tr>
                    <td>${e.message}</td>
                    <td>${e.created_at.slice(0,16).replace("T"," ")}</td>
                </tr>`).join("");

            const alertsTbody = document.querySelector("#nodeAlertsTable tbody");
            const canResolve = ["admin", "safeguard"].includes(currentUser.role);
            alertsTbody.innerHTML = d.alerts.length === 0
                ? "<tr><td colspan='3' class='table-loading'>No active alerts</td></tr>"
                : d.alerts.map(a => `<tr>
                    <td>${a.message}</td>
                    <td>${a.created_at.slice(0,16).replace("T"," ")}</td>
                    <td>${canResolve
                        ? `<button onclick="resolveAlert(${a.id}, ${nodeId})">Resolve</button>`
                        : "—"
                    }</td>
                </tr>`).join("");
        });
    }

    window.resolveAlert = function(alertId, nodeId) {
        apiFetch(`/nodes/alerts/${alertId}/resolve`, { method: "POST" }).then(resp => {
            if (resp.status === 200) {
                const title = document.getElementById("nodeDetailTitle").textContent;
                const uid = title.split(" — ")[0];
                loadNodesPage();
                apiFetch(`/nodes/${nodeId}/detail`).then(r => {
                    if (r.status === 200) {
                        const loc = r.data.location;
                        loadNodeDetail(nodeId, uid, loc);
                    }
                });
            }
        });
    };

    function closeNodeDetail() {
        document.getElementById("nodeDetailPanel").classList.add("hidden");
    }

    function toggleRegisterForm() {
        const form = document.getElementById("registerNodeForm");
        form.classList.toggle("hidden");
    }

    document.getElementById("btnRegisterNode") &&
    document.getElementById("btnRegisterNode").addEventListener("click", toggleRegisterForm);

    window.registerNode = function() {
        const location = document.getElementById("nodeLocation").value.trim();
        const network  = document.getElementById("nodeNetwork").value;
        if (!location || !network) { alert("Please fill in location and network."); return; }

        apiFetch("/nodes", {
            method: "POST",
            body: JSON.stringify({ location, network })
        }).then(resp => {
            if (resp.status === 201) {
                alert(`Node registered successfully. Node ID: ${resp.data.node_uid}`);
                document.getElementById("nodeLocation").value = "";
                document.getElementById("nodeNetwork").value  = "";
                document.getElementById("registerNodeForm").classList.add("hidden");
                loadNodesPage();
            } else {
                alert(resp.data.error || "Failed to register node.");
            }
        });
    };

    function loadMockNodes() { /* replaced */ }

    loadData();
});