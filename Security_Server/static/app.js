document.addEventListener("DOMContentLoaded", () => {
    let currentUser = null;

    const API_URL = "http://127.0.0.1:5000/api";

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

    const approvalTableBody = document.querySelector("#approvalTable tbody");
    const resultsTableBody = document.querySelector("#resultsTable tbody");
    const nodeTableBody = document.querySelector("#nodeTable tbody");

    const submitScanBtn = document.getElementById("submitScanBtn");
    const networkSelect = document.getElementById("networkSelect");
    const scanTypeSelect = document.getElementById("scanTypeSelect");
    const scanNotes = document.getElementById("scanNotes");
    const scanDateTime = document.getElementById("scanDateTime");

    const rolePages = {
        admin: ["createScan", "approval", "results", "nodes", "admin", "dashboard"],
        safeguard: ["approval", "results", "dashboard"],
        staff: ["createScan", "results", "dashboard"]
    };

    const tileDefs = [
        { id: "t-create", title: "Create Scan", icon: "wifi_tethering", page: "createScan" },
        { id: "t-approve", title: "Approve Requests", icon: "assignment_turned_in", page: "approval" },
        { id: "t-results", title: "Scan Results", icon: "wifi", page: "results" },
        { id: "t-nodes", title: "Node Health", icon: "memory", page: "nodes" }
    ];

    loginBtn.addEventListener("click", handleLogin);
    btnLogout.addEventListener("click", logout);
    if(submitScanBtn) submitScanBtn.addEventListener("click", submitScan);

    function handleLogin() {
        const username = loginUser.value.trim();
        const password = loginPass.value.trim();
        if(!username || !password) { loginError.textContent="Enter username/password"; loginError.classList.remove("hidden"); return; }

        fetch(`${API_URL}/login`, {
            method:"POST",
            headers: {"Content-Type":"application/json"},
            body: JSON.stringify({username,password})
        }).then(r=>r.json().then(data=>({status:r.status,data})))
          .then(resp=>{
              if(resp.status===200){
                  localStorage.setItem('authToken','mocktoken123');
                  localStorage.setItem('authUser', JSON.stringify({name:username, role:resp.data.role}));
                  setupSession(username, resp.data.role);
              } else {
                  loginError.textContent=resp.data.error || "Login failed";
                  loginError.classList.remove("hidden");
              }
          });
    }

    function setupSession(name, role){
        currentUser={name,role};
        userInfo.textContent=`${name} (${role})`;
        loginScreen.classList.add("hidden");
        app.classList.remove("hidden");
        btnAdminQuick.classList.toggle("hidden", role!=="admin");
        btnAdminQuick.onclick=()=>showPage("admin");
        buildTilesForRole(role);
        showPage("dashboard");
        loadData();
    }

    function logout(){
        localStorage.removeItem('authToken'); localStorage.removeItem('authUser'); currentUser=null;
        app.classList.add("hidden"); loginScreen.classList.remove("hidden");
        document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));
    }

    function buildTilesForRole(role){
        tilesContainer.innerHTML="";
        tileDefs.forEach(tile=>{
            if(rolePages[role].includes(tile.page)){
                const div=document.createElement("div");
                div.className="tile";
                div.innerHTML=`<span class="material-icons">${tile.icon}</span><h3>${tile.title}</h3>`;
                div.onclick=()=>showPage(tile.page);
                tilesContainer.appendChild(div);
            }
        });
    }

    function showPage(id){
        document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));
        const page=document.getElementById(id);
        if(page) page.classList.remove("hidden");
    }

    function loadData(){
        const token=localStorage.getItem('authToken');
        if(!token) return;

        fetch(`${API_URL}/requests`, { headers:{'Authorization':`Bearer ${token}`}})
            .then(r=>r.json())
            .then(data=>renderApprovalTable(data))
            .catch(err=>console.error(err));

        loadMockResults();
        loadMockNodes();
    }

    function renderApprovalTable(requests){
        approvalTableBody.innerHTML="";
        requests.forEach(r=>{
            const isPending=r.status==="pending";
            let actionHtml=isPending ? `<button onclick="approveScan('${r.id}')">Approve</button>` : "—";
            const tr=document.createElement("tr");
            tr.innerHTML=`<td>${r.id}</td><td>${r.type}</td><td>${r.requested_by}</td><td>${r.status}</td><td>${actionHtml}</td>`;
            approvalTableBody.appendChild(tr);
        });
    }

    window.approveScan = function(id){
        fetch(`${API_URL}/approve-scan`, {
            method:"POST",
            headers:{'Content-Type':'application/json','Authorization':`Bearer mocktoken123`},
            body: JSON.stringify({id})
        }).then(r=>r.json().then(d=>({status:r.status,data:d})))
        .then(resp=>{
            if(resp.status===200) alert(resp.data.message);
            else alert(resp.data.error);
            loadData();
        });
    }

    function submitScan(){
        alert("Scan submitted (mock)");
    }

    function loadMockResults(){
        resultsTableBody.innerHTML="";
        const rows=[
            {id:"R-1", target:"Network1", status:"Completed", notes:"No issues"},
            {id:"R-2", target:"Network2", status:"Running", notes:"Pending"}
        ];
        rows.forEach(r=>{
            const tr=document.createElement("tr");
            tr.innerHTML=`<td>${r.id}</td><td>${r.target}</td><td>${r.status}</td><td>${r.notes}</td>`;
            resultsTableBody.appendChild(tr);
        });
    }

    function loadMockNodes(){
        nodeTableBody.innerHTML="";
        const nodes=[
            {mac:"AA:BB:CC:11:22:33", name:"Server1", last_seen:"2026-02-01"},
            {mac:"12:34:56:78:90:AB", name:"Node2", last_seen:"2026-02-02"}
        ];
        nodes.forEach(n=>{
            const tr=document.createElement("tr");
            tr.innerHTML=`<td>${n.mac}</td><td>${n.name}</td><td>${n.last_seen}</td>`;
            nodeTableBody.appendChild(tr);
        });
    }
});
