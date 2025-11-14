/* ===============================
   전역 변수 (발화자 분석 추가)
=================================*/
let speakerAnalysisToken = null;
let speakerAnalysisCheckInterval = null;

/* ===============================
   Chatbot & Sidebar Fetch
=================================*/
document.addEventListener("DOMContentLoaded", async () => {
  const user = await loadCurrentUser();

  let userSettings = {};
  try {
    userSettings = user || {};
    if (userSettings && userSettings.name) {
      currentUserName = userSettings.name;
      console.log(`로그인한 사용자: ${currentUserName}`);
    } else {
      console.warn("로그인한 사용자 이름을 찾을 수 없습니다. (userSettings)");
      currentUserName = "사용자";
    }
  } catch (e) {
    console.error("userSettings 로드 실패", e);
    currentUserName = "사용자";
    userSettings = { name: "사용자" };
  }

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

      if (typeof loadCurrentUser === 'function') {
        console.log('recordFinish.js: app.js의 loadCurrentUser()를 호출합니다.');
        loadCurrentUser();
      } else {
        console.error('recordFinish.js: app.js의 loadCurrentUser() 함수를 찾을 수 없습니다.');

        document.querySelectorAll(".user-avatar").forEach(el => { el.textContent = "U"; });
        document.querySelectorAll(".user-name").forEach(el => { el.textContent = "사용자"; });
        document.querySelectorAll(".user-email").forEach(el => { el.textContent = ""; });
      }
    });

  // ✅ 서버에서 회의 데이터 로드
  await loadMeetingDataFromServer();
  
  // ✅ sessionStorage에서 발화자 분석 토큰 확인 (recordPage에서 전달된 경우)
  const savedToken = sessionStorage.getItem("speakerAnalysisToken");
  if (savedToken) {
      console.log("🎤 저장된 발화자 분석 토큰 발견:", savedToken);
      speakerAnalysisToken = savedToken;
      sessionStorage.removeItem("speakerAnalysisToken");
      startCheckingSpeakerAnalysisResult();
  } 
  // ❌ 자동 발화자 분석 시작 제거 - 버튼으로만 실행
  
  // ✅ 발화자 분석 상태 체크 및 UI 업데이트
  checkSpeakerAnalysisStatus();
  checkMappingCompletion();
});

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
function showSuccessMessage(msg) {
  const div = document.createElement("div");
  div.className = "success-toast";
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
  });
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 2500);
}

function showErrorMessage(msg) {
  const div = document.createElement("div");
  div.className = "error-toast";
  div.textContent = msg;
  Object.assign(div.style, {
      position: "fixed",
      top: "24px",
      right: "24px",
      background: "#ef4444",
      color: "#fff",
      padding: "12px 20px",
      borderRadius: "8px",
      zIndex: "9999",
  });
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 2500);
}

/* ===============================
   발화자 분석 함수들 (NEW)
=================================*/

// 발화자 분석 시작 함수
async function startSpeakerAnalysis(fileUrl) {
    if (!fileUrl) {
        console.error("❌ 발화자 분석 시작 실패: fileUrl이 없습니다.");
        showErrorMessage("오디오 파일 URL이 없어 발화자 분석을 시작할 수 없습니다.");
        return;
    }

    console.log("🎤 발화자 분석 시작 요청:", fileUrl);
    showSuccessMessage("발화자 분석을 시작합니다...");

    try {
        const response = await fetch("http://localhost:8000/api/analyze/object", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                file_url: fileUrl,
                language: "ko",
                speaker_min: -1,
                speaker_max: -1
            })
        });

        if (!response.ok) {
            throw new Error(`발화자 분석 요청 실패: ${response.status}`);
        }

        const result = await response.json();
        speakerAnalysisToken = result.token;
        
        console.log("✅ 발화자 분석 토큰 받음:", speakerAnalysisToken);
        showSuccessMessage(`발화자 분석이 시작되었습니다.`);

        // 주기적으로 결과 확인 (3초마다)
        startCheckingSpeakerAnalysisResult();

    } catch (error) {
        console.error("❌ 발화자 분석 시작 오류:", error);
        showErrorMessage("발화자 분석 시작에 실패했습니다.");
    }
}

