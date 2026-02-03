document.addEventListener("DOMContentLoaded", () => {

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
    };
    
    try {
        // api call for submission
        const response = await fetch(`${API_URL}/requests/submit`, { 
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify(requestPayload)
        });

        // simplified mock logic
        if (response.ok) {
            alert(`Scan Request Submitted! (API response: ${response.status})`);
        } else {

             alert(`[MOCK SUCCESS]: Scan Request Submitted! Target: ${targetNetwork}, Type: ${scanType}. (Server status: ${response.status} - Endpoint not found, but data is ready)`);
        }

        // clear and show dashboard
        scanNotes.value = "";
        scanDateTime.value = "";
        networkSelect.value = "";
        scanTypeSelect.value = "";
        showPage("dashboard");
        loadData(); 

    } catch (err) {
        console.error("Submission failed:", err);
        alert("Failed to connect to the server.");
    }
}

  // UI helper
  function buildTilesForRole(role) {
    tilesContainer.innerHTML = ""; 
    const allowed = new Set(rolePages[role] || []);
    tileDefs.forEach(td => {
      if (allowed.has(td.page)) {
        const el = document.createElement("div");
        el.className = "tile";
        el.id = td.id;
        el.innerHTML = `<span class="material-icons mi">${td.icon}</span>
                        <h3>${td.title}</h3><p>${td.desc}</p>`;
        el.onclick = () => showPage(td.page);
        tilesContainer.appendChild(el);
      }
    });
  }

  function showPage(pageId) {
    if (!currentUser) return;
    
   // permission check
    const allowed = rolePages[currentUser.role] || [];
    if (!allowed.includes(pageId) && pageId !== "dashboard") {
        alert("Access Denied (UI restriction - This is not the security mechanism!)");
        return;
    }

    document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
    if (pageId === "dashboard") {
      document.getElementById("dashboard").classList.remove("hidden");
      return;
    }
    const target = document.getElementById(pageId);
    if (target) target.classList.remove("hidden");
  }


  // mock filtering table
  function loadMockResults() {
    resultsTableBody.innerHTML = `
      <tr><td>REQ-000</td><td>SchoolWiFi</td><td>-55 dBm</td><td>WPA2</td></tr>
      <tr><td>REQ-002</td><td>BluetoothDevice</td><td>-40 dBm</td><td>BLE</td></tr>
    `;
  }
  function loadMockNodes() {
    nodeTableBody.innerHTML = `
      <tr><td>Node-01</td><td>Online</td><td>87%</td><td>30s ago</td></tr>
      <tr><td>Node-02</td><td>Offline</td><td>—</td><td>2h ago</td></tr>
    `;
  }

});