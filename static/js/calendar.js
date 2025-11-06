/* ===============================================
// 1. 전역 상태 및 API 설정 (병합됨)
=================================================*/
let currentUser = null;         // (API) 로그인한 사용자 정보
let calendarEvents = [];      // (API) 백엔드에서 불러온 이벤트 원본 배열
let currentYearMonth;         // (API) 현재 캘린더가 표시하는 년/월 (Date 객체)
let selectedDate;             // (API) YYYY-MM-DD 형식의 문자열

// API URL
const CALENDAR_BASE_URL = 'http://localhost:8080/api/calendar';

// (참고) LocalStorage 키는 이 파일에서 사용되지 않습니다.
const STORAGE_KEY = 'calendar_events';
const TODO_STORAGE_KEY = 'calendar_todos';


/* ===============================================
// 2. To-do CRUD (API 버전)
=================================================*/

async function addDailyTodo() {
    const todoInput = document.getElementById('todoInput'); 
    
    if (!selectedDate) {
        alert("먼저 캘린더에서 날짜를 선택해주세요.");
        return;
    }
    if (!todoInput || !todoInput.value.trim()) {
        alert("할 일을 입력해주세요.");
        return;
    }
    
    const todoTitle = todoInput.value.trim();
    const targetDate = selectedDate; // YYYY-MM-DD
    const TODO_CREATE_URL = 'http://localhost:8080/api/calendar/events';

    try {
        console.log(`🔄 To-do 생성 요청: ${todoTitle} (마감일: ${targetDate})`);
        
        const response = await fetch(TODO_CREATE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ 
                calendarId: "primary", 
                eventData: {
                    summary: todoTitle, 
                    start: { date: targetDate },
                    end: { date: targetDate }
                }
            })
        });

        if (response.ok) {
            showSuccessMessage('할 일이 추가되었습니다');
            todoInput.value = ''; 
            renderCalendar(); // API로 캘린더 전체 새로고침
        } else {
             const errorText = await response.text();
             console.error(`❌ To-do 생성 실패 (${response.status}):`, errorText);
             alert(`❌ To-do 생성 실패: ${errorText}`);
        }
    } catch (error) {
        console.error('❌ To-do 생성 중 네트워크 오류:', error);
        alert('❌ 네트워크 오류 또는 JSON 처리 오류가 발생했습니다.');
    }
}
async function editApiTodo(eventId, currentTitle, eventDate) {
    const newTitle = prompt('할 일 수정:', currentTitle);
    
    if (!newTitle || !newTitle.trim() || newTitle === currentTitle) {
        return; // 변경 없으면 취소
    }
        
    const EDIT_URL = `${CALENDAR_BASE_URL}/events/${eventId}`; 
    
    // 2. [수정] 백엔드가 요구하는 올바른 JSON 본문(bodyData) 생성
    const bodyData = {
        calendarId: "primary", // 기본 캘린더 ID
        eventData: {
            summary: newTitle.trim(),
            start: { date: eventDate }, // 1번에서 전달받은 날짜
            end: { date: eventDate }   // 1번에서 전달받은 날짜
        }
    };

    try {
        console.log(`🔄 To-do 수정 요청: ${eventId} -> ${newTitle}`);
        const response = await fetch(EDIT_URL, {
            method: 'PUT', // 또는 'PATCH'
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(bodyData) // ⬅️ ⭐️ 3. [수정] 기존 summary 객체 대신 bodyData 사용
        });

        if (response.ok) {
            showSuccessMessage('할 일이 수정되었습니다');
            renderCalendar(); // API로 캘린더 전체 새로고침
        } else {
            // [수정] 백엔드의 JSON 오류 메시지를 더 잘 보여주도록 개선
            let errorText = await response.text();
           try {
               const errorJson = JSON.parse(errorText);
               if (errorJson && errorJson.message) {
                   errorText = errorJson.message; // "eventData는 필수입니다."
               }
           } catch (e) {
               // 파싱 실패 시 HTML 텍스트(로그인 페이지)를 그대로 보여줌
           }
            console.error(`❌ To-do 수정 실패 (${response.status}):`, errorText);
            alert(`❌ To-do 수정 실패: ${errorText}`);
        }
    } catch (error) {
        console.error('❌ To-do 수정 중 네트워크 오류:', error);
        alert('❌ 네트워크 오류가 발생했습니다.');
    }
}
// (API) To-do 삭제
async function deleteApiTodo(eventId, title) {
    if (confirm(`"${title}" 할 일을 삭제하시겠습니까?`)) {        

        const DELETE_URL = `${CALENDAR_BASE_URL}/events/${eventId}`;

        try {
            console.log(`🔄 To-do 삭제 요청: ${eventId}`);
            const response = await fetch(DELETE_URL, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                showSuccessMessage('할 일이 삭제되었습니다');
                renderCalendar(); // API로 캘린더 전체 새로고침
            } else {
                const errorText = await response.text();
                console.error(`❌ To-do 삭제 실패 (${response.status}):`, errorText);
                alert(`❌ To-do 삭제 실패: ${errorText}`);
            }
        } catch (error) {
            console.error('❌ To-do 삭제 중 네트워크 오류:', error);
            alert('❌ 네트워크 오류가 발생했습니다.');
        }
    }
}