// 발화자 분석 결과 주기적 확인
function startCheckingSpeakerAnalysisResult() {
    if (!speakerAnalysisToken) {
        console.error("❌ 발화자 분석 토큰이 없습니다.");
        return;
    }

    if (speakerAnalysisCheckInterval) {
        clearInterval(speakerAnalysisCheckInterval);
    }

    let checkCount = 0;
    const maxChecks = 60; // 최대 3분 (3초 × 60)

    console.log("⏳ 발화자 분석 결과 확인 시작...");

    speakerAnalysisCheckInterval = setInterval(async () => {
        checkCount++;

        if (checkCount > maxChecks) {
            clearInterval(speakerAnalysisCheckInterval);
            showErrorMessage("발화자 분석 시간이 초과되었습니다.");
            return;
        }

        try {
            const response = await fetch(`http://localhost:8000/api/analyze/${speakerAnalysisToken}`);
            
            if (!response.ok) {
                throw new Error(`결과 조회 실패: ${response.status}`);
            }

            const result = await response.json();

            if (result.status === "COMPLETED" || result.success) {
                clearInterval(speakerAnalysisCheckInterval);
                console.log("✅ 발화자 분석 완료!", result);
                
                // meetingData에 발화자 분석 결과 저장
                if (meetingData) {
                    meetingData.speakerAnalysis = result;
                    
                    // segments를 transcripts 형식으로 변환
                    if (result.segments && Array.isArray(result.segments)) {
                        meetingData.transcripts = result.segments.map((seg, idx) => ({
                            speaker: seg.speaker?.name || `화자${seg.speaker?.label || 0}`,
                            speakerName: seg.speaker?.name || `화자${seg.speaker?.label || 0}`,
                            speakerLabel: seg.speaker?.label,  // ✅ CLOVA label 보존
                            time: formatTimestamp(seg.start),
                            text: seg.text || "",
                            startTime: seg.start,
                            endTime: seg.end,
                            sequenceOrder: idx,  // ✅ 순서 명시
                            isDeleted: false
                        }));
                        
                        console.log(`✅ ${meetingData.transcripts.length}개의 발화 로그 변환 완료`);
                    }

                    // 참석자 목록 업데이트
                    if (result.speakers && Array.isArray(result.speakers)) {
                        const speakerNames = result.speakers.map(s => s.name);
                        // 기존 참석자 목록과 병합 (중복 제거)
                        meetingData.participants = [...new Set([...meetingData.participants, ...speakerNames])];
                        
                        console.log(`✅ 참석자 목록 업데이트: ${meetingData.participants.join(', ')}`);
                    }

                    // UI 업데이트
                    displayTranscripts();
                    updateTranscriptStats();
                    checkMappingCompletion();
                    
                    // ✅ 발화자 분석 버튼 숨기기
                    const analysisBtn = document.getElementById('startSpeakerAnalysisBtn');
                    if (analysisBtn) {
                        analysisBtn.style.display = 'none';
                    }
                    
                    // 서버에 저장 (필요한 경우 - 함수가 있다면)
                    if (typeof saveMeetingDataToServer === 'function') {
                        await saveMeetingDataToServer();
                    }
                }

                showSuccessMessage("발화자 분석이 완료되었습니다! 🎉");
                
            } else if (result.status === "FAILED" || result.error) {
                clearInterval(speakerAnalysisCheckInterval);
                console.error("❌ 발화자 분석 실패:", result);
                showErrorMessage("발화자 분석에 실패했습니다.");
                
                // ✅ 버튼 상태 복구
                const analysisBtn = document.getElementById('startSpeakerAnalysisBtn');
                if (analysisBtn) {
                    analysisBtn.disabled = false;
                    analysisBtn.classList.remove('analyzing');
                    analysisBtn.querySelector('span').textContent = '발화자 구분 분석 시작';
                }
                
                // ✅ 토큰 초기화
                speakerAnalysisToken = null;
                
            } else {
                // 아직 진행 중
                const progress = result.progress || 0;
                console.log(`⏳ 발화자 분석 진행 중... ${progress}%`);
            }

        } catch (error) {
            console.error("❌ 발화자 분석 결과 확인 오류:", error);
        }

    }, 3000); // 3초마다 확인
}

// 타임스탬프 포맷팅 함수 (ms → "00:00:00")
function formatTimestamp(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/* ===============================
    HyperCLOVA X API 설정
=================================*/

const HYPERCLOVA_CONFIG = {
    apiKey: '',
    apiUrl: '',
    requestId: ''
};

function generateRequestId() {
    return `meeting-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function callHyperCLOVA(conversationText, taskType) {
    const prompts = {
        '회의목적': `다음 회의 대화 내용을 분석하여 회의의 핵심 목적을 한 문장으로 명확하게 요약해주세요.

회의 대화:
${conversationText}

회의 목적:`,
        
        '주요안건': `다음 회의 대화 내용에서 논의된 주요 안건들을 추출하여 쉼표로 구분하여 간단하게 나열해주세요.

회의 대화:
${conversationText}

주요 안건:`,
        
        '전체요약': `다음 회의 대화 내용을 2-3문장으로 종합적으로 요약해주세요. 주요 결정사항과 논의 내용을 포함해주세요.

회의 대화:
${conversationText}

전체 요약:`,
        
        '중요도': `다음 회의 내용을 분석하여 회의 중요도를 "높음", "보통", "낮음" 중 하나로 평가하고, 그 이유를 한 문장으로 설명해주세요.

회의 대화:
${conversationText}

중요도 평가:`
    };

    try {
        const response = await fetch(HYPERCLOVA_CONFIG.apiUrl, {
            method: 'POST',
            headers: {
                'X-NCP-CLOVASTUDIO-API-KEY': HYPERCLOVA_CONFIG.apiKey,
                'X-NCP-APIGW-API-KEY': HYPERCLOVA_CONFIG.apiKey,
                'X-NCP-CLOVASTUDIO-REQUEST-ID': generateRequestId(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: [
                    {
                        role: 'system',
                        content: '당신은 회의록 작성 전문가입니다. 회의 내용을 명확하고 간결하게 요약합니다.'
                    },
                    {
                        role: 'user',
                        content: prompts[taskType]
                    }
                ],
                topP: 0.8,
                topK: 0,
                maxTokens: 500,
                temperature: 0.3,
                repeatPenalty: 5.0,
                stopBefore: [],
                includeAiFilters: true
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API 응답 오류:', errorText);
            throw new Error(`HyperCLOVA API 호출 실패: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.status && data.status.code !== '20000') {
            throw new Error(`HyperCLOVA API 오류: ${data.status.message}`);
        }

        const resultText = data.result?.message?.content || data.result?.text || '';
        return resultText.trim();

    } catch (error) {
        console.error('HyperCLOVA API 호출 오류:', error);
        throw error;
    }
}

