/* ===============================
   [통합] 홈 화면 전용 JS (home.js)
================================= */

document.addEventListener("DOMContentLoaded", () => {
    loadCommonComponents();
    loadCurrentUserInHome();
    initHomeData();
});

// =========================================
//  1. 공통 컴포넌트 로드
// =========================================
function loadCommonComponents() {
    fetch("components/chatbot.html")
        .then(res => res.text())
        .then(html => {
            const container = document.getElementById("chatbot-container");
            if (container) {
                container.innerHTML = html;
                initChatbotEventListeners();
            }
        });

    fetch("components/sidebar.html")
        .then(res => res.text())
        .then(html => {
            const sidebar = document.getElementById("sidebar-container");
            if (sidebar) {
                sidebar.innerHTML = html;
                activateCurrentNav(sidebar);
                loadCurrentUserInHome();
            }
        });
}

function initChatbotEventListeners() {
    const closeBtn = document.querySelector(".close-chat-btn");
    const sendBtn = document.querySelector(".send-btn");
    const chatInput = document.querySelector("#chatInput");
    const floatingBtn = document.getElementById("floatingChatBtn");

    if (window.closeChat && closeBtn) closeBtn.addEventListener("click", window.closeChat);
    if (window.sendMessage && sendBtn) sendBtn.addEventListener("click", window.sendMessage);
    if (window.handleChatEnter && chatInput) chatInput.addEventListener("keypress", window.handleChatEnter);
    if (window.openChat && floatingBtn) floatingBtn.addEventListener("click", window.openChat);
}

function activateCurrentNav(sidebar) {
    const currentPage = window.location.pathname.split("/").pop();
    sidebar.querySelectorAll(".nav-menu a").forEach(item => {
        item.classList.toggle("active", item.getAttribute("href") === currentPage);
    });
}

// =========================================
//  2. 사용자 정보 로드
// =========================================
async function loadCurrentUserInHome() {
    try {
        const response = await fetch('http://localhost:8080/api/auth/me', { credentials: 'include' });
        if (response.ok) {
            const user = await response.json();
            displayUserNameInHome(user);
        }
    } catch (error) {
        console.error('사용자 정보 로드 실패:', error);
    }
}

function displayUserNameInHome(user) {
    const name = (user && user.name) || (user && user.email) || '사용자';
    const headerName = document.querySelector("#user-name");
    if (headerName) headerName.textContent = name;
    document.querySelectorAll(".user-name").forEach(el => el.textContent = name);
    document.querySelectorAll(".user-email").forEach(el => el.textContent = (user && user.email) || '');
    document.querySelectorAll(".user-avatar").forEach(el => el.textContent = name.charAt(0).toUpperCase());
}

// =========================================
//  3. 홈 데이터 관리 (API 기반)
// =========================================
const API_BASE_URL = 'http://localhost:8080/api/calendar';
const today = new Date();

async function initHomeData() {
    console.log('🏠 홈 데이터 초기화 시작');
    displayCurrentDate();
    await fetchHomeData();
}

function displayCurrentDate() {
    const dateDisplay = document.getElementById('current-date-display');
    if (dateDisplay) {
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        dateDisplay.textContent = `${today.getMonth() + 1}월 ${today.getDate()}일 (${days[today.getDay()]})`;
    }
}

function formatDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// [핵심] 서버 데이터 요청 및 에러 처리
async function fetchHomeData() {
    const startDate = new Date(); startDate.setDate(today.getDate() - 30);
    const endDate = new Date(); endDate.setDate(today.getDate() + 30);
    const startStr = formatDate(startDate);
    const endStr = formatDate(endDate);

    try {
        console.log(`📡 API 데이터 요청: ${startStr} ~ ${endStr}`);
        const response = await fetch(`${API_BASE_URL}/events?startDate=${startStr}&endDate=${endStr}`, {
            method: 'GET', credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            const events = data.map(event => ({
                ...event,
                date: new Date(event.eventDate),
                type: event.eventType === 'MEETING' ? 'meeting' : (event.eventType === 'TASK' ? 'personal' : 'other'),
                important: event.isImportant,
                completed: event.isCompleted || false
            }));
            console.log(`✅ 데이터 수신 완료: ${events.length}건`);
            renderAllComponents(events);
        } else {
            // [🚨 긴급 수정] 500 에러가 나도 모달을 띄우도록 변경
            console.warn(`⚠️ API 오류 발생 (Status: ${response.status})`);
            if (response.status === 401 || response.status === 500) {
                console.warn("👉 Google 연동 재시도 모달 실행");
                showGoogleLinkModal(); 
            }
        }
    } catch (error) {
        console.error("❌ 네트워크 오류:", error);
    }
}

// =========================================
//  4. Google 연동 모달 (확실하게 동작하도록 수정)
// =========================================
function showGoogleLinkModal() {
    // 1. 기존 모달이 있으면 제거 (중복 방지)
    const existingModal = document.getElementById('googleLinkModal');
    if (existingModal) {
        existingModal.remove();
    }

    // 2. 모달 HTML 동적 생성
    const modalHtml = `
        <div id="googleLinkModal" class="modal-overlay" style="display: flex; opacity: 0; transition: opacity 0.3s ease;">
            <div class="modal-container" style="transform: translateY(20px); transition: transform 0.3s ease;">
                <div class="modal-header">
                    <h3>Google 캘린더 연동 필요</h3>
                    <button onclick="closeGoogleModal()" class="close-btn" style="cursor: pointer;">✕</button>
                </div>
                <div class="modal-body">
                    <p>최신 일정을 불러오기 위해<br>Google 계정 연동을 갱신해주세요.</p>
                </div>
                <div class="modal-footer">
                    <button onclick="startGoogleLink()" class="google-btn" style="cursor: pointer; width: 100%; padding: 12px; background-color: #4285F4; color: white; border: none; border-radius: 4px; font-weight: bold;">
                        Google 계정으로 계속하기
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // 3. body에 추가하고 보이게 설정
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // 4. 애니메이션을 위해 약간의 지연 후 스타일 변경
    setTimeout(() => {
        const modal = document.getElementById('googleLinkModal');
        const container = modal.querySelector('.modal-container');
        if (modal && container) {
            modal.style.opacity = '1';
            container.style.transform = 'translateY(0)';
        }
    }, 10);
}

// 전역 함수: 모달 닫기
window.closeGoogleModal = function() {
    const modal = document.getElementById('googleLinkModal');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => modal.remove(), 300);
    }
};

// 전역 함수: 연동 시작
window.startGoogleLink = async function() {
    try {
        const res = await fetch('http://localhost:8080/api/calendar/link/start', {
             method: 'GET', credentials: 'include' 
        });
        if (res.ok) {
            const data = await res.json();
            window.location.href = data.authUrl;
        } else {
            alert("연동 시작 실패. 서버 상태를 확인해주세요.");
        }
    } catch (e) {
        console.error("연동 오류:", e);
        alert("연동 중 오류가 발생했습니다.");
    }
};

// =========================================
//  5. UI 렌더링 함수들
// =========================================
function renderAllComponents(events) {
    renderTodoList(events);
    renderImportantMeetings(events);
    renderRecentMeetings(events);
}

function renderTodoList(events) {
    const listEl = document.querySelector('.todo-list');
    if (!listEl) return;
    const todayStr = formatDate(today);
    const todos = events.filter(e => (e.eventType === 'TASK' || e.eventType === 'PERSONAL') && formatDate(e.date) === todayStr);

    listEl.innerHTML = todos.length ? '' : '<div class="todo-item" style="justify-content: center; color: #9ca3af; padding: 12px 0;">오늘의 할 일이 없습니다</div>';
    todos.forEach(todo => {
        const item = document.createElement('div');
        item.className = `todo-item ${todo.completed ? 'completed' : ''}`;
        item.innerHTML = `<input type="checkbox" class="todo-checkbox" id="todo-${todo.id}" ${todo.completed ? 'checked' : ''}><label for="todo-${todo.id}" class="todo-label">${todo.title}</label>`;
        item.querySelector('.todo-checkbox').addEventListener('change', async (e) => {
            item.classList.toggle('completed', e.target.checked);
            await updateTodoStatus(todo.id, e.target.checked);
        });
        listEl.appendChild(item);
    });
}

function renderImportantMeetings(events) {
    const listEl = document.querySelector('.deadline-list');
    if (!listEl) return;
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const meetings = events.filter(e => (e.important || e.type === 'meeting') && e.date >= todayOnly).sort((a, b) => a.date - b.date).slice(0, 3);

    listEl.innerHTML = meetings.length ? '' : '<div class="empty-message" style="color: #9ca3af; text-align: center; padding: 24px 0;">예정된 중요 회의가 없습니다</div>';
    meetings.forEach(m => {
        const diff = Math.ceil((m.date - todayOnly) / (1000 * 60 * 60 * 24));
        listEl.innerHTML += `<div class="deadline-item ${diff <= 3 ? 'urgent' : ''}"><div class="deadline-info"><div class="deadline-title">${m.title}</div><div class="deadline-meta"><span class="deadline-date">${m.date.getMonth() + 1}/${String(m.date.getDate()).padStart(2, '0')}</span><span class="deadline-badge ${diff <= 3 ? 'urgent' : ''}">${diff === 0 ? 'D-Day' : 'D-' + diff}</span></div></div></div>`;
    });
}

function renderRecentMeetings(events) {
    const listEl = document.querySelector('.meeting-list');
    if (!listEl) return;
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const meetings = events.filter(e => e.type === 'meeting' && e.date < todayOnly).sort((a, b) => b.date - a.date).slice(0, 3);

    listEl.innerHTML = meetings.length ? '' : '<div class="empty-message" style="color: #9ca3af; text-align: center; padding: 24px 0;">최근 회의 기록이 없습니다</div>';
    meetings.forEach(m => {
        listEl.innerHTML += `<div class="meeting-item"><div class="meeting-info"><div class="meeting-title">${m.title}</div><div class="meeting-meta"><span class="meeting-date">${String(m.date.getMonth() + 1).padStart(2, '0')}/${String(m.date.getDate()).padStart(2, '0')}</span><span class="meeting-participants">회의</span></div></div></div>`;
    });
}

async function updateTodoStatus(todoId, isCompleted) {
    try { await fetch(`${API_BASE_URL}/events/${todoId}/completion`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include' }); } catch (e) { console.error(e); }
}

// 기타 리스너
document.addEventListener('visibilitychange', () => { if (!document.hidden) fetchHomeData(); });
function goToMeetings() { window.location.href = 'meetings.html'; }