/* ===============================
    Chatbot & Sidebar Fetch
=================================*/

if (typeof loadCurrentUser === 'function') {
  console.log('recordFinish.js: app.js의 loadCurrentUser()를 호출합니다.');
  loadCurrentUser();
} else {
  console.error('recordFinish.js: app.js의 loadCurrentUser() 함수를 찾을 수 없습니다.');

  document.querySelectorAll(".user-avatar").forEach(el => { el.textContent = "U"; });
  document.querySelectorAll(".user-name").forEach(el => { el.textContent = "사용자"; });
  document.querySelectorAll(".user-email").forEach(el => { el.textContent = ""; });
};

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

/* 공통 메시지 */
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

        const saturation = 65; // 채도 (너무 쨍하지 않게)
        const lightness = 40;  // 명도 (너무 밝지 않게 - 글씨가 흰색이므로)

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

/* 회의 데이터 로드 */
function loadMeetingData() {
    if (!meetingData) return;
    
    actionItems = meetingData.actions || [];
    displayMeetingInfo();
    displayTranscripts();
    
    // purpose, agenda, summary, importance가 있으면 표시
    if (meetingData.purpose && meetingData.agenda && meetingData.summary) {
        displayAISummary();
    } else {
        // 기본값 표시
        document.getElementById("purposeView").textContent = "AI 요약 생성 버튼을 눌러 AI 요약을 생성하세요.";
        document.getElementById("agendaView").textContent = "AI 요약 생성 버튼을 눌러 AI 요약을 생성하세요.";
        document.getElementById("summaryView").textContent = "AI 요약 생성 버튼을 눌러 AI 요약을 생성하세요.";

        const importanceEl = document.getElementById("importanceBlock");
        if (importanceEl) importanceEl.classList.add("hidden");

        // 키워드는 항상 표시!
        renderKeywords();
    }
    
    renderActionItems();
}

/* 회의 정보 표시 */
function displayMeetingInfo() {
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

  input.value = currentTitle; // 현재 제목을 입력창에 미리 채워넣기
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  // 입력창에 포커스 및 엔터키 이벤트 추가
  setTimeout(() => {
    input.focus();
    input.onkeypress = function(e) {
      if (e.key === 'Enter') {
        saveNewTitle();
      }
    };
  }, 100);
}

/* 제목 수정 모달 닫기 */
function closeTitleModal() {
  const modal = document.getElementById("titleModal");
  modal.classList.add("hidden");
  document.body.style.overflow = "";
}

/* 제목 저장 */
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

  meetingData.transcripts.forEach((transcript, index) => {
    const item = document.createElement("div");
    item.className = "transcript-item";
    item.setAttribute("data-index", index);

    const speakerClass = speakerMappingData[transcript.speaker] ? "mapped" : "";
    const displayName = speakerMappingData[transcript.speaker] || transcript.speaker;
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

/**
 * AI 요약 생성 (버튼 클릭 시)
 * 1. 직무 정보 확인 (None/null 체크)
 * 2. generateAISummary 함수 호출
 */
function startFullSummaryGeneration() {
  // 1. localStorage에서 직무 정보 가져오기
    const userSettings = JSON.parse(localStorage.getItem('userSettings'));
    const userJob = userSettings ? userSettings.job : null; // 예: "BACKEND_DEVELOPER" 또는 null

    // 2. 직무가 없는(NONE) 경우 확인
    if (!userJob || userJob === "NONE" || userJob === "") {
        if (confirm("⚠️ 직무가 설정되지 않았습니다.\n중립적인 요약이 생성됩니다. 계속하시겠습니까?\n\n(직무 설정은 '설정' 페이지에서 할 수 있습니다.)")) {
            // '확인' 누르면 그냥 진행
            console.log("직무 없이 요약 생성 진행");
        } else {
            // '취소' 누르면 중단
            return; 
        }
    }

    // 3. (직무가 있거나, 없지만 '확인' 누른 경우) AI 요약 생성 실행
    // (다음 단계에서 이 함수에 userJob을 넘겨줄 예정)
    generateAISummary(userJob); 
}

/* ===============================
    AI 요약 생성 (HyperCLOVA 사용)
=================================*/

async function generateAISummary(userJob) {
    showLoadingState();
    showLoadingMessage("🤖 AI 요약을 생성하는 중...");

    const jobPersona = (!userJob || userJob === "NONE") ? "general" : userJob;

    try {
        const response = await fetch('http://localhost:3000/api/meeting/summarize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                transcripts: meetingData.transcripts.filter(t => !t.isDeleted),
                meetingDate: meetingData.date,
                speakerMapping: speakerMappingData,  // ✅ 추가!
                userJob: jobPersona // 🚨 변경: 직무 정보(페르소나) 추가
            })
        });

        const data = await response.json();

        hideLoadingMessage();

        meetingData.purpose = data.summary.purpose;
        meetingData.agenda = data.summary.agenda;
        meetingData.summary = data.summary.overallSummary;
        meetingData.importance = data.summary.importance;
        
        const userKeywords = (meetingData.keywords || []).filter(k => k.source === 'user');
        const aiKeywords = (data.summary.keywords || []).map(k => ({ text: k, source: 'ai' }));
        meetingData.keywords = [...userKeywords, ...aiKeywords];
        
        displayAISummary();
        showSuccessMessage('AI 요약이 생성되었습니다!');

    } catch (error) {
        hideLoadingMessage();

        console.error('AI 요약 생성 실패:', error);
        showErrorMessage('AI 요약 생성에 실패했습니다.');
        displayDefaultSummary();
    }
}

