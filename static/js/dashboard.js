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


/* ===============================
   관리자 대시보드 통계 데이터 로드
=================================*/
async function loadAdminDashboardStats() {
  try {
    // 사용자 전체 통계 (예: 신규 가입자, 전체 가입 수 등)
    const res = await fetch('http://localhost:8080/api/admin/statistics/users', {
      credentials: 'include'
    });
    if (!res.ok) throw new Error('네트워크 에러');
    const data = await res.json();
    const statMain = document.querySelector('.user-stats-main');
    const statDiff = document.querySelector('.user-stats-diff');
    if (statMain) statMain.textContent = data.totalUserCount + '명';
    if (statDiff) statDiff.textContent = `+${data.newUsersLast7Days} (최근 7일)`;

    // 전체 회의수 카드 반영
    const meetingCountElem = document.getElementById('meetingCountMain');
    const meetingMonthElem = document.getElementById('meetingCountDiff');
    if (meetingCountElem && data.totalMeetingCount != null)
      meetingCountElem.textContent = data.totalMeetingCount + '건';
    if (meetingMonthElem && data.meetingCountThisMonth != null)
      meetingMonthElem.textContent = `+${data.meetingCountThisMonth} (이번 달)`;

    // 오늘 생성 회의, 신규 가입 변화 데이터 (변화량 포함)
    const todayStatsRes = await fetch('http://localhost:8080/api/admin/todaystats', {
      credentials: 'include'
    });
    if (!todayStatsRes.ok) throw new Error('오늘 통계 API 호출 실패');
    const todayStats = await todayStatsRes.json();

    // 오늘 생성 회의 수, 변화량
    const todayCreateMeetCountElem = document.getElementById('todayCreateMeetCount');
    const todayCreateMeetDiffElem = todayCreateMeetCountElem 
      ? todayCreateMeetCountElem.parentElement.querySelector('.stat-change')
      : null;
    if (todayCreateMeetCountElem) 
      todayCreateMeetCountElem.textContent = todayStats.todayCreateMeetCount + '건';
    if (todayCreateMeetDiffElem) 
      todayCreateMeetDiffElem.textContent = 
        (todayStats.todayCreateMeetChange >= 0 ? '+' : '') + todayStats.todayCreateMeetChange;

    // 오늘 신규 가입 수, 변화량
    const todayRegisterUserCountElem = document.getElementById('todayRegisterUserCount');
    const todayRegisterUserDiffElem = todayRegisterUserCountElem 
      ? todayRegisterUserCountElem.parentElement.querySelector('.stat-change')
      : null;
    if (todayRegisterUserCountElem) 
      todayRegisterUserCountElem.textContent = todayStats.todayRegisterUserCount + '명';
    if (todayRegisterUserDiffElem) 
      todayRegisterUserDiffElem.textContent = 
        (todayStats.todayRegisterUserChange >= 0 ? '+' : '') + todayStats.todayRegisterUserChange;

  } catch (e) {
    console.error(e);
  }
}

document.addEventListener('DOMContentLoaded', loadAdminDashboardStats);
