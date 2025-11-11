function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('collapsed');
    }
}

// 페이지 전환 (SPA 스타일)
function changePage(pageName) {
    const pages = ['mainPage', 'recordingPage', 'meetingsPage'];
    pages.forEach(id => {
        const page = document.getElementById(id);
        if (page) page.classList.add('hidden');
    });

    if (pageName === 'main') {
        const mainPage = document.getElementById('mainPage');
        if (mainPage) mainPage.classList.remove('hidden');
    } else if (pageName === 'recording') {
        const recordingPage = document.getElementById('recordingPage');
        if (recordingPage) recordingPage.classList.remove('hidden');
    } else if (pageName === 'meetings') {
        const meetingsPage = document.getElementById('meetingsPage');
        if (meetingsPage) meetingsPage.classList.remove('hidden');
    }

    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    if (event) {
        const navItem = event.target.closest('.nav-item');
        if (navItem) navItem.classList.add('active');
    }
}

function openChat() {
    const chat = document.getElementById("chatBot");
    if (!chat) return;
    chat.classList.add("open");
    const floatingBtn = document.getElementById("floatingChatBtn");
    if (floatingBtn) floatingBtn.classList.add("hidden");
    document.body.classList.add("chat-open");
}

function closeChat() {
    const chat = document.getElementById("chatBot");
    if (!chat) return;
    chat.classList.remove("open");
    const floatingBtn = document.getElementById("floatingChatBtn");
    if (floatingBtn) floatingBtn.classList.remove("hidden");
    document.body.classList.remove("chat-open");
}

function sendMessage() {
    console.log("메시지 전송 (UI만)");
}

function handleChatEnter(e) {
    if (e.key === "Enter") sendMessage();
}

// 페이지 전환 함수
function showPage(pageName) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.add('hidden');
    });

    const targetPage = document.getElementById(pageName + 'Page');
    if (targetPage) targetPage.classList.remove('hidden');

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    const activeNav = document.querySelector(`[data-page="${pageName}"]`);
    if (activeNav) activeNav.classList.add('active');

    if (pageName === 'home' && typeof window.refreshHomeData === 'function') {
        window.refreshHomeData();
    }

    if (pageName === 'calendar' && typeof initCalendar === 'function') {
        initCalendar();
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const pageName = item.getAttribute('data-page');
            if (pageName) showPage(pageName);
        });
    });

    try {
        // 현재 로그인된 사용자 정보 가져오기
        const user = await loadCurrentUser();
        // 관리자 페이지 이동 버튼 요소
        const adminBtn = document.getElementById('adminButton');
        // role이 ADMIN인지 체크 후 버튼 노출/숨김 제어
        if (user && user.role === 'ADMIN' && adminBtn) {
            adminBtn.style.display = 'inline-block'; // 버튼 보이기
        } else if (adminBtn) {
            adminBtn.style.display = 'none'; // 버튼 숨기기
        }
    } catch (error) {
        console.error('유저 정보 로드 실패:', error);
        const adminBtn = document.getElementById('adminButton');
        if (adminBtn) adminBtn.style.display = 'none'; // 문제 발생 시 버튼 숨김
    }
});


// 프로필 드롭다운 토글
function toggleProfileDropdown() {
    const dropdown = document.getElementById('profileDropdown');
    if (dropdown) {
        dropdown.classList.toggle('active');
    }
}

// 외부 클릭 시 드롭다운 닫기
document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('profileDropdown');
    const authBtn = document.querySelector('.auth-btn');
    
    if (dropdown && authBtn) {
        if (!authBtn.contains(event.target) && !dropdown.contains(event.target)) {
            dropdown.classList.remove('active');
        }
    }
});

// 설정 페이지로 이동
function goToSettings() {
    window.location.href = 'settings.html';
    const dropdown = document.getElementById('profileDropdown');
    if (dropdown) {
        dropdown.classList.remove('active');
    }
}

// =====================================
// ✅ 유틸리티 함수
// =====================================
function getCookie(name) {
    const cookies = document.cookie.split(";").map(c => c.trim());
    for (const cookie of cookies) {
        if (cookie.startsWith(name + "=")) {
            return cookie.substring(name.length + 1);
        }
    }
    return null;
}

function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c =>
            '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        ).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) { 
        console.error('JWT 파싱 실패:', e);
        return null; 
    }
}

// 어드민 페이지로 이동
function goToAdminDashboard() {
  window.location.href = '/dashboard.html';  
}



// =====================================
// ✅ 사용자 정보 주입 함수 (통합)
// =====================================
async function loadCurrentUser() {
    try {
        // axios 인스턴스 사용 (fetch 대신)
        const response = await apiClient.get('/auth/me');
        if (response.status === 200) {
            const user = response.data;
            displayUserName(user);
            return user;
        }
    } catch (error) {
        if (error.response && error.response.status === 401) {
            // 여기서 바로 리다이렉트 하지 말고,
            // 재발급 인터셉터가 처리할 수 있도록 에러 반환
            console.warn('401 Unauthorized 발생, 토큰 재발급을 시도하세요.');
            throw error; 
        } else {
            console.error('네트워크 오류', error);
            displayUserName(null);
            return null;
        }
    }
}