async function analyzeMeetingImportance(text) {
    try {
        const summary = await callHyperCLOVA(text, '중요도');
        
        let level = '보통';
        const lowerSummary = summary.toLowerCase();
        
        if (lowerSummary.includes('높음') || lowerSummary.includes('긴급') || 
            lowerSummary.includes('중요') || lowerSummary.includes('high') ||
            lowerSummary.includes('critical') || lowerSummary.includes('시급')) {
            level = '높음';
        } else if (lowerSummary.includes('낮음') || lowerSummary.includes('일상') || 
                   lowerSummary.includes('단순') || lowerSummary.includes('low') ||
                   lowerSummary.includes('routine') || lowerSummary.includes('정기')) {
            level = '낮음';
        }
        
        return {
            level: level,
            reason: summary
        };
    } catch (error) {
        console.error('중요도 분석 오류:', error);
        return {
            level: '보통',
            reason: '분석 중 오류가 발생했습니다.'
        };
    }
}

// 발화자에게 고유 색상을 매핑하는 객체
const speakerColorMap = {};
let colorHUEIndex = 0;
const HUE_STEP = 137.5;

function getSpeakerColor(speakerId) {
    if (!speakerColorMap[speakerId]) {
        const hue = (colorHUEIndex * HUE_STEP) % 360;

        const saturation = 65;
        const lightness = 40;

        const hslToHex = (h, s, l) => {
            l /= 100;
            const a = (s * Math.min(l, 1 - l)) / 100;
            const f = n => {
                const k = (n + h / 30) % 12;
                const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
                return Math.round(255 * color).toString(16).padStart(2, '0');
            };
            return `#${f(0)}${f(8)}${f(4)}`;
        };

        speakerColorMap[speakerId] = hslToHex(hue, saturation, lightness);
        colorHUEIndex++;
    }
    return speakerColorMap[speakerId];
}

/* 전역 변수 */
let meetingData = null;
let speakerMappingData = {};
let actionItems = [];
let currentEditingTranscriptIndex = -1;
let activeKeyword = null;
let isEditingSummary = false;
let originalSummaryData = {};
let currentMappingSpeaker = null;
let currentUserName = null;

/* ===============================
   회의 ID 가져오기 개선 버전
=================================*/

/**
 * 회의 ID를 가져오는 함수
 * 1. URL 쿼리 파라미터에서 확인 (우선순위 높음)
 * 2. localStorage에서 확인
 * 3. 둘 다 없으면 null 반환
 */
function getMeetingId() {
    // 1. URL에서 meetingId 파라미터 확인
    const urlParams = new URLSearchParams(window.location.search);
    const urlMeetingId = urlParams.get('meetingId');
    
    if (urlMeetingId) {
        console.log('✅ URL에서 회의 ID 발견:', urlMeetingId);
        // URL에서 찾았으면 localStorage에도 저장 (다음에도 사용 가능하도록)
        localStorage.setItem('currentMeetingId', urlMeetingId);
        return urlMeetingId;
    }
    
    // 2. localStorage에서 확인
    const storedMeetingId = localStorage.getItem('currentMeetingId');
    if (storedMeetingId) {
        console.log('✅ localStorage에서 회의 ID 발견:', storedMeetingId);
        return storedMeetingId;
    }
    
    // 3. 둘 다 없음
    console.error('❌ 회의 ID를 찾을 수 없습니다');
    return null;
}