/* ===============================================
// 3. 사용자 인증 (API 기반)
=================================================*/
function displayUserName(user) {
    if (user) {
        document.querySelectorAll(".user-name").forEach(el => {
            el.textContent = user.name || user.email || "사용자";
        });
        document.querySelectorAll(".user-email").forEach(el => {
            el.textContent = user.email || "";
        });
        document.querySelectorAll(".user-avatar").forEach(el => {
            el.textContent = (user && user.name) ? user.name.charAt(0).toUpperCase() : "U";
        });
    } 
    console.log('UI 업데이트:', user ? user.email : '로그아웃 상태');
}

// (API) [이름 변경] loadCurrentUser -> loadCurrentUserWithGlobalSet
async function loadCurrentUserWithGlobalSet() { 
    try {
        const response = await fetch('http://localhost:8080/api/auth/me', {
            credentials: 'include' 
        });

        if (response.ok) {
            const user = await response.json();
            currentUser = user; 
            displayUserName(user);
            return user;
        } else if (response.status === 401) {
            console.warn('인증되지 않음 (401). 로그인 페이지로 이동합니다.');
            window.location.href = '/login.html'; 
            return null;
        } else {
            displayUserName(null);
            return null;
        }
    } catch (error) {
        console.error('네트워크 오류:', error);
        displayUserName(null);
        return null;
    }
}

/* ===============================================
// 4. Google 연동 팝업 (API 기반)
=================================================*/
function showGoogleLinkButton() {
    const modal = document.getElementById('googleLinkModal');
    const linkButton = document.getElementById('conn-google-btn');
    const closeButton = document.getElementById('closeModalBtn');

    if (!modal || !linkButton || !closeButton) {
        console.error("❌ Google 연동 모달 UI 요소를 찾을 수 없습니다.");
        return;
    }

    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('visible'), 10); 

    closeButton.addEventListener('click', () => {
        modal.classList.remove('visible');
        setTimeout(() => modal.style.display = 'none', 200); 
    });

    if (!linkButton.dataset.listenerAdded) {
        linkButton.addEventListener('click', async () => {
            try {
                console.log('🔄 Google 연동 시작 API 호출...');
                const response = await fetch('http://localhost:8080/api/calendar/link/start', { 
                    method: 'GET',
                    credentials: 'include'
                });
                
                if (response.ok) {
                    const data = await response.json();
                    window.location.href = data.authUrl; 
                } else {
                    alert("연동 시작에 실패했습니다. 다시 로그인해주세요.");
                }
            } catch (error) {
                console.error("Google 연동 시작 오류:", error);
                alert("연동 중 오류가 발생했습니다.");
            }
        });
        linkButton.dataset.listenerAdded = 'true';
    }
}

function formatDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// [Helper] "YYYY-MM-DD" -> "12월 4일 (목)" (날짜 버그 수정)
function formatDisplayDate(dateString) {
    const parts = dateString.split('-').map(Number);
    const year = parts[0];
    const monthIndex = parts[1] - 1; 
    const day = parts[2];
    const dateObj = new Date(year, monthIndex, day);
    return dateObj.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
}

// [Helper] API 데이터를 기반으로 특정 날짜의 이벤트 필터링
function getEventsForDate(dateString) { // "YYYY-MM-DD"
    return calendarEvents.filter(event => event.eventDate === dateString);
}

