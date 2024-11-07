export function sidebarUtil() {
    const toggleSidebarButton = document.getElementById("toggle-side-bar");
    const sidebars = [document.getElementById("sidebar-generation"), document.getElementById("sidebar-masking"), document.getElementById("sidebar-erosion")];
    const mainContents = [document.getElementById("main-generation"), document.getElementById("main-masking"), document.getElementById("main-erosion")];

    toggleSidebarButton.addEventListener("click", () => {
        sidebars.forEach((sidebar, index) => {
            if (!sidebar.classList.contains("hidden")) {
                // Toggle the sidebar out of view
                sidebar.classList.add("-translate-x-full");
                sidebar.classList.add("hidden");

                // Expand the main content
                mainContents[index].classList.remove("basis-5/6");
                mainContents[index].classList.add("w-full");
            } else {
                // Bring the sidebar back into view
                sidebar.classList.remove("-translate-x-full");
                sidebar.classList.remove("hidden");

                // Restore main content width
                mainContents[index].classList.remove("w-full");
                mainContents[index].classList.add("basis-5/6");
            }
        });
    });
}
