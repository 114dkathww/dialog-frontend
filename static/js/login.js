/* ===============================
    Longin & Signup 탭 변환
=================================*/
// 탭 요소와 폼, 컨테이너 선택
const signinTab = document.getElementById('signinTab');
const signupTab = document.getElementById('signupTab');
const signinForm = document.getElementById('signinForm');
const signupForm = document.getElementById('signupForm');
const authContainer = document.querySelector('.auth-container');

 // 로그인 탭 클릭 시
signinTab.addEventListener('click', function() {
    // 로그인 탭 활성화
    signinTab.classList.add('active');
    signupTab.classList.remove('active');
    signinForm.classList.add('active');
    signupForm.classList.remove('active');
    // 전체 컨테이너에서 signup 모드 제거 (디자인 전환용)
    authContainer.classList.remove('signup-mode');
    hideAlerts(); // 기존 알림 숨김
});

// 회원가입 탭 클릭 시
signupTab.addEventListener('click', function() {
    // 회원가입 탭 활성화
    signupTab.classList.add('active');
    signinTab.classList.remove('active');
    signupForm.classList.add('active');
    signinForm.classList.remove('active');
    // signup 모드 추가 (디자인 전환용)
    authContainer.classList.add('signup-mode');
    hideAlerts(); // 기존 알림 숨김
});

/* ===============================
    비밀번호 표시/숨기기 기능
=================================*/
// 비밀번호 표시/숨기기 - SVG 아이콘 전환
const passwordToggles = document.querySelectorAll('.password-toggle');

passwordToggles.forEach(toggle => {
    toggle.addEventListener('click', function() {
        const targetId = this.getAttribute('data-target'); // 연결된 input ID
        const input = document.getElementById(targetId);
        const eyeIcon = this.querySelector('.eye-icon'); // 눈 열림 아이콘
        const eyeOffIcon = this.querySelector('.eye-off-icon'); // 눈 닫힘 아이콘
        
        // 비밀번호 토글
        if (input.type === 'password') {
            input.type = 'text';
            eyeIcon.style.display = 'none';
            eyeOffIcon.style.display = 'block';
        } else {
            input.type = 'password';
            eyeIcon.style.display = 'block';
            eyeOffIcon.style.display = 'none';
        }
    });
});

/* ===============================
    팝업 알림 (회원가입 결과 등)
=================================*/

// 알림 표시 함수
function showAlert(message, type) {
    const errorAlert = document.getElementById('errorAlert');
    const successAlert = document.getElementById('successAlert');
    
    hideAlerts(); // 기존 알림 숨김

    // 알림 종류 선택 (error 또는 success)
    const alert = type === 'error' ? errorAlert : successAlert;
    alert.textContent = message;
    alert.classList.add('show'); // CSS 애니메이션 or 표시 클래스 추가
    
    // 3초 후 자동 숨김
    setTimeout(hideAlerts, 3000);
}

// 알림 숨김 함수
function hideAlerts() {
    const errorAlert = document.getElementById('errorAlert');
    const successAlert = document.getElementById('successAlert');
    
    errorAlert.classList.remove('show');
    successAlert.classList.remove('show');
}

/* ===============================
    로그인 폼 제출 처리 -> Spring
=================================*/
/* 로그인 폼 제출 처리 추가된 부분*/
signinForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('signin-email').value.trim();
    const password = document.getElementById('signin-password').value;
    const resultDiv = document.getElementById('result') || document.createElement('div');
    resultDiv.textContent = "";
    
    if (!email || !password) {
        resultDiv.textContent = '이메일과 비밀번호를 모두 입력하세요.';
        return;
    }
    
    try {
        const response = await fetch('http://localhost:8080/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
            credentials: 'include' // <-- 이 줄 추가!
        });
        const data = await response.json();

        if (response.ok && data.token) {
            // localStorage 저장은 제거해도 됨 (쿠키 인증만 씀)
            alert('로그인 성공!');
            window.location.href = '/home.html'; 
        } else {
            alert('로그인 실패: ' + (data.message || '알 수 없는 오류'));
        }
    } catch (error) {
        alert('네트워크 오류 또는 서버 오류: ' + error.message);
    }
});


/* ===============================
    회원가입 폼 제출 처리 
 ===============================*/
signupForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    // 기존 유효성 검사 유지
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;
    const terms = document.getElementById('terms').checked;
    if (!name || !email || !password || !confirm) {
        alert('모든 필드를 입력해주세요.');
        return;
    }
    if (password !== confirm) {
        alert('비밀번호가 일치하지 않습니다.');
        return;
    }
    if (!terms) {
        alert('약관에 동의해주세요.');
        return;
    }

    try {
        const response = await fetch('http://localhost:8080/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, terms })
        });
        const data = await response.json();
        if (response.ok && data.success) {
            alert('회원가입 성공! 로그인 페이지로 이동합니다.');
            signinTab.click();
            signupForm.reset();
        } else {
            alert('회원가입 실패: ' + (data.message || '오류'));
        }
    } catch (error) {
        alert('서버 오류: ' + error.message);
    }
});