// [UI 렌더링] 우측 회의 목록 (UI Dev 코드)
function renderMeetingList(dateString) {
    const meetingListEl = document.getElementById('meetingList');
    const meetingCardTitleContentEl = document.getElementById('meetingCardTitleContent');
    const meetingCountEl = document.getElementById('meetingCount');
    
    if (!meetingListEl || !meetingCardTitleContentEl || !meetingCountEl) return;

    const formattedDate = formatDisplayDate(dateString).split('(')[0].trim(); // "12월 4일"
    meetingCardTitleContentEl.textContent = `${formattedDate}의 회의`;

    const selectedEvents = getEventsForDate(dateString);
    const meetings = selectedEvents.filter(event => event.eventType === 'MEETING');

    meetingListEl.innerHTML = '';
    
    meetingCountEl.textContent = `(총 ${meetings.length}개)`;

    if (meetings.length === 0) {
        meetingListEl.innerHTML = '<p class="cell-secondary" style="text-align: center; padding: 16px 0;">회의가 없습니다.</p>';
        return;
    }
    
    const meetingsToShow = meetings.slice(0, 5); // 5개 제한

    meetingsToShow.forEach(event => {
        const meetingItem = document.createElement('div');
        meetingItem.className = 'meeting-item';
        const isImportant = event.isImportant || false; 
        const eventId = event.googleEventId || event.id;

        meetingItem.innerHTML = `
            <span class="meeting-item-dot type-team"></span>
            <div class="meeting-item-text">${event.title}</div>
            <button class="star-btn ${isImportant ? 'active' : ''}" data-meeting-id="${eventId}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="${isImportant ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
            </button>
        `;
        
        meetingListEl.appendChild(meetingItem);
    });
    
    if (meetings.length > 5) {
        const remainingCount = meetings.length - 5;
        const moreItemsEl = document.createElement('p');
        moreItemsEl.className = 'cell-secondary';
        moreItemsEl.style.cssText = 'text-align: center; font-size: 13px; margin-top: 10px; padding: 0;';
        moreItemsEl.textContent = `...외 ${remainingCount}개 더 보기`;
        meetingListEl.appendChild(moreItemsEl);
    }
}

// [UI 렌더링] 우측 To-do 목록 (UI Dev 코드 + API 연동)
function renderTodoList(dateString) {
    const todoListEl = document.getElementById('todoList');
    const todoCardTitleContentEl = document.getElementById('todoCardTitleContent');
    const todoCountEl = document.getElementById('todoCount');

    if (!todoListEl || !todoCardTitleContentEl || !todoCountEl) return;

    const formattedDate = formatDisplayDate(dateString).split('(')[0].trim(); // "12월 4일"
    todoCardTitleContentEl.textContent = `${formattedDate}의 To-do`;

    const selectedEvents = getEventsForDate(dateString);
    const todos = selectedEvents.filter(event => event.eventType === 'TASK' || event.eventType === 'PERSONAL');

    todoListEl.innerHTML = '';

    if (todos.length === 0) {
        todoListEl.innerHTML = '<p class="cell-secondary" style="text-align: center; padding: 16px 0;">등록된 할 일이 없습니다.</p>';
        todoCountEl.textContent = `(총 0개)`;
        return;
    }

    todos.forEach(event => {
        const todoItem = document.createElement('div');
        todoItem.className = 'todo-item';
        const eventId = event.googleEventId || event.id; 
        
        todoItem.innerHTML = `
            <span class="todo-item-dot type-personal"></span>
            <div class="todo-item-text">${event.title}</div>
            <div class="todo-actions">
                <button class="todo-action-btn edit" 
                data-todo-id="${eventId}" 
                data-todo-title="${event.title}" 
                data-todo-date="${event.eventDate}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </button>
                <button class="todo-action-btn delete" data-todo-id="${eventId}" data-todo-title="${event.title}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        `;
               
        todoItem.querySelector('.edit').addEventListener('click', function() {            
            editApiTodo(this.dataset.todoId, this.dataset.todoTitle, this.dataset.todoDate); 
        });
        
        todoItem.querySelector('.delete').addEventListener('click', function() {
            deleteApiTodo(this.dataset.todoId, this.dataset.todoTitle);
        });

        todoListEl.appendChild(todoItem);
    });
    todoCountEl.textContent = `(총 ${todos.length}개)`;
}
//  [UI 렌더링] 캘린더에 이벤트 점(dot) 표시 (UI Dev 코드)
function displayEventDots(events) {
    document.querySelectorAll('.event-dots').forEach(dot => dot.remove());

    const eventsByDate = {};
    events.forEach(event => {
        const dateStr = event.eventDate; // "YYYY-MM-DD"
        if (!dateStr) return; 
        if (!eventsByDate[dateStr]) {
            eventsByDate[dateStr] = [];
        }
        eventsByDate[dateStr].push(event);
    });

    for (const dateStr in eventsByDate) {
        const cell = document.querySelector(`.calendar-day-cell[data-date="${dateStr}"]`);
        if (cell) {
            const dayEvents = eventsByDate[dateStr];
            const dotsContainer = document.createElement('div');
            dotsContainer.className = 'event-dots';
            
            const hasTeamEvent = dayEvents.some(e => e.eventType === 'MEETING');
            const hasPersonalEvent = dayEvents.some(e => e.eventType === 'TASK' || e.eventType === 'PERSONAL');
            
            if (hasTeamEvent) {
                const dot = document.createElement('span');
                dot.className = 'event-dot event-type-team';
                dotsContainer.appendChild(dot);
            }
            if (hasPersonalEvent) {
                const dot = document.createElement('span');
                dot.className = 'event-dot event-type-personal';
                dotsContainer.appendChild(dot);
            }
            
            const dayContent = cell.querySelector('.day-number').parentElement;
            if(dayContent) {
                dayContent.appendChild(dotsContainer);
            }
        }
    }
}

