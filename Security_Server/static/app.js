document.addEventListener("DOMContentLoaded", () => {
    let currentUser = null;

    const API_URL = "http://10.137.45.9:5000/api";

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
          })
          .catch(err=>{
              loginError.textContent="Cannot reach server — check IP or that Flask is running";
              loginError.classList.remove("hidden");
              console.error("Login error:", err);
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

    // ----------------------------
    // MOCK DATA
    // ----------------------------
    const mockPendingScans = [
        {id:"REQ-201", user:"staff", network:"Network1", type:"Passive", time:"2026-02-10 10:30", justification:"Routine check"},
        {id:"REQ-202", user:"safeguard", network:"Network2", type:"Active", time:"2026-02-10 11:00", justification:"Investigate hidden devices"}
    ];

    const mockHistoryScans = [
        {id:"REQ-101", decision:"Approved", startedBy:"staff", approvedBy:"admin", keyData:"SSID: HomeNetwork, Devices: 2"},
        {id:"REQ-102", decision:"Declined", startedBy:"safeguard", approvedBy:"admin", keyData:"SSID: CoffeeShopWiFi, Devices: 1"}
    ];

    const mockScans = [
        {id:"R-1", type:"Passive", time:"2026-02-10 10:30", requestedBy:"staff", approvedBy:"admin", network:"Network1"},
        {id:"R-2", type:"Active", time:"2026-02-10 11:00", requestedBy:"safeguard", approvedBy:"admin", network:"Network2"},
        {id:"R-3", type:"Deep Passive", time:"2026-02-10 12:00", requestedBy:"staff", approvedBy:"admin", network:"Network1"}
    ];

    const mockDevices = {
        "R-1":[
            {mac:"AA:BB:CC:11:22:33", vendor:"Cisco", signal:-55, channel:6, timeSeen:"2026-02-10 10:30", flags:""},
            {mac:"44:55:66:77:88:99", vendor:"Apple", signal:-70, channel:11, timeSeen:"2026-02-10 10:32", flags:"Suspicious"}
        ],
        "R-2":[
            {mac:"12:34:56:78:90:AB", vendor:"Samsung", signal:-60, channel:1, timeSeen:"2026-02-10 11:05", flags:""},
            {mac:"DE:AD:BE:EF:01:02", vendor:"Unknown", signal:-80, channel:6, timeSeen:"2026-02-10 11:10", flags:"Suspicious"}
        ],
        "R-3":[
            {mac:"AA:BB:CC:11:22:33", vendor:"Cisco", signal:-50, channel:6, timeSeen:"2026-02-10 12:01", flags:""},
            {mac:"FE:DC:BA:98:76:54", vendor:"Unknown", signal:-90, channel:11, timeSeen:"2026-02-10 12:05", flags:"Rogue AP"}
        ]
    };

    const mockSummary = {
        "R-1": {totalDevices:2, suspicious:1, rogueAP:"No", bandwidth:"Low"},
        "R-2": {totalDevices:2, suspicious:1, rogueAP:"No", bandwidth:"Medium"},
        "R-3": {totalDevices:2, suspicious:1, rogueAP:"Yes", bandwidth:"High"}
    };

    // ----------------------------
    // LOAD DATA
    // ----------------------------
    function loadData(){
        renderPendingScans();
        renderHistoryScans();
        populateScanSelect();
        loadMockNodes();
    }

    // ----------------------------
    // Approval Page Renderers
    // ----------------------------
    function renderPendingScans(){
        const tbody = document.querySelector("#pendingTable tbody");
        tbody.innerHTML = "";
        mockPendingScans.forEach(r=>{
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${r.id}</td>
                <td>${r.user}</td>
                <td>${r.network}</td>
                <td>${r.type}</td>
                <td>${r.time}</td>
                <td>${r.justification}</td>
                <td>
                    <button onclick="approveScanRequest('${r.id}')">Approve</button>
                    <button onclick="declineScanRequest('${r.id}')">Decline</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderHistoryScans(){
        const tbody = document.querySelector("#historyTable tbody");
        tbody.innerHTML = "";
        mockHistoryScans.forEach(r=>{
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${r.id}</td>
                <td>${r.decision}</td>
                <td>${r.startedBy}</td>
                <td>${r.approvedBy}</td>
                <td>${r.keyData}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.approveScanRequest = function(id){
        const index = mockPendingScans.findIndex(r=>r.id===id);
        if(index>=0){
            const req = mockPendingScans.splice(index,1)[0];
            mockHistoryScans.unshift({
                id:req.id,
                decision:"Approved",
                startedBy:req.user,
                approvedBy:currentUser.name,
                keyData:`SSID: ${req.network}, Devices: 2`
            });
            renderPendingScans();
            renderHistoryScans();
            alert(`Request ${id} approved.`);
        }
    }

    window.declineScanRequest = function(id){
        const index = mockPendingScans.findIndex(r=>r.id===id);
        if(index>=0){
            const req = mockPendingScans.splice(index,1)[0];
            mockHistoryScans.unshift({
                id:req.id,
                decision:"Declined",
                startedBy:req.user,
                approvedBy:currentUser.name,
                keyData:`SSID: ${req.network}, Devices: 0`
            });
            renderPendingScans();
            renderHistoryScans();
            alert(`Request ${id} declined.`);
        }
    }

    // ----------------------------
    // Scan Results Page
    // ----------------------------
    function populateScanSelect(){
        const select = document.getElementById("scanSelect");
        select.innerHTML = '<option value="">-- Choose Scan --</option>';
        mockScans.forEach(s=>{
            const opt = document.createElement("option");
            opt.value = s.id;
            opt.textContent = `${s.id} | ${s.time} | ${s.type}`;
            select.appendChild(opt);
        });

        select.addEventListener("change", function(){
            const scanId = this.value;
            if(scanId) displayScanResults(scanId);
        });
    }

    function displayScanResults(scanId){
        const scan = mockScans.find(s=>s.id===scanId);
        if(!scan) return;

        // Metadata
        const metaBody = document.querySelector("#scanMetadataTable tbody");
        metaBody.innerHTML = `<tr>
            <td>${scan.id}</td>
            <td>${scan.requestedBy}</td>
            <td>${scan.approvedBy}</td>
            <td>${scan.network}</td>
            <td>${scan.type}</td>
            <td>${scan.time}</td>
        </tr>`;

        // Devices
        const devicesBody = document.querySelector("#devicesTable tbody");
        devicesBody.innerHTML = "";
        (mockDevices[scanId]||[]).forEach(d=>{
            const tr = document.createElement("tr");
            tr.innerHTML = `<td>${d.mac}</td><td>${d.vendor}</td><td>${d.signal}</td><td>${d.channel}</td><td>${d.timeSeen}</td><td>${d.flags}</td>`;
            devicesBody.appendChild(tr);
        });

        // Summary
        const summaryBody = document.querySelector("#summaryTable tbody");
        const summary = mockSummary[scanId];
        summaryBody.innerHTML = `<tr>
            <td>${summary.totalDevices}</td>
            <td>${summary.suspicious}</td>
            <td>${summary.rogueAP}</td>
            <td>${summary.bandwidth}</td>
        </tr>`;
    }

    document.getElementById("exportCSV").addEventListener("click", ()=>{
        const scanId = document.getElementById("scanSelect").value;
        if(!scanId){ alert("Select a scan first"); return; }
        let csvContent = "data:text/csv;charset=utf-8,";
        
        const scan = mockScans.find(s=>s.id===scanId);
        csvContent += "Request ID,Requested By,Approved By,Network,Scan Type,Timestamp\n";
        csvContent += `${scan.id},${scan.requestedBy},${scan.approvedBy},${scan.network},${scan.type},${scan.time}\n\n`;

        csvContent += "Device MAC,Vendor,Signal,Channel,Time Seen,Flags\n";
        (mockDevices[scanId]||[]).forEach(d=>{
            csvContent += `${d.mac},${d.vendor},${d.signal},${d.channel},${d.timeSeen},${d.flags}\n`;
        });
        
        const summary = mockSummary[scanId];
        csvContent += `\nTotal Devices, Suspicious, Rogue AP, Bandwidth\n${summary.totalDevices},${summary.suspicious},${summary.rogueAP},${summary.bandwidth}\n`;

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${scanId}_scan.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    document.getElementById("exportJSON").addEventListener("click", ()=>{
        const scanId = document.getElementById("scanSelect").value;
        if(!scanId){ alert("Select a scan first"); return; }
        const data = {
            metadata: mockScans.find(s=>s.id===scanId),
            devices: mockDevices[scanId],
            summary: mockSummary[scanId]
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${scanId}_scan.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    document.getElementById("exportPDF").addEventListener("click", ()=>{
        alert("PDF export not implemented in mock version.");
    });

    // ----------------------------
    // Mock Nodes Table
    // ----------------------------
    function loadMockNodes(){
        const nodeTableBody = document.querySelector("#nodeTable tbody");
        if(!nodeTableBody) return;
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

    function submitScan(){
        alert("Scan submitted (currently mock version)");
    }

    loadData();
});