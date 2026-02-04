document.addEventListener("DOMContentLoaded", () => {
    // --- STATE ---
    let currentUser = null;
    let knownDevicesRegistry = [
        { mac: "AA:BB:CC:11:22:33", name: "Internal Database Server", date: "2026-01-01" },
        { mac: "12:34:56:78:90:AB", name: "Admin Dashboard Console", date: "2026-01-05" }
    ];

<<<<<<< Updated upstream
  // configuration
  const API_URL = "http://10.137.45.6:5000/api";

  // dom elements
  const loginBtn = document.getElementById("loginBtn");
  const loginUser = document.getElementById("loginUser");
  const loginPass = document.getElementById("loginPass");
  const loginError = document.getElementById("loginError");
  const app = document.getElementById("app");
  const loginScreen = document.getElementById("loginScreen");
  const tilesContainer = document.getElementById("tiles");
  const userInfo = document.getElementById("userInfo");
  const btnLogout = document.getElementById("btnLogout");
  const btnAdminQuick = document.getElementById("btnAdminQuick");

  // Ppage elements
  const approvalTableBody = document.querySelector("#approvalTable tbody");
  const resultsTableBody = document.querySelector("#resultsTable tbody");
  const nodeTableBody = document.querySelector("#nodeTable tbody");
  
  // buttons
  const submitScanBtn = document.getElementById("submitScanBtn");
  const networkSelect = document.getElementById("networkSelect");
  const scanTypeSelect = document.getElementById("scanTypeSelect");
  const scanNotes = document.getElementById("scanNotes");
  const scanDateTime = document.getElementById("scanDateTime");
  

  let currentUser = null; 

  // permission
  const rolePages = {
    admin:     ["createScan", "approval", "results", "nodes", "admin", "dashboard"],
    safeguard: ["approval", "results", "dashboard"],
    auditor:   ["approval", "results", "dashboard"],
    ict:       ["createScan", "results", "nodes", "dashboard"],
    staff:     ["createScan", "results", "dashboard"]
  };

  const tileDefs = [
    { id: "t-create", title: "Create Scan", desc: "Submit a new scan request", icon: "wifi_tethering", page: "createScan" },
    { id: "t-approve", title: "Approve Requests", desc: "Review & approve pending scans", icon: "assignment_turned_in", page: "approval" },
    { id: "t-results", title: "Scan Results", desc: "View scan outcomes and details", icon: "wifi", page: "results" },
    { id: "t-nodes", title: "Node Health", desc: "Monitor deployed nodes", icon: "memory", page: "nodes" }
  ];

  // listeners
  loginBtn.addEventListener("click", handleLogin);
  btnLogout.addEventListener("click", logout);

  if (submitScanBtn) submitScanBtn.addEventListener("click", submitScan);
  
  window.showPage = showPage;
  window.approveScan = approveScan;

  // check if logged in
  checkSession();

 // authentication
  async function handleLogin() {
    loginError.classList.add("hidden");
    const username = loginUser.value.trim();
    const password = loginPass.value.trim();

    if (!username || !password) {
      showError("Enter username and password");
      return;
    }

    try {
      // call flask api
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok) {
        // save token and user info
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('authUser', JSON.stringify({ name: data.username, role: data.role }));
        
        setupSession(data.username, data.role);

        // clear password
        loginPass.value = "";
        
      } else {

        // error
        showError(data.message || "Login failed");
      }
    } catch (err) {
      console.log("this bit is not working")
      console.error(err);
      showError("Server error. Is flask running?");
    }
  }

  function checkSession() {
    const token = localStorage.getItem('authToken');
    const userStr = localStorage.getItem('authUser');
    
    if (token && userStr) {
      const user = JSON.parse(userStr);
      setupSession(user.name, user.role);
    }
  }

  function setupSession(name, role) {
    currentUser = { name, role };
    userInfo.textContent = `${name} (${role})`;
    
    loginScreen.classList.add("hidden");
    app.classList.remove("hidden");

    // admin button
    btnAdminQuick.classList.toggle("hidden", role !== "admin");
    btnAdminQuick.onclick = () => showPage("admin");

    buildTilesForRole(role);
    showPage("dashboard");
    
    loadData();
  }

  // logout
  function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    currentUser = null;
    app.classList.add("hidden");
    loginScreen.classList.remove("hidden");
    document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  }

  function showError(msg) {
    loginError.textContent = msg;
    loginError.classList.remove("hidden");
  }

  // load data
  async function loadData() {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
      
      // fetch request from flask
      const response = await fetch(`${API_URL}/requests`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}` 
        }
      });

      // expired token
      if (response.status === 401) { logout(); return; } 

      const requests = await response.json();
      renderApprovalTable(requests);
      
      loadMockResults(); 
      loadMockNodes();

      // fail to load
    } catch (err) {
      console.error("Failed to load data:", err);
    }
  }


  // approval table
  function renderApprovalTable(requests) {
    approvalTableBody.innerHTML = "";
    requests.forEach(req => {
      const isPending = req.status === "Pending";
      let actionHtml = "—";
      if (isPending && (currentUser.role === 'admin' || currentUser.role === 'safeguard')) {
        actionHtml = `<button onclick="approveScan('${req.id}')">Approve</button>`;
      } else if (isPending) {
         actionHtml = `<span style="color:#999; font-size:12px">Waiting Approval</span>`;
      }

      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${req.id}</td><td>${req.type}</td><td>${req.user}</td><td>${req.status}</td><td>${actionHtml}</td>`;
      approvalTableBody.appendChild(tr);
    });
  }

  // action
  async function approveScan(id) {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
      // call flask api
      const response = await fetch(`${API_URL}/approve-scan`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ id: id })
      });

      const result = await response.json();

      if (response.ok) {
        alert("Success: " + result.message);
        loadData(); 
      } else {
        alert("Error: " + result.message);
      }
    } catch (err) {
      console.error(err);
      alert("Request failed");
    }
  }

  // submit scan
  async function submitScan() {
    
    const targetNetwork = networkSelect.value;
    const scanType = scanTypeSelect.value;
    const notes = scanNotes.value;
    const scheduledTime = scanDateTime.value;

    // check inputs
    if (!targetNetwork || !scanType || !scheduledTime) {
        alert("Please select a target, a scan type, and a scheduled date/time.");
        return;
    }

    const token = localStorage.getItem('authToken');
    if (!token) { logout(); return; } 

    // request payload
    const requestPayload = {
        target: targetNetwork,
        type: scanType,
        notes: notes,
        scheduled_for: scheduledTime, 
        user: currentUser.name 
=======
    const ROLE_PERMISSIONS = {
        admin: ["dashboard", "createScan", "results", "knownDevices", "nodes", "admin"],
        ict: ["dashboard", "createScan", "results", "knownDevices", "nodes"],
        staff: ["dashboard", "createScan", "results"]
>>>>>>> Stashed changes
    };

    const MOCK_SCANS = [
        { id: "SCAN-501", ssid: "GuestNet", time: "2026-01-16 08:30", status: "Success" },
        { id: "SCAN-502", ssid: "StaffSecure", time: "2026-01-15 14:00", status: "Success" }
    ];

    const MOCK_REPORT_DEVICES = {
        "SCAN-501": [
            { mac: "AA:BB:CC:11:22:33", signal: "-42" },
            { mac: "00:E0:4C:68:01:AF", signal: "-88" } // Unknown
        ],
        "SCAN-502": [
            { mac: "12:34:56:78:90:AB", signal: "-30" }
        ]
    };

    // --- TIME SELECTOR INITIALIZATION ---
    const dateInput = document.getElementById("scanDateTime");
    const now = new Date();
    // Setting min date to 'now' to prevent past selection
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    dateInput.min = now.toISOString().slice(0, 16);
    dateInput.value = now.toISOString().slice(0, 16);

    window.setQuickTime = (minutes) => {
        const target = new Date();
        target.setMinutes(target.getMinutes() + minutes - target.getTimezoneOffset());
        dateInput.value = target.toISOString().slice(0, 16);
    };

    // --- LOGIN LOGIC ---
    document.getElementById("loginBtn").addEventListener("click", () => {
        const user = document.getElementById("loginUser").value;
        const pass = document.getElementById("loginPass").value;
        if (user === "admin" && pass === "admin123") initSession("System Admin", "admin");
        else alert("Unauthorized access. Check credentials.");
    });

    function initSession(name, role) {
        currentUser = { name, role };
        document.getElementById("userInfo").textContent = `${name} (${role.toUpperCase()})`;
        document.getElementById("loginScreen").classList.add("hidden");
        document.getElementById("app").classList.remove("hidden");
        
        // Show Admin Panel shortcut if admin
        const adminBtn = document.getElementById("btnAdminQuick");
        adminBtn.classList.toggle("hidden", role !== 'admin');
        adminBtn.onclick = () => showPage("admin");

        buildTiles(role);
        showPage("dashboard");
    }

    document.getElementById("btnLogout").addEventListener("click", () => location.reload());

    // --- NAVIGATION ---
    window.showPage = (id) => {
        document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
        document.getElementById(id).classList.remove("hidden");
        
        if (id === "results") renderScanHistory();
        if (id === "knownDevices") renderWhitelist();
        if (id === "admin") renderAdminPanel();
        if (id === "nodes") renderNodes();
    };

    function buildTiles(role) {
        const container = document.getElementById("tiles");
        container.innerHTML = "";
        const defs = [
            { id: "createScan", title: "Initiate Scan", icon: "wifi_tethering" },
            { id: "results", title: "Scan Archive", icon: "history" },
            { id: "knownDevices", title: "Asset Registry", icon: "fact_check" },
            { id: "nodes", title: "Node Health", icon: "memory" },
            { id: "admin", title: "Admin Center", icon: "admin_panel_settings" }
        ];

        defs.forEach(d => {
            if (ROLE_PERMISSIONS[role].includes(d.id)) {
                const div = document.createElement("div");
                div.className = "tile";
                div.innerHTML = `<span class="material-icons">${d.icon}</span><h3>${d.title}</h3>`;
                div.onclick = () => showPage(d.id);
                container.appendChild(div);
            }
        });
    }

    // --- SCAN REPORTS & THREAT DETECTION ---
    function renderScanHistory() {
        const tbody = document.querySelector("#resultsListTable tbody");
        tbody.innerHTML = "";
        MOCK_SCANS.forEach(s => {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td><strong>${s.id}</strong></td><td>${s.ssid}</td><td>${s.time}</td>
                            <td><span class="safe-label">${s.status}</span></td>
                            <td><button onclick="viewFullReport('${s.id}')">Analyze</button></td>`;
            tbody.appendChild(tr);
        });
    }

    window.viewFullReport = (id) => {
        const devices = MOCK_REPORT_DEVICES[id] || MOCK_REPORT_DEVICES["SCAN-501"];
        document.getElementById("detailId").textContent = id;
        document.getElementById("detailTime").textContent = "Completed 1s ago";
        
        const tbody = document.querySelector("#deviceLogTable tbody");
        tbody.innerHTML = "";
        let unknownCount = 0;

        devices.forEach(d => {
            const registryMatch = knownDevicesRegistry.find(k => k.mac.toUpperCase() === d.mac.toUpperCase());
            const tr = document.createElement("tr");
            if (!registryMatch) unknownCount++;

            tr.innerHTML = `
                <td style="font-family:monospace">${d.mac}</td>
                <td>${registryMatch ? `<span class="safe-label">${registryMatch.name}</span>` : `<span class="threat-high">UNKNOWN ASSET</span>`}</td>
                <td>${d.signal} dBm</td>
                <td>${registryMatch ? 'Trusted' : '⚠️ Investigating'}</td>
            `;
            tbody.appendChild(tr);
        });

        document.getElementById("sumUnknown").textContent = unknownCount;
        showPage("scanDetail");
    };

    // --- ASSET MANAGEMENT ---
    window.addDeviceToRegistry = () => {
        const mac = document.getElementById("newDevMac").value.trim().toUpperCase();
        const name = document.getElementById("newDevName").value.trim();
        if (mac && name) {
            knownDevicesRegistry.push({ mac, name, date: new Date().toISOString().split('T')[0] });
            renderWhitelist();
            document.getElementById("newDevMac").value = "";
            document.getElementById("newDevName").value = "";
        }
    };

    function renderWhitelist() {
        const tbody = document.querySelector("#knownDevicesTable tbody");
        tbody.innerHTML = "";
        knownDevicesRegistry.forEach((d, i) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td>${d.mac}</td><td>${d.name}</td><td>${d.date}</td>
                            <td><button onclick="removeDevice(${i})">Remove</button></td>`;
            tbody.appendChild(tr);
        });
    }

    window.removeDevice = (index) => {
        knownDevicesRegistry.splice(index, 1);
        renderWhitelist();
    };

    // --- ADMIN & NODES ---
    function renderAdminPanel() {
        const tbody = document.querySelector("#userTable tbody");
        tbody.innerHTML = `<tr><td>admin</td><td><span class="badge badge-admin">admin</span></td><td>Today 08:30</td><td>Full Access</td></tr>`;
        const log = document.getElementById("auditLogs");
        log.innerHTML = `<div class="log-entry">[${new Date().toLocaleTimeString()}] SECURITY_EVENT: Admin Session Initiated</div>
                         <div class="log-entry">[${new Date().toLocaleTimeString()}] WHITELIST_ACCESS: Asset Registry viewed.</div>`;
    }

    function renderNodes() {
        const tbody = document.querySelector("#nodeTable tbody");
        tbody.innerHTML = `<tr><td>NODE-ALPHA</td><td>10.0.0.50</td><td>12%</td><td><span class="safe-label">Active</span></td></tr>
                           <tr><td>NODE-BRAVO</td><td>10.0.0.51</td><td>--</td><td><span class="threat-high">Offline</span></td></tr>`;
    }
});