// [UI 렌더링] 날짜 클릭 시 오버레이 표시 (UI Dev 코드)
function showDailyEventOverlay(dateString) {
    const dailyEventsList = document.getElementById('dailyEventsList');
    const dailyEventsTitle = document.getElementById('dailyEventsTitle');
    const dailyEventsContent = document.getElementById('dailyEventsContent');
    if (!dailyEventsList || !dailyEventsTitle || !dailyEventsContent) return;

    dailyEventsTitle.textContent = `${formatDisplayDate(dateString)}의 일정`;
    dailyEventsContent.innerHTML = ''; 
    
    const selectedEvents = getEventsForDate(dateString);
    const meetings = selectedEvents.filter(e => e.eventType === 'MEETING');
    const todos = selectedEvents.filter(e => e.eventType === 'TASK' || e.eventType === 'PERSONAL');

    // 오버레이용 회의 섹션
    const meetingSection = document.createElement('div');
    meetingSection.className = 'daily-events-section';
    meetingSection.innerHTML = '<div class="daily-events-section-title">회의</div>';
    const meetingList = document.createElement('div');
    meetingList.className = 'daily-events-list';
    if (meetings.length === 0) {
        meetingList.innerHTML = '<p class="cell-secondary" style="text-align: center; padding: 16px;">등록된 회의가 없습니다.</p>';
    } else {
        meetings.forEach(item => {
            const meetingItem = document.createElement('div');
            meetingItem.className = 'daily-event-item type-team';
            const isImportant = item.isImportant || false;
            meetingItem.innerHTML = `
                <div class="event-details">
                    <div class="event-title">${item.title}</div>
                    <div class="event-meta">팀 회의 ${isImportant ? ' • 중요' : ''}</div>
                </div>
                ${isImportant ? `<svg class="event-star" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" style="margin-left: 8px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>` : ''}
            `;
            meetingList.appendChild(meetingItem);
        });
    }
    meetingSection.appendChild(meetingList);

    // 오버레이용 To-do 섹션
    const todoSection = document.createElement('div');
    todoSection.className = 'daily-events-section';
    todoSection.innerHTML = '<div class="daily-events-section-title">To-do</div>';
    const todoList = document.createElement('div');
    todoList.className = 'daily-events-list';
    if (todos.length === 0) {
        todoList.innerHTML = '<p class="cell-secondary" style="text-align: center; padding: 16px;">등록된 할 일이 없습니다.</p>';
    } else {
        todos.forEach(event => {
            const eventItem = document.createElement('div');
            eventItem.className = `daily-event-item type-personal`;
            eventItem.innerHTML = `
                <div class="event-details">
                    <div class="event-title">${event.title}</div>
                    <div class="event-meta">개인</div>
                </div>
            `;
            todoList.appendChild(eventItem);
        });
    }
    todoSection.appendChild(todoList);
    
    dailyEventsContent.appendChild(meetingSection);
    dailyEventsContent.appendChild(todoSection);
    dailyEventsList.classList.remove('hidden'); // 오버레이 표시
}