/* ===============================
   서버에서 회의 데이터 로드 (개선 버전)
=================================*/
async function loadMeetingDataFromServer() {
    try {
        const meetingId = getMeetingId();
        
        if (!meetingId) {
            console.error('회의 ID를 찾을 수 없습니다');
            
            // 사용자에게 친절한 안내 메시지
            showErrorModal(
                '회의 정보 없음',
                '회의 데이터를 불러올 수 없습니다.<br>' +
                '회의를 먼저 생성하거나 진행해주세요.',
                () => {
                    window.location.href = 'new-meeting.html'; // 회의 생성 페이지로 이동
                }
            );
            return;
        }

        console.log(`📥 회의 데이터 로드 시작 (ID: ${meetingId})`);

        const response = await fetch(`http://localhost:8080/api/meetings/${meetingId}`, {
            credentials: 'include'
        });

        if (response.status === 404) {
            throw new Error('해당 회의를 찾을 수 없습니다. 삭제되었거나 존재하지 않는 회의입니다.');
        }

        if (response.status === 401) {
            showErrorMessage('로그인이 필요합니다');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1500);
            return;
        }

        if (!response.ok) {
            throw new Error(`서버 응답 오류: ${response.status}`);
        }

        const data = await response.json();
        
        // 서버 데이터를 meetingData 형식으로 변환
        meetingData = {
            meetingId: data.meetingId,
            title: data.title || "회의록",
            date: data.scheduledAt || new Date().toISOString(),
            duration: 0,
            participants: data.participants || [],
            transcripts: [],
            actions: [],
            keywords: (data.keywords || []).map(k => ({ text: k, source: 'user' })),
            audioFileUrl: null  // Recording에서 로드될 예정
        };

        // Transcript 데이터 로드
        await loadTranscripts(meetingId);
        
        // Recording 데이터 로드
        await loadRecording(meetingId);

        console.log('✅ 회의 데이터 로드 완료:', meetingData);
        
        // UI 업데이트
        displayMeetingInfo();
        displayTranscripts();
        renderKeywords();
        renderActionItems();
        updateTranscriptStats();
        
    } catch (error) {
        console.error('❌ 회의 데이터 로드 실패:', error);
        showErrorModal(
            '데이터 로드 실패',
            `회의 데이터를 불러오는데 실패했습니다.<br>${error.message}`,
            () => {
                window.location.href = 'dashboard.html'; // 대시보드로 이동
            }
        );
    }
}

/**
 * 에러 모달 표시 함수
 */
function showErrorModal(title, message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    if (!modal) {
        // 모달이 없으면 alert 사용
        alert(`${title}\n\n${message}`);
        if (onConfirm) onConfirm();
        return;
    }
    
    const titleEl = document.getElementById('confirmTitle');
    const msgEl = document.getElementById('confirmMessage');
    const okBtn = document.getElementById('confirmOkBtn');
    const cancelBtn = document.getElementById('confirmCancelBtn');

    titleEl.textContent = title;
    msgEl.innerHTML = message;
    
    // 취소 버튼 숨기기 (에러 모달은 확인만 있으면 됨)
    if (cancelBtn) {
        cancelBtn.style.display = 'none';
    }

    modal.classList.remove('hidden');

    const closeModal = () => {
        modal.classList.add('hidden');
        if (cancelBtn) cancelBtn.style.display = '';
    };
    
    okBtn.onclick = () => {
        closeModal();
        if (onConfirm) onConfirm();
    };
}


/* Transcript 데이터 로드 */
async function loadTranscripts(meetingId) {
    try {
        const response = await fetch(`http://localhost:8080/api/transcripts/meeting/${meetingId}`, {
            credentials: 'include'
        });

        if (response.ok) {
            const transcripts = await response.json();
            
            // Transcript 데이터 변환
            meetingData.transcripts = transcripts.map(t => ({
                speaker: t.speakerId || t.speakerName || 'Unknown',
                speakerName: t.speakerName,
                time: t.timeLabel || formatTimeFromMs(t.startTime),
                text: t.text || '',
                startTime: t.startTime,
                endTime: t.endTime,
                isDeleted: t.isDeleted || false
            }));

            console.log(`✅ Transcript ${transcripts.length}개 로드 완료`);
        } else {
            console.warn('Transcript 데이터가 없습니다');
            meetingData.transcripts = [];
        }
    } catch (error) {
        console.error('Transcript 로드 실패:', error);
        meetingData.transcripts = [];
    }
}

/* Recording 데이터 로드 */
async function loadRecording(meetingId) {
    try {
        const response = await fetch(`http://localhost:8080/api/recordings/meeting/${meetingId}`, {
            credentials: 'include'
        });

        if (response.ok) {
            const recording = await response.json();
            meetingData.duration = recording.durationSeconds || 0;
            meetingData.audioFileUrl = recording.audioFileUrl;
            meetingData.audioFormat = recording.audioFormat;
            meetingData.audioFileSize = recording.audioFileSize;
            
            console.log('✅ Recording 데이터 로드 완료');
            console.log('   - 오디오 URL:', meetingData.audioFileUrl);
        } else {
            console.warn('Recording 데이터가 없습니다');
        }
    } catch (error) {
        console.error('Recording 로드 실패:', error);
    }
}