// 사용자 이름 표시
function displayUserName(user) {
    // 메인 헤더
    const nameElement = document.querySelector("#user-name");
    if (nameElement)
        nameElement.textContent = (user && user.name) || (user && user.email) || '사용자';

    // 사이드바 이름
    document.querySelectorAll(".user-name").forEach(el => {
        el.textContent = (user && user.name) || (user && user.email) || '사용자';
    });
    // 챗봇 이름 표시
    const chatWelcomeName = document.querySelector("#chat-name"); 
    if (chatWelcomeName) 
        chatWelcomeName.textContent = (user && user.name) || (user && user.email) || '사용자';

    // 사이드바 이메일
    document.querySelectorAll(".user-email").forEach(el => {
        el.textContent = (user && user.email) || '';
    });

    // 사이드바 아바타 (선택)
    document.querySelectorAll(".user-avatar").forEach(el => {
        el.textContent = (user && user.name) ? user.name.charAt(0).toUpperCase() : "U";
    });
}


// =====================================
// axios 인스턴스 생성, 쿠키 자동 포함
// =====================================
const apiClient = axios.create({
    baseURL: 'http://localhost:8080/api',
    withCredentials: true,
});

// =====================================
// ✅ 중복 재발급 방지 및 요청 큐 로직 추가
// =====================================
let isTokenRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    // 큐에 대기 중인 요청들을 처리하거나 실패를 전달
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

// =====================================
// 토큰 재발급 함수
// =====================================

async function requestTokenReissue() {
    try {
        //  재발급 요청 시도 로그 추가
        console.log(' JWT 재발급 요청 시작: /api/reissue'); 
        const response = await apiClient.post('/reissue');
        if (response.status === 200) {
            console.log('Access token 재발급 성공');
            return true;
        }
    } catch (error) {
        // 요청 실패 로그 강화 (error.response 확인)
        console.error('JWT 재발급 실패 (서버 응답 확인 필요):', error.response || error);
    }
    return false; 
}

// =====================================
// axios 요청 인터셉터 (수정됨)
// =====================================
apiClient.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    
    // 401 에러가 아니거나, 재시도 요청이거나, 요청 정보가 없으면 무시
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // [중요] Google 재연동 오류(invalid_grant)는 인터셉터가 처리하지 않고
    //          원래 요청(calendar.js)의 catch 블록으로 즉시 보냅니다.
    if (error.response.data && error.response.data.errorCode === "GOOGLE_REAUTH_REQUIRED") {
        console.warn("인터셉터: Google 재연동 필요. 'calendar.js'로 처리를 위임합니다.");
        return Promise.reject(error);
    }

    // 1. 재발급 시도 중인 경우: 현재 요청을 큐에 추가하고 대기
    if (isTokenRefreshing) {
      return new Promise(function(resolve, reject) {
        failedQueue.push({ resolve, reject, originalRequest });
      })
      .then(() => {
        // 큐에 있던 요청을 재시도
        return apiClient(originalRequest);
      })
      .catch(err => {
        return Promise.reject(err);
      });
    }

    // 2. 재발급 시도 시작 (isTokenRefreshing이 false인 경우)
    isTokenRefreshing = true;
    originalRequest._retry = true;

    try {
      // [수정] 오직 JWT 재발급만 시도
      const jwtReissueSuccess = await requestTokenReissue();
      
      if (jwtReissueSuccess) {
        console.log("JWT Access Token 재발급 성공, 큐 처리 및 요청 재시도");
        processQueue(null, null); // 큐에 대기 중인 요청 처리
        await loadCurrentUser(); // (선택) 헤더 UI 업데이트
        return apiClient(originalRequest);
      }

      // [수정] Google 토큰 재발급 로직 (fetchGoogleAccessToken) 삭제
      // [수정] JWT 재발급 실패 시 바로 예외 발생
      console.error("JWT 토큰 재발급 실패");
      throw new Error('JWT reissue failed'); 

    } catch (err) {
      // 최종 실패 시 로그인 페이지로 리다이렉트
      console.error("JWT 재발급 최종 실패! 로그인 페이지로 이동합니다. ");
      processQueue(err, null); // 큐에 대기 중인 요청에 실패 전달
      logout();
      return Promise.reject(err);
    } finally {
      isTokenRefreshing = false; // 재발급 플래그 해제
    }
  }
);

// =====================================
// 소셜 로그인 후 또는 토큰 재발급 요청
// =====================================
async function fetchGoogleAccessToken() {
    const token = getCookie('jwt'); // 또는 다른 곳에서 토큰 획득
    const payload = parseJwt(token);
    const userEmail = payload?.email;

    if (!userEmail) {
        return false; // 토큰 파싱 실패 시 false만 반환
    }

    try {
        //  재발급 요청 시도 로그 추가
        console.log('Google 토큰 재발급 요청 시작: /api/oauth2/google/token');
        const response = await apiClient.post('/oauth2/google/token', null, {
            params: { userEmail },
        });
        return true;
    } catch (e) {
        //  요청 실패 로그 강화
        console.error('Google 토큰 재발급 실패 (서버 응답 확인 필요):', e.response || e);
        return false;
    }
}


// =====================================
// ✅ 로그아웃 함수
// =====================================
function logout() {
    if (confirm('로그아웃 하시겠습니까?')) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('jwtToken');
        localStorage.removeItem('user');
        
        document.cookie = 'jwt=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        
        window.location.href = 'login.html';
    }
    const dropdown = document.getElementById('profileDropdown');
    if (dropdown) {
        dropdown.classList.remove('active');
    }
}