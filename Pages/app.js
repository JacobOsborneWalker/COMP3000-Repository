document.addEventListener("DOMContentLoaded", function() {

    // user roles
    const users = {
        "admin": { password: "admin123", role: "admin" },
        "safeguard": { password: "safe123", role: "safeguard" },
        "ict": { password: "ict123", role: "ict" }
    };

    let currentUser = null;

 
    document.getElementById("loginBtn").addEventListener("click", login);

    // login
    function login() {
        const user = document.getElementById("loginUser").value.trim();
        const pass = document.getElementById("loginPass").value.trim();
        const error = document.getElementById("loginError");

        error.classList.add("hidden");

        if (!users[user] || users[user].password !== pass) {
            error.textContent = "Invalid username or password";
            error.classList.remove("hidden");
            return;
        }

        currentUser = { name: user, role: users[user].role };

        // switch screen
        document.getElementById("loginScreen").classList.add("hidden");
        document.getElementById("app").classList.remove("hidden");

        console.log("working here")
        clearTables();
        loadMenu();
        console.log("working still")
        loadFakeData();
        showPage("dashboard");
    }

    // logout
    window.logout = function() {
        document.getElementById("app").classList.add("hidden");
        document.getElementById("loginScreen").classList.remove("hidden");
        document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
    }

    // switch page
    window.showPage = function(pageId) { 
            // hide all
            const pages = document.querySelectorAll(".page");
            pages.forEach(page => page.classList.add("hidden")); 

            // find page
            const targetPage = Array.from(pages).find(p => p.id === pageId);

            if (!targetPage) {
                console.log("ERROR: Page not found - " + pageId);
                return;
            }

            // remove hidden class
            targetPage.classList.remove("hidden"); 
        }


    
    // role based menu
    function loadMenu() {
        console.log(currentUser)
        const role = currentUser.role;
        console.log(role)
        document.querySelectorAll(".menu-item").forEach(btn => btn.classList.add("hidden"));

        if (role === "admin") {
            ["btnDashboard","btnCreate","btnApproval","btnResults","btnNodes","btnAdmin"]
                .forEach(id => document.getElementById(id).classList.remove("hidden"));
        }

        if (role === "safeguard") {
            ["btnDashboard","btnApproval","btnResults"]
                .forEach(id => document.getElementById(id).classList.remove("hidden"));
        }

        if (role === "ict") {
            ["btnDashboard","btnCreate","btnNodes"]
                .forEach(id => document.getElementById(id).classList.remove("hidden"));
}

    }

    // table managment
    function clearTables() {
        document.getElementById("approvalTable").innerHTML =
            `<tr><th>ID</th><th>Type</th><th>User</th><th>Status</th><th>Action</th></tr>`;
        document.getElementById("resultsTable").innerHTML =
            `<tr><th>SSID</th><th>Signal</th><th>Security</th></tr>`;
        document.getElementById("nodeTable").innerHTML =
            `<tr><th>Node ID</th><th>Status</th><th>Battery</th><th>Last Seen</th></tr>`;
        document.getElementById("userTable").innerHTML =
            `<tr><th>Username</th><th>Role</th><th>Actions</th></tr>`;
    }

    // fake data - edit later
    function loadFakeData() {
        // approval table
        const tableA = document.getElementById("approvalTable");
        const rowA = document.createElement("tr");
        rowA.innerHTML = `<td>001</td><td>WiFi Scan</td><td>ict</td><td>Pending</td>
                          <td><button onclick="approveScan('001')">Approve</button></td>`;
        tableA.appendChild(rowA);

        // results table
        const tableR = document.getElementById("resultsTable");
        const rowR = document.createElement("tr");
        rowR.innerHTML = `<td>School_Guest</td><td>-45 dBm</td><td>WPA2</td>`;
        tableR.appendChild(rowR);

        // node table
        const tableN = document.getElementById("nodeTable");
        const rowN = document.createElement("tr");
        rowN.innerHTML = `<td>Node-01</td><td>Online</td><td>78%</td><td>2 min ago</td>`;
        tableN.appendChild(rowN);

        // user table
        const tableU = document.getElementById("userTable");
        const rowU = document.createElement("tr");
        rowU.innerHTML = `<td>newUser</td><td>student</td><td><button onclick="this.parentElement.remove()">Remove</button></td>`;
        tableU.appendChild(rowU);
    }

    window.approveScan = function(id) { alert("Scan " + id + " approved."); }

    // create scan
    window.createScan = function() {
        const type = document.getElementById("scanType").value;
        const note = document.getElementById("scanNote").value;

        if (!type) { alert("Please select a scan type."); return; }
        alert("Scan request created:\n" + type + "\n" + note);
    }

    // create user
    window.createUser = function() {
        const username = document.getElementById("newUser").value.trim();
        const role = document.getElementById("newRole").value;

        if (!username) return alert("Enter a username");

        const table = document.getElementById("userTable");
        const row = document.createElement("tr");
        row.innerHTML = `<td>${username}</td><td>${role}</td><td><button onclick="this.parentElement.remove()">Remove</button></td>`;
        table.appendChild(row);

        document.getElementById("newUser").value = "";
        const msg = document.getElementById("adminMessage");
        msg.textContent = "User created!";
        msg.classList.remove("hidden");
        setTimeout(()=>msg.classList.add("hidden"), 3000);
    }

});