// [UI 렌더링] 오버레이 닫기 (UI Dev 코드)
window.closeDailyEvents = function() {
    const dailyEventsList = document.getElementById('dailyEventsList');
    if (dailyEventsList) {
        dailyEventsList.classList.add('hidden');
    }
    document.querySelectorAll('.calendar-day-cell.selected').forEach(cell => {
        cell.classList.remove('selected');
    });
    // [수정] 날짜 선택을 해제할 때, 오늘 날짜의 사이드바를 다시 표시
    const todayStr = formatDateString(new Date());
    selectDate(todayStr, false); // false: 오버레이 안 띄움
}

// 캘린더 초기화 (메인)
function initializeCalendar() {
    console.log("캘린더 초기화 및 렌더링 시작...");
    
    const today = new Date();
    currentYearMonth = new Date(today.getFullYear(), today.getMonth(), 1); 
    
    document.getElementById('prevMonthBtn')?.addEventListener('click', () => changeMonth(-1));
    document.getElementById('nextMonthBtn')?.addEventListener('click', () => changeMonth(1));
    document.getElementById('addTodoBtn')?.addEventListener('click', addDailyTodo);
    document.getElementById('todoInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addDailyTodo(); 
        }
    });

    renderCalendar(); // 캘린더 UI 그리기 (API 호출 시작)

    const todayStr = formatDateString(today);
    selectDate(todayStr, false);
}

// 월 변경
function changeMonth(delta) {
    currentYearMonth.setMonth(currentYearMonth.getMonth() + delta);
    selectedDate = null; 
    closeDailyEvents(); 
    renderCalendar(); 
}

// 캘린더 그리기 (API 호출 트리거)
function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const header = document.getElementById('currentMonthYear');
    if (!grid || !header) return;

    grid.innerHTML = ''; 
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    dayNames.forEach(day => {
        const dayLabel = document.createElement('div');
        dayLabel.className = 'calendar-day-label';
        dayLabel.textContent = day;
        grid.appendChild(dayLabel);
    });

    const year = currentYearMonth.getFullYear();
    const month = currentYearMonth.getMonth(); // 0-11
    header.textContent = `${year}년 ${month + 1}월`;

    const firstDayOfMonth = new Date(year, month, 1).getDay(); 
    const daysInMonth = new Date(year, month + 1, 0).getDate(); 
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    // 이전 달
    for (let i = 0; i < firstDayOfMonth; i++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day-cell other-month';
        const dayNumber = document.createElement('span');
        dayNumber.className = 'day-number';
        dayNumber.textContent = daysInPrevMonth - firstDayOfMonth + 1 + i;
        dayCell.appendChild(dayNumber);
        grid.appendChild(dayCell);
    }

    // 현재 달
    const todayStr = formatDateString(new Date()); 
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateStr = formatDateString(date);

        const dayElement = document.createElement('div');
        dayElement.classList.add('calendar-day-cell');
        dayElement.dataset.date = dateStr;
        
        const dayContent = document.createElement('div');
        dayContent.style.cssText = 'display: flex; flex-direction: column; align-items: flex-end; width: 100%;';
        
        if (dateStr === todayStr) {
            dayElement.classList.add('today');
        }

        const dayNumber = document.createElement('span');
        dayNumber.className = 'day-number';
        dayNumber.textContent = day;
        dayContent.appendChild(dayNumber);
        
        dayElement.appendChild(dayContent);

        dayElement.addEventListener('click', () => {
            selectDate(dateStr, true); // true: 클릭 시 오버레이 띄움
        });
        
        grid.appendChild(dayElement);
    }    
    
    // 다음 달
    const totalCells = grid.children.length;
    const remainingCells = 42 - totalCells; // 6줄(42칸) 기준
    
    if (remainingCells > 0 && remainingCells < 7) { 
        for (let i = 1; i <= remainingCells; i++) {
            const dayCell = document.createElement('div');
            dayCell.className = 'calendar-day-cell other-month';
            const dayNumber = document.createElement('span');
            dayNumber.className = 'day-number';
            dayNumber.textContent = i;
            dayCell.appendChild(dayNumber);
            grid.appendChild(dayCell);
        }
    }
    
    const totalRows = Math.ceil((grid.children.length - 7) / 7); 
    grid.style.gridTemplateRows = `auto repeat(${totalRows}, 1fr)`;
    
    // 캘린더 이벤트 로드 (API 호출)
    if (currentUser) {
        loadCalendarEvents(year, month); // month (0-11)
    } else {
        console.warn("캘린더 이벤트 로드 중단: 사용자 정보(currentUser)가 설정되지 않았습니다.");
    }
}