/* 밀리초를 시간 문자열로 변환 */
function formatTimeFromMs(ms) {
    if (!ms) return "00:00";
    const seconds = Math.floor(ms / 1000);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    
    if (h > 0) {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    } else {
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
}

/* 회의 정보 표시 */
function displayMeetingInfo() {
  if (!meetingData) return;

  const title = meetingData.title || "제목 없음";
  document.getElementById("meetingTitle").textContent = title;

  const dateEl = document.getElementById("meetingDate");
  if (meetingData.date && dateEl) {
      const date = new Date(meetingData.date);
      dateEl.textContent = `${date.getFullYear()}.${String(
          date.getMonth() + 1
      ).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")} ${String(
          date.getHours()
      ).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }

  const dur = document.getElementById("meetingDuration");
  if (meetingData.duration && dur)
      dur.textContent = formatDuration(meetingData.duration);

  const part = document.getElementById("participantCount");
  if (meetingData.participants && part)
      part.textContent = meetingData.participants.length + "명 참석";
}

function formatDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* 회의 제목 수정 */
function editMeetingTitle() {
  const modal = document.getElementById("titleModal");
  const input = document.getElementById("newTitleInput");
  const currentTitle = document.getElementById("meetingTitle").textContent;

  input.value = currentTitle;
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  setTimeout(() => {
    input.focus();
    input.onkeypress = function(e) {
      if (e.key === 'Enter') {
        saveNewTitle();
      }
    };
  }, 100);
}

function closeTitleModal() {
  const modal = document.getElementById("titleModal");
  modal.classList.add("hidden");
  document.body.style.overflow = "";
}

function saveNewTitle() {
  const input = document.getElementById("newTitleInput");
  const newTitle = input.value.trim();

  if (newTitle) {
    meetingData.title = newTitle;
    document.getElementById("meetingTitle").textContent = newTitle;
    showSuccessMessage("회의 제목이 수정되었습니다.");
    closeTitleModal();
  } else {
    showErrorMessage("회의 제목을 입력해주세요.");
  }
}

/* 키워드 하이라이트 */
function highlightKeywords(text) {
  if (!activeKeyword) return text;
  const regex = new RegExp("(" + activeKeyword + ")", "gi");
  return text.replace(
      regex,
      '<mark style="background:#fef3c7;color:#d97706;padding:2px 4px;border-radius:3px;">$1</mark>'
  );
}

/* 실시간 로그 표시 */
function displayTranscripts() {
  if (!meetingData || !meetingData.transcripts) return;
  const body = document.getElementById("transcriptList");
  body.innerHTML = "";

  if (meetingData.transcripts.length === 0) {
    body.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #9ca3af;">
        <p>회의 녹취록이 없습니다.</p>
      </div>
    `;
    return;
  }

  meetingData.transcripts.forEach((transcript, index) => {
    const item = document.createElement("div");
    item.className = "transcript-item";
    item.setAttribute("data-index", index);

    const speakerClass = speakerMappingData[transcript.speaker] ? "mapped" : "";
    const displayName = speakerMappingData[transcript.speaker] || transcript.speakerName || transcript.speaker;
    const avatarText = displayName.charAt(0).toUpperCase();

    const speakerColor = getSpeakerColor(transcript.speaker);

    const isSelf = (currentUserName === displayName);
    const selfClass = isSelf ? 'is-self' : '';
    item.className = `transcript-item ${selfClass}`;

    const isDeleted = transcript.isDeleted || false;
    if (isDeleted) {
        item.classList.add('is-deleted');
    }

    const deleteButtonHtml = isDeleted ? `
      <button class="undo-transcript-btn" onclick="undoTranscript(${index})" title="복구">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21.5 2v6h-6M2.5 22v-6h6"/>
          <path d="M2 11.5A10 10 0 0 1 11.5 2a10 10 0 0 1 8.01 4.04"/>
          <path d="M22 12.5a10 10 0 0 1-19.04 1.96"/>
        </svg>
      </button>
    ` : `
      <button class="delete-transcript-btn" onclick="deleteTranscript(${index})" title="삭제">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    `;

    item.innerHTML = `
      <div class="speaker-avatar-wrapper">
        <div class="speaker-avatar ${speakerClass}"
             onclick="openSpeakerModal('${transcript.speaker}')"
             title="${displayName}"
             style="background: ${speakerColor};">
          ${avatarText}
        </div>
      </div>
      <div class="transcript-content">
        <div class="transcript-header">
          <div class="transcript-meta">
            <span class="speaker-name ${speakerClass}"
                  onclick="openSpeakerModal('${transcript.speaker}')"
                  style="color: ${speakerColor};">
              ${displayName}
            </span>
            <span class="time-stamp">${transcript.time}</span>
          </div>

          <div class="transcript-controls" style="display: flex; gap: 4px;">
            <button class="edit-transcript-btn" onclick="editTranscript(${index})" title="수정" ${isDeleted ? 'disabled' : ''}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            ${deleteButtonHtml}
          </div>

        </div>
        <div class="transcript-text" id="transcript-text-${index}">${highlightKeywords(transcript.text)}</div>
      </div>
    `;
    body.appendChild(item);
  });
  updateTranscriptStats();
}

/* 로그 통계 업데이트 */
function updateTranscriptStats() {
  const countEl = document.getElementById("transcriptCount");
  const mappingEl = document.getElementById("mappingStatus");

  if (!meetingData || !meetingData.transcripts) return;

  const total = meetingData.transcripts.length;
  const uniqueSpeakers = [...new Set(meetingData.transcripts.map(t => t.speaker))];
  const mappedCount = uniqueSpeakers.filter(s => speakerMappingData[s]).length;

  if (countEl) countEl.textContent = `총 ${total}개 발화`;
  if (mappingEl) mappingEl.textContent = `${mappedCount}/${uniqueSpeakers.length} 매핑 완료`;
}

/* 키워드 렌더링 */
function renderKeywords() {
    const kwContainer = document.getElementById("keywords");
    if (!kwContainer) return;

    kwContainer.innerHTML = "";

    if (!meetingData || !meetingData.keywords || meetingData.keywords.length === 0) {
        return;
    }

    (meetingData.keywords || []).forEach(k_obj => {
        const tag = document.createElement("div");
        const sourceClass = k_obj.source === 'user' ? 'keyword-user' : 'keyword-ai';
        tag.className = `keyword ${sourceClass}`;
        tag.textContent = k_obj.text;
        tag.onclick = () => toggleKeyword(tag, k_obj.text);
        kwContainer.appendChild(tag);
    });
}

function toggleKeyword(tag, keyword) {
  if (activeKeyword === keyword) {
    activeKeyword = null;
    tag.classList.remove("active");
  } else {
    document.querySelectorAll(".keyword").forEach(k => k.classList.remove("active"));
    activeKeyword = keyword;
    tag.classList.add("active");
  }
  displayTranscripts();
}

/* 액션 아이템 렌더링 */
function renderActionItems() {
  const container = document.getElementById("actionItemsContainer");
  if (!container) return;

  container.innerHTML = "";

  if (!actionItems || actionItems.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 20px; color: #9ca3af;">
        <p>등록된 액션 아이템이 없습니다.</p>
      </div>
    `;
    return;
  }

  actionItems.forEach((item, index) => {
    const actionDiv = document.createElement("div");
    actionDiv.className = "action-item";
    actionDiv.innerHTML = `
      <div class="action-item-content">
        <h4>${item.title}</h4>
        <p>담당: ${item.assignee || '미지정'}</p>
        <p>기한: ${item.deadline || '미지정'}</p>
      </div>
      <button onclick="deleteAction(${index})" class="action-delete-btn">삭제</button>
    `;
    container.appendChild(actionDiv);
  });
}

function deleteAction(index) {
  openConfirmModal(
    "액션 아이템 삭제",
    "이 액션 아이템을 삭제하시겠습니까?",
    () => {
      actionItems.splice(index, 1);
      renderActionItems();
      showErrorMessage("액션 아이템이 삭제되었습니다.");
    }
  );
}

/* 발화자 매핑 */
function openSpeakerModal(speaker) {
  currentMappingSpeaker = speaker;
  const modal = document.getElementById("speakerModal");
  const list = document.getElementById("participantList");
  list.innerHTML = "";
  
  meetingData.participants.forEach((p, index) => {
      const item = document.createElement("div");
      item.className = "participant-item";
      if (speakerMappingData[speaker] === p) item.classList.add("selected");
      item.innerHTML = `
          <div class="participant-avatar">${p.charAt(0)}</div>
          <span class="participant-name">${p}</span>
          <button class="participant-delete-btn" onclick="event.stopPropagation(); deleteParticipant(${index})" title="삭제">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
          </button>
      `;
      item.onclick = () => selectParticipant(item, p);
      list.appendChild(item);
  });

  const addForm = document.createElement("div");
  addForm.className = "add-participant-form";
  addForm.innerHTML = `
      <input type="text" class="add-participant-input" id="newParticipantInput" placeholder="새 참석자 이름 입력">
      <button class="add-participant-btn" onclick="addParticipant()">추가</button>
  `;
  list.appendChild(addForm);
  
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  setTimeout(() => {
      const input = document.getElementById("newParticipantInput");
      if (input) {
          input.addEventListener("keypress", (e) => {
              if (e.key === "Enter") addParticipant();
          });
      }
  }, 100);
}

function addParticipant() {
  const input = document.getElementById("newParticipantInput");
  const name = input.value.trim();
  
  if (!name) {
      showErrorMessage("참석자 이름을 입력해주세요.");
      return;
  }

  if (meetingData.participants.includes(name)) {
      showErrorMessage("이미 존재하는 참석자입니다.");
      return;
  }

  meetingData.participants.push(name);
  input.value = "";
  
  const speaker = currentMappingSpeaker;
  closeSpeakerModal();
  openSpeakerModal(speaker);
  
  showSuccessMessage(`${name}님이 추가되었습니다.`);
}

function deleteParticipant(index) {
  const participant = meetingData.participants[index];

  openConfirmModal(
    "참석자 삭제",
    `'${participant}'님을 참석자 목록에서 삭제하시겠습니까?<br><span style="color: #ef4444; font-size: 13px;">(매핑된 발화 로그도 함께 연결이 끊어집니다.)</span>`,
    () => {
      meetingData.participants.splice(index, 1);

      Object.keys(speakerMappingData).forEach(speaker => {
        if (speakerMappingData[speaker] === participant) {
          delete speakerMappingData[speaker];
        }
      });

      const speaker = currentMappingSpeaker;
      closeSpeakerModal();
      openSpeakerModal(speaker);
      displayTranscripts();
      checkMappingCompletion();

      showErrorMessage(`${participant}님이 삭제되었습니다.`);
    }
  );
}

function selectParticipant(item, participant) {
  document.querySelectorAll(".participant-item").forEach(el => el.classList.remove("selected"));
  item.classList.add("selected");
  speakerMappingData[currentMappingSpeaker] = participant;
}

function closeSpeakerModal() {
  const modal = document.getElementById("speakerModal");
  modal.classList.add("hidden");
  document.body.style.overflow = "";
}

function saveSpeakerMapping() {
    closeSpeakerModal();
    displayTranscripts();
    
    const hasCurrentUser = Object.values(speakerMappingData).includes(currentUserName);
    const extractBtn = document.getElementById('extractMyActionsBtn');
    const infoText = document.getElementById('actionInfoText');
    
    if (hasCurrentUser && extractBtn) {
        extractBtn.disabled = false;
        extractBtn.classList.remove('btn-secondary');
        extractBtn.classList.add('btn-primary');
        
        if (infoText) {
            infoText.textContent = '✅ 준비 완료! 버튼을 클릭하여 할 일을 추출하세요';
            infoText.style.color = '#10b981';
        }
    }
    
    showSuccessMessage("발화자 매핑이 저장되었습니다.");
    checkMappingCompletion();
}

/* ===============================
   발화자 분석 상태 체크 및 UI 업데이트
=================================*/

/**
 * 발화자 분석이 필요한지 확인하고 UI 업데이트
 */
function checkSpeakerAnalysisStatus() {
    if (!meetingData) return;

    const needsAnalysis = meetingData.audioFileUrl && 
                         (!meetingData.transcripts || meetingData.transcripts.length === 0);

    // 발화자 분석 버튼 찾기 (없으면 생성)
    let analysisBtn = document.getElementById('startSpeakerAnalysisBtn');
    
    if (needsAnalysis) {
        // 버튼이 없으면 생성
        if (!analysisBtn) {
            analysisBtn = createSpeakerAnalysisButton();
        }
        
        // 버튼 활성화
        analysisBtn.disabled = false;
        analysisBtn.style.display = 'flex';
        
        console.log('💡 발화자 분석이 필요합니다. 버튼을 클릭하여 시작하세요.');
    } else if (analysisBtn) {
        // Transcript가 있으면 버튼 숨기기
        analysisBtn.style.display = 'none';
        console.log('✅ 발화자 분석 완료 - 버튼 숨김');
    }
}

/**
 * 발화자 분석 시작 버튼 생성
 */
function createSpeakerAnalysisButton() {
    // 버튼을 추가할 컨테이너 찾기
    const transcriptHeader = document.querySelector('.transcript-header') || 
                            document.querySelector('.transcript-section h2')?.parentElement;
    
    if (!transcriptHeader) {
        console.error('❌ 발화자 분석 버튼을 추가할 위치를 찾을 수 없습니다.');
        return null;
    }

    // 버튼 생성
    const button = document.createElement('button');
    button.id = 'startSpeakerAnalysisBtn';
    button.className = 'speaker-analysis-btn';
    button.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
        <span>발화자 구분 분석 시작</span>
    `;
    
    button.onclick = handleSpeakerAnalysisButtonClick;
    
    // 버튼 스타일 추가
    const style = document.createElement('style');
    style.textContent = `
        .speaker-analysis-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 12px 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 6px rgba(102, 126, 234, 0.25);
            margin: 16px 0;
        }
        
        .speaker-analysis-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(102, 126, 234, 0.35);
        }
        
        .speaker-analysis-btn:active {
            transform: translateY(0);
        }
        
        .speaker-analysis-btn:disabled {
            background: #9ca3af;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
        
        .speaker-analysis-btn svg {
            flex-shrink: 0;
        }
        
        .speaker-analysis-btn.analyzing {
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            cursor: wait;
        }
        
        .speaker-analysis-btn.analyzing span::after {
            content: '...';
            animation: dots 1.5s steps(4, end) infinite;
        }
        
        @keyframes dots {
            0%, 20% { content: '.'; }
            40% { content: '..'; }
            60%, 100% { content: '...'; }
        }
    `;
    
    if (!document.getElementById('speaker-analysis-btn-style')) {
        style.id = 'speaker-analysis-btn-style';
        document.head.appendChild(style);
    }
    
    // 버튼을 헤더 다음에 추가
    transcriptHeader.insertAdjacentElement('afterend', button);
    
    return button;
}

/**
 * 발화자 분석 버튼 클릭 핸들러
 */
async function handleSpeakerAnalysisButtonClick() {
    const button = document.getElementById('startSpeakerAnalysisBtn');
    
    if (!meetingData || !meetingData.audioFileUrl) {
        showErrorMessage('오디오 파일 정보가 없습니다.');
        return;
    }
    
    // 이미 분석 중이면 중복 실행 방지
    if (speakerAnalysisToken) {
        showErrorMessage('이미 발화자 분석이 진행 중입니다.');
        return;
    }
    
    // 확인 모달 표시
    openConfirmModal(
        '발화자 구분 분석',
        '발화자 구분 분석을 시작하시겠습니까?<br><span style="color: #6b7280; font-size: 13px;">분석 시간은 녹음 길이에 따라 다르며, 수 분이 소요될 수 있습니다.</span>',
        async () => {
            // 버튼 상태 변경
            button.disabled = true;
            button.classList.add('analyzing');
            button.querySelector('span').textContent = '분석 중';
            
            // 발화자 분석 시작
            await startSpeakerAnalysis(meetingData.audioFileUrl);
        }
    );
}

/* AI 요약 버튼 활성화 체크 */
function checkMappingCompletion() {
    if (!meetingData || !meetingData.transcripts) return;

    const uniqueSpeakers = [...new Set(meetingData.transcripts.map(t => t.speaker))];
    const mappedCount = uniqueSpeakers.filter(s => speakerMappingData[s]).length;

    const allMapped = uniqueSpeakers.length > 0 && mappedCount === uniqueSpeakers.length;
    const generateBtn = document.getElementById('generateSummaryBtn');

    if (generateBtn) {
        if (allMapped) {
            generateBtn.disabled = false;
            console.log('모든 발화자 매핑 완료. AI 요약 버튼 활성화.');
        } else {
            generateBtn.disabled = true;
            console.log('아직 매핑되지 않은 발화자가 있습니다. AI 요약 버튼 비활성화.');
        }
    }
}

/* ===============================
   서버 저장 함수
=================================*/

/**
 * 발화자 분석 완료 후 Transcript 데이터를 서버에 저장하는 함수
 */
async function saveMeetingDataToServer() {
    if (!meetingData || !meetingData.transcripts || meetingData.transcripts.length === 0) {
        console.warn('⚠️ 저장할 Transcript 데이터가 없습니다.');
        return;
    }

    const meetingId = getMeetingId();
    if (!meetingId) {
        console.error('❌ Meeting ID를 찾을 수 없어 서버 저장 불가');
        showErrorMessage('회의 ID를 찾을 수 없습니다.');
        return;
    }

    console.log(`💾 Transcript 서버 저장 시작... (Meeting ID: ${meetingId})`);

    try {
        // Frontend transcripts를 Backend DTO 형식으로 변환
        const transcriptDtos = meetingData.transcripts.map((transcript, index) => {
            // speakerLabel 추출 (있으면 사용, 없으면 null)
            const speakerLabel = transcript.speakerLabel !== undefined 
                ? transcript.speakerLabel 
                : null;

            return {
                speakerId: transcript.speaker,           // 화자 ID (예: "spk_0")
                speakerName: transcript.speakerName || transcript.speaker,  // 화자 이름
                speakerLabel: speakerLabel,              // CLOVA speaker label (정수)
                text: transcript.text,                   // 발화 내용
                startTime: transcript.startTime,         // 시작 시간 (ms)
                endTime: transcript.endTime,             // 종료 시간 (ms)
                sequenceOrder: transcript.sequenceOrder !== undefined ? transcript.sequenceOrder : index  // 발화 순서
            };
        });

        console.log(`📤 전송할 Transcript 수: ${transcriptDtos.length}개`);

        // Backend API 호출 - 일괄 저장
        const response = await fetch(
            `http://localhost:8080/api/transcripts/batch?meetingId=${meetingId}`,
            {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                credentials: 'include',  // 세션 쿠키 포함
                body: JSON.stringify(transcriptDtos)
            }
        );

        if (!response.ok) {
            throw new Error(`서버 응답 오류: ${response.status}`);
        }

        const savedTranscripts = await response.json();
        console.log(`✅ Transcript ${savedTranscripts.length}개 서버 저장 완료`);
        
        showSuccessMessage(`발화 로그 ${savedTranscripts.length}개가 저장되었습니다.`);

        // 저장된 데이터로 meetingData 업데이트 (ID 등 추가된 정보 반영)
        savedTranscripts.forEach((saved, index) => {
            if (meetingData.transcripts[index]) {
                meetingData.transcripts[index].id = saved.id;
                meetingData.transcripts[index].createdAt = saved.createdAt;
                meetingData.transcripts[index].updatedAt = saved.updatedAt;
            }
        });

    } catch (error) {
        console.error('❌ Transcript 서버 저장 실패:', error);
        showErrorMessage('발화 로그 저장에 실패했습니다.');
    }
}

/* 초기화 */