/* ===============================
   Chatbot & Sidebar Fetch
=================================*/
document.addEventListener("DOMContentLoaded", () => {
    // 챗봇 로드
    fetch("components/chatbot.html")
        .then(res => res.text())
        .then(html => {
            const container = document.getElementById("chatbot-container");
            container.innerHTML = html;

            const closeBtn = container.querySelector(".close-chat-btn");
            const sendBtn = container.querySelector(".send-btn");
            const chatInput = container.querySelector("#chatInput");
            const floatingBtn = document.getElementById("floatingChatBtn");

            if (closeBtn) closeBtn.addEventListener("click", closeChat);
            if (sendBtn) sendBtn.addEventListener("click", sendMessage);
            if (chatInput) chatInput.addEventListener("keypress", handleChatEnter);
            if (floatingBtn) floatingBtn.addEventListener("click", openChat);
        });
    
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
    loadAndRenderMeetings();
});

// 신규 회의 등록(테스트)
function addMeeting() {
  alert('신규 회의 등록!');
}

async function loadAndRenderMeetings() {
    const tableBody = document.querySelector(".meetings-table tbody");
    if (!tableBody) {
        console.error("테이블 <tbody>를 찾을 수 없습니다.");
        return;
    }

    // 1. 로딩 표시
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">회의 목록을 불러오는 중...</td></tr>';

    try {
        // app.js에 정의된 'apiClient'를 사용하여 백엔드 API 호출
        const response = await apiClient.get('/admin/meetings');
        const meetings = response.data;

        // 2. 데이터가 없는 경우
        if (!meetings || meetings.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">등록된 회의가 없습니다.</td></tr>';
            return;
        }

        // 3. 데이터가 있으면 테이블 렌더링
        tableBody.innerHTML = ''; // 로딩 표시 제거 및 초기화
        meetings.forEach(meeting => {
            tableBody.appendChild(createMeetingRow(meeting));
        });

    } catch (error) {
        console.error("회의 목록 로드 실패:", error);
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">목록을 불러오는 데 실패했습니다.</td></tr>';
    }
}

function createMeetingRow(user) { // 변수명을 meeting 대신 user로 변경
    const tr = document.createElement('tr');

    // --- AdminResponse DTO 기준으로 필드 매핑 ---
    const meetingId = meeting.meetingId || 'N/A'; // DTO의 'meetingId' 사용
    const title = meeting.title || '제목 없음'; // DTO의 'title' 사용
    const date = meeting.scheduledAt ? new Date(meeting.scheduledAt).toLocaleDateString() : '날짜 없음'; // DTO의 'scheduledAt' 사용
    const participants = meeting.participants && meeting.participants.length > 0 ? meeting.participants.join(', ') : '참여자 없음'; // DTO의 'participants' 리스트 사용    
    const statusText = (meeting.status === 'CLOSED') ? '종료' : '진행중'; 
    const statusClass = (meeting.status === 'CLOSED') ? 'closed' : 'ongoing';
    const author = 'N/A';

       tr.innerHTML = `
            <td>${title}</td>
            <td>${date}</td>
            <td>${participants}</td>
            <td><span class="meeting-status ${statusClass}">${statusText}</span></td>
            <td>${author}</td>
            <td>
                <div class="meeting-actions">
                    <button class="small-action-btn" data-action="details" data-id="${meetingId}">상세</button>
                    <button class="small-action-btn" data-action="edit" data-id="${meetingId}">수정</button>
                    <button class="small-action-btn danger" data-action="delete" data-id="${meetingId}">삭제</button>
                </div>
            </td>
        `;

        // 각 버튼에 클릭 이벤트 리스너 연결
        tr.querySelector('[data-action="details"]').addEventListener('click', handleDetailsClick);
        tr.querySelector('[data-action="edit"]').addEventListener('click', handleEditClick);
        tr.querySelector('[data-action="delete"]').addEventListener('click', handleDeleteClick);

        return tr;
}

function handleDetailsClick(event) {
    const meetingId = event.target.dataset.id;
    alert(`상세: ${meetingId}번 회의 (상세 페이지 이동 로직 필요)`);
    // 예: window.location.href = \`/meeting-details.html?id=\${meetingId}\`;
}

function handleEditClick(event) {
    const meetingId = event.target.dataset.id;
    // "수정" 버튼이 동작하는 것을 확인
    alert(`수정: ${meetingId}번 회의 (수정 페이지 이동 또는 모달 열기 로직 필요)`);
    // 예: window.location.href = \`/meeting-edit.html?id=\${meetingId}\`;
}

async function handleDeleteClick(event) {
    const meetingId = event.target.dataset.id;
    if (confirm(`회의(ID: ${meetingId})를 정말 삭제하시겠습니까?`)) {
        
        // **중요**: 현재 AdminController에는 '/api/admin/meetings/{id}'로 DELETE하는 기능이 없습니다.
        // 해당 기능이 백엔드에 추가되어야 실제 삭제가 가능합니다.
        
        alert(`삭제: ${meetingId}번 회의 (백엔드 API 구현 필요)`);

        /* // (참고) 백엔드에 'DELETE /api/admin/meetings/{id}'가 구현되었을 때의 실제 코드
        try {
            // app.js의 apiClient 사용
            await apiClient.delete(\`/admin/meetings/\${meetingId}\`); 
            alert('삭제되었습니다.');
            loadAndRenderMeetings(); // 목록 새로고침
        } catch (error) {
            console.error('삭제 실패:', error);
            alert('삭제에 실패했습니다.');
        }
        */
    }
}