function showLoadingState() {
    const loadingText = '<span style="color: #9ca3af;">🤖 AI 요약 생성 중...</span>';

    document.getElementById("purposeView").innerHTML = loadingText;
    document.getElementById("agendaView").innerHTML = loadingText;
    document.getElementById("summaryView").innerHTML = loadingText;

    const importanceEl = document.getElementById("importanceBlock");
    if (importanceEl) importanceEl.classList.add("hidden");

    document.getElementById("keywords").innerHTML = loadingText;
}

function displayAISummary() {
    const toggleBtn = document.getElementById("toggleEditBtn");
    if (toggleBtn) toggleBtn.disabled = false;

    const importanceEl = document.getElementById("importanceBlock");
    if (importanceEl) importanceEl.classList.remove("hidden");

    document.getElementById("purposeView").textContent = 
        meetingData.purpose || "프로젝트 방향성 논의 및 세부 일정 수립";
    document.getElementById("agendaView").textContent = 
        meetingData.agenda || "예산 배정, 일정 조율, 역할 분담";
    document.getElementById("summaryView").textContent = 
        meetingData.summary || "이번 회의에서는 프로젝트의 주요 목표와 일정에 대해 논의했습니다.";

    // 중요도 표시
    if (meetingData.importance) {
        const summaryTextDiv = document.querySelector("#importanceBlock .summary-text");
        if (!summaryTextDiv) return;

        const levelEl = document.createElement("span");
        levelEl.id = "importanceLevel";

        const reasonEl = document.createElement("div");
        reasonEl.id = "importanceReason";
        reasonEl.style.marginTop = "4px";
        reasonEl.style.color = "#6b7280";

        summaryTextDiv.innerHTML = "";
        summaryTextDiv.appendChild(levelEl);
        summaryTextDiv.appendChild(reasonEl);

        const level = meetingData.importance.level || '보통';

        let cleanReason = meetingData.importance.reason || "";
        if (cleanReason.startsWith(level)) {
            cleanReason = cleanReason.substring(level.length).trim();
        }
        cleanReason = cleanReason.trim(); 

        // 5. 새로 만든 요소에 내용과 스타일 적용
        levelEl.textContent = level;
        levelEl.className = 'importance-level';
        if (level === '높음') {
            levelEl.classList.add('level-high');
        } else if (level === '보통') {
            levelEl.classList.add('level-medium');
        } else if (level === '낮음') {
            levelEl.classList.add('level-low');
        } else {
            levelEl.classList.add('level-default');
        }

        reasonEl.textContent = cleanReason; 

        console.log('회의 중요도:', meetingData.importance);
    }

    // 키워드 표시
    renderKeywords();
}

