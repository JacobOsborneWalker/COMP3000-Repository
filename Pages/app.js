// login 
function login() {

    console.log("button working")
    document.getElementById("loginScreen").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");

    // show dashboard
    showPage("dashboard");
}

// logout 
function logout() {
    document.getElementById("app").classList.add("hidden");
    document.getElementById("loginScreen").classList.remove("hidden");

    document.querySelectorAll(".page").forEach(page => {
        page.classList.remove("active");
    });
}

// switch
function showPage(pageId) {

    console.log("function working")
    
    // hide pages
    document.querySelectorAll(".page").forEach(page => {
        page.classList.remove("active");
    });

    // show page
    const page = document.getElementById(pageId);
    page.classList.add("active");
}
