
// click login
let ClickedLogin = false;

function login() {
   
    // login attempted
    ClickedLogin = true;

    // unlocks sidebar
    document.getElementById("sidebar").classList.remove("locked");

    // dashboard
    showPage("dashboard");
}

function logout() {
    // reset
    ClickedLogin = false;

    // lock sidebar
    document.getElementById("sidebar").classList.add("locked");

    // return
    showPage("login");
}

// show pages
function showPage(pageId) {
    
    // block navigation
    if (!ClickedLogin && pageId !== "login") {
        alert("Please click the Login button first.");
        return;
    }

    const pages = document.querySelectorAll(".page");

    pages.forEach(page => {
        if (page.id === pageId) {
            page.classList.remove("hidden");
        } else {
            page.classList.add("hidden");
        }
    });
}
