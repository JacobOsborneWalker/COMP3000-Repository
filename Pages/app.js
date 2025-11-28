// basic js function
function showPage(pageId) {
    const pages = document.querySelectorAll(".page");

    pages.forEach(page => {
        if (page.id === pageId) {
            page.classList.remove("hidden");
        } else {
            page.classList.add("hidden");
        }
    });
}
