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
        admin:      ["createScan", "approval", "activity", "results", "nodes", "admin", "dashboard"],
        safeguard:  ["approval", "activity", "results", "nodes", "dashboard"],
        technician: ["createScan", "activity", "results", "nodes", "dashboard"],
        auditor:    ["activity", "results", "nodes", "dashboard"]
    };

    // icons and pages
    const tileDefs = [
        { title: "Create Scan",      icon: "wifi_tethering",      page: "createScan" },
        { title: "Approve Requests", icon: "assignment_turned_in", page: "approval"   },
        { title: "Scan Activity",    icon: "radar",               page: "activity"   },
        { title: "Scan Results",     icon: "wifi",                page: "results"    },
        { title: "Scanner Health",   icon: "memory",              page: "nodes"      },
        { title: "Admin Panel",      icon: "admin_panel_settings", page: "admin"      },
        { title: "Log out",          icon: "logout",              page: "logout"     },
    ];

    loginBtn.addEventListener("click", handleLogin);
    btnLogout.addEventListener("click", logout);

    loginPass.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            handleLogin();
        }
    });

    if (submitScanBtn) {
        submitScanBtn.addEventListener("click", submitScan);
    }


    // dom helpers
    function el(tag, className, text) {
        const e = document.createElement(tag);
        if (className) {
            e.className = className;
        }
        if (text !== undefined) {
            e.textContent = text;
        }
        return e;
    }


    // add a row of plain text
    function addRow(tbody, cells) {
        const tr = tbody.insertRow();
        cells.forEach(val => {
            let cellText;
            if (val === null || val === undefined) {
                cellText = "";
            } else {
                cellText = val;
            }
            tr.insertCell().textContent = cellText;
        });
        return tr;
    }

    // add a nothing here message row
    function emptyRow(tbody, colspan, message) {
        const td = tbody.insertRow().insertCell();
        td.colSpan = colspan;
        td.className = "table-loading";
        td.textContent = message;
    }

    // clear a tbody
    function clearTable(selector, loadingMsg, colspan) {
        const tbody = document.querySelector(selector);
        if (!tbody) {
            return null;
        }
        tbody.innerHTML = "";
        if (loadingMsg) {
            emptyRow(tbody, colspan, loadingMsg);
        }
        return tbody;
    }

    // create button with click handler
    function btn(label, className, onClick) {
        const b = el("button", className, label);
        b.onclick = onClick;
        return b;
    }

    // format datetime for display
    function fmtDate(str) {
        if (!str) {
            return "N/A";
        }
        return str.slice(0, 16).replace("T", " ");
    }


    // api

    function getToken() {
        return localStorage.getItem("authToken");
    }

    // fetch api
    function apiFetch(path, options = {}) {
        return fetch(`${API_URL}${path}`, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                "Authorisation": `Bearer ${getToken()}`,
                "ngrok-skip-browser-warning": "true"
            }
        }).then(r => r.json().then(data => ({ status: r.status, data })));
    }



    // login, session and logout

    // handles login
    function handleLogin() {
        const username = loginUser.value.trim();
        const password = loginPass.value;

        if (!username || !password) {
            showLoginError("Please enter a username and password.");
            return;
        }

        fetch(`${API_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
            body: JSON.stringify({ username, password })
        })
        .then(r => r.json().then(data => ({ status: r.status, data })))
        .then(resp => {
            if (resp.status === 200) {
                localStorage.setItem("authToken", resp.data.access_token);
                setupSession(username, resp.data.role);
            } else {
                // failed login
                let errorMessage = resp.data.error;
                if (!errorMessage) {
                    errorMessage = "Login failed.";
                }
                showLoginError(errorMessage);
            }
        })
        // cant reach server
        .catch(() => showLoginError("Cannot reach server. Is Flask running?"));
    }

    // login error
    function showLoginError(msg) {
        loginError.textContent = msg;
        loginError.classList.remove("hidden");
    }

    // create session
    function setupSession(name, role) {
        currentUser = { name, role };
        userInfo.textContent = `${name} (${role})`;
        loginScreen.classList.add("hidden");
        app.classList.remove("hidden");
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


    // keep alive
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

    // build tiles
    function buildTiles(role) {
        tilesContainer.innerHTML = "";
        tileDefs.forEach(tile => {
            if (tile.page !== "logout" && !rolePages[role].includes(tile.page)) {
                return;
            }

            let tileClass;
            if (tile.page === "logout") {
                tileClass = "tile tile-logout";
            } else {
                tileClass = "tile";
            }
            const div = el("div", tileClass);

            div.append(el("span", "material-icons", tile.icon), el("h3", null, tile.title));

            div.onclick = () => showPage(tile.page);

            tilesContainer.appendChild(div);
        });
    }

    // show pages
    function showPage(id) {
        if (id === "logout") {
            logout();
            return;
        }
        document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
        const page = document.getElementById(id);
        if (page) {
            page.classList.remove("hidden");
        }
        if (id !== "activity" && typeof _activityTimer !== "undefined" && _activityTimer) {
            clearInterval(_activityTimer);
            _activityTimer = null;
        }
        // id
        if (id === "createScan") { setupCreateScanPage(); }
        if (id === "approval")   { loadApprovalPage(); }
        if (id === "results")    { loadResultsPage(); }
        if (id === "nodes")      { loadNodesPage(); }
        if (id === "admin")      { loadAdminPage(); }
        if (id === "activity")   { loadActivityPage(); }
    }


    // create scan

    function setupCreateScanPage() {
        const select = document.getElementById("scanTypeSelect");
        if (!select) {
            return;
        }

        select.innerHTML = '<option value="">Select Type</option>';

        // all scan types
        const allTypes = [
            { value: "Passive",      label: "Passive Scan" },
            { value: "Active",       label: "Active Scan" },
            { value: "Deep Passive", label: "Deep Passive Scan" }
        ];

        // scan type for technician
        const techTypes = [
            { value: "Passive", label: "Passive Scan (Routine)" }
        ];

        let types;
        if (currentUser.role === "technician") {
            types = techTypes;
        } else {
            types = allTypes;
        }

        types.forEach(t => {
            const opt = el("option", null, t.label);
            opt.value = t.value;
            select.appendChild(opt);
        });

        // active scan additional justification
        const notesLabel = document.querySelector("label[for='scanNotes']");
        select.onchange = function() {
            if (!notesLabel) {
                return;
            }
            if (this.value === "Active") {
                notesLabel.innerHTML = 'Justification <span style="color:var(--danger)">* required for Active scans</span>';
            } else {
                notesLabel.textContent = "Notes";
            }
        };

        loadNodeCheckboxes();
    }

    // node data fetched fresh each time the page is visited
    let _allNodes    = null;
    let _allRequests = null;

    function loadNodeCheckboxes() {
        const networkSelect = document.getElementById("networkFilterSelect");
        const nodeListGroup = document.getElementById("nodeListGroup");
        const container     = document.getElementById("nodeCheckboxList");
        if (!networkSelect || !container) {
            return;
        }

        // reset state
        _allNodes    = null;
        _allRequests = null;
        networkSelect.innerHTML = "<option value=''>Loading...</option>";
        networkSelect.disabled  = true;
        nodeListGroup.style.display = "none";
        container.innerHTML = "";

        Promise.all([apiFetch("/nodes"), apiFetch("/requests")]).then(([nodesResp, requestsResp]) => {
            networkSelect.disabled = false;

            // failed to load scanner
            if (nodesResp.status !== 200) {
                networkSelect.innerHTML = "<option value=''>Failed to load scanners</option>";
                return;
            }

            // no registered scanners
            if (nodesResp.data.length === 0) {
                networkSelect.innerHTML = "<option value=''>No scanners registered</option>";
                networkSelect.disabled = true;
                return;
            }

            _allNodes = nodesResp.data;

            if (requestsResp.status === 200) {
                _allRequests = requestsResp.data;
            } else {
                _allRequests = [];
            }

            const sites = [...new Set(_allNodes.map(n => n.site))];
            networkSelect.innerHTML = "";
            const placeholder = document.createElement("option");
            placeholder.value = "";

            if (sites.length === 1) {
                placeholder.textContent = "1 site available - select to choose scanners";
            } else {
                placeholder.textContent = `${sites.length} sites available - select one`;
            }
            networkSelect.appendChild(placeholder);

            sites.forEach(site => {
                const nodeCount = _allNodes.filter(n => n.site === site).length;
                const opt = document.createElement("option");
                opt.value = site;

                let scannerWord;
                if (nodeCount !== 1) {
                    scannerWord = "s";
                } else {
                    scannerWord = "";
                }
                opt.textContent = `${site}  (${nodeCount} scanner${scannerWord})`;
                networkSelect.appendChild(opt);
            });

            // wire up onchange, replaced each page visit
            networkSelect.onchange = function() {
                renderNodeCheckboxes(this.value);
            };
        });
    }

    // registered node checkboxes
    function renderNodeCheckboxes(selectedNetwork) {
        const nodeListGroup = document.getElementById("nodeListGroup");
        const container     = document.getElementById("nodeCheckboxList");
        container.innerHTML = "";

        if (!selectedNetwork) {
            nodeListGroup.style.display = "none";
            return;
        }

        nodeListGroup.style.display = "block";
        const nodesOnSite = _allNodes.filter(n => n.site === selectedNetwork);

        // no scanners at a site
        if (nodesOnSite.length === 0) {
            container.innerHTML = "<p class='schedule-hint'>No scanners at this site</p>";
            return;
        }

        // statuses
        const statusClasses = {
            online: "status-online", offline: "status-offline",
            warning: "status-warning", unknown: "status-unknown"
        };

        // select all row and only shown when there are multiple available nodes
        const availableNodes = nodesOnSite.filter(n => n.status !== "offline");
        if (availableNodes.length > 1) {
            const selectAllWrapper = el("div", "node-checkbox-item node-select-all");
            const selectAllCb = el("input");
            selectAllCb.type = "checkbox";
            selectAllCb.id   = "node-cb-all";
            const selectAllLabel = el("label");
            selectAllLabel.htmlFor = "node-cb-all";
            selectAllLabel.textContent = `Select all (${availableNodes.length} scanners)`;
            selectAllCb.onchange = function() {
                container.querySelectorAll("input[type=checkbox]:not(#node-cb-all):not(:disabled)")
                    .forEach(cb => { cb.checked = this.checked; });
            };

            // keep select all in sync if individual boxes are toggled
            container.addEventListener("change", function(e) {
                if (e.target.id === "node-cb-all") {
                    return;
                }
                const all  = [...container.querySelectorAll("input[type=checkbox]:not(#node-cb-all):not(:disabled)")];
                selectAllCb.checked       = all.every(cb => cb.checked);
                selectAllCb.indeterminate = !selectAllCb.checked && all.some(cb => cb.checked);
            });
            selectAllWrapper.append(selectAllCb, selectAllLabel);
            container.appendChild(selectAllWrapper);
        }

        nodesOnSite.forEach(n => {
            // offline
            const isOffline = n.status === "offline";

            let wrapperClass;
            if (isOffline) {
                wrapperClass = "node-checkbox-item node-offline";
            } else {
                wrapperClass = "node-checkbox-item";
            }
            const wrapper  = el("div", wrapperClass);
            const checkbox = el("input");

            checkbox.type  = "checkbox";
            checkbox.id    = `node-cb-${n.id}`;
            checkbox.value = n.network;
            checkbox.dataset.nodeUid   = n.node_uid;
            checkbox.dataset.nodeLabel = `${n.site} / ${n.area}`;

            if (isOffline) {
                checkbox.disabled = true;
            }

            const labelEl  = el("label");
            labelEl.htmlFor = `node-cb-${n.id}`;

            let statusClass;
            if (statusClasses[n.status]) {
                statusClass = statusClasses[n.status];
            } else {
                statusClass = "status-unknown";
            }
            const statusBadge = el("span", `status-badge ${statusClass}`, n.status);
            const nodeTitle   = el("span");
            nodeTitle.innerHTML = `<strong>${n.area}</strong> <span class="node-network-hint">${n.node_uid}</span>`;

            labelEl.append(nodeTitle, " ", statusBadge);

            wrapper.append(checkbox, labelEl);
            container.appendChild(wrapper);
        });
    }

    // generate group ID
    function generateGroupId() {
        return "grp-" + Math.random().toString(36).slice(2, 10) + "-" + Date.now().toString(36);
    }


    // submit scan
    function submitScan() {
        const checked   = [...document.querySelectorAll("#nodeCheckboxList input:checked:not(#node-cb-all)")];
        const scan_type = document.getElementById("scanTypeSelect").value;
        const notes     = document.getElementById("scanNotes").value.trim();
        const scanDate  = document.getElementById("scanDate").value;
        const scanHour  = document.getElementById("scanHour").value;
        const scanMin   = document.getElementById("scanMinute").value;

        // no scanner picked, or scan type not selected
        if (checked.length === 0 || !scan_type) {
            alert("Please select at least one scanner and a scan type.");
            return;
        }

        // active scan justification missing
        if (scan_type === "Active" && !notes) {
            alert("Active scans require a justification in the Notes field.");
            document.getElementById("scanNotes").focus();
            return;
        }

        // date time partially complete
        let scheduled_at = null;
        if (scanDate && scanHour && scanMin) {
            scheduled_at = `${scanDate}T${scanHour}:${scanMin}:00`;
        } else if (scanDate || scanHour || scanMin) {
            alert("Please fill in the full schedule (date, hour and minute) or leave all blank.");
            return;
        }

        // submit
        const doSubmit = (password) => {
            const node_uids   = checked.map(cb => cb.dataset.nodeUid);
            const node_labels = checked.map(cb => cb.dataset.nodeLabel);
            const networks    = checked.map(cb => cb.value);

            apiFetch("/requests", {
                method: "POST",
                body: JSON.stringify({ node_uids, node_labels, networks, scan_type, notes, scheduled_at, password })
            }).then(resp => {
                // submitted
                if (resp.status === 201) {
                    alert(`Scan request submitted - ID: #${resp.data.id}`);
                    clearScanForm();

                // failed submit
                } else {
                    let errorMessage = resp.data.error;
                    if (!errorMessage) {
                        errorMessage = "Failed to submit scan request.";
                    }
                    alert(errorMessage);
                }
            });
        };

        // active scan confirmation
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

    // clear page
    function clearScanForm() {
        ["networkFilterSelect", "scanTypeSelect", "scanNotes", "scanDate", "scanHour", "scanMinute"]
            .forEach(id => {
                const el2 = document.getElementById(id);
                if (el2) {
                    el2.value = "";
                }
            });
        const nodeListGroup = document.getElementById("nodeListGroup");
        if (nodeListGroup) {
            nodeListGroup.style.display = "none";
        }
        const container = document.getElementById("nodeCheckboxList");
        if (container) {
            container.innerHTML = "";
        }
        const notesLabel = document.querySelector("label[for='scanNotes']");
        if (notesLabel) {
            notesLabel.textContent = "Notes";
        }
        // reset cache and reload network dropdown
        _allNodes = null;
        _allRequests = null;
        loadNodeCheckboxes();
    }



    // load activity page
    let _activityTimer = null;
    function loadActivityPage() {
        if (_activityTimer) {
            clearInterval(_activityTimer);
        }

        apiFetch("/requests").then(resp => {
            if (resp.status !== 200) {
                return;
            }
            const all = resp.data;
            const now = new Date();

            // scheduled scans
            const scheduled = all.filter(r =>
                r.status === "approved" &&
                r.scheduled_at &&
                new Date(r.scheduled_at) > now &&
                (!r.result_ids || r.result_ids.length === 0)
            );

            // in progress results
            const inProgress = all.filter(r =>
                r.status === "approved" &&
                (!r.scheduled_at || new Date(r.scheduled_at) <= now) &&
                (!r.result_ids || r.result_ids.length === 0)
            );

            // awaiting approval
            const awaiting = all.filter(r => r.status === "pending");

            renderScheduledTable(scheduled);
            renderInProgressTable(inProgress);
            renderAwaitingTable(awaiting);

            _activityTimer = setInterval(() => updateCountdowns(), 1000);
        });
    }

    // render scheduled table
    function renderScheduledTable(requests) {
        const tbody = clearTable("#scheduledTable tbody");
        if (!tbody) {
            return;
        }
        if (requests.length === 0) {
            emptyRow(tbody, 6, "No scheduled scans");
            return;
        }
        requests.forEach(r => {
            let nodeText;
            if (r.node_labels && r.node_labels.length > 0) {
                nodeText = r.node_labels.join(", ");
            } else {
                nodeText = r.network;
            }
            const tr = addRow(tbody, [
                `#${r.id}`, nodeText, r.scan_type,
                r.requested_by, fmtDate(r.scheduled_at), ""
            ]);
            tr.lastElementChild.dataset.scheduledAt = r.scheduled_at;
            tr.lastElementChild.className = "countdown-cell";
        });
        updateCountdowns();
    }

    // update countdown
    function updateCountdowns() {
        document.querySelectorAll(".countdown-cell").forEach(cell => {
            const diff = new Date(cell.dataset.scheduledAt) - new Date();
            if (diff <= 0) {
                cell.textContent = "Starting now";
                return;
            }
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);

            if (h > 0) {
                cell.textContent = `${h}h ${m}m ${s}s`;
            } else if (m > 0) {
                cell.textContent = `${m}m ${s}s`;
            } else {
                cell.textContent = `${s}s`;
            }
        });
    }

    // in progress table
    function renderInProgressTable(requests) {
        const tbody = clearTable("#inProgressTable tbody");
        if (!tbody) {
            return;
        }
        // none
        if (requests.length === 0) {
            emptyRow(tbody, 6, "No scans currently in progress");
            return;
        }
        // row of in progress
        requests.forEach(r => {
            let nodeText;
            if (r.node_labels && r.node_labels.length > 0) {
                nodeText = r.node_labels.join(", ");
            } else {
                nodeText = r.network;
            }

            let approvedBy;
            if (r.approved_by) {
                approvedBy = r.approved_by;
            } else {
                approvedBy = "N/A";
            }

            const tr = addRow(tbody, [
                `#${r.id}`, nodeText, r.scan_type,
                r.requested_by, approvedBy, fmtDate(r.created_at)
            ]);
            tr.classList.add("row-in-progress");
        });
    }


    // awaiting table
    function renderAwaitingTable(requests) {
        const tbody = clearTable("#awaitingTable tbody");
        if (!tbody) {
            return;
        }

        // no waiting scans
        if (requests.length === 0) {
            emptyRow(tbody, 6, "No scans awaiting approval");
            return;
        }
        requests.forEach(r => {
            let nodeText;
            if (r.node_labels && r.node_labels.length > 0) {
                nodeText = r.node_labels.join(", ");
            } else {
                nodeText = r.network;
            }

            let notes;
            if (r.notes) {
                notes = r.notes;
            } else {
                notes = "N/A";
            }

            addRow(tbody, [
                `#${r.id}`, nodeText, r.scan_type,
                r.requested_by, fmtDate(r.created_at), notes
            ]);
        });
    }


    // load approved scans
    function loadApprovalPage() {
        apiFetch("/requests").then(resp => {
            if (resp.status !== 200) {
                return;
            }
            renderPendingTable(resp.data.filter(r => r.status === "pending"));
            renderHistoryTable(resp.data.filter(r => r.status !== "pending"));
        });
    }

    // pending scan table
    function renderPendingTable(requests) {
        const tbody = clearTable("#pendingTable tbody");
        if (!tbody) {
            return;
        }

        // no pending scans
        if (requests.length === 0) {
            emptyRow(tbody, 7, "No pending requests");
            return;
        }

        // safeguard and admin can approve
        requests.forEach(r => {
            const isSelf     = r.requested_by === currentUser.name;
            const canApprove = ["admin", "safeguard"].includes(currentUser.role);

            let timeValue;
            if (r.scheduled_at) {
                timeValue = r.scheduled_at;
            } else {
                timeValue = r.created_at;
            }
            const time = fmtDate(timeValue);

            // show node labels if multi-node, otherwise network
            let nodeText;
            if (r.node_labels && r.node_labels.length > 0) {
                nodeText = r.node_labels.join(", ");
            } else {
                nodeText = r.network;
            }

            let notes;
            if (r.notes) {
                notes = r.notes;
            } else {
                notes = "N/A";
            }

            const tr = addRow(tbody, [`#${r.id}`, r.requested_by, nodeText, r.scan_type, time, notes]);
            const actionCell = tr.insertCell();

            // cannot approve own scan
            if (isSelf) {
                actionCell.appendChild(btn("Cancel", "cancel-btn", () => cancelScanRequest(r.id)));
                actionCell.appendChild(el("span", "self-request-note", " Awaiting another user to approve"));

            // approve or decline
            } else if (canApprove) {
                actionCell.appendChild(btn("Approve", "", () => approveScanRequest(r.id, r.scan_type)));
                actionCell.appendChild(btn("Decline", "", () => declineScanRequest(r.id)));

            // awaiting approval
            } else {
                actionCell.appendChild(el("span", "self-request-note", "Awaiting approval"));
            }
        });
    }

    // history table
    function renderHistoryTable(requests) {
        const tbody = clearTable("#historyTable tbody");
        if (!tbody) {
            return;
        }

        // no history yet
        if (requests.length === 0) {
            emptyRow(tbody, 5, "No history yet");
            return;
        }

        requests.forEach(r => {
            const tr = tbody.insertRow();

            tr.insertCell().textContent = r.id;

            const statusCell = tr.insertCell();
            statusCell.textContent = r.status.charAt(0).toUpperCase() + r.status.slice(1);

            if (r.status === "approved") {
                statusCell.classList.add("status-approved");
            } else {
                statusCell.classList.add("status-declined");
            }

            let nodeText;
            if (r.node_labels && r.node_labels.length > 0) {
                nodeText = r.node_labels.join(", ");
            } else {
                nodeText = r.network;
            }

            let approvedBy;
            if (r.approved_by) {
                approvedBy = r.approved_by;
            } else {
                approvedBy = "N/A";
            }

            [r.requested_by, approvedBy, `${nodeText} | ${r.scan_type}`].forEach(val => {
                tr.insertCell().textContent = val;
            });
        });
    }

    // approve scan requests
    function approveScanRequest(id, scanType) {
        const doApprove = (password) => {
            apiFetch(`/requests/${id}/approve`, {
                method: "POST",
                body: JSON.stringify({ password })
            }).then(resp => {

                // approved request
                if (resp.status === 200) {
                    alert(`Request #${id} approved. The scanner(s) will collect and submit results shortly.`);
                    loadApprovalPage();

                    // refresh activity page if it is open
                    if (document.getElementById("activity") && !document.getElementById("activity").classList.contains("hidden")) {
                        loadActivityPage();
                    }

                // error
                } else if (resp.status === 409) {
                    alert(`Approval blocked: ${resp.data.error}`);

                // failed to approve
                } else {
                    let errorMessage = resp.data.error;
                    if (!errorMessage) {
                        errorMessage = "Failed to approve.";
                    }
                    alert(errorMessage);
                }
            });
        };


        // active scans
        if (scanType === "Active") {
            showPasswordModal(
                "Approve Active Scan - Password Confirmation",
                `Approving an Active scan requires password confirmation. Please re-enter your password to approve request #${id}.`,
                doApprove
            );
        // approve requests
        } else {
            if (!confirm(`Approve request #${id}?`)) {
                return;
            }
            doApprove(null);
        }
    }

    // decline scan requests
    function declineScanRequest(id) {
        if (!confirm(`Decline request #${id}?`)) {
            return;
        }
        apiFetch(`/requests/${id}/decline`, { method: "POST" }).then(resp => {
            // declined
            if (resp.status === 200) {
                alert(`Request #${id} declined.`);
                loadApprovalPage();
            // failed to decline
            } else {
                let errorMessage = resp.data.error;
                if (!errorMessage) {
                    errorMessage = "Failed to decline.";
                }
                alert(errorMessage);
            }
        });
    }

    // cancel request
    function cancelScanRequest(id) {
        if (!confirm(`Cancel request #${id}? This cannot be undone.`)) {
            return;
        }
        apiFetch(`/requests/${id}/cancel`, { method: "POST" }).then(resp => {
            if (resp.status === 200) {
                alert(`Request #${id} cancelled.`);
                loadApprovalPage();
            } else {
                let errorMessage = resp.data.error;
                if (!errorMessage) {
                    errorMessage = "Failed to cancel.";
                }
                alert(errorMessage);
            }
        });
    }


    // load results page
    function loadResultsPage() {
        apiFetch("/results").then(resp => {
            if (resp.status !== 200) {
                return;
            }
            populateScanSelect(resp.data);
        });
    }


    // populate select scan
    function populateScanSelect(scans) {
        const old   = document.getElementById("scanSelect");
        const fresh = old.cloneNode(false);
        fresh.innerHTML = '<option value="">-- Choose Scan --</option>';

        scans.forEach(s => {
            let nodeText;
            if (s.node_labels && s.node_labels.length > 0) {
                nodeText = s.node_labels.join(", ");
            } else {
                nodeText = s.network;
            }

            let label;
            if (s.node_count > 1) {
                label = `#${s.id} | ${fmtDate(s.created_at)} | ${s.scan_type} | ${nodeText} (${s.node_count} scanners)`;
            } else {
                label = `#${s.id} | ${fmtDate(s.created_at)} | ${s.scan_type} | ${nodeText}`;
            }

            const opt = el("option", null, label);
            opt.value = s.id;
            fresh.appendChild(opt);
        });

        fresh.onchange = function() {
            if (this.value) {
                displayScanRequest(this.value);
            }
        };

        old.parentNode.replaceChild(fresh, old);
    }

    // display scan results
    function displayScanRequest(requestId) {
        apiFetch("/results").then(resp => {
            if (resp.status !== 200) {
                return;
            }
            const scan = resp.data.find(s => s.id == requestId);
            if (!scan) {
                return;
            }
            if (scan.result_ids.length === 0) {
                return;
            }

            window._currentScanRequestId = requestId;
            window._currentScanResultIds = scan.result_ids;
            window._currentNodeLabels    = scan.node_labels;

            renderNodeTabs(scan.result_ids, scan.node_labels);

            // load the first node and total across all nodes
            displayScanResults(scan.result_ids[0]);

            if (scan.result_ids.length > 1) {
                Promise.all(scan.result_ids.map(id => apiFetch(`/results/${id}`))).then(responses => {
                    const all = responses.filter(r => r.status === 200).map(r => r.data.summary);
                    if (all.length === 0) {
                        return;
                    }

                    // totals
                    const totals = {
                        total_devices:        all.reduce((s, r) => s + (r.total_devices || 0), 0),
                        suspicious:           all.reduce((s, r) => s + (r.suspicious || 0), 0),
                        rogue_ap:             all.some(r => r.rogue_ap),
                        bandwidth:            all.map(r => r.bandwidth).filter(Boolean).join(" / "),
                        total_deauth_frames:  all.reduce((s, r) => s + (r.total_deauth_frames || 0), 0),
                        unknown_associations: all.reduce((s, r) => s + (r.unknown_associations || 0), 0),
                    };

                    // detect scan type from first result
                    const scan_type = responses[0].data.metadata.scan_type;
                    const isRich = scan_type === "Active" || scan_type === "Deep Passive";

                    // write combined totals
                    const combinedSection = document.getElementById("combinedSummarySection");
                    const combinedTbody   = clearTable("#combinedSummaryTable tbody");
                    const combinedThead   = document.querySelector("#combinedSummaryTable thead");

                    if (combinedSection && combinedTbody && combinedThead) {
                        combinedSection.classList.remove("hidden");
                        const baseHeaders = ["Total Devices", "Suspicious", "Rogue AP", "Bandwidth"];
                        const richHeaders  = ["Total Deauth Frames", "Unknown Associations"];

                        let allHeaders;
                        if (isRich) {
                            allHeaders = [...baseHeaders, ...richHeaders];
                        } else {
                            allHeaders = baseHeaders;
                        }

                        combinedThead.innerHTML = "";
                        const hRow = combinedThead.insertRow();
                        allHeaders.forEach(h => {
                            const th = document.createElement("th");
                            th.textContent = h;
                            hRow.appendChild(th);
                        });

                        // devices, suspicious, rogue and total bandwidth
                        let rogueApText;
                        if (totals.rogue_ap) {
                            rogueApText = "Yes";
                        } else {
                            rogueApText = "No";
                        }
                        const baseCells = [
                            totals.total_devices, totals.suspicious,
                            rogueApText, totals.bandwidth
                        ];

                        // deauth frames and unknown associates
                        let richCells;
                        if (isRich) {
                            richCells = [
                                totals.total_deauth_frames,
                                totals.unknown_associations
                            ];
                        } else {
                            richCells = [];
                        }
                        addRow(combinedTbody, [...baseCells, ...richCells]);
                    }
                });
            }
        });
    }

    // node tabs load
    function renderNodeTabs(resultIds, nodeLabels) {
        const tabContainer = document.getElementById("nodeTabs");
        if (!tabContainer) {
            return;
        }
        tabContainer.innerHTML = "";

        if (resultIds.length <= 1) {
            tabContainer.classList.add("hidden");
            const combinedSection = document.getElementById("combinedSummarySection");
            if (combinedSection) {
                combinedSection.classList.add("hidden");
            }
            const summaryLabel = document.getElementById("nodeSummaryLabel");
            if (summaryLabel) {
                summaryLabel.textContent = "Summary Insights";
            }
            return;
        }

        tabContainer.classList.remove("hidden");
        resultIds.forEach((id, i) => {
            let label;
            if (nodeLabels && nodeLabels[i]) {
                label = nodeLabels[i];
            } else {
                label = `Node ${i + 1}`;
            }

            const tabBtn = el("button", "node-tab-btn", label);
            tabBtn.dataset.resultId = id;
            tabBtn.onclick = function() {
                document.querySelectorAll(".node-tab-btn").forEach(b => b.classList.remove("active"));
                this.classList.add("active");
                const summaryLabel = document.getElementById("nodeSummaryLabel");
                if (summaryLabel) {
                    summaryLabel.textContent = `Scanner Summary - ${label}`;
                }
                displayScanResults(id);
            };
            if (i === 0) {
                tabBtn.classList.add("active");
                const summaryLabel = document.getElementById("nodeSummaryLabel");
                if (summaryLabel) {
                    summaryLabel.textContent = `Scanner Summary - ${label}`;
                }
            }
            tabContainer.appendChild(tabBtn);
        });
    }

    function displayScanResults(resultId) {
        apiFetch(`/results/${resultId}`).then(resp => {
            if (resp.status !== 200) {
                return;
            }
            const { metadata, devices, summary } = resp.data;
            const isRich = metadata.scan_type === "Active" || metadata.scan_type === "Deep Passive";

            // metadata row
            const metaTbody = clearTable("#scanMetadataTable tbody");
            if (metaTbody) {
                let nodeDisplay;
                if (metadata.node_label) {
                    nodeDisplay = metadata.node_label;
                } else if (metadata.node_uid) {
                    nodeDisplay = metadata.node_uid;
                } else {
                    nodeDisplay = "N/A";
                }

                let approvedBy;
                if (metadata.approved_by) {
                    approvedBy = metadata.approved_by;
                } else {
                    approvedBy = "N/A";
                }

                addRow(metaTbody, [
                    `#${metadata.id}`,
                    nodeDisplay,
                    metadata.requested_by,
                    approvedBy,
                    metadata.network,
                    metadata.scan_type,
                    fmtDate(metadata.created_at)
                ]);
            }

            // devices table - rebuild header based on scan type
            const devicesTable = document.getElementById("devicesTable");
            const devicesTbody = clearTable("#devicesTable tbody");

            const baseHeaders = ["MAC", "Vendor", "Signal (dBm)", "Channel", "Time Seen", "Flags", "Status"];
            const richHeaders  = ["Frame Count", "Signal Variance", "Beacon Interval", "Probe SSIDs", "SSID History", "Associated BSSID", "Deauth Frames"];

            let headers;
            if (isRich) {
                headers = [...baseHeaders, ...richHeaders];
            } else {
                headers = baseHeaders;
            }

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
                    let flagsText;
                    if (d.flags) {
                        flagsText = d.flags;
                    } else {
                        flagsText = "None";
                    }

                    const tr = addRow(devicesTbody, [
                        d.mac, d.vendor, d.signal, d.channel,
                        fmtDate(d.time_seen), flagsText
                    ]);

                    if (!d.known) {
                        tr.classList.add("unknown-device");
                    }

                    let badgeClass;
                    let badgeText;
                    if (d.known) {
                        badgeClass = "badge known";
                        badgeText  = `Known: ${d.label}`;
                    } else {
                        badgeClass = "badge unknown";
                        badgeText  = "Unknown Device";
                    }
                    const badge = el("span", badgeClass);
                    badge.textContent = badgeText;
                    tr.insertCell().appendChild(badge);

                    if (isRich) {
                        let frameCountText;
                        if (d.frame_count != null) {
                            frameCountText = d.frame_count;
                        } else {
                            frameCountText = "N/A";
                        }
                        addCellText(tr, frameCountText);

                        const varCell = tr.insertCell();
                        if (d.signal_variance != null) {
                            varCell.textContent = d.signal_variance.toFixed(1);
                            if (d.signal_variance > 10) {
                                varCell.classList.add("flag-warning");
                            }
                        } else {
                            varCell.textContent = "N/A";
                        }

                        const beaconCell = tr.insertCell();
                        if (d.beacon_interval != null) {
                            beaconCell.textContent = `${d.beacon_interval} ms`;
                            if (d.beacon_interval !== 100) {
                                beaconCell.classList.add("flag-warning");
                            }
                        } else {
                            beaconCell.textContent = "N/A";
                        }

                        const probeCell  = tr.insertCell();
                        let probeCount;
                        if (d.probe_ssids) {
                            probeCount = d.probe_ssids.length;
                        } else {
                            probeCount = 0;
                        }

                        if (probeCount > 0) {
                            probeCell.textContent = `${probeCount} SSIDs`;
                        } else {
                            probeCell.textContent = "None";
                        }

                        if (d.probe_ssids) {
                            probeCell.title = d.probe_ssids.join(", ");
                        } else {
                            probeCell.title = "";
                        }

                        if (probeCount >= 5) {
                            probeCell.classList.add("flag-warning");
                        }

                        const histCell  = tr.insertCell();
                        let histCount;
                        if (d.ssid_history) {
                            histCount = d.ssid_history.length;
                        } else {
                            histCount = 0;
                        }

                        if (histCount > 0) {
                            histCell.textContent = d.ssid_history.join(", ");
                        } else {
                            histCell.textContent = "None";
                        }

                        let associatedText;
                        if (d.associated_bssid) {
                            associatedText = d.associated_bssid;
                        } else {
                            associatedText = "None";
                        }
                        addCellText(tr, associatedText);

                        const deauthCell = tr.insertCell();
                        if (d.deauth_count != null) {
                            deauthCell.textContent = d.deauth_count;
                        } else {
                            deauthCell.textContent = 0;
                        }
                        if (d.deauth_count > 0) {
                            deauthCell.classList.add("flag-danger");
                        }
                    }
                });
            }

            // summary table
            const summaryTable = document.getElementById("summaryTable");
            const summaryTbody = clearTable("#summaryTable tbody");

            const baseSummaryHeaders = ["Total Devices", "Suspicious", "Rogue AP", "Bandwidth"];
            const richSummaryHeaders = ["Total Deauth Frames", "Unknown Associations"];

            let summaryHeaders;
            if (isRich) {
                summaryHeaders = [...baseSummaryHeaders, ...richSummaryHeaders];
            } else {
                summaryHeaders = baseSummaryHeaders;
            }

            const summaryThead = summaryTable.querySelector("thead");
            summaryThead.innerHTML = "";
            const summaryHeaderRow = summaryThead.insertRow();
            summaryHeaders.forEach(h => {
                const th = document.createElement("th");
                th.textContent = h;
                summaryHeaderRow.appendChild(th);
            });

            if (summaryTbody) {
                let rogueApText;
                if (summary.rogue_ap) {
                    rogueApText = "Yes";
                } else {
                    rogueApText = "No";
                }

                const baseCells = [
                    summary.total_devices, summary.suspicious,
                    rogueApText, summary.bandwidth
                ];

                let richCells;
                if (isRich) {
                    let deauthFrames;
                    if (summary.total_deauth_frames) {
                        deauthFrames = summary.total_deauth_frames;
                    } else {
                        deauthFrames = 0;
                    }

                    let unknownAssoc;
                    if (summary.unknown_associations) {
                        unknownAssoc = summary.unknown_associations;
                    } else {
                        unknownAssoc = 0;
                    }

                    richCells = [deauthFrames, unknownAssoc];
                } else {
                    richCells = [];
                }
                addRow(summaryTbody, [...baseCells, ...richCells]);
            }

            window._currentScanData = { metadata, devices, summary };
        });
    }


    // add a plain text cell to a row
    function addCellText(tr, text) {
        tr.insertCell().textContent = text;
    }

    document.getElementById("exportCSV").addEventListener("click", () => {
        const d = window._currentScanData;
        if (!d) {
            alert("Select a scan first.");
            return;
        }

        const m = d.metadata;

        let approvedBy;
        if (m.approved_by) {
            approvedBy = m.approved_by;
        } else {
            approvedBy = "";
        }

        const rows = [
            "data:text/csv;charset=utf-8,",
            "Request ID,Requested By,Approved By,Network,Scan Type,Timestamp",
            `${m.id},${m.requested_by},${approvedBy},${m.network},${m.scan_type},${m.created_at}`,
            "",
            "Device MAC,Vendor,Signal,Channel,Time Seen,Flags,Status",
            ...d.devices.map(dev => {
                let timeSeen;
                if (dev.time_seen) {
                    timeSeen = dev.time_seen;
                } else {
                    timeSeen = "";
                }

                let flags;
                if (dev.flags) {
                    flags = dev.flags;
                } else {
                    flags = "";
                }

                let knownStatus;
                if (dev.known) {
                    knownStatus = "Known";
                } else {
                    knownStatus = "Unknown";
                }

                return `${dev.mac},${dev.vendor},${dev.signal},${dev.channel},${timeSeen},${flags},${knownStatus}`;
            }),
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
        if (!d) {
            alert("Select a scan first.");
            return;
        }

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
            if (resp.status !== 200) {
                return;
            }
            renderKnownDevices(resp.data);
        });
    }

    function renderKnownDevices(devices) {
        const container = document.getElementById("knownDevicesSection");
        if (!container) {
            return;
        }

        container.innerHTML = `
            <h3>Known Device Registry</h3>
            <table id="knownDevicesTable">
                <thead><tr>
                    <th>MAC Address</th><th>Label</th><th>Added By</th><th>Added At</th><th>Action</th>
                </tr></thead>
                <tbody></tbody>
            </table>
            <div class="add-device-form">
                <h4>Add Known Device</h4>
                <div class="form-group">
                    <label>MAC Address</label>
                    <input type="text" id="newDeviceMAC" placeholder="e.g. AA:BB:CC:11:22:33">
                </div>
                <div class="form-group">
                    <label>Label</label>
                    <input type="text" id="newDeviceLabel" placeholder="e.g. Reception Laptop">
                </div>
            </div>
        `;

        const tbody = container.querySelector("tbody");
        if (devices.length === 0) {
            emptyRow(tbody, 5, "No devices registered");
        } else {
            devices.forEach(d => {
                const tr = addRow(tbody, [d.mac, d.label, d.added_by, fmtDate(d.added_at)]);
                tr.insertCell().appendChild(btn("Remove", "danger-btn", () => removeKnownDevice(d.id, d.label)));
            });
        }

        container.querySelector(".add-device-form").appendChild(
            btn("Add Device", "primary-btn", addKnownDevice)
        );
    }


    // add known device
    function addKnownDevice() {
        const mac   = document.getElementById("newDeviceMAC").value.trim().toUpperCase();
        const label = document.getElementById("newDeviceLabel").value.trim();

        if (!mac || !label) {
            alert("Please fill in both fields.");
            return;
        }
        if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(mac)) {
            alert("Invalid MAC format. Use AA:BB:CC:11:22:33");
            return;
        }

        apiFetch("/known-devices", {
            method: "POST",
            body: JSON.stringify({ mac, label })
        }).then(resp => {
            if (resp.status === 201) {
                loadAdminPage();
            } else {
                let errorMessage = resp.data.error;
                if (!errorMessage) {
                    errorMessage = "Failed to add device.";
                }
                alert(errorMessage);
            }
        });
    }

    function removeKnownDevice(id, label) {
        if (!confirm(`Remove "${label}" from known devices?`)) {
            return;
        }
        apiFetch(`/known-devices/${id}`, { method: "DELETE" }).then(resp => {
            if (resp.status === 200) {
                loadAdminPage();
            } else {
                let errorMessage = resp.data.error;
                if (!errorMessage) {
                    errorMessage = "Failed to remove device.";
                }
                alert(errorMessage);
            }
        });
    }


    // loads nodes page
    function loadNodesPage() {
        const btnReg = document.getElementById("btnRegisterNode");
        if (btnReg) {
            if (currentUser.role !== "admin") {
                btnReg.classList.add("hidden");
            } else {
                btnReg.classList.remove("hidden");
            }
        }

        const tbody = clearTable("#nodesTable tbody", "Loading scanners...", 6);
        if (!tbody) {
            return;
        }

        apiFetch("/nodes").then(resp => {
            tbody.innerHTML = "";

            if (resp.status !== 200) {
                emptyRow(tbody, 6, "Failed to load scanners. Check server connection.");
                return;
            }
            if (resp.data.length === 0) {
                emptyRow(tbody, 6, "No scanners registered");
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

                [n.node_uid, n.site, n.area, n.network].forEach(val => {
                    tr.insertCell().textContent = val;
                });

                const statusCell = tr.insertCell();
                let statusClass;
                if (statusClasses[n.status]) {
                    statusClass = statusClasses[n.status];
                } else {
                    statusClass = "status-unknown";
                }
                statusCell.appendChild(el("span", `status-badge ${statusClass}`, n.status));

                let lastCheckinText;
                if (n.last_checkin) {
                    lastCheckinText = fmtDate(n.last_checkin);
                } else {
                    lastCheckinText = "Never";
                }
                tr.insertCell().textContent = lastCheckinText;

                let alertBadgeClass;
                if (n.alert_count > 0) {
                    alertBadgeClass = "badge unknown";
                } else {
                    alertBadgeClass = "badge known";
                }
                const alertBadge = el("span", alertBadgeClass);

                if (n.alert_count > 0) {
                    let alertWord;
                    if (n.alert_count > 1) {
                        alertWord = "s";
                    } else {
                        alertWord = "";
                    }
                    alertBadge.textContent = `${n.alert_count} alert${alertWord}`;
                } else {
                    alertBadge.textContent = "None";
                }
                tr.insertCell().appendChild(alertBadge);

                tr.onclick = () => loadNodeDetail(n.id, n.node_uid, n.site, n.area);
            });
        });
    }


    // load node details
    function loadNodeDetail(nodeId, uid, site, area) {
        const panel = document.getElementById("nodeDetailPanel");
        document.getElementById("nodeDetailTitle").textContent = `${uid} - ${site} / ${area}`;
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

            // recent approved scans
            const scansTbody = clearTable("#nodeScansTable tbody");
            if (d.recent_scans.length === 0) {
                emptyRow(scansTbody, 5, "No completed scans yet");
            } else {
                d.recent_scans.forEach(s => {
                    const tr = addRow(scansTbody, [
                        `#${s.id}`, s.scan_type, fmtDate(s.created_at), s.requested_by
                    ]);
                    const actionCell = tr.insertCell();
                    if (s.result_id) {
                        actionCell.appendChild(btn("View Results", "primary-btn", () => {
                            showPage("results");

                            // wait for the results page to load then select this scan
                            apiFetch("/results").then(resp => {
                                if (resp.status !== 200) {
                                    return;
                                }
                                populateScanSelect(resp.data);
                                displayScanResults(s.result_id);

                                // set the dropdown to match
                                const sel = document.getElementById("scanSelect");
                                if (sel) {
                                    sel.value = s.result_id;
                                }
                            });
                        }));
                    } else {
                        actionCell.textContent = "No result";
                    }
                });
            }

            // pending scans
            const schedTbody = clearTable("#nodeScheduledTable tbody");
            if (d.pending_scans.length === 0) {
                emptyRow(schedTbody, 5, "No pending scans");
            } else {
                d.pending_scans.forEach(s => {
                    let scheduledText;
                    if (s.scheduled_at) {
                        scheduledText = fmtDate(s.scheduled_at);
                    } else {
                        scheduledText = "Unscheduled";
                    }

                    addRow(schedTbody, [
                        `#${s.id}`,
                        s.scan_type,
                        s.status.charAt(0).toUpperCase() + s.status.slice(1),
                        s.requested_by,
                        scheduledText
                    ]);
                });
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
            if (resp.status !== 200) {
                let errorMessage = resp.data.error;
                if (!errorMessage) {
                    errorMessage = "Failed to resolve alert.";
                }
                alert(errorMessage);
                return;
            }
            const uid = document.getElementById("nodeDetailTitle").textContent.split(" - ")[0];
            loadNodesPage();
            apiFetch(`/nodes/${nodeId}/detail`).then(r => {
                if (r.status === 200) {
                    loadNodeDetail(nodeId, uid, r.data.site, r.data.area);
                }
            });
        });
    }

    function toggleRegisterForm() {
        document.getElementById("registerNodeForm").classList.toggle("hidden");
    }

    function registerNode() {
        const site    = document.getElementById("nodeSite").value.trim();
        const area    = document.getElementById("nodeArea").value.trim();
        const network = document.getElementById("nodeNetwork").value.trim();

        if (!site || !area || !network) {
            alert("Please fill in site, area, and network.");
            return;
        }

        apiFetch("/nodes", {
            method: "POST",
            body: JSON.stringify({ site, area, network })
        }).then(resp => {
            if (resp.status === 201) {
                alert(`Scanner registered. ID: ${resp.data.node_uid}`);
                document.getElementById("nodeSite").value    = "";
                document.getElementById("nodeArea").value    = "";
                document.getElementById("nodeNetwork").value = "";
                toggleRegisterForm();
                loadNodesPage();
            } else {
                let errorMessage = resp.data.error;
                if (!errorMessage) {
                    errorMessage = "Failed to register scanner.";
                }
                alert(errorMessage);
            }
        });
    }

    const btnReg = document.getElementById("btnRegisterNode");
    if (btnReg) {
        btnReg.addEventListener("click", toggleRegisterForm);
    }

    const btnRefresh = document.getElementById("btnRefreshNodes");
    if (btnRefresh) {
        btnRefresh.addEventListener("click", loadNodesPage);
    }

    window.registerNode    = registerNode;
    window.closeNodeDetail = () => {
        document.getElementById("nodeDetailPanel").classList.add("hidden");
    };
    window.toggleRegisterForm = toggleRegisterForm;


    // password modal
    function showPasswordModal(title, message, onConfirm) {
        const existing = document.getElementById("pwdModalOverlay");
        if (existing) {
            existing.remove();
        }

        const overlay    = el("div");    overlay.id    = "pwdModalOverlay";
        const box        = el("div");    box.id         = "pwdModalBox";
        const heading    = el("h3", null, title);
        const para       = el("p",  null, message);
        const input      = el("input");
        input.id          = "pwdModalInput";
        input.type        = "password";
        input.placeholder = "Enter your password";
        input.autocomplete = "current-password";
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

        input.addEventListener("keydown", e => {
            if (e.key === "Enter") {
                confirm();
            }
        });

        overlay.addEventListener("click", e => {
            if (e.target === overlay) {
                close();
            }
        });

        btnRow.append(cancelBtn, confirmBtn);
        box.append(heading, para, input, errorMsg, btnRow);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        input.focus();
    }

});