/*
* '키워드 표시' 로직을 별도 함수로 분리
*/
function renderKeywords() {
    const kwContainer = document.getElementById("keywords");
    if (!kwContainer) return; 

    kwContainer.innerHTML = "";

    if (!meetingData || !meetingData.keywords || meetingData.keywords.length === 0) {
        // 키워드가 없을 때 비어있는 대신 안내 문구 표시 (선택 사항)
        // kwContainer.innerHTML = `<p style="color: #6b7280; font-size: 13px;">키워드가 없습니다.</p>`;
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

function displayDefaultSummary() {
    document.getElementById("purposeView").textContent = "AI 요약을 생성할 수 없습니다.";
    document.getElementById("agendaView").textContent = "API 설정을 확인해주세요.";
    document.getElementById("summaryView").textContent = "HyperCLOVA API 키가 필요합니다.";
}

/* 이하 기존 코드 동일하게 유지 (발화자 매핑, 액션 아이템 등) */

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

function deleteKeyword(index) {
  if (index < 0 || !meetingData.keywords || index >= meetingData.keywords.length) {
    return;
  }
  
  const keywordToDelete = meetingData.keywords[index].text;
  
  openConfirmModal(
    "키워드 삭제",
    `'${keywordToDelete}' 키워드를 삭제하시겠습니까?`,
    () => {
      meetingData.keywords.splice(index, 1);
      renderKeywordManageList();
    }
  );
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

function openParticipationChart() {
  if (!meetingData || !meetingData.transcripts) {
      showErrorMessage("회의 데이터가 없습니다.");
      return;
  }

  const filteredTranscripts = meetingData.transcripts.filter(t => !t.isDeleted);

  if (filteredTranscripts.length === 0) {
      showErrorMessage("표시할 발화 로그가 없습니다.");
      return;
  }

  const speakerCounts = {};
  filteredTranscripts.forEach(t => {
      const speaker = speakerMappingData[t.speaker] || t.speaker;
      speakerCounts[speaker] = (speakerCounts[speaker] || 0) + 1;
  });

  const total = filteredTranscripts.length;
  const chartData = Object.entries(speakerCounts).map(([speaker, count]) => ({
      speaker,
      count,
      percentage: ((count / total) * 100).toFixed(1)
  }));

  chartData.sort((a, b) => b.count - a.count);

  const container = document.getElementById("chartContainer");
  container.innerHTML = "";

  chartData.forEach(data => {
      const barDiv = document.createElement("div");
      barDiv.className = "chart-bar";
      barDiv.innerHTML = `
          <div class="chart-label">
              <span class="chart-name">${data.speaker}</span>
              <span class="chart-percentage">${data.percentage}% (${data.count}회)</span>
          </div>
          <div class="chart-bar-bg">
              <div class="chart-bar-fill" style="width: ${data.percentage}%"></div>
          </div>
      `;
      container.appendChild(barDiv);
  });

  const modal = document.getElementById("chartModal");
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeChartModal() {
  const modal = document.getElementById("chartModal");
  modal.classList.add("hidden");
  document.body.style.overflow = "";
}

function toggleSummaryEdit() {
    isEditingSummary = !isEditingSummary;
    const editBtn = document.getElementById("editBtnText");
    const editActions = document.getElementById("editActions");

    const toggleBtn = document.getElementById("toggleEditBtn");

    const sections = [
        { view: "purposeView", editor: "purposeEditor" },
        { view: "agendaView", editor: "agendaEditor" },
        { view: "summaryView", editor: "summaryEditor" },
        { view: "importanceReason", editor: "importanceEditor" }
    ];

  if (isEditingSummary) {
      editBtn.textContent = "편집 중";
      editActions.classList.remove("hidden");

      if (toggleBtn) toggleBtn.disabled = true;

      originalSummaryData = {};
      sections.forEach(({ view, editor }) => {
          const viewEl = document.getElementById(view);
          const editEl = document.getElementById(editor);
          const text = viewEl.textContent.trim();
          originalSummaryData[view] = text;
          editEl.value = text;
          viewEl.classList.add("hidden");
          editEl.classList.remove("hidden");
      });
  } else {
      editBtn.textContent = "편집";
      editActions.classList.add("hidden");

      if (toggleBtn) toggleBtn.disabled = false;

      sections.forEach(({ view, editor }) => {
          const viewEl = document.getElementById(view);
          const editEl = document.getElementById(editor);
          viewEl.classList.remove("hidden");
          editEl.classList.add("hidden");
      });
  }
}

function saveSummaryEdit() {
  const idsToSave = [
    { editorId: "purposeEditor", viewId: "purposeView", dataKey: "purpose" },
    { editorId: "agendaEditor", viewId: "agendaView", dataKey: "agenda" },
    { editorId: "summaryEditor", viewId: "summaryView", dataKey: "summary" },
    { editorId: "importanceEditor", viewId: "importanceReason", dataKey: "importanceReason" }
  ];

  idsToSave.forEach(({ editorId, viewId, dataKey }) => {
    const editor = document.getElementById(editorId);
    const view = document.getElementById(viewId);
    const newText = editor.value.trim() || "내용 없음";

    view.textContent = newText;

    if (dataKey === "importanceReason") {
      if (meetingData.importance) {
        meetingData.importance.reason = newText;
      } else {
        meetingData.importance = { level: "보통", reason: newText };
      }
    } else {
      meetingData[dataKey] = newText;
    }
  });

  toggleSummaryEdit();
  showSuccessMessage("AI 요약이 저장되었습니다.");
}

function cancelSummaryEdit() {
  ["purpose", "agenda", "summary"].forEach(id => {
      const view = document.getElementById(`${id}View`);
      view.textContent = originalSummaryData[`${id}View`];
  });
  toggleSummaryEdit();
}

function toggleKeyword(el, keyword) {
  if (activeKeyword === keyword) {
      activeKeyword = null;
      el.classList.remove("active");
  } else {
      document.querySelectorAll(".keyword").forEach(tag => tag.classList.remove("active"));
      el.classList.add("active");
      activeKeyword = keyword;
  }
  displayTranscripts();
}

function openKeywordModal() {
  const modal = document.getElementById("keywordModal");
  if (!modal) return;

  // 1. 모달을 엽니다.
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  // 2. 현재 키워드 리스트를 모달 안에 채웁니다.
  renderKeywordManageList();

  // 3. (엔터키 지원) 입력창에 엔터키 이벤트를 연결합니다.
  const input = document.getElementById("modalKeywordInput");
  if (input) {
    input.onkeypress = function(e) {
      if (e.key === 'Enter') {
        e.preventDefault(); // 폼 제출 방지
        addManualKeywordFromModal();
      }
    };
    // 모달이 열릴 때 입력창에 포커스
    setTimeout(() => input.focus(), 100);
  }
}

function closeKeywordModal() {
  const modal = document.getElementById("keywordModal");
  if (modal) {
    modal.classList.add("hidden");
  }
  document.body.style.overflow = "";

  // 🚨 중요: 모달이 닫힐 때, 변경된 키워드 목록을
  // 메인 화면에도 다시 그려줍니다. (삭제된 항목 반영)
  renderKeywords();
  showSuccessMessage("키워드 변경사항이 저장되었습니다.");
}

function addManualKeywordFromModal() {
  const input = document.getElementById("modalKeywordInput");
  if (!input) return;

  const newKeyword = input.value.trim();

  // 1. 입력값이 없으면 무시
  if (newKeyword.length === 0) {
    showErrorMessage("추가할 키워드를 입력하세요.");
    return;
  }

  // 2. 키워드 객체 생성 ('user' 태그)
  const newKeywordObj = {
    text: newKeyword,
    source: 'user'
  };

  if (!meetingData.keywords) {
    meetingData.keywords = [];
  }

  // 3. 중복 검사 (텍스트 기준)
  const isDuplicate = meetingData.keywords.some(k => k.text.toLowerCase() === newKeyword.toLowerCase());
  if (isDuplicate) {
    showErrorMessage("이미 존재하는 키워드입니다.");
    return;
  }

  // 4. 데이터에 추가하고 입력창 비우기
  meetingData.keywords.push(newKeywordObj);
  input.value = "";

  // 5. 모달 안의 목록을 새로고침 (즉시 반영)
  renderKeywordManageList(); 
}

function renderKeywordManageList() {
  const listContainer = document.getElementById("keywordManageList");
  if (!listContainer) return;

  listContainer.innerHTML = ""; // 목록 비우기

  if (!meetingData.keywords || meetingData.keywords.length === 0) {
    listContainer.innerHTML = `<p style="color: #6b7280; text-align: center; font-size: 14px;">추가된 키워드가 없습니다.</p>`;
    return;
  }

  meetingData.keywords.forEach((k_obj, index) => {
    const item = document.createElement("div");
    item.className = "keyword-manage-item";
    
    const sourceTag = k_obj.source === 'user' 
      ? '<span class="keyword-source-tag user">사용자</span>'
      : '<span class="keyword-source-tag ai">AI 생성</span>';

    item.innerHTML = `
      <div>
        <span class="keyword-text">${k_obj.text}</span>
        ${sourceTag}
      </div>
      <button class="btn-icon-small delete" onclick="deleteKeyword(${index})" title="삭제">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    `;
    listContainer.appendChild(item);
  });
}

function renderActionItems() {
    const container = document.getElementById("actionList");
    container.innerHTML = "";
    
    actionItems.forEach((a, index) => {
        const div = document.createElement("div");
        div.className = "action-item";
        div.innerHTML = `
            <div class="rfc-action-header">
                <div class="action-title">${a.title}</div>
                <div class="action-controls">
                    <button class="btn-icon-small" onclick="editAction(${index})" title="수정">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="btn-icon-small delete" onclick="deleteAction(${index})" title="삭제">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
            ${a.deadline ? `<div class="action-meta">${a.deadline}</div>` : ''}
            <div class="action-buttons">
                <button class="calendar-btn ${a.addedToCalendar ? 'added' : ''}" onclick="toggleCalendar(${index})">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    ${a.addedToCalendar ? '캘린더에 추가됨' : '캘린더에 추가'}
                </button>
            </div>
        `;
        container.appendChild(div);
    });
}

function editAction(index) {
    const action = actionItems[index];
    document.getElementById("actionTitle").value = action.title;
    document.getElementById("actionDeadline").value = action.deadline || "";
    
    // ✅ 담당자 선택 필드 숨기기
    const assigneeField = document.querySelector('.form-group:has(#actionAssignee)');
    if (assigneeField) assigneeField.style.display = 'none';
    
    const modal = document.getElementById("actionModal");
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    
    const saveBtn = modal.querySelector(".btn-primary");
    saveBtn.textContent = "수정";
    saveBtn.onclick = () => {
        const title = document.getElementById("actionTitle").value.trim();
        if (!title) {
            showErrorMessage("액션 아이템을 입력해주세요.");
            return;
        }
        
        const deadline = document.getElementById("actionDeadline").value;
        
        actionItems[index] = { 
            title, 
            assignee: currentUserName,
            deadline,
            addedToCalendar: action.addedToCalendar, 
            source: action.source || 'user'
        };
        
        renderActionItems();
        closeActionModal();
        showSuccessMessage("액션 아이템이 수정되었습니다.");
        
        saveBtn.textContent = "추가";
        saveBtn.onclick = saveAction;
    };
}

function toggleCalendar(index) {
  actionItems[index].addedToCalendar = !actionItems[index].addedToCalendar;
  renderActionItems();
  if (actionItems[index].addedToCalendar) {
      showSuccessMessage("캘린더에 추가되었습니다.");
  } else {
      showErrorMessage("캘린더에서 제거되었습니다.");
  }
}

function openActionModal() {
    const modal = document.getElementById("actionModal");
    document.getElementById("actionTitle").value = "";
    document.getElementById("actionDeadline").value = "";
    
    // ✅ 담당자 선택 필드 숨기기
    const assigneeField = document.querySelector('.form-group:has(#actionAssignee)');
    if (assigneeField) assigneeField.style.display = 'none';
    
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
}

function saveAction() {
    const title = document.getElementById("actionTitle").value.trim();
    if (!title) {
        showErrorMessage("액션 아이템을 입력해주세요.");
        return;
    }
    
    const deadline = document.getElementById("actionDeadline").value;
    
    // ✅ 담당자는 항상 현재 사용자
    actionItems.push({ 
        title, 
        assignee: currentUserName, 
        deadline, 
        addedToCalendar: false, 
        source: 'user'
    });
    
    renderActionItems();
    closeActionModal();
    showSuccessMessage("액션 아이템이 추가되었습니다.");
}

function closeActionModal() {
    const modal = document.getElementById("actionModal");
    if (modal) {
        modal.classList.add("hidden");
    }
    document.body.style.overflow = "";

    // ✅ [중요] 모달이 닫힐 때, '수정' 상태였던 버튼을 '추가' 상태로 초기화
    // (이유: '수정' 누르다 '취소' 누르면, 다음 '추가' 시 '수정'으로 동작하는 버그 방지)
    const saveBtn = modal.querySelector(".btn-primary");
    if (saveBtn) {
        saveBtn.textContent = "추가";
        saveBtn.onclick = saveAction;
    }
}

function openAddTranscriptModal() {
    const modal = document.getElementById("addTranscriptModal");
    const speakerSelect = document.getElementById("newTranscriptSpeaker");

    // 1. 발화자 목록 채우기 (editTranscript 로직 재활용)
    speakerSelect.innerHTML = ""; // 기존 옵션 비우기
    const uniqueSpeakers = [...new Set(meetingData.transcripts.map(t => t.speaker))].sort();

    let speakerOptions = uniqueSpeakers.map(speaker =>
        `<option value="${speaker}">
          ${speakerMappingData[speaker] || speaker}
        </option>`
    ).join('');

    // "선택하세요" 옵션을 맨 위에 추가
    speakerSelect.innerHTML = `<option value="">발화자를 선택하세요</option>` + speakerOptions;

    // 2. 입력 필드 초기화
    document.getElementById("newTranscriptTime").value = "";
    document.getElementById("newTranscriptText").value = "";

    // 3. 모달 표시
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
}

function closeAddTranscriptModal() {
    const modal = document.getElementById("addTranscriptModal");
    if (modal) {
        modal.classList.add("hidden");
    }
    document.body.style.overflow = "";
}

function saveNewTranscript() {
    const speaker = document.getElementById("newTranscriptSpeaker").value;
    const time = document.getElementById("newTranscriptTime").value.trim();
    const text = document.getElementById("newTranscriptText").value.trim();

    // 1. 유효성 검사
    if (!speaker) {
        showErrorMessage("발화자를 선택해주세요.");
        return;
    }
    // 시간 형식 검사 (예: 00:15:30)
    if (!time || !time.match(/^\d{2}:\d{2}:\d{2}$/)) {
        showErrorMessage("시간을 '00:00:00' 형식으로 입력해주세요.");
        return;
    }
    if (!text) {
        showErrorMessage("발화 내용을 입력해주세요.");
        return;
    }

    // 2. 새 발화 객체 생성
    const newTranscript = {
        speaker: speaker,
        time: time,
        text: text,
        isDeleted: false // 기본값
    };

    // 3. 데이터에 추가
    meetingData.transcripts.push(newTranscript);

    // 4. [중요] 시간순으로 재정렬
    meetingData.transcripts.sort((a, b) => {
        return a.time.localeCompare(b.time);
    });

    // 5. UI 새로고침 및 모달 닫기
    displayTranscripts();
    checkMappingCompletion(); // 통계 업데이트
    closeAddTranscriptModal();
    showSuccessMessage("새 발화 로그가 추가되었습니다.");
}

function editTranscript(index) {
  if (currentEditingTranscriptIndex !== -1) {
      cancelTranscriptEdit(currentEditingTranscriptIndex);
  }
  currentEditingTranscriptIndex = index;

  const item = document.querySelector(`.transcript-item[data-index="${index}"]`);
  const textDiv = item.querySelector(".transcript-text");
  const originalText = meetingData.transcripts[index].text;

  const uniqueSpeakers = [...new Set(meetingData.transcripts.map(t => t.speaker))].sort();
  const currentSpeaker = meetingData.transcripts[index].speaker;

  let speakerOptions = uniqueSpeakers.map(speaker =>
    `<option value="${speaker}" ${speaker === currentSpeaker ? 'selected' : ''}>
      ${speakerMappingData[speaker] || speaker}
    </option>`
  ).join('');

  textDiv.innerHTML = `
      <div class="form-group" style="margin-bottom: 8px;">
        <label class="form-label" style="font-size: 12px; font-weight: 600;">발화자 변경</label>
        <select class="form-select" id="transcript-speaker-editor-${index}">
          ${speakerOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" style="font-size: 12px; font-weight: 600;">내용 수정</label>
        <textarea class="summary-editor" id="transcript-text-editor-${index}" style="width: 100%; padding: 8px; border: 2px solid #8E44AD; border-radius: 8px; font-size: 15px; line-height: 1.7; resize: vertical; min-height: 60px; margin-top: 0;">${originalText}</textarea>
      </div>
      <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px;">
          <button class="btn btn-secondary" onclick="cancelTranscriptEdit(${index})">취소</button>
          <button class="btn btn-primary" onclick="saveTranscriptEdit(${index})">저장</button>
      </div>
  `;
  const editor = document.getElementById(`transcript-text-editor-${index}`);
  editor.focus();
}

function saveTranscriptEdit(index) {
  const speakerEditor = document.getElementById(`transcript-speaker-editor-${index}`);
  const textEditor = document.getElementById(`transcript-text-editor-${index}`);

  const newSpeaker = speakerEditor.value;
  const newText = textEditor.value.trim();

  if (!newText) {
      showErrorMessage("내용을 입력해주세요.");
      return;
  }

  meetingData.transcripts[index].text = newText;
  meetingData.transcripts[index].speaker = newSpeaker;

  currentEditingTranscriptIndex = -1;

  displayTranscripts();
  checkMappingCompletion();

  showSuccessMessage("발화 로그가 수정되었습니다.");
}

/**
 * 발화 로그를 '삭제' 상태로 만듭니다. (isDeleted = true)
 */
function deleteTranscript(index) {
  if (!meetingData || !meetingData.transcripts[index]) return;

  // 1. 데이터를 '삭제' 상태로 변경
  meetingData.transcripts[index].isDeleted = true;

  // 2. UI 새로고침 (가운데 줄, 복구 버튼 표시)
  displayTranscripts();

  // 3. (중요) AI 요약 생성/액션 추출은 '삭제되지 않은' 로그만 사용해야 하므로,
  //    이 기능들은 '삭제된' 로그를 반영하여 다시 실행해야 함을 알려야 합니다.
  //    (지금은 버튼 활성화 체크만 다시 합니다.)
  checkMappingCompletion();

  showErrorMessage("발화 로그가 삭제되었습니다. (복구 가능)");
}

/**
 * 발화 로그를 '복구'합니다. (isDeleted = false)
 */
function undoTranscript(index) {
  if (!meetingData || !meetingData.transcripts[index]) return;

  // 1. 데이터를 '복구' 상태로 변경
  meetingData.transcripts[index].isDeleted = false;

  // 2. UI 새로고침
  displayTranscripts();

  // 3. 매핑 상태 다시 체크
  checkMappingCompletion();

  showSuccessMessage("발화 로그가 복구되었습니다.");
}

function cancelTranscriptEdit(index) {
  currentEditingTranscriptIndex = -1;
  displayTranscripts();
}

function toggleDropdown() {
  const dropdown = document.getElementById("downloadDropdown");
  dropdown.classList.toggle("show");
}

document.addEventListener("click", (e) => {
  const dropdown = document.getElementById("downloadDropdown");
  const btn = document.getElementById("downloadBtn");
  if (dropdown && btn && !dropdown.contains(e.target) && !btn.contains(e.target)) {
    dropdown.classList.remove("show");
  }
});

function collectFinalData() {
  const filteredTranscripts = (meetingData.transcripts || []).filter(t => !t.isDeleted);

  const mappedTranscripts = filteredTranscripts.map(t => {
    const speakerName = speakerMappingData[t.speaker] || t.speaker;
    return {
      ...t,
      speaker: speakerName // 'speaker' 필드를 매핑된 이름으로 덮어쓰기
    };
  });

  const sortedSpeakerMapping = {};
  Object.keys(speakerMappingData)
    .sort((a, b) => {
      // "Speaker 1", "Speaker 2" ... "Speaker 10"을 숫자 기준으로 정렬
      const numA = parseInt(a.replace('Speaker ', ''), 10);
      const numB = parseInt(b.replace('Speaker ', ''), 10);
      return numA - numB;
    })
    .forEach(key => {
      sortedSpeakerMapping[key] = speakerMappingData[key];
    });

  return {
    ...meetingData,
    transcripts: mappedTranscripts,
    speakerMapping: sortedSpeakerMapping,
    actions: actionItems,
    createdAt: new Date().toISOString(),
  };
}

function exportJSON() {
  const dropdown = document.getElementById("downloadDropdown");
  if (dropdown) dropdown.classList.remove("show");
  
  const data = collectFinalData();
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${meetingData.title || "meeting"}.json`;
  a.click();
  showSuccessMessage("JSON 파일이 다운로드되었습니다.");
}

async function exportPDF() {
    const dropdown = document.getElementById("downloadDropdown");
    if (dropdown) dropdown.classList.remove("show");

    if (typeof jspdf === 'undefined') {
        showErrorMessage("PDF 라이브러리를 불러오는 데 실패했습니다.");
        return;
    }

    try {
        const fontResponse = await fetch('./static/fonts/NotoSansKR-Regular.ttf');
        if (!fontResponse.ok) {
            throw new Error('폰트 파일을 불러오는 데 실패했습니다.');
        }
        const fontBuffer = await fontResponse.arrayBuffer();

        const fontData = btoa(
            new Uint8Array(fontBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );

        const { jsPDF } = jspdf;
        const doc = new jsPDF();
        const data = collectFinalData();

        // 한글 폰트 설정
        doc.addFileToVFS('NotoSansKR-Regular.ttf', fontData);
        doc.addFont('NotoSansKR-Regular.ttf', 'NotoSansKR', 'normal');
        doc.setFont('NotoSansKR', 'normal');

        const pageHeight = doc.internal.pageSize.getHeight();
        const marginBottom = 20; // 하단 여백
        let currentY = 20;

        // --- 제목 및 메타 정보 ---
        doc.setFontSize(20);
        const titleText = doc.splitTextToSize(data.title || "회의록", 170);
        doc.text(titleText, 20, currentY, { lineHeightFactor: 1.3 });
        currentY += (titleText.length * 10 * 1.3);

        doc.setFontSize(12);
        currentY += 5;
        doc.text(`회의 일시: ${document.getElementById("meetingDate").textContent}`, 20, currentY);
        currentY += 7;
        doc.text(`회의 시간: ${document.getElementById("meetingDuration").textContent}`, 20, currentY);
        currentY += 7;
        doc.text(`참석자: ${data.participants.join(', ')}`, 20, currentY);

        // --- AI 요약 ---
        currentY += 15;
        doc.setFontSize(16);
        doc.text("AI 요약", 20, currentY);

        doc.setFontSize(12);
        currentY += 10;
        doc.text("회의 목적:", 20, currentY);
        currentY += 7;
        const purposeText = doc.splitTextToSize(data.purpose || "-", 170);
        doc.text(purposeText, 20, currentY, { lineHeightFactor: 1.5 });
        currentY += (purposeText.length * 7 * 1.5) + 5;

        doc.text("주요 안건:", 20, currentY);
        currentY += 7;
        const agendaText = doc.splitTextToSize(data.agenda || "-", 170);
        doc.text(agendaText, 20, currentY, { lineHeightFactor: 1.5 });
        currentY += (agendaText.length * 7 * 1.5) + 5;

        doc.text("전체 요약:", 20, currentY);
        currentY += 7;
        const summaryText = doc.splitTextToSize(data.summary || "-", 170);
        doc.text(summaryText, 20, currentY, { lineHeightFactor: 1.5 });
        currentY += (summaryText.length * 7 * 1.5) + 5;

        doc.text("회의 중요도:", 20, currentY);
        currentY += 7;
        const importanceText = `${data.importance?.level || "보통"} - ${data.importance?.reason || "분석되지 않음"}`;
        const importanceLines = doc.splitTextToSize(importanceText, 170);
        doc.text(importanceLines, 20, currentY, { lineHeightFactor: 1.5 });
        currentY += (importanceLines.length * 7 * 1.5);

        // --- 하이라이트 키워드 ---
        if (currentY + 30 > pageHeight - marginBottom) { 
            doc.addPage();
            currentY = 20; 
        }

        currentY += 15;
        doc.setFontSize(16);
        doc.text("하이라이트 키워드", 20, currentY);
        currentY += 10;
        
        doc.setFontSize(12);
        if (data.keywords && data.keywords.length > 0) {
            const keywordText = data.keywords.map(k => k.text).join(', ');
            const keywordLines = doc.splitTextToSize(keywordText, 170);
            
            doc.text(keywordLines, 20, currentY, { lineHeightFactor: 1.5 });
            currentY += (keywordLines.length * 7 * 1.5) + 5;
        } else {
            doc.text("추출된 하이라이트 키워드가 없습니다.", 20, currentY);
            currentY += 7;
        }

        // --- 액션 아이템 ---
        if (currentY + 30 > pageHeight - marginBottom) { 
            doc.addPage();
            currentY = 20;
        }
        
        currentY += 15; 
        doc.setFontSize(16);
        doc.text("액션 아이템", 20, currentY);
        currentY += 10;

        doc.setFontSize(12);
        if (data.actions && data.actions.length > 0) {
            data.actions.forEach((item, index) => {
                const itemText = `${index + 1}. ${item.title} (담당: ${item.assignee || '미지정'}, 기한: ${item.deadline || '미지정'})`;
                const splitText = doc.splitTextToSize(itemText, 170);

                const itemHeight = (splitText.length * 7 * 1.5) + 5; 

                if (currentY + itemHeight > pageHeight - marginBottom) {
                    doc.addPage();
                    currentY = 20;
                }

                doc.text(splitText, 20, currentY, { lineHeightFactor: 1.5 });
                currentY += itemHeight;
            });
        } else {
            doc.text("추가된 액션 아이템이 없습니다.", 20, currentY);
            currentY += 7;
        }

        // --- 실시간 변환 로그 추가 ---
        if (currentY + 30 > pageHeight - marginBottom) {
            doc.addPage();
            currentY = 20;
        }

        currentY += 15;
        doc.setFontSize(16);
        doc.text("실시간 변환 로그", 20, currentY);
        currentY += 10;

        doc.setFontSize(10);

        if (data.transcripts && data.transcripts.length > 0) {
            data.transcripts.forEach((item) => {
                const headerText = `[${item.time}] ${item.speaker}`;
                const contentText = item.text;

                const headerLines = doc.splitTextToSize(headerText, 170);
                const contentLines = doc.splitTextToSize(contentText, 165); 

                const itemHeight = (headerLines.length * 6 * 1.5) + (contentLines.length * 6 * 1.5) + 5;

                if (currentY + itemHeight > pageHeight - marginBottom) {
                    doc.addPage();
                    currentY = 20;
                }

                doc.setFont('NotoSansKR', 'normal'); 
                doc.text(headerLines, 20, currentY, { lineHeightFactor: 1.5 });
                currentY += (headerLines.length * 6 * 1.5);

                doc.setFont('NotoSansKR', 'normal');
                doc.text(contentLines, 25, currentY, { lineHeightFactor: 1.5 }); 
                currentY += (contentLines.length * 6 * 1.5) + 5; 
            });
        } else {
            doc.setFontSize(12);
            doc.text("실시간 변환 로그가 없습니다.", 20, currentY);
            currentY += 7;
        }

        doc.setFontSize(12);

        // 파일 저장
        doc.save(`${data.title || "meeting"}.pdf`);
        showSuccessMessage("PDF 파일이 다운로드되었습니다.");

    } catch (error) {
        console.error("PDF 생성 중 폰트 로드 오류:", error);
        showErrorMessage("PDF 생성 실패: 폰트 파일을 불러올 수 없습니다.");
    }
}

function saveMeeting() {
  const data = collectFinalData();
  localStorage.setItem("savedMeeting", JSON.stringify(data));
  showSuccessMessage("회의록이 저장되었습니다.");
}

/* AI 요약 버튼 활성화 체크 */
function checkMappingCompletion() {
    if (!meetingData || !meetingData.transcripts) return;

    // 1. 전체 발화자 목록 (중복 제거)
    const uniqueSpeakers = [...new Set(meetingData.transcripts.map(t => t.speaker))];
    // 2. 매핑된 발화자 수
    const mappedCount = uniqueSpeakers.filter(s => speakerMappingData[s]).length;

    // 3. 발화자가 1명 이상이고, 전체 수와 매핑된 수가 같은지 확인
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

// 발화자 매핑 저장 시 버튼 활성화
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

    // ✅ [추가] AI 요약 버튼 활성화 여부 체크
    checkMappingCompletion();
}


// ✅ 내 할 일만 추출 (담당자 표시 제거)
async function extractMyActions() {
    if (!meetingData || !meetingData.transcripts) {
        showErrorMessage("회의 데이터가 없습니다.");
        return;
    }
    
    showLoadingMessage("내 할 일을 추출하는 중...");
    
    try {
        const response = await fetch('http://localhost:3000/api/meeting/extract-all-actions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transcripts: meetingData.transcripts.filter(t => !t.isDeleted),
                speakerMapping: speakerMappingData,
                meetingDate: meetingData.date
            })
        });
        
        if (!response.ok) {
            throw new Error(`서버 오류: ${response.status}`);
        }
        
        const data = await response.json();
        
        hideLoadingMessage();
        
        if (data.success) {
            // 내 것만 필터링
            const aiMyActions = (data.actions || []).filter(action => action.assignee === currentUserName);
            const userManualActions = (actionItems || []).filter(item => item.source === 'user');
            actionItems = [...userManualActions, ...aiMyActions];

            if (aiMyActions.length > 0) {
                showSuccessMessage(`${aiMyActions.length}개의 할 일이 추출되었습니다!`);
            } else if (userManualActions.length > 0) {
                showSuccessMessage("AI가 추가로 추출한 할 일은 0개입니다.");
            } else {
                showErrorMessage("회원님이 담당하는 액션 아이템이 없습니다.");
            }
            meetingData.actions = actionItems;
            renderActionItems();

            // ✅ 추출 완료 후 안내 문구 숨기기
            const infoText = document.getElementById('actionInfoText');
            if (infoText) {
                infoText.style.display = 'none';
            }
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        hideLoadingMessage();
        console.error('내 할 일 추출 실패:', error);
        showErrorMessage('할 일 추출에 실패했습니다.');
    }
}

function showLoadingMessage(msg) {
    const div = document.createElement("div");
    div.id = "loadingToast";
    div.textContent = msg;
    Object.assign(div.style, {
        position: "fixed",
        top: "24px",
        right: "24px",
        background: "#8E44AD",
        color: "#fff",
        padding: "12px 20px",
        borderRadius: "8px",
        zIndex: "9999",
    });
    document.body.appendChild(div);
}

function hideLoadingMessage() {
    const toast = document.getElementById("loadingToast");
    if (toast) toast.remove();
}

/* 초기화 */
document.addEventListener("DOMContentLoaded", () => {
  let userSettings = {};
  try {
    userSettings = JSON.parse(localStorage.getItem('userSettings')) || {};

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

  fetch("components/sidebar.html")
    .then(res => res.text())
    .then(html => {
      const sidebar = document.getElementById("sidebar-container");
      sidebar.innerHTML = html;

      // 'active' 페이지 로직
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

      // app.js의 loadCurrentUser() 함수를 호출하여 프로필 정보 주입
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

  const stored = localStorage.getItem("lastMeeting");
  if (stored) {
      meetingData = JSON.parse(stored);
      loadMeetingData();
      checkMappingCompletion();
  } else {
      meetingData = {
          "title": "신규 E-Commerce 플랫폼 킥오프 회의",
          "date": new Date().toISOString(),
          "duration": 3120, // 52분
          "participants": [
              "김민준 (PM)",
              "이수진 (백엔드)",
              "박현우 (프론트)",
              "최유리 (DBA)",
              "정태영 (보안)"
          ],
          "transcripts": [
              { "speaker": "Speaker 1", "time": "00:00:15", "text": "안녕하세요, 오늘 킥오프 회의 시작하겠습니다. 먼저 프로젝트 전체 **일정**과 **주요 마일스톤**에 대해 공유 드립니다." },
              { "speaker": "Speaker 2", "time": "00:01:30", "text": "PM님, **Spring Boot** 기반의 마이크로서비스 아키텍처(MSA)로 설계 방향은 잡혔는데, 서비스 간 **API 인증**은 어떻게 처리할 계획인가요?" },
              { "speaker": "Speaker 3", "time": "00:02:45", "text": "프론트 입장에서는 **API 명세**가 빨리 나와야 개발 착수가 가능합니다. **Swagger** 같은 툴로 공유 주실 수 있나요?" },
              { "speaker": "Speaker 1", "time": "00:03:50", "text": "네, 인증은 **OAuth 2.0**과 **JWT** 토큰 기반으로 가려고 합니다. 정태영 님, 이 부분 **보안 검토**가 필요합니다." },
              { "speaker": "Speaker 5", "time": "00:04:30", "text": "알겠습니다. **JWT** 토큰의 만료 시간과 리프레시 토큰 정책을 명확히 해야 **보안 취약점**이 생기지 않습니다. 다음 주까지 가이드라인 마련해서 공유할게요." },
              { "speaker": "Speaker 4", "time": "00:05:55", "text": "데이터베이스 측면에서는, **ERD** 초안을 공유 드렸습니다. 주문-결제-배송 간의 **데이터 정합성**이 **critical**합니다. 특히 **트랜잭션** 관리가 중요해요." },
              { "speaker": "Speaker 2", "time": "00:07:10", "text": "맞습니다. MSA 환경이라 **분산 트랜잭션** 처리가 필요한데, **Saga 패턴**을 도입하는 건 어떨까요? 구현 복잡도가 좀 있긴 합니다." },
              { "speaker": "Speaker 4", "time": "00:08:20", "text": "Saga 패턴 좋네요. 다만 **데이터베이스 부하**가 예상되니, **주문 테이블**은 **인덱스** 설계를 신중하게 해야 합니다. **쿼리 성능**이 중요합니다." },
              { "speaker": "Speaker 3", "time": "00:09:40", "text": "프론트에서는 **React**와 **Next.js**를 사용해 **SSR(서버 사이드 렌더링)**을 구현할 예정입니다. 초기 로딩 속도 개선이 목표입니다." },
              { "speaker": "Speaker 1", "time": "00:10:35", "text": "좋습니다. **일정**을 다시 정리하죠. 1차 스프린트는 2주 뒤로 잡고, 백엔드는 **API 명세** 완료, 프론트는 **UI/UX 와이어프레임** 확정을 목표로 합시다." },
              { "speaker": "Speaker 2", "time": "00:11:50", "text": "이수진입니다. **API 명세**는 Swagger로 정리해서 이번 주 금요일까지 공유하겠습니다." },
              { "speaker": "Speaker 4", "time": "00:12:30", "text": "DBA입니다. **ERD** 리뷰는 다음 주 월요일 오후 2시에 별도 미팅 요청드립니다. 백엔드 개발팀 필참입니다." },
              { "speaker": "Speaker 3", "time": "00:13:10", "text": "프론트팀은 와이어프레임 확정 후 **컴포넌트** 설계에 들어가겠습니다. **디자인 시스템**이 먼저 정의되어야 합니다." },
              { "speaker": "Speaker 5", "time": "00:14:05", "text": "보안팀에서는 다음 주까지 **OAuth 2.0** 관련 **보안 가이드**를 배포하겠습니다. 개인정보 **암호화** 정책도 포함입니다." },
              { "speaker": "Speaker 1", "time": "00:15:00", "text": "네, 모두 수고하셨습니다. 각자 **액션 아이템** 잘 챙겨주시고, 이슈 발생 시 즉시 공유 바랍니다." }
          ],

          "actions": [],

          "keywords": []
      };
      
      loadMeetingData();
      checkMappingCompletion();
  }
});