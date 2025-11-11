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
        .then(html => {
            const sidebar = document.getElementById("sidebar-container");
            sidebar.innerHTML = html;

            // ✅ 사이드바 로드 후 사용자 정보 주입
            loadCurrentUser();

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



// 사용자 정보 로드 함수 (API에서만)
async function loadCurrentUser() {
  try {
    const response = await fetch('http://localhost:8080/api/auth/me', {
      credentials: 'include'  // 이 옵션만 있으면 브라우저가 HttpOnly 쿠키를 요청에 자동 포함!
    });
    if (response.ok) {
      const user = await response.json();
      displayUserName(user);
      return user;
    } else if (response.status === 401) {
      window.location.href = '/login.html';
      return null;
    } else {
      displayUserName(null);
      return null;
    }
  } catch (error) {
    console.error('네트워크 오류', error);
    displayUserName(null);
    return null;
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

    // 사이드바 이메일
    document.querySelectorAll(".user-email").forEach(el => {
        el.textContent = (user && user.email) || '';
    });

    // 사이드바 아바타 (선택)
    document.querySelectorAll(".user-avatar").forEach(el => {
        el.textContent = (user && user.name) ? user.name.charAt(0).toUpperCase() : "U";
    });
}

function openConfirmModal(title, message, onConfirm) {
  const modal = document.getElementById('confirmModal');
  const titleEl = document.getElementById('confirmTitle');
  const msgEl = document.getElementById('confirmMessage');
  const okBtn = document.getElementById('confirmOkBtn');
  const cancelBtn = document.getElementById('confirmCancelBtn');

  titleEl.textContent = title;
  msgEl.innerHTML = message;

  modal.classList.remove('hidden');

  // 클릭 핸들러
  const closeModal = () => modal.classList.add('hidden');
  cancelBtn.onclick = closeModal;
  okBtn.onclick = () => {
    closeModal();
    if (onConfirm) onConfirm();
  };
}

/* ===============================
공통 메시지 함수
=================================*/
function showSuccessMessage(message) {
  const existing = document.querySelector('.success-message');
  if (existing) existing.remove();

  const msg = document.createElement('div');
  msg.className = 'success-message';
  msg.style.cssText = `
        position: fixed;
        top: 24px;
        right: 24px;
        background: #10b981;
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 12px;
        animation: slideInRight 0.3s ease;
    `;
  msg.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span>${message}</span>
    `;
  document.body.appendChild(msg);

  setTimeout(() => {
    msg.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => msg.remove(), 300);
  }, 3000);
}

function showErrorMessage(message) {
  const existing = document.querySelector('.error-message');
  if (existing) existing.remove();

  const msg = document.createElement('div');
  msg.className = 'error-message';
  msg.style.cssText = `
        position: fixed;
        top: 24px;
        right: 24px;
        background: #ef4444;
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 12px;
        animation: slideInRight 0.3s ease;
    `;
  msg.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>${message}</span>
    `;
  document.body.appendChild(msg);

  setTimeout(() => {
    msg.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => msg.remove(), 300);
  }, 3000);
}

document.querySelectorAll('.info-card-collapsible .info-header').forEach(header => {
  header.addEventListener('click', () => {
    const card = header.closest('.info-card-collapsible');
    card.classList.toggle('collapsed');
  });
});

/* ===============================
   회의 데이터 로드 및 표시
=================================*/
let meetingData = null;
let isRecording = false;
let mediaRecorder = null; 
let recordedChunks = [];

async function loadMeetingData() {
    try {
        const meetingId = localStorage.getItem("currentMeetingId");

        // meetingId가 없으면 스킵
        if (!meetingId) {
            console.warn("회의 ID가 없습니다. 로컬 데이터 사용");
            const stored = localStorage.getItem('currentMeeting');
            if (stored) meetingData = JSON.parse(stored);
            displayMeetingInfo();
            return;
        }

        // Spring API 호출
        const res = await fetch(`http://localhost:8080/api/meetings/${meetingId}`, {
            credentials: 'include'  // 중요: 쿠키 포함
        });
        if (!res.ok) throw new Error("회의 정보 불러오기 실패");

        meetingData = await res.json();
        displayMeetingInfo();
        
    } catch (e) {
        console.error('회의 데이터 로드 실패:', e);
        showErrorMessage("서버에서 회의 정보를 불러올 수 없습니다.");
    }
}

function displayMeetingInfo() {
  if (!meetingData) return;

  // 회의 제목
  document.getElementById('meetingTitle').textContent = meetingData.title || '제목 없음';

  // 회의 일시
  if (meetingData.scheduledAt) {
    const date = new Date(meetingData.scheduledAt);
    const formatted = date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    document.getElementById('meetingDate').textContent = formatted;
  }

  // 회의 설명
  if (meetingData.description && meetingData.description.trim()) {
    document.getElementById('meetingDescription').textContent = meetingData.description;
  } else {
    document.getElementById('descriptionSection').style.display = 'none';
  }

  // 참석자
  if (meetingData.participants && meetingData.participants.length > 0) {
    const participantsList = document.getElementById('participantsList');
    const participantCount = document.getElementById('participantCount');

    participantCount.textContent = `${meetingData.participants.length}명`;
    participantsList.innerHTML = '';

    meetingData.participants.forEach(name => {
      const chip = document.createElement('div');
      chip.className = 'participant-chip';
      chip.innerHTML = `
                <div class="participant-avatar-mini">${name.charAt(0)}</div>
                <span>${name}</span>
            `;
      participantsList.appendChild(chip);
    });
  } else {
    document.getElementById('participantCount').textContent = '0명';
  }

  // 키워드
  if (meetingData.keywords && meetingData.keywords.length > 0) {
    const keywordsList = document.getElementById('keywordsList');
    const keywordCount = document.getElementById('keywordCount');

    keywordCount.textContent = `${meetingData.keywords.length}개`;
    keywordsList.innerHTML = '';

    meetingData.keywords.forEach(keyword => {
      const chip = document.createElement('span');
      chip.className = 'keyword-chip';
      chip.textContent = keyword;
      keywordsList.appendChild(chip);
    });
  } else {
    document.getElementById('keywordCount').textContent = '0개';
  }
}
/* ===============================
   타이머 기능
=================================*/
let timerSeconds = 0;
let timerInterval = null;
let isPaused = false;

function startTimer() {
  timerInterval = setInterval(() => {
    if (!isPaused) {
      timerSeconds++;
      updateTimerDisplay();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const hours = Math.floor(timerSeconds / 3600);
  const minutes = Math.floor((timerSeconds % 3600) / 60);
  const seconds = timerSeconds % 60;

  const display = [hours, minutes, seconds]
    .map(n => String(n).padStart(2, '0'))
    .join(':');

  document.getElementById('timerDisplay').textContent = display;
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/* ===============================
   녹음 시작 기능
=================================*/
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const endBtn = document.getElementById('endBtn');

startBtn.addEventListener('click', () => {
  isRecording = true;

  // UI 전환
  startBtn.style.display = 'none';
  pauseBtn.style.display = 'flex';

  // 종료 버튼 활성화
  endBtn.disabled = false;
  endBtn.classList.add('active');
  document.querySelector('.end-warning').textContent = '회의를 종료하려면 클릭하세요';

  // 상태 변경
  const micHeader = document.querySelector('.mic-status-header');
  micHeader.classList.remove('ready', 'paused');
  micHeader.classList.add('recording');
  micHeader.querySelector('.mic-status-label').textContent = '녹음 중';


  // 타이머 시작
  startTimer();

  // 마이크 시작
  startMicVisualizer();

  // 데모 데이터 시작
  startDemoTranscript();
});

/* ===============================
   일시정지/재개 기능
=================================*/
pauseBtn.addEventListener('click', async () => {
  isPaused = !isPaused;

  if (isPaused) {
    pauseBtn.classList.add('active');
    pauseBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>
      재개
    `;

    // 실제 녹음도 일시정지
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.pause();
    }

    pauseMicVisualizer();
    showSuccessMessage('녹음이 일시정지되었습니다.');

  } else {
    pauseBtn.classList.remove('active');
    pauseBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="6" y="4" width="4" height="16"/>
        <rect x="14" y="4" width="4" height="16"/>
      </svg>
      일시정지
    `;

    // 녹음 재개
    if (mediaRecorder && mediaRecorder.state === "paused") {
      mediaRecorder.resume();
    }

    await resumeMicVisualizer();
    showSuccessMessage('녹음이 다시 시작되었습니다.');
  }
});


/* ===============================
   회의 종료 -> Spring
=================================*/
endBtn.addEventListener('click', () => {
  if (!isRecording) return;

  openConfirmModal(
    '회의 종료',
    '회의를 종료하시겠습니까?<br>종료하면 회의록 페이지로 이동합니다.',
    async () => {
      clearInterval(timerInterval);

      // 녹음 중단
      if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();

      const finalMeetingData = {
        ...meetingData,
        duration: timerSeconds,
        endTime: new Date().toISOString(),
        transcripts: Array.from(document.querySelectorAll('.transcript-item')).map(item => ({
          speaker: item.querySelector('.speaker-name').textContent,
          time: item.querySelector('.transcript-time').textContent,
          text: item.querySelector('.transcript-text').textContent
        }))
      };

      try {
        // 회의 종료 API 호출
        const meetingId = localStorage.getItem("currentMeetingId");
        const res = await fetch(`http://localhost:8080/api/meetings/${meetingId}/finish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(finalMeetingData)
        });

        if (!res.ok) throw new Error("회의 종료 실패");
        const result = await res.json();

        showSuccessMessage("회의가 저장되었습니다!");
        localStorage.removeItem("currentMeeting");
        localStorage.removeItem("currentMeetingId");
        window.location.href = 'recordFinish.html';

      } catch (err) {
        console.error("회의 종료 중 오류:", err);
        showErrorMessage("회의 데이터를 서버에 저장하지 못했습니다.");
      }
    }
  );
});

/* ===============================
   실시간 텍스트 로그
=================================*/
const transcriptContent = document.getElementById('transcriptContent');
const autoScrollCheckbox = document.getElementById('autoScroll');
const transcriptCountEl = document.getElementById('transcriptCount');
let transcriptCount = 3; // 초기 샘플 개수

function scrollToBottom() {
  if (autoScrollCheckbox.checked) {
    transcriptContent.scrollTop = transcriptContent.scrollHeight;
  }
}

function updateTranscriptCount() {
  transcriptCountEl.textContent = `${transcriptCount}개 발화`;
}

/* ===============================
   실시간 발화 저장 -> Spring
=================================*/

async function addTranscript(speakerName, text) {
    const item = document.createElement('div');
    item.className = 'transcript-item';
    
    const timestamp = formatTime(timerSeconds);
    
    // 키워드 하이라이트 적용
    let highlightedText = text;
    if (meetingData && meetingData.keywords) {
        meetingData.keywords.forEach((keyword, index) => {
            const regex = new RegExp(`(${keyword})`, 'gi');
            const colorClass = `keyword-highlight-${index % 6}`; // 6가지 색상 반복
            highlightedText = highlightedText.replace(regex, `<mark class="${colorClass}">$1</mark>`);
        });
    }
    
    item.innerHTML = `
        <div class="transcript-meta">
            <span class="speaker-name">${speakerName}</span>
            <span class="transcript-time">${timestamp}</span>
        </div>
        <div class="transcript-text">${highlightedText}</div>
    `;
    
    transcriptContent.appendChild(item);
    transcriptCount++;
    updateTranscriptCount();
    scrollToBottom();
    
    // 키워드 알림 체크
    if (meetingData && meetingData.keywords) {
        checkKeywords(text, timestamp, speakerName);
    }

    // 서버 전송 (선택)
    try {
        const meetingId = localStorage.getItem("currentMeetingId");
        if (meetingId) {
            await fetch(`http://localhost:8080/api/meetings/${meetingId}/transcripts`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    speaker: speakerName,
                    text: text,
                    timestamp: new Date().toISOString()
                })
            });
        }
    } catch (err) {
        console.error("서버에 발화 저장 실패:", err);
    }
}

/* ===============================
   키워드 하이라이트 알림
=================================*/
function checkKeywords(text, timestamp, speakerName) {
  if (!meetingData || !meetingData.keywords) return;

  meetingData.keywords.forEach(keyword => {
    if (text.toLowerCase().includes(keyword.toLowerCase())) {
      showHighlightToast(keyword, text, timestamp, speakerName);
    }
  });
}

function showHighlightToast(keyword, text, timestamp, speakerName) {
  const container = document.getElementById('highlightToastContainer');

  const toast = document.createElement('div');
  toast.className = 'highlight-toast';

  const colorIndex = meetingData.keywords.indexOf(keyword) % 6; // 색상 번호 계산
  toast.dataset.color = colorIndex; // 색상 클래스 매칭용

  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const keywordIndex = lowerText.indexOf(lowerKeyword);
  const start = Math.max(0, keywordIndex - 25);
  const end = Math.min(text.length, keywordIndex + keyword.length + 25);
  let snippet = text.substring(start, end);

  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';

  const regex = new RegExp(`(${keyword})`, 'gi');
  const colorClass = `keyword-highlight-${colorIndex}`;
  snippet = snippet.replace(regex, `<mark class="${colorClass}">$1</mark>`);

  toast.innerHTML = `
        <div class="highlight-toast-header">
            <div class="highlight-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                    <line x1="7" y1="7" x2="7.01" y2="7"/>
                </svg>
            </div>
            <span class="highlight-toast-title">${speakerName}</span>
            <span class="highlight-toast-time">${timestamp}</span>
        </div>
        <div class="highlight-toast-content">${snippet}</div>
    `;

  container.appendChild(toast);

  // 클릭 시 해당 위치로 스크롤
  toast.addEventListener('click', () => {
    const items = transcriptContent.querySelectorAll('.transcript-item');
    items[items.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  });

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* ===============================
   녹음 제어 (일시정지 / 재개 포함)
=================================*/

let audioContext = null;
let analyser = null;
let microphone = null;
let micStream = null;
let animationId = null;

async function startMicVisualizer() {
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // 오디오 스트림 녹음 시작
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(micStream);
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordedChunks.push(event.data);
    };

    mediaRecorder.start(); // 녹음 시작

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    microphone = audioContext.createMediaStreamSource(micStream);

    analyser.smoothingTimeConstant = 0.7;
    analyser.fftSize = 256;

    microphone.connect(analyser);
    visualize();
  } catch (error) {
    console.error("마이크 접근 실패:", error);
    const micHeader = document.querySelector(".mic-status-header");
    if (!micHeader) return;
    micHeader.classList.add("error");
    const micLabel = micHeader.querySelector(".mic-status-label");
    if (micLabel) micLabel.textContent = "마이크 오류";
  }
}

/** 일시정지 */
function pauseMicVisualizer() {
  if (audioContext) audioContext.suspend(); // 분석만 멈춤
  if (animationId) cancelAnimationFrame(animationId);

  const micHeader = document.querySelector('.mic-status-header');
  micHeader.classList.remove('recording', 'ready');
  micHeader.classList.add('paused');
  micHeader.querySelector('.mic-status-label').textContent = '일시정지 중';
}


/** 재개 */
async function resumeMicVisualizer() {
  if (!micStream) {
    await startMicVisualizer(); // 새 스트림 열기
  } else if (audioContext?.state === "suspended") {
    await audioContext.resume();
  }

  const micHeader = document.querySelector('.mic-status-header');
  micHeader.classList.remove('ready', 'paused');
  micHeader.classList.add('recording');
  micHeader.querySelector('.mic-status-label').textContent = '녹음 중';
}

/** 완전 종료 */
function stopMicVisualizer() {
  if (animationId) cancelAnimationFrame(animationId);
  if (micStream) {
    micStream.getTracks().forEach(track => track.stop());
  }
  if (audioContext) audioContext.close();
}

/** 시각화 */
function visualize() {
  const bars = document.querySelectorAll(".wave-bar");
  const micHeader = document.querySelector(".mic-status-header");
  const micLabel = micHeader?.querySelector(".mic-status-label");
  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  function update() {
    if (isPaused) return; // 일시정지 시 업데이트 중단

    analyser.getByteFrequencyData(dataArray);
    const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

    if (micHeader && micLabel) {
      if (avg < 5) {
        micHeader.classList.add("no-sound");
        micHeader.classList.remove("error");
        micLabel.textContent = "소리 없음";
      } else {
        micHeader.classList.remove("no-sound", "error");
        micLabel.textContent = "녹음 중";
      }
    }

    bars.forEach((bar, i) => {
      const value = dataArray[i * 8] || avg;
      const height = Math.max(10, (value / 255) * 100);
      bar.style.height = height + "%";
    });

    animationId = requestAnimationFrame(update);
  }

  update();
}


/* ===============================
   익명 발화자 (발화자 1, 2, 3, ...)
=================================*/
const demoSpeakers = ['발화자 1', '발화자 2', '발화자 3', '발화자 4'];

function getRandomSpeaker() {
  // 실사용 시 diarization 결과에 따라 speakerId 부여
  return demoSpeakers[Math.floor(Math.random() * demoSpeakers.length)];
}

const demoTexts = [
  "다음 주까지 예산안을 완성해야 합니다. 각 부서별로 필요한 항목을 정리해주세요.",
  "네, 알겠습니다. 마감일은 정확히 언제인가요?",
  "마감일은 다음 주 금요일입니다. 예산 초과가 되지 않도록 주의해주세요.",
  "현재 진행 중인 프로젝트와 예산 분배는 어떻게 하면 좋을까요?",
  "우선순위를 정해서 중요한 항목부터 예산을 배정하는 게 좋을 것 같습니다.",
  "그럼 이번 주 내로 1차 예산안을 작성하고, 다음 주 초에 검토하는 건 어떨까요?",
  "좋습니다. 그렇게 진행하겠습니다. 마감일 전까지는 충분한 시간이 있네요.",
  "추가로 필요한 자료가 있으면 말씀해주세요. 바로 준비하겠습니다."
];

let demoIndex = 0;

function startDemoTranscript() {
  setInterval(() => {
    if (!isPaused) {
      const speaker = getRandomSpeaker();
      const text = demoTexts[demoIndex % demoTexts.length];
      addTranscript(speaker, text);
      demoIndex++;
    }
  }, 5000); // 5초마다 새 발화 추가
}

/* ===============================
   초기화
=================================*/
document.addEventListener('DOMContentLoaded', () => {
  const micHeader = document.querySelector('.mic-status-header');
  micHeader.classList.remove('recording', 'paused');
  micHeader.classList.add('ready');
  micHeader.querySelector('.mic-status-label').textContent = '대기 중';
  // 회의 데이터 로드
  loadMeetingData();

  // 발화 카운트 초기화
  updateTranscriptCount();

  // 타이머는 녹음 시작 버튼을 누를 때 시작
  // 마이크 비주얼라이저도 녹음 시작 버튼을 누를 때 시작
});

// 페이지 나갈 때 리소스 정리
window.addEventListener('beforeunload', () => {
  stopMicVisualizer();
  clearInterval(timerInterval);
});