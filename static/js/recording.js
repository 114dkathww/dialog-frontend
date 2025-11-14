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

            loadCurrentUser();

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

// 사용자 정보 로드
async function loadCurrentUser() {
  try {
    const response = await fetch('http://localhost:8080/api/auth/me', {
      credentials: 'include'
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
    position: fixed; top: 24px; right: 24px;
    background: #10b981; color: white;
    padding: 16px 24px; border-radius: 8px;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    z-index: 9999; display: flex; align-items: center; gap: 12px;
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
    position: fixed; top: 24px; right: 24px;
    background: #ef4444; color: white;
    padding: 16px 24px; border-radius: 8px;
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
    z-index: 9999; display: flex; align-items: center; gap: 12px;
    animation: slideInRight 0.3s ease;
  `;
  msg.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <line x1="15" y1="9" x2="9" y2="15"/>
      <line x1="9" y1="9" x2="15" y2="15"/>
    </svg>
    <span>${message}</span>
  `;
  document.body.appendChild(msg);

  setTimeout(() => {
    msg.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => msg.remove(), 300);
  }, 3000);
}

/* ===============================
   WebSocket STT 연결
=================================*/
let ws = null;
let isWebSocketConnected = false;
let mediaRecorder = null;
let micStream = null;
let sentences = [];  // 문장 저장 배열
let isRecordingComplete = false;

// 🆕 녹음 파일 메타데이터 저장
let recordingMetadata = {
  audioFileUrl: '',
  audioFormat: 'wav',
  audioFileSize: null,
  durationSeconds: 0
};

function connectSTTWebSocket(language = "ko") {
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log("이미 WebSocket 연결되어 있음");
    return;
  }

  try {
    ws = new WebSocket('ws://localhost:8000/ws/realtime');
    
    ws.onopen = () => {
      console.log('✅ WebSocket 연결 성공');
      isWebSocketConnected = true;
      
      // STT 시작 신호 전송
      ws.send(JSON.stringify({
        action: 'start',
        language: language
      }));
      
      showSuccessMessage('음성 인식이 시작되었습니다');
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (err) {
        console.error('메시지 파싱 오류:', err);
      }
    };
    
    ws.onerror = (error) => {
      console.error('❌ WebSocket 오류:', error);
      showErrorMessage('음성 인식 서버 연결 실패');
      isWebSocketConnected = false;
    };
    
    ws.onclose = () => {
      console.log('🔌 WebSocket 연결 종료');
      isWebSocketConnected = false;
    };
  } catch (error) {
    console.error('WebSocket 연결 실패:', error);
    showErrorMessage('음성 인식 서버에 연결할 수 없습니다');
  }
}

// WebSocket 메시지 처리 (발화자 분석 제거)
function handleWebSocketMessage(data) {
  console.log('📨 받은 메시지:', data);
  
  switch(data.type) {
    case 'status':
      if (data.message === 'recording') {
        console.log('🎙️ STT 시작됨');
      } else if (data.message === 'stopping') {
        console.log('🛑 STT 중지 중...');
      } else if (data.message === 'paused') {
        console.log('⏸️ STT 일시정지됨');
      } else if (data.message === 'resumed') {
        console.log('▶️ STT 재개됨');
      }
      break;
      
    case 'data':
    case 'transcription':
      handleTranscription(data);
      break;
      
    case 'audio_uploaded':
      console.log('✅ 오디오 업로드 완료:', data.file_url);
      
      // Recording 엔티티 필드에 맞춰 메타데이터 저장
      recordingMetadata.audioFileUrl = data.file_url;
      recordingMetadata.audioFormat = data.audio_format || 'wav';
      recordingMetadata.audioFileSize = data.file_size || null;
      
      // 하위 호환성을 위한 기존 저장소도 유지
      localStorage.setItem('uploadedAudioUrl', data.file_url);
      sessionStorage.setItem('uploaded_file_url', data.file_url);
      
      if (data.audio_format) {
        sessionStorage.setItem('audio_format', data.audio_format);
      }
      if (data.file_size) {
        sessionStorage.setItem('audio_file_size', data.file_size);
      }
      break;
      
    case 'done':
      console.log('✅ STT 완료');
      console.log('전체 텍스트:', data.fullText);
      console.log('문장 수:', data.sentenceCount);
      isRecordingComplete = true;
      
      if (data.file_url) {
        recordingMetadata.audioFileUrl = data.file_url;
        localStorage.setItem('uploadedAudioUrl', data.file_url);
        sessionStorage.setItem('uploaded_file_url', data.file_url);
      }
      
      // 최종 녹음 시간 업데이트
      recordingMetadata.durationSeconds = timerSeconds;
      
      showSuccessMessage('녹음이 완료되었습니다!');
      break;
      
    case 'error':
      console.error('❌ STT 에러:', data.message);
      showErrorMessage('음성 인식 중 오류 발생');
      break;
  }
}

// 📝 개선된 실시간 인식 처리 함수
function handleTranscription(data) {
  const {
    text,
    fullText,
    isSentenceEnd,
    isFinal
  } = data;

  // 서버 타임스탬프
  let startTimestamp = data.startTimestamp || data.start_timestamp;
  let endTimestamp = data.endTimestamp || data.end_timestamp;
  
  // 현재 오디오 시간
  const currentAudioTime = timerSeconds * 1000; // ms로 변환

  if (!text) return;

  // 1. 중간 인식 결과 처리
  if (!isFinal && !isSentenceEnd) {
    updatePartialTranscript(text);
    return;
  }

  // 2. 최종 인식 결과 처리
  if (isFinal || isSentenceEnd) {
    // 부분 인식 결과 제거
    const partialDiv = document.getElementById('partialTranscript');
    if (partialDiv) partialDiv.remove();

    // 최종 텍스트 결정
    let finalText = fullText ? fullText.trim() : text.trim();
    if (finalText.length === 0) return;

    // 타임스탬프 보완
    if (endTimestamp === undefined) {
      endTimestamp = currentAudioTime;
    }
    if (startTimestamp === undefined && sentences.length > 0) {
      startTimestamp = sentences[sentences.length - 1].endTs;
    } else if (startTimestamp === undefined) {
      startTimestamp = 0;
    }

    // 3. 문장 병합 로직 (이전 문장이 불완전한 경우)
    if (sentences.length > 0 && isFragment(sentences[sentences.length - 1].text)) {
      const lastSentence = sentences[sentences.length - 1];
      lastSentence.text += ' ' + finalText;
      lastSentence.endTs = endTimestamp;
      
      // 병합 후 구두점 추가
      if (needsPunctuation(lastSentence.text) && /[요다죠니다음습니다음죠]$/.test(lastSentence.text.trim())) {
        lastSentence.text += '.';
      }
    } else {
      // 4. 새로운 문장으로 추가
      // 구두점 보완
      if (needsPunctuation(finalText) && /[요다죠니다음습니다음죠]$/.test(finalText)) {
        finalText += '.';
      }

      sentences.push({
        text: finalText,
        startTs: startTimestamp,
        endTs: endTimestamp,
        speaker: data.speaker || meetingData?.participants?.[0] || '화자'
      });
    }

    // 5. 화면에 표시
    displaySentences();
    updateTranscriptCount();
  }
}

// 구두점 체크 함수
function needsPunctuation(txt) {
  return !/[.?!]$/.test(txt.trim());
}

// 불완전한 문장 체크
function isFragment(txt) {
  const trimmed = txt.trim();
  return needsPunctuation(trimmed) && !/[요다죠니다음습니다음죠]$/.test(trimmed);
}

// 문장 화면 표시
function displaySentences() {
  const transcriptContent = document.getElementById('transcriptContent');
  
  // 기존 내용 제거 (빈 상태 메시지 포함)
  const emptyState = transcriptContent.querySelector('.empty-state');
  if (emptyState) emptyState.remove();

  sentences.forEach((sentence, index) => {
    // 이미 표시된 문장인지 확인
    let existingItem = transcriptContent.querySelector(`[data-sentence-index="${index}"]`);
    
    if (existingItem) {
      // 기존 문장 업데이트 (병합된 경우)
      const textDiv = existingItem.querySelector('.transcript-text');
      if (textDiv) {
        textDiv.innerHTML = highlightKeywords(sentence.text);
      }
    } else {
      // 새 문장 추가
      const item = document.createElement('div');
      item.className = 'transcript-item';
      item.setAttribute('data-sentence-index', index);
      
      const timestamp = formatTime(Math.floor(sentence.startTs / 1000) || timerSeconds);
      const highlightedText = highlightKeywords(sentence.text);
      
      item.innerHTML = `
        <div class="transcript-meta">
          <span class="transcript-time">${timestamp}</span>
        </div>
        <div class="transcript-text">${highlightedText}</div>
      `;
      
      transcriptContent.appendChild(item);
    }
  });

  scrollToBottom();
}

// 키워드 하이라이팅
function highlightKeywords(text) {
  let highlightedText = text;
  if (meetingData && meetingData.keywords) {
    meetingData.keywords.forEach((keyword, index) => {
      const regex = new RegExp(`(${keyword})`, 'gi');
      const colorClass = `keyword-highlight-${index % 6}`;
      highlightedText = highlightedText.replace(regex, `<mark class="${colorClass}">$1</mark>`);
    });
  }
  return highlightedText;
}

// 중간 인식 결과 표시
function updatePartialTranscript(text) {
  let partialDiv = document.getElementById('partialTranscript');
  
  if (!partialDiv) {
    partialDiv = document.createElement('div');
    partialDiv.id = 'partialTranscript';
    partialDiv.className = 'transcript-item partial';
    partialDiv.style.opacity = '0.5';
    partialDiv.style.fontStyle = 'italic';
    partialDiv.style.border = '1px dashed #ccc';
    
    const transcriptContent = document.getElementById('transcriptContent');
    transcriptContent.appendChild(partialDiv);
  }
  
  partialDiv.innerHTML = `
    <div class="transcript-meta">
      <span class="transcript-time">${formatTime(timerSeconds)}</span>
      <span style="color: #999; font-style: italic; margin-left: 10px;">인식 중...</span>
    </div>
    <div class="transcript-text" style="color: #666;">${text}</div>
  `;
  
  scrollToBottom();
}

/* ===============================
   카드 접기/펼치기
=================================*/
const participantsCard = document.getElementById('participantsCard');
const keywordsCard = document.getElementById('keywordsCard');

if (participantsCard) {
  participantsCard.querySelector('.info-header').addEventListener('click', () => {
    participantsCard.classList.toggle('collapsed');
  });
}

if (keywordsCard) {
  keywordsCard.querySelector('.info-header').addEventListener('click', () => {
    keywordsCard.classList.toggle('collapsed');
  });
}

/* ===============================
   회의 데이터 로드
=================================*/
let meetingData = null;
let isRecording = false;

async function loadMeetingData() {
    try {
        const meetingId = localStorage.getItem("currentMeetingId");
        
        if (!meetingId) {
            console.warn('회의 ID가 없습니다');
            return;
        }

        const res = await fetch(`http://localhost:8080/api/meetings/${meetingId}`, {
            credentials: 'include'
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

  document.getElementById('meetingTitle').textContent = meetingData.title || '제목 없음';

  if (meetingData.date) {
    const date = new Date(meetingData.date);
    const formatted = date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    document.getElementById('meetingDate').textContent = formatted;
  }

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
      recordingMetadata.durationSeconds = timerSeconds;
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
   실시간 텍스트 로그
=================================*/
const transcriptContent = document.getElementById('transcriptContent');
const autoScrollCheckbox = document.getElementById('autoScroll');
const transcriptCountEl = document.getElementById('transcriptCount');

function scrollToBottom() {
  if (autoScrollCheckbox && autoScrollCheckbox.checked) {
    transcriptContent.scrollTop = transcriptContent.scrollHeight;
  }
}

function updateTranscriptCount() {
  if (transcriptCountEl) {
    transcriptCountEl.textContent = `${sentences.length}개 발화`;
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
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'highlight-toast';

  const colorIndex = meetingData.keywords.indexOf(keyword) % 6;
  toast.dataset.color = colorIndex;

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

  toast.addEventListener('click', () => {
    const items = transcriptContent.querySelectorAll('.transcript-item:not(.partial)');
    if (items.length > 0) {
      items[items.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  });

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

/* ===============================
   마이크 비주얼라이저
=================================*/
let audioContext = null;
let analyser = null;
let microphone = null;
let animationId = null;

async function startMicVisualizer() {
  try {
    if (!micStream) {
      micStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
    }

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    microphone = audioContext.createMediaStreamSource(micStream);

    analyser.smoothingTimeConstant = 0.7;
    analyser.fftSize = 256;

    microphone.connect(analyser);
    visualize();
  } catch (error) {
    console.error("마이크 접근 실패:", error);
    showErrorMessage("마이크에 접근할 수 없습니다");
  }
}

function pauseMicVisualizer() {
  if (audioContext) audioContext.suspend();
  if (animationId) cancelAnimationFrame(animationId);

  const micHeader = document.querySelector('.mic-status-header');
  if (micHeader) {
    micHeader.classList.remove('recording', 'ready');
    micHeader.classList.add('paused');
    const label = micHeader.querySelector('.mic-status-label');
    if (label) label.textContent = '일시정지 중';
  }
}

async function resumeMicVisualizer() {
  if (!micStream) {
    await startMicVisualizer();
  } else if (audioContext?.state === "suspended") {
    await audioContext.resume();
  }

  const micHeader = document.querySelector('.mic-status-header');
  if (micHeader) {
    micHeader.classList.remove('ready', 'paused');
    micHeader.classList.add('recording');
    const label = micHeader.querySelector('.mic-status-label');
    if (label) label.textContent = '녹음 중';
  }
}

function stopMicVisualizer() {
  if (animationId) cancelAnimationFrame(animationId);
  if (micStream) {
    micStream.getTracks().forEach(track => track.stop());
    micStream = null;
  }
  if (audioContext) audioContext.close();
}

function visualize() {
  const bars = document.querySelectorAll(".wave-bar");
  const micHeader = document.querySelector(".mic-status-header");
  const micLabel = micHeader?.querySelector(".mic-status-label");
  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  function update() {
    if (isPaused) {
      animationId = requestAnimationFrame(update);
      return;
    }

    analyser.getByteFrequencyData(dataArray);
    const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

    if (micHeader && micLabel && !isPaused) {
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
   녹음 시작
=================================*/
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const endBtn = document.getElementById('endBtn');

startBtn.addEventListener('click', async () => {
  if (isRecording) return;
  
  try {
    isRecording = true;

    // UI 전환
    startBtn.style.display = 'none';
    pauseBtn.style.display = 'flex';
    endBtn.disabled = false;
    endBtn.classList.add('active');
    document.querySelector('.end-warning').textContent = '회의를 종료하려면 클릭하세요';

    const micHeader = document.querySelector('.mic-status-header');
    micHeader.classList.remove('ready', 'paused');
    micHeader.classList.add('recording');
    micHeader.querySelector('.mic-status-label').textContent = '녹음 중';

    // 타이머 시작
    startTimer();

    // 마이크 시작
    await startMicVisualizer();

    // WebSocket STT 연결
    connectSTTWebSocket("ko");
    
    // 기존 데이터 초기화
    transcriptContent.innerHTML = '';
    sentences = [];
    updateTranscriptCount();
    
    // 녹음 메타데이터 초기화
    recordingMetadata = {
      audioFileUrl: '',
      audioFormat: 'wav',
      audioFileSize: null,
      durationSeconds: 0
    };

  } catch (error) {
    console.error('녹음 시작 실패:', error);
    showErrorMessage('녹음을 시작할 수 없습니다');
    isRecording = false;
  }
});

/* ===============================
   일시정지/재개
=================================*/
pauseBtn.addEventListener('click', async () => {
  isPaused = !isPaused;

  if (isPaused) {
    // WebSocket에 일시정지 신호 전송
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: 'pause' }));
    }

    pauseBtn.classList.add('active');
    pauseBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>
      재개
    `;

    pauseMicVisualizer();
    showSuccessMessage('녹음이 일시정지되었습니다.');

  } else {
    // WebSocket에 재개 신호 전송
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: 'resume' }));
    }
    
    pauseBtn.classList.remove('active');
    pauseBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="6" y="4" width="4" height="16"/>
        <rect x="14" y="4" width="4" height="16"/>
      </svg>
      일시정지
    `;

    await resumeMicVisualizer();
    showSuccessMessage('녹음이 다시 시작되었습니다.');
  }
});

/* ===============================
   회의 종료 (개선 버전)
=================================*/
endBtn.addEventListener('click', () => {
  if (!isRecording) return;

  openConfirmModal(
    '회의 종료',
    '회의를 종료하시겠습니까?<br>종료하면 회의록 페이지로 이동합니다.',
    async () => {
      clearInterval(timerInterval);

      // WebSocket 종료 신호
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: "stop" }));
        setTimeout(() => {
          try { ws.close(); } catch(e) {}
        }, 500);
      }

      // 마이크 정리
      stopMicVisualizer();

      // 회의 데이터 준비
      const transcripts = sentences.map((s, index) => ({
        speakerId: s.speaker || 'Unknown',
        speakerName: s.speaker || 'Unknown',
        speakerLabel: extractSpeakerLabel(s.speaker),
        text: s.text || '',
        startTime: s.startTs || 0,
        endTime: s.endTs || s.startTs || 0,
        sequenceOrder: index
      }));

      // Recording 엔티티 필드에 맞춘 녹음 데이터 준비
      const audioFileUrl = recordingMetadata.audioFileUrl || 
                          sessionStorage.getItem('uploaded_file_url') || 
                          localStorage.getItem('uploadedAudioUrl') || '';
      
      const audioFormat = recordingMetadata.audioFormat || 
                         sessionStorage.getItem('audio_format') || 
                         'wav';
      
      const audioFileSize = recordingMetadata.audioFileSize || 
                           (sessionStorage.getItem('audio_file_size') ? 
                            parseInt(sessionStorage.getItem('audio_file_size')) : null);
      
      const durationSeconds = recordingMetadata.durationSeconds || timerSeconds;

      const finalMeetingData = {
        duration: durationSeconds,
        endTime: new Date().toISOString(),
        recording: {
          audioFileUrl: audioFileUrl,
          audioFormat: audioFormat,
          audioFileSize: audioFileSize,
          durationSeconds: durationSeconds
        },
        transcripts: transcripts
      };

      console.log('📤 서버 전송 데이터:', finalMeetingData);

      try {
        const meetingId = localStorage.getItem("currentMeetingId");
        if (!meetingId) {
          throw new Error("회의 ID를 찾을 수 없습니다");
        }

        console.log(`📡 회의 종료 요청 (Meeting ID: ${meetingId})`);

        const res = await fetch(`http://localhost:8080/api/meetings/${meetingId}/finish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(finalMeetingData),
          credentials: 'include'
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error('서버 응답 에러:', errorText);
          throw new Error(`회의 종료 실패: ${res.status}`);
        }
        
        showSuccessMessage("회의가 저장되었습니다!");

        // ✅ currentMeetingId는 localStorage에 유지
        console.log(`✅ 회의 저장 완료. Meeting ID: ${meetingId}`);
        
        // 세션 정리 (다른 것들만 삭제)
        localStorage.removeItem("currentMeeting");
        localStorage.removeItem("uploadedAudioUrl");
        sessionStorage.removeItem("uploaded_file_url");
        sessionStorage.removeItem("audio_format");
        sessionStorage.removeItem("audio_file_size");
        
        // ✅ URL 파라미터로도 meetingId 전달 (이중 안전장치)
        setTimeout(() => {
          window.location.href = `recordFinish.html?meetingId=${meetingId}`;
        }, 1000);

      } catch (err) {
        console.error("❌ 회의 종료 중 오류:", err);
        showErrorMessage("회의 데이터를 서버에 저장하지 못했습니다: " + err.message);
      }
    }
  );
});

// ✅ 발화자 ID에서 숫자 추출하는 헬퍼 함수
function extractSpeakerLabel(speakerId) {
  if (!speakerId) return 0;
  const match = speakerId.match(/\d+/);
  return match ? parseInt(match[0]) : 0;
}