// 캘린더 이벤트 로드 (API)
async function loadCalendarEvents(year, monthIndex) {
    if (!currentUser) {
        console.error("❗ loadCalendarEvents: 사용자 인증 정보가 누락되었습니다.");
        return;
    }
    
    const month = monthIndex + 1; // 1-12
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = formatDateString(new Date(year, month, 0)); 
    
    const FETCH_URL = `${CALENDAR_BASE_URL}/events?startDate=${startDate}&endDate=${endDate}`;

    const header = document.getElementById('currentMonthYear');
    if (header) header.textContent = `${year}년 ${month}월`;

    try {
        const response = await fetch(FETCH_URL, {
            method: 'GET',
            credentials: 'include',
        });

        if (header) header.textContent = `${year}년 ${month}월`;

        if (response.ok) {
            const data = await response.json();
            calendarEvents = data; // 🚨 전역 API 이벤트 배열 업데이트
            console.log("✅ 캘린더 이벤트 로드 성공:", data.length, "개");
            
            displayEventDots(calendarEvents);
            
            if (selectedDate) {
                // [버그 수정] renderSidebar -> renderMeetingList/renderTodoList 호출
                renderMeetingList(selectedDate);
                renderTodoList(selectedDate);
            }

        } else {
            const errorData = await response.json().catch(() => ({ message: "Unknown error" })); 

            if (response.status === 401 && errorData.errorCode === "GOOGLE_REAUTH_REQUIRED") {
                console.warn("⚠️ Google 연동 필요:", errorData.message);
                showGoogleLinkButton(); // 연동 팝업 띄우기
            } else {
                console.error("❌ [Spring] Calendar event loading error:", response.status, errorData.message || response.statusText);
            }
        }
    } catch (error) {
        console.error(`❌ [Spring] Calendar event loading network error: ${error}`);
        if (header) header.textContent = `${year}년 ${month}월 (오류 발생)`;
    }
}

// 날짜 선택 핸들러 (병합됨)
function selectDate(dateStr, showOverlay = true) { 
    selectedDate = dateStr; 
    console.log(`날짜 선택: ${selectedDate}`);

    // 1. 하이라이트 CSS 적용
    document.querySelectorAll('.calendar-day-cell.selected').forEach(el => el.classList.remove('selected'));
    const selectedCell = document.querySelector(`.calendar-day-cell[data-date="${dateStr}"]`);
    if (selectedCell) {
        selectedCell.classList.add('selected');
    }
    
    renderMeetingList(dateStr);
    renderTodoList(dateStr);
     
    if (showOverlay) {
        showDailyEventOverlay(dateStr);
    }
}

