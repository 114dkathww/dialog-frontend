let cachedUsers = [];
/* ===============================
   Chatbot & Sidebar Fetch
=================================*/
document.addEventListener("DOMContentLoaded", () => {
    // 챗봇 로드
    fetch("components/chatbot.html")
        .then(res => res.text())
        .then(html => {
            const container = document.getElementById("chatbot-container");
            if (container) { // null 체크 추가
                container.innerHTML = html;
    
                const closeBtn = container.querySelector(".close-chat-btn");
                const sendBtn = container.querySelector(".send-btn");
                const chatInput = container.querySelector("#chatInput");
                const floatingBtn = document.getElementById("floatingChatBtn");
    
                if (closeBtn) closeBtn.addEventListener("click", closeChat);
                if (sendBtn) sendBtn.addEventListener("click", sendMessage);
                if (chatInput) chatInput.addEventListener("keypress", handleChatEnter);
                if (floatingBtn) floatingBtn.addEventListener("click", openChat);
            }
        });
    
    // 사이드바 로드
    fetch("components/sidebar.html")
        .then(res => res.text())
        .then(async html => {
            const sidebar = document.getElementById("sidebar-container");
            sidebar.innerHTML = html;
            await loadCurrentUser(); // app.js의 함수
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

    loadUsers();
});

function addUser() {
  alert('신규 유저 추가!');
}

async function loadUsers() {
  try {
    const response = await apiClient.get('/admin/users');
    const users = response.data;

    cachedUsers = users; 
    
    const tbody = document.querySelector('.users-table tbody');
    if (!tbody) {
        console.error("테이블 <tbody>를 찾을 수 없습니다.");
        return;
    }
    tbody.innerHTML = ''; 

    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">등록된 사용자가 없습니다.</td></tr>';
        return;
    }

    users.forEach(user => {
      const tr = document.createElement('tr');
      
      // ✅ 디버깅: 콘솔에 user 객체 출력
      console.log('User data:', user);
      
      tr.innerHTML = `
        <td>${user.name || '이름 없음'}</td>
        <td>${user.email || '-'}</td>
        <td><span class="role-badge ${user.role ? user.role.toLowerCase() : 'user'}">${user.role || 'USER'}</span></td>
        <td><span class="user-status ${user.active ? 'active' : 'deactivated'}">${user.active ? '활성' : '비활성'}</span></td>
        <td>${user.regDate ? new Date(user.regDate).toLocaleDateString('ko-KR') : '-'}</td>
        <td>
          <div class="user-actions">
            <button class="small-action-btn" onclick="editUser('${user.id}')">수정</button>
            <button class="small-action-btn danger" onclick="deleteUser('${user.id}')">삭제</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error('유저 목록 로드 실패:', error);
    const tbody = document.querySelector('.users-table tbody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">목록을 불러오는 데 실패했습니다.</td></tr>';
    }
  }
}

function editUser(userId) {
    // 1. 캐시된 데이터에서 사용자 찾기
    const user = cachedUsers.find(u => u.id == userId);
    if (!user) {
        alert('사용자 정보를 찾을 수 없습니다.');
        return;
    }

    // 2. 모달 폼에 기존 데이터 채우기
    // (AdminResponse에 job, position이 포함되어 있다고 가정)
    document.getElementById('modalUserId').value = user.id;
    document.getElementById('modalUserName').value = user.name;
    document.getElementById('modalUserJob').value = user.job; 
    document.getElementById('modalUserPosition').value = user.position;

    // 3. 모달 띄우기
    const modal = document.getElementById('editUserModalOverlay');
    modal.style.display = 'flex';
}

//모달 닫기함수.
function closeEditModal() {
    const modal = document.getElementById('editUserModalOverlay');
    modal.style.display = 'none';
}

async function saveUserSettings() {
    const userId = document.getElementById('modalUserId').value;
    const job = document.getElementById('modalUserJob').value;
    const position = document.getElementById('modalUserPosition').value;

    // 1. 백엔드로 보낼 DTO (UserSettingsUpdateDto) 객체 생성
    const updateDto = {
        job: job,
        position: position
    };

    try {
        // 2. 백엔드 컨트롤러에 만든 API 경로로 PUT 요청
        await apiClient.put(`/admin/users/settings/${userId}`, updateDto);
        
        alert('사용자 정보가 성공적으로 수정되었습니다.');
        closeEditModal(); // 모달 닫기
        loadUsers();      // 목록 새로고침

    } catch (error) {
        console.error('사용자 수정 실패:', error);
        alert('수정 중 오류가 발생했습니다.');
    }
}


async function deleteUser(userId) {
  if (confirm(`사용자(ID: ${userId})를 정말 삭제하시겠습니까?`)) {
    try {
        await apiClient.delete(`/admin/users/${userId}`);
        
        alert('사용자가 삭제되었습니다.');       

        loadUsers(); 
    } catch (error) {
        console.error('사용자 삭제 실패:', error);
        alert('삭제 중 오류가 발생했습니다.');
    }
  }
}