/* ===============================
    회원가입 폼 제출 처리 -> Spring
=================================*/
signupForm.addEventListener('submit', function(e) {
    e.preventDefault(); // 기본 제출 방지
    
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;
    const terms = document.getElementById('terms').checked;
    
    // 필수 필드 검증
    if (!name || !email || !password || !confirm) {
        showAlert('모든 필드를 입력해주세요.', 'error');
        return;
    }
    
    // 이름 길이 검증
    if (name.trim().length < 2) {
        showAlert('이름은 2자 이상 입력해주세요.', 'error');
        return;
    }
    
    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showAlert('올바른 이메일 형식을 입력해주세요.', 'error');
        return;
    }
    
    // 비밀번호 길이 검증
    if (password.length < 12) {
        showAlert('비밀번호는 12자 이상 입력해주세요.', 'error');
        return;
    }
    
    // 비밀번호 일치 검증
    if (password !== confirm) {
        showAlert('비밀번호가 일치하지 않습니다.', 'error');
        return;
    }
    
    // 약관 동의 검증
    if (!terms) {
        showAlert('이용약관에 동의해주세요.', 'error');
        return;
    }
    
    // 유효성 검사 통과
    // terms 가 DTO 에 NotNull 로 존재하기 때문에 추가 필요
    console.log('회원가입 시도:', { name, email, password, terms });
    
    //실제 API 호출은 여기에 구현
    fetch('http://localhost:8080/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // terms 가 DTO 에 NotNull 로 존재하기 때문에 추가 필요
        body: JSON.stringify({ name, email, password, terms })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert('회원가입 성공!', 'success');
            setTimeout(() => {
                signinTab.click();
                signupForm.reset();
            }, 2000);
        } else {
            showAlert(data.message, 'error');
        }
    });

});

// JWT 토큰 발급하여 소셜 로그인 구현 코드 20일 수정
function openSocialLogin(url) {
  alert("소셜로그인 확인")
  const width = 600;
  const height = 700;
  const left = (window.innerWidth - width) / 2;
  const top = (window.innerHeight - height) / 2;

  const popup = window.open(url, 'socialLogin', `width=${width},height=${height},left=${left},top=${top}`);

  window.addEventListener('message', (event) => {
    // 보안 위해 도메인 체크 (예: localhost)
    alert("이벤트 동작 확인")
    if (event.origin !== window.location.origin) return;

    const { token, user } = event.data;
    if (token) {
      localStorage.setItem('jwtToken', token);
      alert("로그인 완료1")
    }
    if (user) {
      console.log(JSON.stringify(user))
      localStorage.setItem('user', JSON.stringify(user));
      alert("사용자 정보")
    }
    popup.close();
    // 로그인 성공 후 명확한 페이지 이동 권장
    window.location.href = '/home.html';
  });
}

// 소셜 로그인 버튼 클릭시, 바로 현재창에서 백엔드 OAuth2 경로로 이동
googleLoginBtn.addEventListener('click', () => {
  window.location.href = 'http://localhost:8080/oauth2/authorization/google';
});

kakaoLoginBtn.addEventListener('click', () => {
  window.location.href = 'http://localhost:8080/oauth2/authorization/kakao';
});

// Google 회원가입 - 메시지 없이 처리
const googleSignupBtn = document.getElementById('googleSignupBtn');
googleSignupBtn.addEventListener('click', function() {
    console.log('Google 회원가입 시작');
    
    // Google OAuth 2.0 회원가입 구현
    // Google API 에 인증 요청을 보내려면 이렇게 작성해야함
    window.location.href = 'http://localhost:8080/oauth2/authorization/google';
});

// 카카오 회원가입 추가
const kakaoSignupBtn = document.getElementById('kakaoSignupBtn');
kakaoSignupBtn.addEventListener('click', function() {
    console.log('KaKao 회원가입 시작');
    
    // KaKao OAuth 2.0 회원가입 구현
    window.location.href = 'http://localhost:8080/oauth2/authorization/kakao';
});

// Enter 키로 다음 필드 이동
document.querySelectorAll('input').forEach(input => {
    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && this.type !== 'submit' && this.type !== 'checkbox') {
            const form = this.closest('form');
            const inputs = Array.from(form.querySelectorAll('input:not([type="checkbox"])'));
            const index = inputs.indexOf(this);
            
            if (index < inputs.length - 1) {
                e.preventDefault();
                inputs[index + 1].focus();
            }
        }
    });
});

// 페이지 로드 시 첫 번째 입력 필드에 포커스
window.addEventListener('load', function() {
    const firstInput = document.querySelector('#signinForm input[type="email"]');
    if (firstInput) {
        firstInput.focus();
    }
});