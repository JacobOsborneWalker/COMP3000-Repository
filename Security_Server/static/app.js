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
        admin:     ["createScan", "approval", "results", "nodes", "admin", "dashboard"],
        safeguard: ["approval", "results", "dashboard"],
        staff:     ["createScan", "results", "dashboard"]
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
            "Authorisation": `Bearer ${getToken()}`
        };
    }

    function apiFetch(path, options = {}) {
        return fetch(`${API_URL}${path}`, {
            ...options,
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
        if (id === "approval") loadApprovalPage();
        if (id === "results")  loadResultsPage();
        if (id === "admin")    loadAdminPage();
    }

   // load data
    function loadData() {
        loadMockNodes();
    }

  
    // create scan
    function submitScan() {
        const network     = document.getElementById("networkSelect").value;
        const scan_type   = document.getElementById("scanTypeSelect").value;
        const notes       = document.getElementById("scanNotes").value;
        const scheduled_at = document.getElementById("scanDateTime").value;

        if (!network || !scan_type) {
            alert("Please select a network and scan type.");
            return;
        }

        apiFetch("/requests", {
            method: "POST",
            body: JSON.stringify({ network, scan_type, notes, scheduled_at: scheduled_at || null })
        }).then(resp => {
            if (resp.status === 201) {
                alert("Scan request submitted successfully.");
                document.getElementById("networkSelect").value  = "";
                document.getElementById("scanTypeSelect").value = "";
                document.getElementById("scanNotes").value      = "";
                document.getElementById("scanDateTime").value   = "";
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
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${r.id}</td>
                <td>${r.requested_by}</td>
                <td>${r.network}</td>
                <td>${r.scan_type}</td>
                <td>${r.scheduled_at ? r.scheduled_at.replace("T", " ").slice(0,16) : r.created_at.replace("T"," ").slice(0,16)}</td>
                <td>${r.notes || "—"}</td>
                <td>
                    <button onclick="approveScanRequest(${r.id})">Approve</button>
                    <button onclick="declineScanRequest(${r.id})">Decline</button>
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

    // result page
    function loadResultsPage() {
        apiFetch("/results").then(resp => {
            if (resp.status !== 200) return;
            populateScanSelect(resp.data);
        });
    }

    function populateScanSelect(scans) {
        const select = document.getElementById("scanSelect");
        select.innerHTML = '<option value="">-- Choose Scan --</option>';

        // clear old listener 
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

            // exports
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

    // node health
    function loadMockNodes() {
        const nodeTableBody = document.querySelector("#nodeTable tbody");
        if (!nodeTableBody) return;
        nodeTableBody.innerHTML = "";
        const nodes = [
            { mac: "AA:BB:CC:11:22:33", name: "Server1", last_seen: "2026-02-01" },
            { mac: "12:34:56:78:90:AB", name: "Node2",   last_seen: "2026-02-02" }
        ];
        nodes.forEach(n => {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td>${n.mac}</td><td>${n.name}</td><td>${n.last_seen}</td>`;
            nodeTableBody.appendChild(tr);
        });
    }

    loadData();
});