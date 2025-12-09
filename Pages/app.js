document.addEventListener("DOMContentLoaded", () => {
  const users = {
    "admin": { password: "admin123", role: "admin" },
    "safeguard": { password: "safe123", role: "safeguard" }, 
    "auditor": { password: "audit123", role: "auditor" },
    "staff": { password: "staff123", role: "staff" }
  };

  let currentUser = null;

  const rolePages = {
    admin:      ["btnDashboard","btnCreate","btnApproval","btnResults","btnNodes","btnAdmin"],
    safeguard:  ["btnDashboard","btnResults"],
    auditor:    ["btnDashboard","btnApproval","btnResults"],
    staff:      ["btnDashboard","btnCreate","btnResults"]
  };

  const loginBtn = document.getElementById("loginBtn");
  const submitScanBtn = document.getElementById("submitScanBtn");
  const createUserBtn = document.getElementById("createUserBtn");

  loginBtn.addEventListener("click", login);
  if (submitScanBtn) submitScanBtn.addEventListener("click", submitScan);
  if (createUserBtn) createUserBtn.addEventListener("click", createUser);

  function login() {
    const username = document.getElementById("loginUser").value.trim();
    const password = document.getElementById("loginPass").value.trim();
    const loginErr = document.getElementById("loginError");
    loginErr.classList.add("hidden");

    if (!username || !password) {
      loginErr.textContent = "Enter username and password";
      loginErr.classList.remove("hidden");
      return;
    }

    const u = users[username];
    if (!u || u.password !== password) {
      loginErr.textContent = "Invalid username or password";
      loginErr.classList.remove("hidden");
      return;
    }

    currentUser = { name: username, role: u.role };

    document.getElementById("loginScreen").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");
    
    document.getElementById("loginPass").value = ""; 

    clearTables();
    loadMenu();
    loadFakeData();
    showPage("dashboard"); 
  }

  window.logout = function() {
    currentUser = null;
    document.getElementById("app").classList.add("hidden");
    document.getElementById("loginScreen").classList.remove("hidden");
    document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
    document.querySelectorAll(".menu-item").forEach(mi => mi.classList.add("hidden"));
    document.getElementById("loginUser").value = "";
    document.getElementById("loginPass").value = "";
  };

  function loadMenu() {
    if (!currentUser) return;
    const role = currentUser.role;
    document.querySelectorAll(".menu-item").forEach(el => el.classList.add("hidden"));

    const allowed = rolePages[role];
    if (!allowed) return;
    allowed.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove("hidden");
    });
  }

  window.showPage = function(pageId) {
    document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
    const target = document.getElementById(pageId);
    if (!target) return;
    target.classList.remove("hidden");
  };

  function clearTables() {
    const ids = ["approvalTable","resultsTable","nodeTable","userTable"];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (id === "approvalTable") el.innerHTML = `<tr><th>Request ID</th><th>Type</th><th>User</th><th>Status</th><th>Action</th></tr>`;
      if (id === "resultsTable") el.innerHTML = `<tr><th>Request ID</th><th>SSID</th><th>Signal</th><th>Security</th></tr>`;
      if (id === "nodeTable") el.innerHTML = `<tr><th>Node ID</th><th>Status</th><th>Battery</th><th>Last Seen</th></tr>`;
      if (id === "userTable") el.innerHTML = `<tr><th>Username</th><th>Role</th><th>Actions</th></tr>`;
    });
  }

  function loadFakeData() {
    const appT = document.getElementById("approvalTable");
    appT.innerHTML += `<tr><td>REQ-001</td><td>WiFi Scan</td><td>staff</td><td>Pending</td>
      <td><button onclick="approveScan('REQ-001')">Approve</button></td></tr>`;

    const resT = document.getElementById("resultsTable");
    resT.innerHTML += `<tr><td>REQ-000</td><td>SchoolWiFi</td><td>-55 dBm</td><td>WPA2</td></tr>`;

    const nT = document.getElementById("nodeTable");
    nT.innerHTML += `<tr><td>Node-01</td><td>Online</td><td>87%</td><td>1 min ago</td></tr>`;

    const uT = document.getElementById("userTable");
    uT.innerHTML = `<tr><th>Username</th><th>Role</th><th>Actions</th></tr>`;
    Object.keys(users).forEach(name => {
      const removeBtn = name === 'admin' ? '—' : `<button onclick="this.closest('tr').remove()">Remove</button>`;
      uT.innerHTML += `<tr><td>${name}</td><td>${users[name].role}</td><td>${removeBtn}</td></tr>`;
    });
  }

  window.approveScan = function(id) {
    alert("Approved " + id);
    const appT = document.getElementById("approvalTable");
    Array.from(appT.querySelectorAll("tr")).forEach(row => {
      if (row.children.length > 0 && row.children[0].innerText === id) {
        if (row.children[3] && row.children[4]) {
             row.children[3].innerText = "Approved";
             row.children[4].innerHTML = "—";
        }
      }
    });
    const resT = document.getElementById("resultsTable");
    resT.innerHTML += `<tr><td>${id}</td><td>GeneratedSSID</td><td>-60 dBm</td><td>WPA2</td></tr>`;
  };

  function submitScan() {
    const type = document.getElementById("scanType").value;
    const note = document.getElementById("scanNote").value;
    const err = document.getElementById("scanError");
    const ok = document.getElementById("scanSuccess");
    err.classList.add("hidden");
    ok.classList.add("hidden");

    if (!type) {
      err.textContent = "Please select a scan type.";
      err.classList.remove("hidden");
      return;
    }

    const id = "REQ-" + Math.floor(Math.random()*900 + 100);
    const appT = document.getElementById("approvalTable");
    appT.innerHTML += `<tr><td>${id}</td><td>${type}</td><td>${currentUser.name}</td><td>Pending</td>
      <td><button onclick="approveScan('${id}')">Approve</button></td></tr>`;

    ok.textContent = "Scan request submitted (ID: " + id + ")";
    ok.classList.remove("hidden");
    document.getElementById("scanType").value = "";
    document.getElementById("scanNote").value = "";
    showPage("dashboard");
  }
  window.submitScan = submitScan;

  function createUser() {
    const uname = document.getElementById("newUser").value.trim();
    const role = document.getElementById("newRole").value;
    const msg = document.getElementById("adminMessage");
    msg.classList.add("hidden");

    if (!uname) { msg.textContent = "Enter username"; msg.classList.remove("hidden"); return; }
    if (users[uname]) { msg.textContent = `User ${uname} already exists!`; msg.classList.remove("hidden"); return; }

    users[uname] = { password: "changeme", role: role };
    const uT = document.getElementById("userTable");
    uT.innerHTML += `<tr><td>${uname}</td><td>${role}</td><td><button onclick="this.closest('tr').remove()">Remove</button></td></tr>`;
    msg.textContent = `User ${uname} created (pw: changeme)`;
    msg.classList.remove("hidden");
    document.getElementById("newUser").value = ""; 
  }
  window.createUser = createUser;
});