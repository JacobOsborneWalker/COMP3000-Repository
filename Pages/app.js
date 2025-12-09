document.addEventListener("DOMContentLoaded", () => {

  // fake data
  const users = {
    "admin": { password: "admin123", role: "admin" },
    "safeguard": { password: "safe123", role: "safeguard" },    
    "auditor": { password: "audit123", role: "auditor" },
    "ict": { password: "ict123", role: "ict" },
    "staff": { password: "staff123", role: "staff" }
  };

  // roles
  const rolePages = {
    admin:    ["createScan","approval","results","nodes","admin","dashboard"],
    safeguard:["approval","results","dashboard"],
    auditor:  ["approval","results","dashboard"],
    ict:      ["createScan","results","nodes","dashboard"],
    staff:    ["createScan","results","dashboard"]
  };

  // tiles
  const tileDefs = [
    { id:"t-create", title:"Create Scan", desc:"Submit a new scan request", icon:"wifi_tethering", page:"createScan" },
    { id:"t-approve", title:"Approve Requests", desc:"Review & approve pending scans", icon:"assignment_turned_in", page:"approval" },
    { id:"t-results", title:"Scan Results", desc:"View scan outcomes and details", icon:"wifi", page:"results" },
    { id:"t-nodes", title:"Node Health", desc:"Monitor deployed nodes", icon:"memory", page:"nodes" }
  ];

  let currentUser = null; 

  // DOM
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

  // page elements
  const approvalTableBody = document.querySelector("#approvalTable tbody");
  const resultsTableBody = document.querySelector("#resultsTable tbody");
  const nodeTableBody = document.querySelector("#nodeTable tbody");
  const userTableBody = document.querySelector("#userTable tbody");

  // buttons
  const submitScanBtn = document.getElementById("submitScanBtn");
  const createUserBtn = document.getElementById("createUserBtn");

  // wire events
  loginBtn.addEventListener("click", handleLogin);
  btnLogout.addEventListener("click", logout);
  if (submitScanBtn) submitScanBtn.addEventListener("click", submitScan);
  if (createUserBtn) createUserBtn.addEventListener("click", createUser);


  window.showPage = showPage;
  window.approveScan = approveScan;

  // login
  function handleLogin() {
    loginError.classList.add("hidden");
    const username = loginUser.value.trim();
    const password = loginPass.value.trim();

    if (!username || !password) {
      loginError.textContent = "Enter username and password";
      loginError.classList.remove("hidden");
      return;
    }
    const acct = users[username];
    if (!acct || acct.password !== password) {
      loginError.textContent = "Invalid username or password";
      loginError.classList.remove("hidden");
      return;
    }

    currentUser = { name: username, role: acct.role };

    // update page
    userInfo.textContent = `${currentUser.name} (${currentUser.role})`;
    loginScreen.classList.add("hidden");
    app.classList.remove("hidden");

    // clear password
    loginPass.value = "";

   
    btnAdminQuick.classList.toggle("hidden", currentUser.role !== "admin");
    btnAdminQuick.onclick = () => showPage("admin");

    buildTilesForRole(currentUser.role);
    clearTables();
    loadFakeData();
    showPage("dashboard");
  }

  // logout
  function logout() {
    currentUser = null;
    app.classList.add("hidden");
    loginScreen.classList.remove("hidden");
    loginUser.value = ""; loginPass.value = "";
    document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  }

  
  // build tyle
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


  // show pages
  function showPage(pageId) {
    
    if (!currentUser) {
      console.warn("Attempt to navigate while not logged in");
      return;
    }

    // check permission
    if (currentUser.role !== "admin") {
      const allowed = rolePages[currentUser.role] || [];
      if (!allowed.includes(pageId) && pageId !== "dashboard") {
        alert("You do not have permission to access that page.");
        return;
      }
    }

    // hide all pages
    document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));

    // show dashboard 
    if (pageId === "dashboard") {
      document.getElementById("dashboard").classList.remove("hidden");
      return;
    }

    const target = document.getElementById(pageId);
    if (!target) {
      console.error("showPage: no page found with id", pageId);
      return;
    }
    target.classList.remove("hidden");
  }

  // clear table
  function clearTables() {
    approvalTableBody.innerHTML = "";
    resultsTableBody.innerHTML = "";
    nodeTableBody.innerHTML = "";
    userTableBody.innerHTML = "";
  }

  // load data
  function loadFakeData() {

    // pending
    approvalTableBody.innerHTML = `
      <tr><td>REQ-001</td><td>WiFi Scan</td><td>staff</td><td>Pending</td>
        <td><button onclick="approveScan('REQ-001')">Approve</button></td></tr>
    `;

    // results
    resultsTableBody.innerHTML = `
      <tr><td>REQ-000</td><td>SchoolWiFi</td><td>-55 dBm</td><td>WPA2</td></tr>
    `;

    // nodes
    nodeTableBody.innerHTML = `
      <tr><td>Node-01</td><td>Online</td><td>87%</td><td>30s ago</td></tr>
      <tr><td>Node-02</td><td>Offline</td><td>—</td><td>2h ago</td></tr>
    `;

    // users
    userTableBody.innerHTML = "";
    Object.keys(users).forEach(un => {
      const r = document.createElement("tr");
      r.innerHTML = `<td>${un}</td><td>${users[un].role}</td>
        <td><button onclick="this.closest('tr').remove()">Remove</button></td>`;
      userTableBody.appendChild(r);
    });
  }

  // approve scan
  function approveScan(id) {

    // approved
    Array.from(approvalTableBody.querySelectorAll("tr")).forEach(row => {
      if (row.children[0] && row.children[0].innerText === id) {
        row.children[3].innerText = "Approved";
        row.children[4].innerHTML = "—";
      }
    });

    // add results
    const newRow = document.createElement("tr");
    newRow.innerHTML = `<td>${id}</td><td>GeneratedSSID</td><td>-60 dBm</td><td>WPA2</td>`;
    resultsTableBody.appendChild(newRow);
    alert("Approved " + id);
  }
  window.approveScan = approveScan;

  // submit scan
  function submitScan() {
    const type = document.getElementById("scanType").value;
    const note = document.getElementById("scanNote").value;
    const err = document.getElementById("scanError");
    const ok = document.getElementById("scanSuccess");
    err.classList.add("hidden"); ok.classList.add("hidden");

    if (!type) {
      err.textContent = "Please select a scan type.";
      err.classList.remove("hidden");
      return;
    }

    const id = "REQ-" + Math.floor(Math.random() * 900 + 100);
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${id}</td><td>${type}</td><td>${currentUser.name}</td><td>Pending</td>
      <td><button onclick="approveScan('${id}')">Approve</button></td>`;
    approvalTableBody.appendChild(tr);

    ok.textContent = "Scan request submitted (" + id + ")";
    ok.classList.remove("hidden");

    
    setTimeout(() => showPage("dashboard"), 800);
  }
  window.submitScan = submitScan;

  
  // create user
  function createUser() {
    const uname = document.getElementById("newUser").value.trim();
    const role = document.getElementById("newRole").value;
    const msg = document.getElementById("adminMessage");
    msg.classList.add("hidden");

    if (!uname) { msg.textContent = "Enter username"; msg.classList.remove("hidden"); return; }
    
    users[uname] = { password: "changeme", role: role };
    const r = document.createElement("tr");
    r.innerHTML = `<td>${uname}</td><td>${role}</td><td><button onclick="this.closest('tr').remove()">Remove</button></td>`;
    userTableBody.appendChild(r);
    msg.textContent = `User ${uname} created (pw: changeme)`; msg.classList.remove("hidden");
    document.getElementById("newUser").value = "";
  }
  window.createUser = createUser;

}); 