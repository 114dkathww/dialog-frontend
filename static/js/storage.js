/* ===============================
   Chatbot & Sidebar Fetch
=================================*/
document.addEventListener("DOMContentLoaded", () => {
    // 사이드바 로드
    fetch("components/sidebar.html")
        .then(res => res.text())
        .then(async html => {
            const sidebar = document.getElementById("sidebar-container");
            sidebar.innerHTML = html;

            // ✅ 사이드바 로드 후 사용자 정보 주입
            await loadCurrentUser();

            // 현재 페이지 활성화
            const currentPage = window.location.pathname.split("/").pop();
            const navItems = sidebar.querySelectorAll(".nav-menu a");

            navItems.forEach(item => {
                const linkPath = item.getAttribute("href");
                if (linkPath === currentPage) {
                    item.classList.add("active");
                } else {
                    item.classList.remove("active");
                }
            });
        })
        .catch(error => {
            console.error('사이드바 로드 실패:', error);
        });
});