// 이벤트 리스너 추가 함수 안되면 삭제해야함. (pih 수정.)
async function toggleImportance(eventId, starBtn) {
    const TOGGLE_URL = `${CALENDAR_BASE_URL}/${eventId}/importance`; // API 엔드포인트 가정

    try {
        console.log(`🔄 중요도 토글 요청: ${eventId}`);
        // 1. Optimistic UI 적용 (이미 이벤트 리스너에서 처리됨)

        const response = await fetch(TOGGLE_URL, {
            method: 'PATCH', // 또는 백엔드 API에 맞는 메서드 (POST/PUT 등)
            credentials: 'include',
             headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        console.log(`✅ 중요도 토글 성공: ${eventId}`);
        // 성공 시 별도 처리 필요 없음 (Optimistic UI가 이미 적용됨)

    } catch (error) {
        console.error('❌ 중요도 토글 실패:', error);
        alert('❌ 중요도 변경에 실패했습니다.');
        
        // 실패 시 UI 롤백
        starBtn.classList.toggle('active');
        const svg = starBtn.querySelector('svg');
        if (starBtn.classList.contains('active')) {
             svg.setAttribute('fill', 'currentColor');
        } else {
             svg.setAttribute('fill', 'none');
        }
    }
}

// 이벤트 리스너 추가 함수 안되면 삭제해야함. (pih 수정.)
document.addEventListener("DOMContentLoaded", () => {

    document.addEventListener('click', function(e) {
        // 클릭된 요소가 star-btn이거나 그 내부 요소인 경우
        const starBtn = e.target.closest('.star-btn');

        if (starBtn) {
            const meetingId = starBtn.getAttribute('data-meeting-id');

            // 1. 즉각적인 UI 반응 (Optimistic UI)
            starBtn.classList.toggle('active');
            const svg = starBtn.querySelector('svg');
            if (starBtn.classList.contains('active')) {
                 svg.setAttribute('fill', 'currentColor');
            } else {
                 svg.setAttribute('fill', 'none');
            }

            // 2. 서버로 API 요청 보내기
            console.log(`⭐ 별표 클릭됨! ID: ${meetingId}`);
            toggleImportance(meetingId, starBtn); // 위에서 정의한 함수 호출
        }
    });

});

document.addEventListener("DOMContentLoaded", () => {
    
    // 1. 챗봇 로드 (병렬 처리)
    fetch("components/chatbot.html")
        .then(res => res.ok ? res.text() : Promise.reject('Chatbot HTML not found'))
        .then(html => {
            const container = document.getElementById("chatbot-container");
            if (container) {
                container.innerHTML = html;
                
                const closeBtn = container.querySelector(".close-chat-btn");
                const sendBtn = container.querySelector(".send-btn");
                const chatInput = container.querySelector("#chatInput");
                const floatingBtn = document.getElementById("floatingChatBtn");

                //  app.js 또는 chatbot.js에 함수가 있다고 가정
                if (closeBtn && typeof closeChat === 'function') closeBtn.addEventListener("click", closeChat);
                if (sendBtn && typeof sendMessage === 'function') sendBtn.addEventListener("click", sendMessage);
                if (chatInput && typeof handleChatEnter === 'function') chatInput.addEventListener("keypress", handleChatEnter);
                if (floatingBtn && typeof openChat === 'function') floatingBtn.addEventListener("click", openChat);
            }
        })
        .catch(error => console.error('챗봇 로드 실패:', error));

    // 2. 사이드바 로드 (순차 처리)
    fetch("components/sidebar.html")
        .then(res => res.ok ? res.text() : Promise.reject('Sidebar HTML not found'))
        .then(html => {
            const sidebar = document.getElementById("sidebar-container");
            if (!sidebar) throw new Error("사이드바 컨테이너(#sidebar-container)를 찾을 수 없습니다.");
            sidebar.innerHTML = html;

            // [병합] API 기반 사용자 정보 로드
            return loadCurrentUserWithGlobalSet();
        })
        .then(user => { 
            // 3. 사이드바 "active" 클래스 처리
            const sidebar = document.getElementById("sidebar-container");
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

            // 4. (가장 중요) 캘린더 앱 로직 시작
            if (user) {
                console.log("로그인 사용자 확인: " + (user.email || "이메일 없음"));
                initializeCalendar(); 
            } else { 
                console.error("오류: 사용자 정보를 가져올 수 없습니다. (user is null)");
            }
        })
        .catch(error => {
            console.error('페이지 초기화 실패 (사이드바 또는 사용자 정보):', error);
        });
});

/* ===============================================
// 7. (UI Dev) 헬퍼 함수
=================================================*/
function showSuccessMessage(msg) {
    const div = document.createElement("div");
    div.textContent = msg;
    Object.assign(div.style, {
        position: "fixed",
        top: "24px",
        right: "24px",
        background: "#10b981",
        color: "#fff",
        padding: "12px 20px",
        borderRadius: "8px",
        zIndex: "9999",
        boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)"
    });
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 2500);
}

// (UI Dev) JWT 파싱 헬퍼
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("Invalid JWT token", e);
        return null;
    }
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

function injectUserInfo() {
}