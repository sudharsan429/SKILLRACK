/* ========================================================
   SKILLRACK Full-Stack Application Client
   Connected to Flask REST APIs & SQLite Database
   ======================================================== */

const roles = {
  student: {
    name: 'Student',
    email: 'student@demo.com',
    person: 'Alex Morgan',
    items: [
      ['Dashboard','▦'],
      ['Daily Challenge','☀'],
      ['Problem Bank','▤'],
      ['Topic Practice','◈'],
      ['Code Editor','⌘'],
      ['My Submissions','↗'],
      ['Leaderboard','♛'],
      ['My Progress','▥'],
      ['My Profile','◎'],
      ['Settings','⚙']
    ]
  },
  faculty: {
    name: 'Faculty',
    email: 'faculty@demo.com',
    person: 'Dr. Priya Kumar',
    items: [
      ['Dashboard','▦'],
      ['Student Management','♙'],
      ['Problem Assignment','▤'],
      ['Scheduled Tests','◷'],
      ['Batch Performance','▥'],
      ['Weak Students','⚑'],
      ['Submission Reports','↗'],
      ['Analytics','◫'],
      ['My Profile','◎'],
      ['Settings','⚙']
    ]
  },
  admin: {
    name: 'College Admin',
    email: 'admin@demo.com',
    person: 'Karthik Raman',
    items: [
      ['Dashboard','▦'],
      ['Department Management','▦'],
      ['Batch Management','▤'],
      ['Student Management','♙'],
      ['Faculty Management','♟'],
      ['Bulk Student Import','⇧'],
      ['College Reports','◫'],
      ['Settings','⚙']
    ]
  },
  super: {
    name: 'Super Admin',
    email: 'super@demo.com',
    person: 'Platform Admin',
    items: [
      ['Dashboard','▦'],
      ['College Management','▦'],
      ['User Management','♙'],
      ['Problem Bank Management','▤'],
      ['Licence Management','◷'],
      ['Platform Analytics','◫'],
      ['System Monitoring','⌁'],
      ['Settings','⚙']
    ]
  }
};

let currentUser = null;
let role = 'student';
let current = 'Dashboard';

// Client cache state synced with SQLite
let data = {
  points: 420,
  solved: 18,
  streak: 6,
  accuracy: '86%',
  rank: 3,
  submissions: [],
  students: [],
  faculty: [],
  colleges: [],
  departments: [],
  batches: [],
  problems: [],
  today_challenge: null,
  weekly_activity: [],
  topic_progress: []
};

let currentProblem = null;
let activeTestId = null;
let testTimerInterval = null;
let pendingParsedCSV = [];
let pendingRawCSV = '';
let lbScope = 'college';
let lbTimeframe = 'all';
let lbSearchQuery = '';
let lbRoster = [];

/* ========================================================
   UTILITY & TOAST NOTIFICATIONS
   ======================================================== */
function toast(s) {
  const r = document.getElementById('toastRoot');
  if (!r) return;
  const div = document.createElement('div');
  div.className = 'toast';
  div.innerHTML = esc(s) + '<div class="toast-bar"></div>';
  r.appendChild(div);
  setTimeout(() => {
    div.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    div.style.opacity = '0';
    div.style.transform = 'translateY(12px) scale(0.95)';
    setTimeout(() => div.remove(), 260);
  }, 2600);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function flameIcon() {
  return `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="vertical-align:text-bottom;display:inline-block;">
      <path d="M12 2C11 5 8 8 8 11.5C8 14 10 16 10 18C8 18 6 16.5 6 14C4 16 3 18 3 20C3 22 7 24 12 24C17 24 21 22 21 20C21 16 17.5 13 17.5 13C17 10 14.5 7 12 2Z" fill="url(#flameGrad1)"/>
      <path d="M12 13C11 14 11 15 11.5 16C12 17 13 17.5 14 17C14.5 16.5 14.5 15.5 14 14C13.5 13 12.5 12.5 12 13Z" fill="url(#flameGrad2)"/>
      <defs>
        <linearGradient id="flameGrad1" x1="12" y1="2" x2="14" y2="19" gradientUnits="userSpaceOnUse">
          <stop stop-color="#f59e0b"/>
          <stop offset="1" stop-color="#dc2626"/>
        </linearGradient>
        <linearGradient id="flameGrad2" x1="12" y1="12" x2="14" y2="18" gradientUnits="userSpaceOnUse">
          <stop stop-color="#fef08a"/>
          <stop offset="1" stop-color="#f97316"/>
        </linearGradient>
      </defs>
    </svg>
  `;
}

/* ========================================================
   AUTHENTICATION & SESSION MANAGEMENT
   ======================================================== */
async function checkSession() {
  try {
    const res = await fetch('/api/session');
    const json = await res.json();
    if (json.authenticated && json.user) {
      currentUser = json.user;
      role = json.user.role;
      if (json.user.theme) {
        document.documentElement.setAttribute('data-theme', json.user.theme);
      }
      openApp();
      return true;
    }
  } catch(e) {
    console.warn('Session check failed:', e);
  }
  document.getElementById('login').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  return false;
}

// Interactive Role Dropdown Selector
function onLoginRoleChange(targetRole) {
  const loginRoleSelect = document.getElementById('loginRoleSelect');
  if (loginRoleSelect && loginRoleSelect.value !== targetRole) {
    loginRoleSelect.value = targetRole;
  }

  const btnText = document.getElementById('loginBtnText');

  if (roles[targetRole]) {
    if (btnText) btnText.textContent = `Sign in as ${roles[targetRole].name} →`;
    toast(`Selected ${roles[targetRole].name} role`);
  }
}

// Backward-compatible alias
function selectDemoRole(targetRole) {
  onLoginRoleChange(targetRole);
}

function onCredentialEdit() {
  const val = document.getElementById('loginId') ? document.getElementById('loginId').value.trim() : '';
  const btnText = document.getElementById('loginBtnText');
  const loginRoleSelect = document.getElementById('loginRoleSelect');

  let matchedRole = null;
  ['student', 'faculty', 'admin', 'super'].forEach(r => {
    if (roles[r] && roles[r].email.toLowerCase() === val.toLowerCase()) {
      matchedRole = r;
    }
  });

  if (matchedRole) {
    if (loginRoleSelect) loginRoleSelect.value = matchedRole;
    if (btnText) btnText.textContent = `Sign in as ${roles[matchedRole].name} →`;
  } else {
    if (btnText) btnText.textContent = 'Sign in to Workspace →';
  }
}

// Quick Login fills credentials and executes authenticated POST /api/login
async function quickLogin(targetRole) {
  selectDemoRole(targetRole);
  if (roles[targetRole]) {
    await executeLogin(roles[targetRole].email, 'demo123');
  }
}

// Password visibility - strictly keep masked as hidden password
function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.type = 'password';
}

function clearLoginInputs() {
  const loginId = document.getElementById('loginId');
  const loginPass = document.getElementById('loginPass');
  if (loginId) loginId.value = '';
  if (loginPass) loginPass.value = '';
}

function clearRegisterInputs() {
  const ids = [
    'regName', 'regEmail', 'regPass', 'regConfirmPass',
    'regRoll', 'regFacultyCode', 'regAdminCode', 'regSuperCode',
    'regCollege', 'regSuperTitle'
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const matchIcon = document.getElementById('pwdMatchIcon');
  if (matchIcon) matchIcon.classList.add('hidden');
}

window.clearLoginInputs = clearLoginInputs;
window.clearRegisterInputs = clearRegisterInputs;

document.addEventListener('DOMContentLoaded', () => {
  ['loginPass', 'regPass', 'regConfirmPass'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.type = 'password';
      el.setAttribute('autocomplete', id === 'loginPass' ? 'current-password' : 'new-password');
      el.addEventListener('input', () => { el.type = 'password'; });
    }
  });
});

// Live password match verification indicator in registration
function checkPasswordMatch() {
  const p1 = document.getElementById('regPass') ? document.getElementById('regPass').value : '';
  const p2 = document.getElementById('regConfirmPass') ? document.getElementById('regConfirmPass').value : '';
  const badge = document.getElementById('pwdMatchIcon');
  if (!badge) return;
  if (p1 && p2 && p1 === p2 && p1.length >= 4) {
    badge.classList.remove('hidden');
    badge.style.background = '#dcfce7';
    badge.style.color = '#15803d';
    badge.textContent = '✓ Match';
  } else if (p2 && p1 !== p2) {
    badge.classList.remove('hidden');
    badge.style.background = '#fee2e2';
    badge.style.color = '#b91c1c';
    badge.textContent = '✕ Mismatch';
  } else {
    badge.classList.add('hidden');
  }
}

document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const email = document.getElementById('loginId').value.trim();
  const pass = document.getElementById('loginPass').value;
  await executeLogin(email, pass);
});

async function executeLogin(identifier, password) {
  const submitBtn = document.getElementById('btnLoginSubmit') || document.querySelector('#loginForm button');
  const btnText = document.getElementById('loginBtnText');
  const origText = btnText ? btnText.textContent : 'Sign in to Workspace →';
  const roleSelect = document.getElementById('loginRoleSelect');
  const selectedRole = roleSelect ? roleSelect.value : 'student';

  const assist = document.getElementById('loginAuthAssist');
  if (assist) assist.style.display = 'none';

  if (submitBtn) {
    submitBtn.disabled = true;
    if (btnText) btnText.textContent = 'Authenticating with Flask...';
    else submitBtn.textContent = 'Authenticating with Flask...';
  }

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password, role: selectedRole, auto_create: true })
    });
    const json = await res.json();

    if (json.success && json.user) {
      currentUser = json.user;
      role = json.user.role;
      openApp();
      toast(json.message || 'Welcome back, ' + currentUser.name + '!');
    } else if (json.user_exists) {
      // User exists with a different password - show one-click update helper
      if (assist) {
        assist.style.display = 'flex';
        const msg = document.getElementById('loginAuthAssistMsg');
        if (msg) msg.textContent = `Existing account detected (${json.email}). Sign in with this password?`;
      }
      toast(json.error || 'Password mismatch. Click "Update & Sign In" to set your new password.');
    } else {
      toast(json.error || 'Invalid credentials. Please verify your email and password.');
    }
  } catch(err) {
    toast('Server connection error. Please verify the Flask backend is running.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      if (btnText) btnText.textContent = origText;
      else submitBtn.textContent = 'Sign in to Workspace →';
    }
  }
}

async function quickUpdatePasswordAndLogin() {
  const identifier = document.getElementById('loginId') ? document.getElementById('loginId').value.trim() : '';
  const password = document.getElementById('loginPass') ? document.getElementById('loginPass').value : '';
  const roleSelect = document.getElementById('loginRoleSelect');
  const selectedRole = roleSelect ? roleSelect.value : 'student';

  if (!identifier || !password) {
    toast('Please enter both email and password.');
    return;
  }

  const assist = document.getElementById('loginAuthAssist');
  if (assist) assist.style.display = 'none';

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password, role: selectedRole, allow_password_update: true })
    });
    const json = await res.json();
    if (json.success && json.user) {
      currentUser = json.user;
      role = json.user.role;
      openApp();
      toast(json.message || 'Password updated and signed in!');
    } else {
      toast(json.error || 'Failed to authenticate.');
    }
  } catch(e) {
    toast('Connection error during authentication.');
  }
}
window.quickUpdatePasswordAndLogin = quickUpdatePasswordAndLogin;

// Interactive Auth Tab Switcher (Sign In vs Register)
function switchAuthTab(tab) {
  const btnSign = document.getElementById('tabBtnSignIn');
  const btnReg = document.getElementById('tabBtnRegister');
  const secSign = document.getElementById('loginSection');
  const secReg = document.getElementById('registerSection');

  if (tab === 'register') {
    if (btnSign) btnSign.classList.remove('active');
    if (btnReg) btnReg.classList.add('active');
    if (secSign) secSign.classList.add('hidden');
    if (secReg) secReg.classList.remove('hidden');
    clearRegisterInputs();
  } else {
    if (btnSign) btnSign.classList.add('active');
    if (btnReg) btnReg.classList.remove('active');
    if (secSign) secSign.classList.remove('hidden');
    if (secReg) secReg.classList.add('hidden');
    clearLoginInputs();
  }
}

// Interactive Role Dropdown for Registration
function selectRegRole(targetRole) {
  const regRoleInput = document.getElementById('regRole');
  if (regRoleInput) regRoleInput.value = targetRole;

  const regRoleSelect = document.getElementById('regRoleSelect');
  if (regRoleSelect && regRoleSelect.value !== targetRole) {
    regRoleSelect.value = targetRole;
  }

  const stuFields = document.getElementById('studentFields');
  const facFields = document.getElementById('facultyFields');
  const admFields = document.getElementById('adminFields');
  const supFields = document.getElementById('superFields');

  if (stuFields) stuFields.classList.toggle('hidden', targetRole !== 'student');
  if (facFields) facFields.classList.toggle('hidden', targetRole !== 'faculty');
  if (admFields) admFields.classList.toggle('hidden', targetRole !== 'admin');
  if (supFields) supFields.classList.toggle('hidden', targetRole !== 'super');

  const regBtnText = document.querySelector('#btnRegisterSubmit span');
  if (regBtnText && roles[targetRole]) {
    regBtnText.textContent = `Register as ${roles[targetRole].name} →`;
  }
}

// Registration Form Submission Handler
const regForm = document.getElementById('registerForm');
if (regForm) {
  regForm.addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const pass = document.getElementById('regPass').value;
    let confirmPass = document.getElementById('regConfirmPass').value;
    const selectedRole = document.getElementById('regRole').value || 'student';

    if (!name || !email) {
      toast('Please provide your full name and email address.');
      return;
    }

    if (!pass) {
      toast('Please enter a password.');
      return;
    }

    if (!confirmPass) {
      confirmPass = pass;
    } else if (pass !== confirmPass) {
      toast('Passwords do not match. Please verify your password confirmation.');
      return;
    }

    let department = 'CSE';
    let batch = '2024-A';
    let college = 'Inovate Institute of Technology';
    let rollNumber = '';

    if (selectedRole === 'student') {
      department = document.getElementById('regDept') ? document.getElementById('regDept').value : 'CSE';
      batch = document.getElementById('regBatch') ? document.getElementById('regBatch').value : '2024-A';
      rollNumber = document.getElementById('regRoll') ? document.getElementById('regRoll').value.trim() : '';
    } else if (selectedRole === 'faculty') {
      department = document.getElementById('regFacultyDept') ? document.getElementById('regFacultyDept').value : 'CSE';
      rollNumber = document.getElementById('regFacultyCode') ? document.getElementById('regFacultyCode').value.trim() : '';
    } else if (selectedRole === 'admin') {
      college = document.getElementById('regCollege') ? document.getElementById('regCollege').value.trim() : 'Inovate Institute of Technology';
      rollNumber = document.getElementById('regAdminCode') ? document.getElementById('regAdminCode').value.trim() : '';
    } else if (selectedRole === 'super') {
      rollNumber = document.getElementById('regSuperCode') ? document.getElementById('regSuperCode').value.trim() : '';
    }

    const submitBtn = document.getElementById('btnRegisterSubmit');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Registering verified account...';
    }

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          email: email,
          password: pass,
          role: selectedRole,
          department: department,
          batch: batch,
          college: college,
          roll_number: rollNumber,
          allow_update: true
        })
      });

      const json = await res.json();

      if (json.success && json.user) {
        currentUser = json.user;
        role = json.user.role;
        openApp();
        toast(json.message || `Welcome to SKILLRACK, ${currentUser.name}! (${roles[role].name})`);
      } else {
        toast(json.error || 'Registration failed. Please check your information.');
      }
    } catch(err) {
      toast('Network error during registration. Please verify the Flask server is running.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Register & Access Workspace →';
      }
    }
  });
}

function openApp() {
  clearLoginInputs();
  clearRegisterInputs();
  document.getElementById('login').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  updateRoleUI();
  buildNav();
  render('Dashboard');
}

async function logout() {
  try {
    await fetch('/api/logout', { method: 'POST' });
  } catch(e) {}
  currentUser = null;
  clearLoginInputs();
  clearRegisterInputs();
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login').classList.remove('hidden');
  toast('Signed out from workspace.');
}

function switchRole(newRole) {
  // Prevent unauthorized role jumping
  if (currentUser && currentUser.role !== newRole) {
    toast('Access restricted: You are authenticated as ' + roles[currentUser.role].name + '. Log in as ' + roles[newRole].name + ' to switch workspace.');
    const topSel = document.getElementById('topRoleSelect');
    if (topSel) topSel.value = currentUser.role;
    return;
  }
  role = newRole;
  updateRoleUI();
  buildNav();
  render('Dashboard');
}

function updateRoleIndicator() {
  const topSel = document.getElementById('topRoleSelect');
  if (topSel && topSel.value !== role) {
    topSel.value = role;
  }
}

function updateRoleUI() {
  const r = roles[role] || roles.student;
  const personName = currentUser ? currentUser.name : r.person;
  const initial = (personName || 'U')[0].toUpperCase();

  document.getElementById('sideName').textContent = personName;
  document.getElementById('sideRole').textContent = r.name;
  document.getElementById('sideAvatar').textContent = initial;
  document.getElementById('topAvatar').textContent = initial;
  document.getElementById('roleLabel').textContent = r.name.toUpperCase() + ' WORKSPACE';

  const topSel = document.getElementById('topRoleSelect');
  if (topSel) topSel.value = role;
}

/* ========================================================
   SKILLRACK ICONS & MODULE HELPERS
   ======================================================== */
const iconSvg = {
  // 1. Laptop / Desktop Monitor (Learn C, Java, Python, SQL... & Lab Programs & System Health)
  laptop: `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="13" rx="2"/><line x1="2" y1="13" x2="22" y2="13"/><line x1="12" y1="16" x2="12" y2="20"/><line x1="7" y1="20" x2="17" y2="20"/></svg>`,
  
  // 2. Keyboard (Programming Challenges - Tracks, Problem Assignment)
  keyboard: `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2.5"/><line x1="6" y1="9" x2="6.01" y2="9" stroke-width="2.6"/><line x1="10" y1="9" x2="10.01" y2="9" stroke-width="2.6"/><line x1="14" y1="9" x2="14.01" y2="9" stroke-width="2.6"/><line x1="18" y1="9" x2="18.01" y2="9" stroke-width="2.6"/><line x1="6" y1="12.5" x2="6.01" y2="12.5" stroke-width="2.6"/><line x1="10" y1="12.5" x2="10.01" y2="12.5" stroke-width="2.6"/><line x1="14" y1="12.5" x2="14.01" y2="12.5" stroke-width="2.6"/><line x1="18" y1="12.5" x2="18.01" y2="12.5" stroke-width="2.6"/><line x1="7" y1="15.5" x2="17" y2="15.5" stroke-width="2.2"/></svg>`,
  
  // 3. Clock (Daily Challenge 24 Hours, Daily Test 10 PM, Scheduled Tests)
  clock: `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><polyline points="12 6.5 12 12 8.5 12" stroke-width="2.2"/></svg>`,
  
  // 4. Code (Programming Tests - Test Center, Test Engine)
  code: `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 8 3 12 7 16"/><polyline points="17 8 21 12 17 16"/><line x1="14" y1="4" x2="10" y2="20"/></svg>`,
  
  // 5. Globe (Live Assisted Coding Sessions - LACS, Colleges, Platforms)
  globe: `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><line x1="2.5" y1="12" x2="21.5" y2="12"/><path d="M12 2.5a15.3 15.3 0 0 1 4 9.5 15.3 15.3 0 0 1-4 9.5 15.3 15.3 0 0 1-4-9.5 15.3 15.3 0 0 1 4-9.5z"/></svg>`,
  
  // 6. Monitor (Lab Programs, Student Management)
  monitor: `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="13" rx="2"/><line x1="2" y1="13" x2="22" y2="13"/><line x1="12" y1="16" x2="12" y2="20"/><line x1="7" y1="20" x2="17" y2="20"/></svg>`,
  
  // 7. Code-Pad / Document (My Code-Pads Self Practice, Submissions, Reports)
  codepad: `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>`,
  
  // 8. Eye (View Programs Solved Count, Analytics, Performance)
  eye: `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/></svg>`,

  // Small icons for stat widgets:
  statProblems: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 8 3 12 7 16"/><polyline points="17 8 21 12 17 16"/><line x1="14" y1="4" x2="10" y2="20"/></svg>`,
  statTrophy: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2M6 3h12v7a6 6 0 0 1-12 0V3zM9 21h6M12 16v5"/></svg>`,
  statFlame: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A4.5 4.5 0 0 0 13 19a4.5 4.5 0 0 0 4.5-4.5c0-3-2.5-5.5-3.5-7.5-1 2-2 3.5-2.5 4.5-.5-1-1-2-1-3-1.5 2-2 4.5-2 6.5z"/></svg>`,
  statTarget: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  statUsers: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  statClock: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 8 12"/></svg>`,
  statBook: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="7" y1="15" x2="17" y2="15"/></svg>`,
  statBuilding: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="9" y1="22" x2="9" y2="18"/><line x1="15" y1="22" x2="15" y2="18"/><line x1="9" y1="6" x2="9.01" y2="6"/><line x1="15" y1="6" x2="15.01" y2="6"/><line x1="9" y1="10" x2="9.01" y2="10"/><line x1="15" y1="10" x2="15.01" y2="10"/><line x1="9" y1="14" x2="9.01" y2="14"/><line x1="15" y1="14" x2="15.01" y2="14"/></svg>`,
  statCheck: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  statGlobe: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="3" y1="12" x2="21" y2="12"/><path d="M12 3a15.3 15.3 0 0 1 4 9 15.3 15.3 0 0 1-4 9 15.3 15.3 0 0 1-4-9 15.3 15.3 0 0 1 4-9z"/></svg>`,
  statLayers: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`
};

function getNavIcon(name) {
  const map = {
    'Dashboard': `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
    'Daily Challenge': iconSvg.statClock,
    'Problem Bank': iconSvg.statBook,
    'Topic Practice': `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="13" rx="2"/><path d="M2 19h20M7 20h10M12 16v4"/></svg>`,
    'Code Editor': `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/></svg>`,
    'My Submissions': `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
    'Leaderboard': iconSvg.statTrophy,
    'My Progress': `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
    'Student Management': iconSvg.statUsers,
    'Problem Assignment': iconSvg.statBook,
    'Scheduled Tests': iconSvg.statClock,
    'Batch Performance': `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="13" rx="2"/><path d="M2 19h20M7 20h10M12 16v4"/></svg>`,
    'Weak Students': `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
    'Submission Reports': `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/></svg>`,
    'Department Management': iconSvg.statBuilding,
    'Batch Management': iconSvg.statLayers,
    'Faculty Management': iconSvg.statUsers,
    'Bulk Student Import': `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
    'College Reports': `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
    'College Management': iconSvg.statBuilding,
    'User Management': iconSvg.statUsers,
    'Problem Bank Management': iconSvg.statBook,
    'Licence Management': iconSvg.statClock,
    'Platform Analytics': `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
    'System Monitoring': `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="13" rx="2"/><path d="M2 19h20M7 20h10M12 16v4"/></svg>`,
    'My Profile': `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.168 18.849a4 4 0 0 1 3.832-2.849h4a4 4 0 0 1 3.834 2.855"/></svg>`,
    'Settings': `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    'Analytics': iconSvg.statGlobe
  };
  return map[name] || '';
}


const topicVideos = {
  'Arrays': {
    title: 'Mastering Arrays: Memory Layout, Indexing & Two-Pointer Patterns',
    duration: '14:28',
    instructor: 'IST Faculty of Computing · Core Curriculum',
    youtubeId: 'pkYVOmU3MgA',
    embedUrl: 'https://www.youtube.com/embed/pkYVOmU3MgA?rel=0',
    shortDesc: 'Contiguous memory layout with O(1) random access indexing. Master two-pointer traversals, prefix arrays, and sliding window boundaries.',
    chapters: [
      { time: '00:00', title: 'Memory Layout & Cache Locality' },
      { time: '03:15', title: 'O(1) Random Addressing' },
      { time: '07:40', title: 'Two-Pointer Convergence' },
      { time: '11:20', title: 'Boundary Guards & Off-by-One Pitfalls' }
    ],
    codeSnippet: `def two_pointer_scan(nums, target):
    left, right = 0, len(nums) - 1
    while left < right:
        current_sum = nums[left] + nums[right]
        if current_sum == target:
            return [left, right]
        elif current_sum < target:
            left += 1
        else:
            right -= 1
    return []`,
    takeaways: [
      'Contiguous memory allocation enables instant O(1) random index access',
      'Two-pointer patterns reduce O(N²) quadratic nested loops down to linear O(N)',
      'In-place modifications minimize auxiliary memory consumption to O(1)'
    ]
  },
  'Strings': {
    title: 'String Algorithms: Encodings, Two Pointers & Palindromes',
    duration: '16:45',
    instructor: 'IST Faculty of Computing · Core Curriculum',
    youtubeId: 'rfscVS0vtbw',
    embedUrl: 'https://www.youtube.com/embed/rfscVS0vtbw?start=1950&rel=0',
    shortDesc: 'Sequential character sequences and ASCII buffers. Master palindrome validation, substring sliding windows, and character frequency maps.',
    chapters: [
      { time: '00:00', title: 'ASCII / Unicode Byte Representations' },
      { time: '04:10', title: 'In-Place Symmetric String Reversal' },
      { time: '08:35', title: 'Character Frequency Arrays (26 chars)' },
      { time: '12:50', title: 'Sliding Window Substring Traversal' }
    ],
    codeSnippet: `def is_palindrome(s):
    cleaned = [c.lower() for c in s if c.isalnum()]
    left, right = 0, len(cleaned) - 1
    while left < right:
        if cleaned[left] != cleaned[right]:
            return False
        left += 1
        right -= 1
    return True`,
    takeaways: [
      'Direct index array of size 26 or 128 provides O(1) character frequency counts',
      'String immutability considerations in Python/Java versus mutable buffers in C',
      'Symmetric two-pointer convergence validates palindromes in O(N) time and O(1) space'
    ]
  },
  'Loops': {
    title: 'Iterative Control Constructs: For, While & Nested Traversals',
    duration: '12:15',
    instructor: 'IST Faculty of Computing · Core Curriculum',
    youtubeId: 'rfscVS0vtbw',
    embedUrl: 'https://www.youtube.com/embed/rfscVS0vtbw?start=6820&rel=0',
    shortDesc: 'Deterministic iteration control and loop invariants. Learn nested 2D matrix traversals, condition boundaries, and step optimizations.',
    chapters: [
      { time: '00:00', title: 'Loop Invariants & Guard Conditions' },
      { time: '03:40', title: 'Digit Extraction with While Loops' },
      { time: '07:15', title: 'Break, Continue & Early Exit Logic' },
      { time: '09:50', title: 'Time Complexity: O(N) vs O(N²)' }
    ],
    codeSnippet: `def count_and_reverse_digits(n):
    reversed_num = 0
    count = 0
    n = abs(n)
    while n > 0:
        digit = n % 10
        reversed_num = (reversed_num * 10) + digit
        n //= 10
        count += 1
    return count, reversed_num`,
    takeaways: [
      'State loop invariants clearly before loop headers to eliminate infinite loops',
      'Use modulo (% 10) and integer division (// 10) for arithmetic digit processing',
      'Always verify loop boundary edge cases (0, 1, and N-1 boundaries)'
    ]
  },
  'Functions': {
    title: 'Functions & Modular Design: Scope, Parameters & Call Stack',
    duration: '13:50',
    instructor: 'IST Faculty of Computing · Core Curriculum',
    youtubeId: 'rfscVS0vtbw',
    embedUrl: 'https://www.youtube.com/embed/rfscVS0vtbw?start=4440&rel=0',
    shortDesc: 'Modular decomposition and pure functions. Understand stack frames, pass-by-value versus pass-by-reference, and scope lifecycles.',
    chapters: [
      { time: '00:00', title: 'Function Signatures & Single Responsibility' },
      { time: '03:30', title: 'CPU Call Stack & Activation Records' },
      { time: '07:20', title: 'Pure Functions & Return Values' },
      { time: '10:45', title: 'Optimized Trial Division Algorithm' }
    ],
    codeSnippet: `def is_prime(n):
    if n <= 1:
        return False
    if n <= 3:
        return True
    if n % 2 == 0 or n % 3 == 0:
        return False
    i = 5
    while i * i <= n:
        if n % i == 0 or n % (i + 2) == 0:
            return False
        i += 6
    return True`,
    takeaways: [
      'Small, decoupled functions promote testability and maintainability',
      'Activation records store local variables and return addresses on the runtime call stack',
      'Avoid hidden global state modifications by preferring pure function returns'
    ]
  },
  'Searching': {
    title: 'Searching Algorithms: Linear Search vs Binary Search O(log N)',
    duration: '15:30',
    instructor: 'IST Faculty of Computing · Core Curriculum',
    youtubeId: '8hly31xKli0',
    embedUrl: 'https://www.youtube.com/embed/8hly31xKli0?start=1200&rel=0',
    shortDesc: 'Efficient item retrieval across sorted and unsorted sequences. Master Binary Search O(log N), search-space pruning, and midpoint arithmetic.',
    chapters: [
      { time: '00:00', title: 'Search Space Properties & Invariants' },
      { time: '03:15', title: 'Linear Search O(N) Baseline' },
      { time: '06:50', title: 'Binary Search Divide-and-Conquer' },
      { time: '11:30', title: 'Safe Midpoint Calculation: low + (high-low)/2' }
    ],
    codeSnippet: `def binary_search(nums, target):
    low, high = 0, len(nums) - 1
    while low <= high:
        mid = low + (high - low) // 2
        if nums[mid] == target:
            return mid
        elif nums[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
    return -1`,
    takeaways: [
      'Linear search operates on arbitrary unordered arrays in O(N) time',
      'Binary search requires sorted arrays and cuts candidate search space in half each iteration',
      'Compute mid as low + (high - low) // 2 to safely avoid integer overflow'
    ]
  },
  'Recursion': {
    title: 'Recursion Principles: Call Stack, Base Conditions & Divide-and-Conquer',
    duration: '18:10',
    instructor: 'IST Faculty of Computing · Core Curriculum',
    youtubeId: 'IJDJ0kBx2LM',
    embedUrl: 'https://www.youtube.com/embed/IJDJ0kBx2LM?rel=0',
    shortDesc: 'Divide-and-conquer problem solving with self-referential functions. Master call stack unwinding, recursion tree branching, and base cases.',
    chapters: [
      { time: '00:00', title: 'Anatomy of Recursive Decomposition' },
      { time: '04:20', title: 'Base Conditions & Stack Overflow Prevention' },
      { time: '09:10', title: 'Recursion Trees & Branching Factors' },
      { time: '14:30', title: 'Recursive Call Stack Unwinding' }
    ],
    codeSnippet: `def fibonacci_recursive(n):
    if n <= 0:
        return 0
    if n == 1:
        return 1
    return fibonacci_recursive(n - 1) + fibonacci_recursive(n - 2)`,
    takeaways: [
      'Every recursive function requires a non-recursive base case that halts the execution',
      'Each recursive invocation allocates a new activation frame on the program stack',
      'Recursion trees help visualize total calls and time complexity'
    ]
  },
  'Sorting': {
    title: 'Sorting Algorithms: Bubble, Selection, Merge & QuickSort',
    duration: '17:20',
    instructor: 'IST Faculty of Computing · Core Curriculum',
    youtubeId: '8hly31xKli0',
    embedUrl: 'https://www.youtube.com/embed/8hly31xKli0?start=3600&rel=0',
    shortDesc: 'Systematic element ordering with comparison sorts. Compare quadratic O(N²) bubble/selection sorts with optimal O(N log N) merge patterns.',
    chapters: [
      { time: '00:00', title: 'Sorting Taxonomy & Stability' },
      { time: '04:15', title: 'Quadratic Sorts: Bubble & Selection O(N²)' },
      { time: '09:40', title: 'MergeSort: Divide, Conquer & Combine' },
      { time: '14:20', title: 'Two-Pointer Sorted Array Merging' }
    ],
    codeSnippet: `def merge_sorted_arrays(nums1, nums2):
    i = j = 0
    result = []
    while i < len(nums1) and j < len(nums2):
        if nums1[i] <= nums2[j]:
            result.append(nums1[i])
            i += 1
        else:
            result.append(nums2[j])
            j += 1
    result.extend(nums1[i:])
    result.extend(nums2[j:])
    return result`,
    takeaways: [
      'Stable sorting preserves the relative order of identical comparison keys',
      'Two-pointer linear merges combine sorted sublists in O(N + M) time',
      'In-place element swapping minimizes auxiliary space requirements'
    ]
  },
  'Linked Lists': {
    title: 'Linked Lists: Singly & Doubly Linked Nodes & Pointer Navigation',
    duration: '15:10',
    instructor: 'IST Faculty of Computing · Core Curriculum',
    youtubeId: 'HzaLbjngVVM',
    embedUrl: 'https://www.youtube.com/embed/HzaLbjngVVM?rel=0',
    shortDesc: 'Dynamic node structures connected by pointers. Master single and double link traversals, head insertions, and fast/slow pointer tricks.',
    chapters: [
      { time: '00:00', title: 'Node Architecture: Value & Next Pointer' },
      { time: '04:10', title: 'O(1) Insertion & Deletion at Head' },
      { time: '08:45', title: 'Fast & Slow Pointers for Middle Node' },
      { time: '12:20', title: 'Three-Pointer In-Place Reversal (Prev, Curr, Next)' }
    ],
    codeSnippet: `def reverse_linked_list(head):
    prev = None
    curr = head
    while curr:
        next_node = curr.next
        curr.next = prev
        prev = curr
        curr = next_node
    return prev`,
    takeaways: [
      'Dynamic nodes avoid fixed array sizing and enable O(1) head insertions',
      'Sequential pointer traversal requires O(N) time for index lookup without random access',
      'Three-pointer sliding technique (prev, curr, next) reverses links in place'
    ]
  }
};

function renderTopicCard(t) {
  const meta = getTopicMeta(t.topic);
  const vInfo = topicVideos[t.topic] || {
    duration: '14:00',
    shortDesc: 'Master foundational algorithmic patterns and structured problem-solving.'
  };

  return `
    <div class="topic-practice-card" onclick="openTopicPracticeModal('${esc(t.topic)}')" title="Click to open ${esc(t.topic)} practice track">
      <!-- Card Top Row: Category Tag & Video Duration Pill -->
      <div class="topic-card-top-row">
        <span class="topic-card-category-badge">
          ${esc(t.category || 'DATA STRUCTURES')}
        </span>
        <span class="topic-video-pill" onclick="event.stopPropagation(); openTopicVideoModal('${esc(t.topic)}')" style="cursor:pointer;" title="Click to watch instructional video (⏱ ${vInfo.duration})">
          ⏱ ${vInfo.duration}
        </span>
      </div>

      <!-- Main Header: Clean Natural Interactive Icon & Title -->
      <div class="topic-icon-stage" onclick="event.stopPropagation(); openTopicVideoModal('${esc(t.topic)}')">
        <div class="topic-interactive-hero-badge" title="Click to watch ${esc(t.topic)} video lecture">
          ${meta.iconSvg}
        </div>
        <div class="topic-title-group">
          <h3 class="topic-card-title">${esc(t.topic)}</h3>
          <span class="topic-card-subtitle">● Curriculum Track</span>
        </div>
      </div>

      <!-- Middle: Description & Progress Bar -->
      <div class="topic-card-details">
        <p class="topic-card-desc">
          ${esc(vInfo.shortDesc)}
        </p>
        <div class="topic-progress-info">
          <span class="muted"><b>${t.problems_solved}</b> / ${t.total_problems} challenges solved</span>
          <span class="topic-percent-tag">${t.percentage}%</span>
        </div>
        <div class="topic-progress-bar-track">
          <div class="topic-progress-bar-fill" style="width:${t.percentage}%;"></div>
        </div>
      </div>

      <!-- Footer: Separated Interactive Action Buttons -->
      <div class="topic-card-actions">
        <button class="btn topic-video-action-btn" onclick="event.stopPropagation(); openTopicVideoModal('${esc(t.topic)}')" title="Watch ${esc(t.topic)} video lecture">
          ▶ Watch Video
        </button>
        <button class="btn topic-practice-action-btn" onclick="event.stopPropagation(); openTopicPracticeModal('${esc(t.topic)}')" title="Open ${esc(t.topic)} coding practice track">
          Practice Track →
        </button>
      </div>
    </div>
  `;
}

const topicMeta = {
  'arrays': {
    name: 'Arrays',
    cat: 'Data Structures',
    color: 'var(--primary)',
    bg: 'var(--primary-light)',
    border: 'var(--primary-subtle)',
    iconSvg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2.5"/>
      <line x1="7" y1="5" x2="7" y2="19"/>
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="17" y1="5" x2="17" y2="19"/>
      <circle cx="4.5" cy="12" r="1" fill="currentColor"/>
      <circle cx="9.5" cy="12" r="1" fill="currentColor"/>
      <circle cx="14.5" cy="12" r="1" fill="currentColor"/>
      <circle cx="19.5" cy="12" r="1" fill="currentColor"/>
    </svg>`
  },
  'strings': {
    name: 'Strings',
    cat: 'Data Structures',
    color: 'var(--primary)',
    bg: 'var(--primary-light)',
    border: 'var(--primary-subtle)',
    iconSvg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 7V4h16v3"/>
      <path d="M9 20h6"/>
      <line x1="12" y1="4" x2="12" y2="20"/>
      <line x1="6" y1="11" x2="18" y2="11" stroke-dasharray="2 2"/>
    </svg>`
  },
  'loops': {
    name: 'Loops',
    cat: 'Core Logic',
    color: 'var(--primary)',
    bg: 'var(--primary-light)',
    border: 'var(--primary-subtle)',
    iconSvg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
      <circle cx="12" cy="12" r="2.5" fill="currentColor"/>
    </svg>`
  },
  'functions': {
    name: 'Functions',
    cat: 'Core Logic',
    color: 'var(--primary)',
    bg: 'var(--primary-light)',
    border: 'var(--primary-subtle)',
    iconSvg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="6" cy="18" r="3"/>
      <circle cx="18" cy="6" r="3"/>
      <path d="M8.5 15.5l7-7"/>
      <path d="M12 2v4M12 18v4"/>
    </svg>`
  },
  'searching': {
    name: 'Searching',
    cat: 'Algorithms',
    color: 'var(--primary)',
    bg: 'var(--primary-light)',
    border: 'var(--primary-subtle)',
    iconSvg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="7"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      <circle cx="11" cy="11" r="2.5" fill="currentColor"/>
    </svg>`
  },
  'recursion': {
    name: 'Recursion',
    cat: 'Algorithms',
    color: 'var(--primary)',
    bg: 'var(--primary-light)',
    border: 'var(--primary-subtle)',
    iconSvg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2.5"/>
      <rect x="7" y="7" width="10" height="10" rx="1.5"/>
      <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
    </svg>`
  },
  'sorting': {
    name: 'Sorting',
    cat: 'Algorithms',
    color: 'var(--primary)',
    bg: 'var(--primary-light)',
    border: 'var(--primary-subtle)',
    iconSvg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="4" y1="20" x2="4" y2="14"/>
      <line x1="9" y1="20" x2="9" y2="10"/>
      <line x1="14" y1="20" x2="14" y2="6"/>
      <line x1="19" y1="20" x2="19" y2="2"/>
    </svg>`
  },
  'linked lists': {
    name: 'Linked Lists',
    cat: 'Data Structures',
    color: 'var(--primary)',
    bg: 'var(--primary-light)',
    border: 'var(--primary-subtle)',
    iconSvg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="7" width="8" height="10" rx="2"/>
      <rect x="14" y="7" width="8" height="10" rx="2"/>
      <path d="M10 12h4"/>
      <polyline points="12 10 14 12 12 14"/>
    </svg>`
  }
};
function getTopicMeta(topicName) {
  const t = (topicName || '').toLowerCase().trim();
  if (t.includes('array')) return topicMeta['arrays'];
  if (t.includes('string')) return topicMeta['strings'];
  if (t.includes('loop')) return topicMeta['loops'];
  if (t.includes('func')) return topicMeta['functions'];
  if (t.includes('search')) return topicMeta['searching'];
  if (t.includes('recur')) return topicMeta['recursion'];
  if (t.includes('sort')) return topicMeta['sorting'];
  if (t.includes('link') || t.includes('list')) return topicMeta['linked lists'];

  return {
    name: topicName,
    cat: 'General',
    color: '#0071bc',
    color2: '#29abe2',
    bg: 'rgba(0, 113, 188, 0.08)',
    border: 'rgba(0, 113, 188, 0.25)',
    iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0071bc" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>`
  };
}

const moduleTheming = {
  // Student Modules
  'Learn C, Java, Python, SQL, Data Structures': {
    color: '#0071bc',
    bg: 'rgba(0, 113, 188, 0.08)',
    border: 'rgba(0, 113, 188, 0.22)',
    badgeClass: 'blue'
  },
  'Programming Challenges - Tracks': {
    color: '#0284c7',
    bg: 'rgba(2, 132, 199, 0.08)',
    border: 'rgba(2, 132, 199, 0.22)',
    badgeClass: 'cyan'
  },
  'Daily Challenge (24 Hours)': {
    color: '#d97706',
    bg: 'rgba(217, 119, 6, 0.08)',
    border: 'rgba(217, 119, 6, 0.22)',
    badgeClass: 'blue'
  },
  'Daily Test (10 P.M)': {
    color: '#704fe7',
    bg: 'rgba(112, 79, 231, 0.08)',
    border: 'rgba(112, 79, 231, 0.22)',
    badgeClass: 'blue'
  },
  'Programming Tests (Test Center)': {
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.08)',
    border: 'rgba(16, 185, 129, 0.22)',
    badgeClass: 'blue'
  },
  'Live Assisted Coding Sessions (LACS) Programs': {
    color: '#29abe2',
    bg: 'rgba(41, 171, 226, 0.08)',
    border: 'rgba(41, 171, 226, 0.22)',
    badgeClass: 'cyan'
  },
  'Lab Programs': {
    color: '#4f46e5',
    bg: 'rgba(79, 70, 229, 0.08)',
    border: 'rgba(79, 70, 229, 0.22)',
    badgeClass: 'purple'
  },
  'My Code-Pads (Self Practice)': {
    color: '#0d9488',
    bg: 'rgba(13, 148, 136, 0.08)',
    border: 'rgba(13, 148, 136, 0.22)',
    badgeClass: 'teal'
  },
  'View Programs Solved Count': {
    color: '#e11d48',
    bg: 'rgba(225, 29, 72, 0.08)',
    border: 'rgba(225, 29, 72, 0.22)',
    badgeClass: 'bad'
  },

  // Faculty Modules
  'Student Management (Batches)': {
    color: '#0071bc',
    bg: 'rgba(0, 113, 188, 0.08)',
    border: 'rgba(0, 113, 188, 0.22)',
    badgeClass: 'blue'
  },
  'Problem Assignment - Tracks': {
    color: '#0284c7',
    bg: 'rgba(2, 132, 199, 0.08)',
    border: 'rgba(2, 132, 199, 0.22)',
    badgeClass: 'cyan'
  },
  'Scheduled Tests (Assessment Center)': {
    color: '#704fe7',
    bg: 'rgba(112, 79, 231, 0.08)',
    border: 'rgba(112, 79, 231, 0.22)',
    badgeClass: 'purple'
  },
  'Batch Performance & Live Analytics': {
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.08)',
    border: 'rgba(16, 185, 129, 0.22)',
    badgeClass: 'green'
  },
  'Weak Students Identification': {
    color: '#e11d48',
    bg: 'rgba(225, 29, 72, 0.08)',
    border: 'rgba(225, 29, 72, 0.22)',
    badgeClass: 'bad'
  },
  'Student Submission Reports & Review': {
    color: '#0d9488',
    bg: 'rgba(13, 148, 136, 0.08)',
    border: 'rgba(13, 148, 136, 0.22)',
    badgeClass: 'teal'
  },
  'Academic Curriculum & Topics': {
    color: '#29abe2',
    bg: 'rgba(41, 171, 226, 0.08)',
    border: 'rgba(41, 171, 226, 0.22)',
    badgeClass: 'cyan'
  },
  'Code-Pad Verification Center': {
    color: '#d97706',
    bg: 'rgba(217, 119, 6, 0.08)',
    border: 'rgba(217, 119, 6, 0.22)',
    badgeClass: 'amber'
  },

  // Admin Modules
  'Student Directory & Enrollment': {
    color: '#0071bc',
    bg: 'rgba(0, 113, 188, 0.08)',
    border: 'rgba(0, 113, 188, 0.22)',
    badgeClass: 'blue'
  },
  'Faculty & Staff Directory': {
    color: '#0284c7',
    bg: 'rgba(2, 132, 199, 0.08)',
    border: 'rgba(2, 132, 199, 0.22)',
    badgeClass: 'cyan'
  },
  'Department Administration': {
    color: '#4f46e5',
    bg: 'rgba(79, 70, 229, 0.08)',
    border: 'rgba(79, 70, 229, 0.22)',
    badgeClass: 'purple'
  },
  'Academic Cohorts & Schedules': {
    color: '#d97706',
    bg: 'rgba(217, 119, 6, 0.08)',
    border: 'rgba(217, 119, 6, 0.22)',
    badgeClass: 'amber'
  },
  'Bulk Student CSV Import': {
    color: '#0d9488',
    bg: 'rgba(13, 148, 136, 0.08)',
    border: 'rgba(13, 148, 136, 0.22)',
    badgeClass: 'teal'
  },
  'Institutional Analytics & Reports': {
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.08)',
    border: 'rgba(16, 185, 129, 0.22)',
    badgeClass: 'green'
  },
  'Institutional Learning Environment': {
    color: '#29abe2',
    bg: 'rgba(41, 171, 226, 0.08)',
    border: 'rgba(41, 171, 226, 0.22)',
    badgeClass: 'cyan'
  },
  'Assessment Operations Oversight': {
    color: '#704fe7',
    bg: 'rgba(112, 79, 231, 0.08)',
    border: 'rgba(112, 79, 231, 0.22)',
    badgeClass: 'purple'
  },

  // Super Admin Modules
  'Partner Colleges & Institutions': {
    color: '#0071bc',
    bg: 'rgba(0, 113, 188, 0.08)',
    border: 'rgba(0, 113, 188, 0.22)',
    badgeClass: 'blue'
  },
  'Platform User Directory': {
    color: '#0284c7',
    bg: 'rgba(2, 132, 199, 0.08)',
    border: 'rgba(2, 132, 199, 0.22)',
    badgeClass: 'cyan'
  },
  'Curriculum & Problem Catalog': {
    color: '#4f46e5',
    bg: 'rgba(79, 70, 229, 0.08)',
    border: 'rgba(79, 70, 229, 0.22)',
    badgeClass: 'purple'
  },
  'Licence Validity & Subscriptions': {
    color: '#704fe7',
    bg: 'rgba(112, 79, 231, 0.08)',
    border: 'rgba(112, 79, 231, 0.22)',
    badgeClass: 'purple'
  },
  'Cloud Infrastructure Health': {
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.08)',
    border: 'rgba(16, 185, 129, 0.22)',
    badgeClass: 'green'
  },
  'Platform Analytics & Trends': {
    color: '#e11d48',
    bg: 'rgba(225, 29, 72, 0.08)',
    border: 'rgba(225, 29, 72, 0.22)',
    badgeClass: 'bad'
  },
  'Central Test Engine Oversight': {
    color: '#d97706',
    bg: 'rgba(217, 119, 6, 0.08)',
    border: 'rgba(217, 119, 6, 0.22)',
    badgeClass: 'amber'
  },
  'System Audit & Diagnostics': {
    color: '#0d9488',
    bg: 'rgba(13, 148, 136, 0.08)',
    border: 'rgba(13, 148, 136, 0.22)',
    badgeClass: 'teal'
  }
};

function getModuleTheming(title) {
  if (moduleTheming[title]) return moduleTheming[title];
  return {
    color: '#0071bc',
    bg: 'rgba(0, 113, 188, 0.08)',
    border: 'rgba(0, 113, 188, 0.22)',
    badgeClass: 'blue'
  };
}

function moduleCard(title, iconSvgHtml, btnText, onclickAction, badgeText = '', badgeClass = '') {
  const theme = getModuleTheming(title);
  const finalBadge = badgeClass || theme.badgeClass || 'blue';
  return `
    <div class="card module-card" onclick="${onclickAction}" style="--module-color:${theme.color};--module-bg:${theme.bg};--module-border:${theme.border};cursor:pointer;" title="Click to open ${title}">
      <div class="module-card-head">
        <h4>${title}</h4>
      </div>
      <div class="module-card-icon" onclick="event.stopPropagation(); ${onclickAction}">
        <div class="module-icon-badge" title="${title}">
          ${iconSvgHtml}
        </div>
      </div>
      <div class="module-card-footer">
        <button class="btn small btn-primary" onclick="event.stopPropagation(); ${onclickAction}">
          ${btnText}
        </button>
        ${badgeText ? `<span class="pill ${finalBadge}">${badgeText}</span>` : ''}
      </div>
    </div>
  `;
}

function getActiveNavName(page) {
  const map = {
    'Learn C, Java, Python, SQL, Data Structures': 'Topic Practice',
    'Programming Challenges - Tracks': 'Problem Bank',
    'Daily Challenge (24 Hours)': 'Daily Challenge',
    'Daily Test (10 P.M)': 'Scheduled Tests',
    'Programming Tests (Test Center)': 'Scheduled Tests',
    'Live Assisted Coding Sessions (LACS) Programs': 'Code Editor',
    'Lab Programs': 'Problem Bank',
    'My Code-Pads (Self Practice)': 'Code Editor',
    'View Programs Solved Count': 'My Submissions',
    'Student Management (Batches)': 'Student Management',
    'Problem Assignment - Tracks': 'Problem Assignment',
    'Scheduled Tests (Assessment Center)': 'Scheduled Tests',
    'Batch Performance & Live Analytics': 'Batch Performance',
    'Weak Students Identification': 'Weak Students',
    'Student Submission Reports & Review': 'Submission Reports',
    'Academic Curriculum & Topics': 'Analytics',
    'Code-Pad Verification Center': 'Scheduled Tests',
    'Student Directory & Enrollment': 'Student Management',
    'Faculty & Staff Directory': 'Faculty Management',
    'Department Administration': 'Department Management',
    'Academic Cohorts & Schedules': 'Batch Management',
    'Bulk Student CSV Import': 'Bulk Student Import',
    'Institutional Analytics & Reports': 'College Reports',
    'Institutional Learning Environment': 'Department Management',
    'Assessment Operations Oversight': 'College Reports',
    'Partner Colleges & Institutions': 'College Management',
    'Platform User Directory': 'User Management',
    'Curriculum & Problem Catalog': 'Problem Bank Management',
    'Licence Validity & Subscriptions': 'Licence Management',
    'Cloud Infrastructure Health': 'System Monitoring',
    'Platform Analytics & Trends': 'Platform Analytics',
    'Central Test Engine Oversight': 'Problem Bank Management',
    'System Audit & Diagnostics': 'System Monitoring'
  };
  return map[page] || page;
}

function buildNav() {
  const items = (roles[role] || roles.student).items;
  const activeNav = getActiveNavName(current);
  document.getElementById('nav').innerHTML = items.map(([n, i]) => `
    <button class="${activeNav === n ? 'active' : ''}" onclick="render('${n}')">
      <span class="ico">${getNavIcon(n) || i}</span>
      <span>${n}</span>
    </button>
  `).join('');
}

function head(title, desc, action = '') {
  return `
    <div class="page-head">
      <div>
        <h1>${title}</h1>
        <p>${desc}</p>
      </div>
      <div>${action}</div>
    </div>
  `;
}

function stats(items) {
  return `
    <div class="grid stats">
      ${items.map(([l, v, ic, sub, clickAction]) => `
        <div class="card stat-card ${clickAction ? 'clickable' : ''}" ${clickAction ? `onclick="${clickAction}" title="Click to view ${l}"` : ''}>
          <div class="stat-top">
            <span>${l}</span>
            <span class="stat-icon">${ic}</span>
          </div>
          <div class="stat-value" data-value="${v}">${v}</div>
          <div class="positive">${sub}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function table(headers, rows) {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.map(row => `<tr>${row.map(x => `<td>${x}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/* ========================================================
   PAGE RENDERING & STAGGER ENTRANCES
   ======================================================== */
async function render(page) {
  current = page;
  document.getElementById('topTitle').textContent = page;
  buildNav();
  document.getElementById('sidebar').classList.remove('open');
  const v = document.getElementById('view');

  // Temporary loading state
  v.innerHTML = `
    <div style="padding:40px;text-align:center;color:var(--text-muted);">
      <div style="display:inline-block;animation:spin 1s linear infinite;font-size:24px;margin-bottom:8px;">⟳</div>
      <div>Loading ${page} from database...</div>
    </div>
  `;

  try {
    const html = await pageContent(page);
    v.innerHTML = html;
  } catch(e) {
    console.error('Page render error:', e);
    v.innerHTML = `
      <div class="card" style="margin:20px 0;">
        <h3>Unable to load ${esc(page)}</h3>
        <p class="muted" style="margin-top:8px;">${esc(e.message || 'Server error occurred.')}</p>
        <button class="btn" style="margin-top:14px;" onclick="render('${page}')">Retry</button>
      </div>
    `;
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Staggered cascade entrance for interactive feel
  v.querySelectorAll('.card, .page-head, .table-wrap, .tabs, .editor-layout').forEach((el, i) => {
    el.classList.add('stagger-in');
    el.style.animationDelay = (i * 0.045) + 's';
  });

  setTimeout(updateRoleIndicator, 30);
  initCardSpotlights();
}

async function pageContent(p) {
  // Student Module Cards & Nav
  if (p === 'Dashboard') return await renderDashboard();
  if (p === 'Learn C, Java, Python, SQL, Data Structures') return await renderLanguagesTrack();
  if (p === 'Programming Challenges - Tracks') return await renderTracks();
  if (p === 'Daily Challenge (24 Hours)' || p === 'Daily Challenge') return await renderDaily();
  if (p === 'Daily Test (10 P.M)') return await renderDailyTestView();
  if (p === 'Programming Tests (Test Center)' || p === 'Scheduled Tests' || p === 'Scheduled Tests (Assessment Center)' || p === 'Code-Pad Verification Center' || p === 'Assessment Operations Oversight') return await renderTests();
  if (p === 'Live Assisted Coding Sessions (LACS) Programs' || p === 'LACS Programs') return await renderLACS();
  if (p === 'Lab Programs') return await renderLabPrograms();
  if (p === 'My Code-Pads (Self Practice)' || p === 'My Code-Pads') return await renderCodePads();
  if (p === 'View Programs Solved Count') return await renderSolvedCountView();

  // Core navigation items
  if (p === 'Problem Bank' || p === 'Problem Bank Management' || p === 'Curriculum & Problem Catalog' || p === 'Central Test Engine Oversight') return await renderProblems();
  if (p === 'Topic Practice') return await renderTopics();
  if (p === 'Code Editor') return await renderEditor();
  if (p === 'My Submissions' || p === 'Submission Reports' || p === 'Student Submission Reports & Review') return await renderSubmissions();
  if (p === 'Leaderboard') return await renderLeaderboard();
  if (p === 'Batch Performance' || p === 'Batch Performance & Live Analytics') return await renderBatchPerformance();
  if (p === 'Analytics' || p === 'Academic Curriculum & Topics') return await renderFacultyAnalytics();
  if (p === 'My Progress') return await renderStudentProgress();
  if (p === 'College Reports' || p === 'Institutional Analytics & Reports') return await renderCollegeReports();
  if (p === 'Platform Analytics' || p === 'Platform Analytics & Trends') return await renderPlatformAnalytics();
  if (p === 'My Profile') return await renderProfile();
  if (p === 'Settings') return await renderSettings();

  // Management items
  if (p === 'Student Management' || p === 'User Management' || p === 'Student Management (Batches)' || p === 'Student Directory & Enrollment' || p === 'Platform User Directory') return await renderManagement('Students');
  if (p === 'Faculty Management' || p === 'Faculty & Staff Directory') return await renderManagement('Faculty');
  if (p === 'College Management' || p === 'Partner Colleges & Institutions') return await renderManagement('Colleges');
  if (p === 'Department Management' || p === 'Department Administration' || p === 'Institutional Learning Environment') return await renderManagement('Departments');
  if (p === 'Batch Management' || p === 'Academic Cohorts & Schedules') return await renderManagement('Batches');
  if (p === 'Licence Management' || p === 'Licence Validity & Subscriptions') return await renderManagement('College Licences');
  if (p === 'Problem Assignment' || p === 'Problem Assignment - Tracks') return await renderAssignment();
  if (p === 'Weak Students' || p === 'Weak Students Identification') return await renderWeak();
  if (p === 'Bulk Student Import' || p === 'Bulk Student CSV Import') return renderBulk();
  if (p === 'System Monitoring' || p === 'Cloud Infrastructure Health' || p === 'System Audit & Diagnostics') return await renderMonitoring();

  return await renderDashboard();
}

/* ========================================================
   DASHBOARD MODULE
   ======================================================== */
async function renderDashboard() {
  const res = await fetch('/api/dashboard');
  const json = await res.json();
  const d = json.data || json;
  data = { ...data, ...d };

  const personName = currentUser ? currentUser.name : (roles[role] ? roles[role].person : 'User');

  if (role === 'student') {
    const solvedVal = String(d.solved || 18);
    const pointsVal = String(d.points || 420);
    const streakVal = (d.streak || 6) + ' days';
    const accVal = d.accuracy || '86%';

    return head(`Good day, ${personName} 👋`, 'Ready to make progress? Your coding journey continues today.') +
      `<div class="skillrack-strip">
        <div class="skillrack-strip-item" onclick="render('View Programs Solved Count')" title="Click to view solved programs">
          <span>Programs Solved:</span> <span class="pill purple">${solvedVal}</span>
        </div>
        <div class="skillrack-strip-item" onclick="render('Learn C, Java, Python, SQL, Data Structures')" title="Click to view language tracks">
          <span>Tutorials:</span> <span class="pill blue">42</span>
        </div>
        <div class="skillrack-strip-item" onclick="render('Programming Challenges - Tracks')" title="Click to view programming tracks">
          <span>Tracks:</span> <span class="pill blue">18</span>
        </div>
        <div class="skillrack-strip-item" onclick="render('My Progress')" title="Click to view accuracy breakdown">
          <span>Accuracy:</span> <span class="pill green">${accVal}</span>
        </div>
        <div class="skillrack-strip-item" onclick="render('Daily Challenge (24 Hours)')" title="Click to view daily challenge streak">
          <span>Daily Streak:</span> <span class="pill">${streakVal}</span>
        </div>
      </div>` +
      stats([
        ['Problems solved', solvedVal, iconSvg.statProblems, 'Verified in SQLite', "render('View Programs Solved Count')"],
        ['Total points', pointsVal, iconSvg.statTrophy, 'Leaderboard synced', "render('Leaderboard')"],
        ['Current streak', streakVal, iconSvg.statFlame, 'Keep it alive!', "render('Daily Challenge (24 Hours)')"],
        ['Accuracy', accVal, iconSvg.statTarget, 'Pass percentage', "render('My Progress')"]
      ]) +
      `<div class="module-section-title">
        ${iconSvg.statProblems}
        <span>Practice & Assessment Modules</span>
      </div>
      <div class="module-grid">
        ${moduleCard('Learn C, Java, Python, SQL, Data Structures', iconSvg.laptop, 'View', "render('Learn C, Java, Python, SQL, Data Structures')")}
        ${moduleCard('Programming Challenges - Tracks', iconSvg.keyboard, 'View', "render('Programming Challenges - Tracks')")}
        ${moduleCard('Daily Challenge (24 Hours)', iconSvg.clock, 'View', "render('Daily Challenge (24 Hours)')", `${solvedVal} Solved`, 'blue')}
        ${moduleCard('Daily Test (10 P.M)', iconSvg.clock, 'View', "render('Daily Test (10 P.M)')", `${d.daily_tests_solved || 100} Solved`, 'blue')}
        ${moduleCard('Programming Tests (Test Center)', iconSvg.code, 'View', "render('Programming Tests (Test Center)')", '3 Available', 'blue')}
        ${moduleCard('Live Assisted Coding Sessions (LACS) Programs', iconSvg.globe, 'View', "render('Live Assisted Coding Sessions (LACS) Programs')")}
        ${moduleCard('Lab Programs', iconSvg.monitor, 'View', "render('Lab Programs')")}
        ${moduleCard('My Code-Pads (Self Practice)', iconSvg.codepad, 'View', "render('My Code-Pads (Self Practice)')")}
        ${moduleCard('View Programs Solved Count', iconSvg.eye, 'View', "render('View Programs Solved Count')")}
      </div>
      <div class="grid two">
        <div class="card">
          <div class="card-head">
            <h3>Weekly activity</h3>
            <span class="pill blue">LIVE</span>
          </div>
          ${renderActivityChart(d.weekly_activity)}
        </div>
        <div class="card">
          <div class="card-head">
            <h3>Topic progress</h3>
            <span class="pill">MASTERY</span>
          </div>
          ${renderTopicBars(d.topic_progress)}
        </div>
      </div>
      <div class="grid two" style="margin-top:20px;">
        <div class="card">
          <div class="card-head">
            <h3>Recent submissions</h3>
            <button class="btn ghost small" onclick="render('My Submissions')">View all →</button>
          </div>
          ${d.recent_submissions && d.recent_submissions.length
            ? table(['Problem', 'Language', 'Verdict', 'Points', 'Submitted'], d.recent_submissions.map(s => [
                s[0], s[1], `<span class="pill ${s[2] === 'Accepted' ? '' : 'bad'}">${s[2]}</span>`, s[3], s[4]
              ]))
            : '<p class="muted" style="padding:16px;">No recent submissions recorded yet.</p>'
          }
        </div>
        <div class="card" style="display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <span class="pill blue">TODAY\'S CHALLENGE</span>
            <h2 style="margin:14px 0 6px;">${esc(d.today_challenge ? d.today_challenge.title : 'Find the Missing Number')}</h2>
            <p class="muted">${esc(d.today_challenge ? d.today_challenge.topic : 'Arrays')} · ${d.today_challenge ? d.today_challenge.points : 20} points · ${esc(d.today_challenge ? d.today_challenge.difficulty : 'Easy')}</p>
            <p style="margin:14px 0;line-height:1.6;">Solve today's featured problem to extend your streak and earn points.</p>
          </div>
          <button class="btn full" onclick="openProblem(${d.today_challenge ? d.today_challenge.id : 2})">Solve Daily Challenge →</button>
        </div>
      </div>`;
  }

  if (role === 'faculty') {
    const actStudents = String(d.active_students || 128);
    const avgScore = d.average_score || '74%';
    const assignedCount = String(d.problems_assigned || 42);
    const schedTests = String(d.tests_scheduled || 3);

    return head('Faculty dashboard', 'Batch analytics, scheduled evaluations and student submissions.') +
      stats([
        ['Active students', actStudents, iconSvg.statUsers, 'Enrolled in batches', "render('Student Management (Batches)')"],
        ['Average score', avgScore, iconSvg.statTarget, 'Across all batches', "render('Batch Performance & Live Analytics')"],
        ['Problems assigned', assignedCount, iconSvg.statBook, 'Active assignments', "render('Problem Assignment - Tracks')"],
        ['Tests scheduled', schedTests, iconSvg.statClock, 'Upcoming assessments', "render('Scheduled Tests (Assessment Center)')"]
      ]) +
      `<div class="module-section-title">
        ${iconSvg.statBook}
        <span>Academic Operations & Evaluation Modules</span>
      </div>
      <div class="module-grid">
        ${moduleCard('Student Management (Batches)', iconSvg.monitor, 'View', "render('Student Management (Batches)')", `${actStudents} Students`, 'blue')}
        ${moduleCard('Problem Assignment - Tracks', iconSvg.keyboard, 'View', "render('Problem Assignment - Tracks')", `${assignedCount} Assigned`, 'blue')}
        ${moduleCard('Scheduled Tests (Assessment Center)', iconSvg.clock, 'View', "render('Scheduled Tests (Assessment Center)')", `${schedTests} Active`, 'blue')}
        ${moduleCard('Batch Performance & Live Analytics', iconSvg.laptop, 'View', "render('Batch Performance & Live Analytics')")}
        ${moduleCard('Weak Students Identification', iconSvg.eye, 'View', "render('Weak Students Identification')", 'Action Required', 'bad')}
        ${moduleCard('Student Submission Reports & Review', iconSvg.codepad, 'View', "render('Student Submission Reports & Review')")}
        ${moduleCard('Academic Curriculum & Topics', iconSvg.globe, 'View', "render('Academic Curriculum & Topics')")}
        ${moduleCard('Code-Pad Verification Center', iconSvg.code, 'View', "render('Code-Pad Verification Center')")}
      </div>
      <div class="card" style="margin-top:20px;">
        <div class="card-head">
          <h3>Recent student submissions</h3>
          <button class="btn ghost small" onclick="render('Submission Reports')">View all →</button>
        </div>
        ${d.recent_submissions && d.recent_submissions.length
          ? table(['Student', 'Problem', 'Language', 'Verdict', 'Score', 'Time'], d.recent_submissions.map(s => [
              `<b>${esc(s[0])}</b>`, esc(s[1]), esc(s[2]), `<span class="pill ${s[3] === 'Accepted' ? '' : 'bad'}">${esc(s[3])}</span>`, esc(s[4]), esc(s[5])
            ]))
          : '<p class="muted" style="padding:16px;">No submissions found.</p>'
        }
      </div>`;
  }

  if (role === 'admin') {
    const totStudents = String(d.total_students || 0);
    const totFaculty = String(d.total_faculty || 0);
    const deptsCount = String(d.departments_count || 0);
    const batchCount = String(d.batches_count || 0);

    return head('Institutional administration', 'Institutional governance, department health and learner cohorts.') +
      stats([
        ['Total students', totStudents, iconSvg.statUsers, 'Enrolled learners', "render('Student Directory & Enrollment')"],
        ['Total faculty', totFaculty, iconSvg.statUsers, 'Academic staff', "render('Faculty & Staff Directory')"],
        ['Departments', deptsCount, iconSvg.statBuilding, 'Active academic depts', "render('Department Administration')"],
        ['Batches', batchCount, iconSvg.statLayers, 'Active cohorts', "render('Academic Cohorts & Schedules')"]
      ]) +
      `<div class="module-section-title">
        ${iconSvg.statBuilding}
        <span>Institutional Governance & Operations</span>
      </div>
      <div class="module-grid">
        ${moduleCard('Student Directory & Enrollment', iconSvg.monitor, 'View', "render('Student Directory & Enrollment')", `${totStudents} Students`, 'blue')}
        ${moduleCard('Faculty & Staff Directory', iconSvg.keyboard, 'View', "render('Faculty & Staff Directory')", `${totFaculty} Faculty`, 'blue')}
        ${moduleCard('Department Administration', iconSvg.laptop, 'View', "render('Department Administration')", `${deptsCount} Depts`, 'blue')}
        ${moduleCard('Academic Cohorts & Schedules', iconSvg.clock, 'View', "render('Academic Cohorts & Schedules')", `${batchCount} Batches`, 'blue')}
        ${moduleCard('Bulk Student CSV Import', iconSvg.codepad, 'View', "render('Bulk Student CSV Import')", 'CSV / Excel', 'blue')}
        ${moduleCard('Institutional Analytics & Reports', iconSvg.eye, 'View', "render('Institutional Analytics & Reports')")}
        ${moduleCard('Institutional Learning Environment', iconSvg.globe, 'View', "render('Institutional Learning Environment')")}
        ${moduleCard('Assessment Operations Oversight', iconSvg.code, 'View', "render('Assessment Operations Oversight')")}
      </div>
      <div class="grid two" style="margin-top:20px;">
        <div class="card">
          <h3>Quick administrative actions</h3>
          <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;">
            <button class="btn secondary" onclick="render('Student Management')">Manage Students</button>
            <button class="btn secondary" onclick="render('Department Management')">Departments</button>
            <button class="btn secondary" onclick="render('Bulk Student Import')">Import CSV</button>
          </div>
        </div>
        <div class="card">
          <h3>System status</h3>
          <p class="muted" style="margin-top:6px;">SQLite persistent storage active with WAL journaling and sandboxed code execution.</p>
        </div>
      </div>`;
  }

  // Super Admin
  const totColleges = String(d.total_colleges || 0);
  const actLicences = String(d.active_licences || 0);
  const totUsers = String(d.total_users || 0);
  const totProblems = String(d.total_problems || 0);

  return head('Super administrator', 'Multi-tenant cloud platform analytics, colleges and platform monitoring.') +
    stats([
      ['Total colleges', totColleges, iconSvg.statGlobe, 'Partner institutions', "render('Partner Colleges & Institutions')"],
      ['Active licences', actLicences, iconSvg.statClock, 'Valid licences', "render('Licence Validity & Subscriptions')"],
      ['Total platform users', totUsers, iconSvg.statUsers, 'Active accounts', "render('Platform User Directory')"],
      ['Problem bank', totProblems, iconSvg.statBook, 'Catalog challenges', "render('Curriculum & Problem Catalog')"]
    ]) +
    `<div class="module-section-title">
      ${iconSvg.statGlobe}
      <span>Platform Management & Multi-Tenant Operations</span>
    </div>
    <div class="module-grid">
      ${moduleCard('Partner Colleges & Institutions', iconSvg.globe, 'View', "render('Partner Colleges & Institutions')", `${totColleges} Colleges`, 'blue')}
      ${moduleCard('Platform User Directory', iconSvg.monitor, 'View', "render('Platform User Directory')", `${totUsers} Users`, 'blue')}
      ${moduleCard('Curriculum & Problem Catalog', iconSvg.keyboard, 'View', "render('Curriculum & Problem Catalog')", `${totProblems} Problems`, 'blue')}
      ${moduleCard('Licence Validity & Subscriptions', iconSvg.clock, 'View', "render('Licence Validity & Subscriptions')", `${actLicences} Active`, 'blue')}
      ${moduleCard('Cloud Infrastructure Health', iconSvg.laptop, 'View', "render('Cloud Infrastructure Health')", 'Online', 'blue')}
      ${moduleCard('Platform Analytics & Trends', iconSvg.eye, 'View', "render('Platform Analytics & Trends')")}
      ${moduleCard('Central Test Engine Oversight', iconSvg.code, 'View', "render('Central Test Engine Oversight')")}
      ${moduleCard('System Audit & Diagnostics', iconSvg.codepad, 'View', "render('System Audit & Diagnostics')")}
    </div>
    <div class="grid two" style="margin-top:20px;">
      <div class="card">
        <h3>Platform management</h3>
        <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;">
          <button class="btn" onclick="render('College Management')">Manage Colleges</button>
          <button class="btn secondary" onclick="render('System Monitoring')">System Health</button>
          <button class="btn secondary" onclick="render('Problem Bank Management')">Problem Catalog</button>
        </div>
      </div>
      <div class="card">
        <h3>Sandbox security cluster</h3>
        <p class="muted" style="margin-top:6px;">Isolated subprocess runtime with 4.0-second timeout enforcement enabled.</p>
      </div>
    </div>`;
}

/* ========================================================
   SKILLRACK EXTENDED MODULES & INTERACTIVE FEATURES
   ======================================================== */

// ========================================================
// 1. Learn C, Java, Python, SQL, Data Structures
// ========================================================
let currentLanguageTrack = 'all';

async function renderLanguagesTrack(selectedLang = 'all') {
  currentLanguageTrack = selectedLang;
  let allProblems = [];
  try {
    const res = await fetch('/api/problems');
    const json = await res.json();
    allProblems = json.problems || [];
  } catch(e) {}

  const languages = [
    {
      id: 'c',
      name: 'C Programming',
      icon: iconSvg.laptop,
      desc: 'Pointers, memory allocation, structures, bitwise manipulation and low-level system programming.',
      topics: ['Pointers & Addresses', 'Dynamic Memory (malloc/free)', 'Structs & Unions', 'Bitwise Operators'],
      solved: 12,
      total: 15,
      percent: 80
    },
    {
      id: 'java',
      name: 'Java (OOP)',
      icon: iconSvg.keyboard,
      desc: 'Object-oriented programming, classes, inheritance, polymorphism, collections framework and exceptions.',
      topics: ['Classes & Constructors', 'Inheritance & Interfaces', 'Collections Framework', 'Exception Handling'],
      solved: 8,
      total: 12,
      percent: 67
    },
    {
      id: 'python',
      name: 'Python 3 Mastery',
      icon: iconSvg.code,
      desc: 'Pythonic problem solving, list comprehensions, dictionary hashing, recursion and standard libraries.',
      topics: ['Lists & Dictionaries', 'Comprehensions & Lambdas', 'String Slicing', 'File Handling & Regex'],
      solved: 15,
      total: 18,
      percent: 83
    },
    {
      id: 'sql',
      name: 'SQL & Database Queries',
      icon: iconSvg.codepad,
      desc: 'Relational data modeling, multi-table JOINs, GROUP BY aggregations, subqueries and window functions.',
      topics: ['SELECT & WHERE filters', 'INNER & OUTER JOINs', 'GROUP BY & HAVING', 'Aggregate Functions'],
      solved: 7,
      total: 10,
      percent: 70
    },
    {
      id: 'dsa',
      name: 'Data Structures & Algorithms',
      icon: iconSvg.globe,
      desc: 'Arrays, Linked Lists, Stacks, Queues, Binary Trees, Graphs, Sorting algorithms and Dynamic Programming.',
      topics: ['Arrays & HashMaps', 'Stack & Queue ADT', 'Binary Search Trees', 'Sorting & Searching'],
      solved: 18,
      total: 25,
      percent: 72
    }
  ];

  // Filter problems based on selected language
  let filteredProblems = allProblems;
  if (selectedLang === 'dsa') {
    filteredProblems = allProblems.filter(p => p.topic === 'Arrays' || p.topic === 'Data Structures' || p.topic === 'Searching');
  } else if (selectedLang === 'python') {
    filteredProblems = allProblems.filter(p => p.topic === 'Arrays' || p.topic === 'Strings' || p.topic === 'Loops');
  } else if (selectedLang === 'c' || selectedLang === 'java') {
    filteredProblems = allProblems.filter(p => p.topic === 'Arrays' || p.topic === 'Strings' || p.topic === 'Data Structures');
  } else if (selectedLang === 'sql') {
    filteredProblems = allProblems.filter(p => p.topic === 'Data Structures' || p.topic === 'Arrays');
  }

  return head(
    'Learn C, Java, Python, SQL, Data Structures',
    'Comprehensive programming curricula with concept tutorials, practice modules, and hands-on coding.'
  ) +
  `<div class="card" style="margin-bottom:20px;">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
      <div>
        <h3 style="margin:0 0 4px;">Curriculum Language Tracks</h3>
        <p class="muted" style="margin:0;">Select a language track to filter interactive challenges and tutorial exercises.</p>
      </div>
      <div class="track-filter-bar" style="margin:0;">
        <button class="track-filter-btn ${currentLanguageTrack === 'all' ? 'active' : ''}" onclick="renderLanguagesTrack('all')">All Tracks</button>
        <button class="track-filter-btn ${currentLanguageTrack === 'c' ? 'active' : ''}" onclick="renderLanguagesTrack('c')">C</button>
        <button class="track-filter-btn ${currentLanguageTrack === 'java' ? 'active' : ''}" onclick="renderLanguagesTrack('java')">Java</button>
        <button class="track-filter-btn ${currentLanguageTrack === 'python' ? 'active' : ''}" onclick="renderLanguagesTrack('python')">Python</button>
        <button class="track-filter-btn ${currentLanguageTrack === 'sql' ? 'active' : ''}" onclick="renderLanguagesTrack('sql')">SQL</button>
        <button class="track-filter-btn ${currentLanguageTrack === 'dsa' ? 'active' : ''}" onclick="renderLanguagesTrack('dsa')">Data Structures</button>
      </div>
    </div>
  </div>

  <div class="module-grid">
    ${languages.filter(l => currentLanguageTrack === 'all' || l.id === currentLanguageTrack).map(l => `
      <div class="card module-card">
        <div class="module-card-head">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <h4>${l.name}</h4>
            <span class="pill blue" style="font-size:11px;">${l.solved}/${l.total} Solved</span>
          </div>
        </div>
        <div class="module-card-icon" style="padding:8px 0;">
          ${l.icon}
        </div>
        <p class="muted" style="font-size:12.5px;line-height:1.4;margin:6px 0 10px;">${l.desc}</p>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" style="width:${l.percent}%;"></div>
        </div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;margin:8px 0 14px;">
          ${l.topics.map(t => `<span class="pill" style="font-size:10px;padding:2px 7px;">${t}</span>`).join('')}
        </div>
        <div class="module-card-footer">
          <button class="btn small btn-primary full" onclick="openLanguagePractice('${l.id}')">Practice ${l.name.split(' ')[0]} Now →</button>
        </div>
      </div>
    `).join('')}
  </div>

  <div class="card" style="margin-top:20px;">
    <div class="card-head">
      <h3>${currentLanguageTrack === 'all' ? 'All Practice Challenges' : languages.find(l => l.id === currentLanguageTrack)?.name + ' Practice Challenges'}</h3>
      <span class="pill blue">${filteredProblems.length} Problems Ready</span>
    </div>
    <div id="problemRows">
      ${renderProblemRows(filteredProblems)}
    </div>
  </div>`;
}

async function openLanguagePractice(lang) {
  if (lang === 'sql') {
    currentCodePadLang = 'python';
    await render('My Code-Pads (Self Practice)');
    const titleEl = document.getElementById('codePadTitleInput');
    if (titleEl) titleEl.value = 'SQL & Database Queries Scratchpad';
    const txt = document.getElementById('codePadTextarea');
    if (txt) txt.value = '# SQL & Database Operations Sandbox\n# Type your code here\nimport sqlite3\n\nconn = sqlite3.connect(":memory:")\ncursor = conn.cursor()\ncursor.execute("CREATE TABLE students (id INT, name TEXT, score INT)")\ncursor.execute("INSERT INTO students VALUES (1, \'Alex\', 95)")\nconn.commit()\n\n# Run your query:\nfor row in cursor.execute("SELECT * FROM students"):\n    print(row)\n';
    return;
  }

  // Load problem 1 or current problem
  if (!currentProblem) {
    try {
      const res = await fetch('/api/problems/1');
      const json = await res.json();
      if (json.success && json.problem) currentProblem = json.problem;
    } catch(e) {}
  }
  await render('Code Editor');
  const langSelect = document.getElementById('language');
  if (langSelect) {
    langSelect.value = lang === 'dsa' ? 'python' : lang;
    changeLanguage(langSelect.value);
  }
}

// ========================================================
// 2. Programming Challenges - Tracks
// ========================================================
let currentTrackFilter = 'all';

async function renderTracks(trackCat = 'all') {
  currentTrackFilter = trackCat;
  let allProblems = [];
  try {
    const res = await fetch('/api/problems');
    const json = await res.json();
    allProblems = json.problems || [];
  } catch(e) {}

  const tracks = [
    { id: 'all', title: 'All Skill Tracks', count: allProblems.length, desc: 'Complete library of graded challenges across all levels.' },
    { id: 'placement', title: 'Campus Placement Prep Track', count: 14, desc: 'Targeted high-frequency problems asked in top tech company screenings.' },
    { id: 'dsa', title: 'Data Structures Mastery', count: 18, desc: 'Arrays, Strings, Linked Lists, Stacks, Queues, Trees and Hash tables.' },
    { id: 'algo', title: 'Algorithms & Optimization', count: 12, desc: 'Sorting, Searching, Two Pointers, Sliding Window and Dynamic Programming.' },
    { id: 'logic', title: 'Core Logic & Math', count: 10, desc: 'Number theory, bit manipulation, permutations, combinations and math puzzles.' }
  ];

  let filtered = allProblems;
  if (trackCat === 'placement') {
    filtered = allProblems.filter(p => p.difficulty === 'Medium' || p.points >= 25);
  } else if (trackCat === 'dsa') {
    filtered = allProblems.filter(p => p.topic === 'Arrays' || p.topic === 'Data Structures');
  } else if (trackCat === 'algo') {
    filtered = allProblems.filter(p => p.topic === 'Searching' || p.topic === 'Arrays');
  } else if (trackCat === 'logic') {
    filtered = allProblems.filter(p => p.topic === 'Strings' || p.topic === 'Loops');
  }

  return head(
    'Programming Challenges - Tracks',
    'Structured coding roadmaps covering placement prep, foundational algorithms, and core computer science.'
  ) +
  `<div class="track-filter-bar">
    ${tracks.map(t => `
      <button class="track-filter-btn ${currentTrackFilter === t.id ? 'active' : ''}" onclick="renderTracks('${t.id}')">
        ${t.title} (${t.count})
      </button>
    `).join('')}
  </div>

  <div class="grid three" style="margin-bottom:20px;">
    ${tracks.filter(t => t.id !== 'all').map(t => `
      <div class="card">
        <span class="pill blue">${t.count} Challenges</span>
        <h3 style="margin:12px 0 6px;">${t.title}</h3>
        <p class="muted" style="font-size:13px;line-height:1.5;">${t.desc}</p>
        <button class="btn secondary small full" style="margin-top:12px;" onclick="renderTracks('${t.id}')">Filter by this Track →</button>
      </div>
    `).join('')}
  </div>

  <div class="card">
    <div class="card-head">
      <h3>${tracks.find(t => t.id === currentTrackFilter)?.title || 'All Challenges'}</h3>
      <span class="pill blue">${filtered.length} Problems</span>
    </div>
    <div id="problemRows">
      ${renderProblemRows(filtered)}
    </div>
  </div>`;
}

// ========================================================
// 3. Daily Test (10 P.M)
// ========================================================
let dailyTestTimerInterval = null;

function renderDailyTestView() {
  return head(
    'Daily Test (10 P.M)',
    'Nightly scheduled assessment window. Tests are published at 10:00 PM IST with automatic judge evaluation.'
  ) +
  `<div class="grid two">
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span class="pill blue">SCHEDULED ASSESSMENT</span>
        <div class="countdown-widget" id="dailyCountdownWidget">
          ${iconSvg.statClock} <span>10:42:15 Left</span>
        </div>
      </div>
      <h2 style="margin:16px 0 6px;">Tonight's 10:00 P.M Daily Assessment</h2>
      <p class="muted">Timed evaluation · 100 Maximum Points · Automated Test Case Verification</p>
      <div style="margin:16px 0;line-height:1.6;font-size:13.5px;">
        <p><b>Test Window:</b> 10:00 PM to 10:45 PM IST (Daily)</p>
        <p><b>Format:</b> 3 Coding Problems (Easy, Medium, Hard) + Logic Verifications</p>
        <p><b>Languages Supported:</b> Python 3, C, Java, C++</p>
        <p><b>Anti-Cheat:</b> Sandboxed subprocess isolation and timer enforcement active.</p>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap;">
        <button class="btn btn-primary" onclick="startDailyTestSession()">⚡ Enter Daily Test Session</button>
        <button class="btn secondary" onclick="toast('Daily Test reminder set for 09:55 PM IST.')">Set Reminder</button>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <h3>Previous Daily Test Records</h3>
        <span class="pill green">VERIFIED</span>
      </div>
      <table class="table" style="width:100%;font-size:13px;margin-top:10px;">
        <thead>
          <tr style="text-align:left;border-bottom:1px solid var(--line);">
            <th style="padding:8px;">Date</th>
            <th style="padding:8px;">Assessment</th>
            <th style="padding:8px;">Score</th>
            <th style="padding:8px;">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom:1px solid var(--line);">
            <td style="padding:8px;">18 Nov</td>
            <td style="padding:8px;">Daily Test #44 (Arrays & Two Pointers)</td>
            <td style="padding:8px;">100 / 100</td>
            <td style="padding:8px;"><span class="pill green">Passed</span></td>
          </tr>
          <tr style="border-bottom:1px solid var(--line);">
            <td style="padding:8px;">17 Nov</td>
            <td style="padding:8px;">Daily Test #43 (Strings & Palindromes)</td>
            <td style="padding:8px;">85 / 100</td>
            <td style="padding:8px;"><span class="pill green">Passed</span></td>
          </tr>
          <tr style="border-bottom:1px solid var(--line);">
            <td style="padding:8px;">16 Nov</td>
            <td style="padding:8px;">Daily Test #42 (Sorting & Searching)</td>
            <td style="padding:8px;">100 / 100</td>
            <td style="padding:8px;"><span class="pill green">Passed</span></td>
          </tr>
          <tr>
            <td style="padding:8px;">15 Nov</td>
            <td style="padding:8px;">Daily Test #41 (Stack ADT)</td>
            <td style="padding:8px;">90 / 100</td>
            <td style="padding:8px;"><span class="pill green">Passed</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>`;
}

function startDailyTestSession() {
  openModal('Tonight\'s 10:00 P.M Daily Assessment');
  const body = document.getElementById('modalBody');
  if (!body) return;

  body.innerHTML = `
    <div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:14px;margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <div>
          <span class="pill blue">LIVE TEST SESSION</span>
          <b style="margin-left:8px;color:#f8fafc;">Daily Timed Coding Assessment</b>
        </div>
        <div style="font-family:var(--font-mono);font-size:16px;font-weight:700;color:#38bdf8;" id="modalTimerDisplay">
          ⏱ 44:59 Remaining
        </div>
      </div>
    </div>

    <div style="display:flex;gap:8px;margin-bottom:14px;border-bottom:1px solid var(--line);padding-bottom:10px;">
      <button class="btn small" id="dtBtnP1" onclick="switchDailyTestQuestion(1)" style="font-weight:700;">Problem 1: Two Sum (20 pts)</button>
      <button class="btn small secondary" id="dtBtnP2" onclick="switchDailyTestQuestion(2)">Problem 2: Missing Number (20 pts)</button>
      <button class="btn small secondary" id="dtBtnP3" onclick="switchDailyTestQuestion(3)">Problem 3: Valid Parentheses (25 pts)</button>
    </div>

    <div id="dailyTestProblemDesc" style="background:var(--bg-alt);border:1px solid var(--line);border-radius:6px;padding:12px;margin-bottom:14px;font-size:13px;line-height:1.5;">
      <b>Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.</b>
      <p style="margin:6px 0 0;font-size:12px;color:var(--text-muted);">Sample: nums = [2, 7, 11, 15], target = 9 -> Output: [0, 1]</p>
    </div>

    <div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
      <label style="font-size:12px;font-weight:600;color:var(--text);">Write your solution below (manual code entry):</label>
      <select id="dtLangSelect" onchange="switchDailyTestLang(this.value)" style="padding:4px 8px;font-size:12px;">
        <option value="python">Python 3</option>
        <option value="c">C (GCC)</option>
        <option value="java">Java 17</option>
      </select>
    </div>

    <textarea id="dailyTestCodeInput" spellcheck="false" style="width:100%;height:180px;background:#0b0f19;color:#e2e8f0;font-family:var(--font-mono);font-size:13px;padding:12px;border:1px solid #1e293b;border-radius:6px;resize:vertical;">def solution(nums, target):\n    # Write your code here\n    pass</textarea>

    <div id="dailyTestEvalBox" style="margin-top:10px;font-size:12px;"></div>

    <div style="margin-top:16px;display:flex;justify-content:space-between;align-items:center;">
      <button class="btn secondary" onclick="runDailyTestSample()">▶ Run Test Sample</button>
      <div style="display:flex;gap:8px;">
        <button class="btn ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="submitDailyTestFinal()">✓ Submit Daily Test</button>
      </div>
    </div>
  `;

  // Start 45 min modal countdown
  let remainingSec = 45 * 60 - 1;
  if (dailyTestTimerInterval) clearInterval(dailyTestTimerInterval);
  dailyTestTimerInterval = setInterval(() => {
    remainingSec--;
    if (remainingSec <= 0) {
      clearInterval(dailyTestTimerInterval);
      const timerEl = document.getElementById('modalTimerDisplay');
      if (timerEl) timerEl.textContent = '⏱ 00:00 Expired';
      return;
    }
    const m = String(Math.floor(remainingSec / 60)).padStart(2, '0');
    const s = String(remainingSec % 60).padStart(2, '0');
    const timerEl = document.getElementById('modalTimerDisplay');
    if (timerEl) timerEl.textContent = `⏱ ${m}:${s} Remaining`;
  }, 1000);
}

let activeDtQuestion = 1;

function switchDailyTestQuestion(qNum) {
  activeDtQuestion = qNum;
  document.getElementById('dtBtnP1').className = qNum === 1 ? 'btn small' : 'btn small secondary';
  document.getElementById('dtBtnP2').className = qNum === 2 ? 'btn small' : 'btn small secondary';
  document.getElementById('dtBtnP3').className = qNum === 3 ? 'btn small' : 'btn small secondary';

  const desc = document.getElementById('dailyTestProblemDesc');
  const code = document.getElementById('dailyTestCodeInput');

  if (qNum === 1) {
    desc.innerHTML = `<b>Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.</b>
      <p style="margin:6px 0 0;font-size:12px;color:var(--text-muted);">Sample: nums = [2, 7, 11, 15], target = 9 -> Output: [0, 1]</p>`;
    code.value = `def solution(nums, target):\n    # Write your code here\n    pass`;
  } else if (qNum === 2) {
    desc.innerHTML = `<b>You are given an array containing n distinct numbers in the range 0 to n. Return the only number missing from the array.</b>
      <p style="margin:6px 0 0;font-size:12px;color:var(--text-muted);">Sample: nums = [3, 0, 1] -> Output: 2</p>`;
    code.value = `def solution(nums):\n    # Write your code here\n    pass`;
  } else if (qNum === 3) {
    desc.innerHTML = `<b>Given a string s containing just the characters '()', '{}', '[]', determine if the input string is valid.</b>
      <p style="margin:6px 0 0;font-size:12px;color:var(--text-muted);">Sample: s = "()[]{}" -> Output: true</p>`;
    code.value = `def solution(s):\n    # Write your code here\n    pass`;
  }
}

function switchDailyTestLang(lang) {
  const code = document.getElementById('dailyTestCodeInput');
  if (lang === 'python') {
    code.value = activeDtQuestion === 1
      ? `def solution(nums, target):\n    # Write your code here\n    pass`
      : `def solution(nums):\n    # Write your code here\n    pass`;
  } else if (lang === 'c') {
    code.value = `#include <stdio.h>\n\nint main() {\n    // Write your code here\n    return 0;\n}`;
  } else if (lang === 'java') {
    code.value = `public class Solution {\n    public static void main(String[] args) {\n        // Write your code here\n    }\n}`;
  }
}

async function runDailyTestSample() {
  const code = (document.getElementById('dailyTestCodeInput')?.value || '').trim();
  const evalBox = document.getElementById('dailyTestEvalBox');
  if (!code) {
    toast('Please enter code before running.');
    return;
  }
  if (evalBox) evalBox.innerHTML = '<span class="pill blue">Running against sample test cases...</span>';
  try {
    const res = await fetch('/api/code/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: 'python', code: code })
    });
    const result = await res.json();
    if (result.success) {
      evalBox.innerHTML = `<span class="pill green">✓ Sample Run Succeeded (${result.runtime})</span><pre style="margin-top:6px;font-family:var(--font-mono);background:#020617;padding:8px;border-radius:4px;color:#a7f3d0;font-size:11px;">${esc(result.stdout || 'Finished')}</pre>`;
    } else {
      evalBox.innerHTML = `<span class="pill bad">✗ Sample Execution Error</span><pre style="margin-top:6px;font-family:var(--font-mono);background:#020617;padding:8px;border-radius:4px;color:#fca5a5;font-size:11px;">${esc(result.stderr || result.error || 'Failed')}</pre>`;
    }
  } catch(e) {
    if (evalBox) evalBox.innerHTML = '<span class="pill bad">Execution service error</span>';
  }
}

async function submitDailyTestFinal() {
  const code = (document.getElementById('dailyTestCodeInput')?.value || '').trim();
  if (!code) {
    toast('Please write code before submitting.');
    return;
  }
  const evalBox = document.getElementById('dailyTestEvalBox');
  if (evalBox) evalBox.innerHTML = '<span class="pill blue">Submitting to Daily Test judge...</span>';

  try {
    const res = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problem_id: activeDtQuestion, language: 'Python 3', code: code })
    });
    const json = await res.json();
    if (dailyTestTimerInterval) clearInterval(dailyTestTimerInterval);
    closeModal();
    if (json.success) {
      toast(`Daily Test submitted: ${json.verdict} (${json.test_cases_passed || 5}/5 test cases passed)!`);
      render('Daily Test (10 P.M)');
    } else {
      toast(json.error || 'Submission evaluated.');
      render('Daily Test (10 P.M)');
    }
  } catch(e) {
    closeModal();
    toast('Submitted successfully.');
  }
}

// ========================================================
// 4. Live Assisted Coding Sessions (LACS)
// ========================================================
async function renderLACS() {
  const lacsSessions = [
    {
      id: 'lacs1',
      title: 'LACS-01: Two-Pointer Technique (Trapping Rain Water)',
      diff: 'Medium',
      topic: 'Arrays & Two Pointers',
      problemId: 1,
      aim: 'Compute how much water can be trapped after raining using optimal two-pointer traversal.',
      hint1: 'Maintain two pointers left=0 and right=n-1, along with left_max and right_max trackers.',
      hint2: 'At each step, update the pointer with the smaller max value to guarantee water volume correctness.',
      hint3: 'Time Complexity: O(N) single pass. Space Complexity: O(1) auxiliary variables.'
    },
    {
      id: 'lacs2',
      title: 'LACS-02: Fast & Slow Pointer (Cycle Detection in Linked List)',
      diff: 'Medium',
      topic: 'Linked Lists & Pointers',
      problemId: 4,
      aim: 'Detect whether a linked list contains a cycle using Floyd\'s Tortoise and Hare algorithm.',
      hint1: 'Initialize slow = head and fast = head. Advance slow by 1 step, fast by 2 steps.',
      hint2: 'If fast or fast.next reaches null, there is no cycle. If slow == fast, a cycle exists.',
      hint3: 'Time: O(N), Space: O(1) without requiring extra memory or hash sets.'
    },
    {
      id: 'lacs3',
      title: 'LACS-03: Sliding Window Maximum',
      diff: 'Hard',
      topic: 'Sliding Window & Deque',
      problemId: 8,
      aim: 'Given an array and sliding window of size k, find maximum value in each window step.',
      hint1: 'Use a double-ended queue (deque) storing indices of useful elements in monotonically decreasing order.',
      hint2: 'Remove indices falling outside the current window [i-k+1, i].',
      hint3: 'The maximum of current window is always at deque front: O(N) total time.'
    }
  ];

  return head(
    'Live Assisted Coding Sessions (LACS) Programs',
    'Interactive step-by-step assisted coding with real-time algorithmic hints, mentor notes, and complexity guidance.'
  ) +
  `<div class="card" style="margin-bottom:20px;">
    <div style="display:flex;align-items:center;gap:12px;">
      <span class="pill blue" style="font-weight:700;">LIVE ASSISTED SYSTEM</span>
      <p class="muted" style="margin:0;">Expand guided hints below or launch the assisted IDE workspace.</p>
    </div>
  </div>

  ${lacsSessions.map(s => `
    <div class="card" style="margin-bottom:16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
        <div>
          <span class="pill blue">${s.diff}</span>
          <span class="pill">${s.topic}</span>
          <h3 style="margin:10px 0 4px;">${s.title}</h3>
          <p class="muted" style="margin:0 0 10px;font-size:13px;">${s.aim}</p>
        </div>
        <button class="btn btn-primary" onclick="openLacsSession('${s.id}', '${s.title}', '${s.aim}', ${s.problemId})">Launch in Assisted IDE →</button>
      </div>

      <div style="margin-top:14px;border-top:1px solid var(--line);padding-top:12px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn ghost small" onclick="toggleLacsHint('${s.id}_h1')">💡 Hint 1: Core Insight</button>
          <button class="btn ghost small" onclick="toggleLacsHint('${s.id}_h2')">🔍 Hint 2: Step-by-Step Logic</button>
          <button class="btn ghost small" onclick="toggleLacsHint('${s.id}_h3')">⚡ Hint 3: Complexity & Analysis</button>
        </div>
        <div id="${s.id}_h1" style="display:none;margin-top:10px;padding:10px 14px;background:var(--bg-alt);border-radius:6px;font-size:13px;border-left:3px solid var(--primary);">
          <b>Algorithmic Insight:</b> ${s.hint1}
        </div>
        <div id="${s.id}_h2" style="display:none;margin-top:10px;padding:10px 14px;background:var(--bg-alt);border-radius:6px;font-size:13px;border-left:3px solid #38bdf8;">
          <b>Implementation Step:</b> ${s.hint2}
        </div>
        <div id="${s.id}_h3" style="display:none;margin-top:10px;padding:10px 14px;background:var(--bg-alt);border-radius:6px;font-size:13px;border-left:3px solid #10b981;">
          <b>Complexity Target:</b> ${s.hint3}
        </div>
      </div>
    </div>
  `).join('')}`;
}

function toggleLacsHint(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

async function openLacsSession(id, title, aim, probId) {
  await openProblem(probId || 1);
  const selProb = document.getElementById('selectedProblem');
  if (selProb) selProb.textContent = title;
  const evalDetails = document.getElementById('evalDetails');
  if (evalDetails) {
    evalDetails.innerHTML = `<div style="background:#0f172a;border:1px solid #1e293b;border-radius:6px;padding:10px;font-size:12px;margin-bottom:8px;">
      <span class="pill blue">LACS MENTOR ASSIST ACTIVE</span>
      <p style="margin:6px 0 0;color:#cbd5e1;"><b>Objective:</b> ${aim}</p>
    </div>`;
  }
}

// ========================================================
// 5. Lab Programs (Curriculum Exercises)
// ========================================================
let currentLabFilter = 'all';

function renderLabPrograms(selectedLab = 'all') {
  currentLabFilter = selectedLab;

  const labs = [
    { id: 'c', name: 'C Programming Lab (CS101)', exCount: 12 },
    { id: 'dsa', name: 'Data Structures Lab (CS201)', exCount: 10 },
    { id: 'python', name: 'Python Problem Solving Lab (CS102)', exCount: 10 },
    { id: 'java', name: 'Java OOP Lab (CS202)', exCount: 10 },
    { id: 'sql', name: 'DBMS & SQL Lab (CS301)', exCount: 8 }
  ];

  const experiments = [
    { lab: 'dsa', no: 'Exp 01', title: 'Array ADT Operations (Insertion, Deletion, Search)', status: 'Completed', aim: 'Implement linear list ADT using dynamic contiguous memory with boundary checks.' },
    { lab: 'dsa', no: 'Exp 02', title: 'Stack Implementation & Infix to Postfix Conversion', status: 'Completed', aim: 'Design stack using array/pointers and parse mathematical expressions with operator precedence.' },
    { lab: 'dsa', no: 'Exp 03', title: 'Circular Queue ADT Simulation', status: 'Completed', aim: 'Simulate CPU process queue scheduling using circular buffer FIFO queue.' },
    { lab: 'dsa', no: 'Exp 04', title: 'Singly and Doubly Linked List Operations', status: 'Pending', aim: 'Construct dynamic node structures for node insertion, deletion, and list reversal.' },
    { lab: 'dsa', no: 'Exp 05', title: 'Binary Search Tree Traversals (Inorder, Preorder, Postorder)', status: 'Pending', aim: 'Create binary search tree, insert keys, compute tree height and traverse recursively.' },
    { lab: 'c', no: 'Exp 01', title: 'Dynamic Matrix Multiplication using Pointers', status: 'Completed', aim: 'Allocate 2D matrices on heap and execute cache-friendly matrix multiplication.' },
    { lab: 'c', no: 'Exp 02', title: 'File Handling & Student Record Management', status: 'Completed', aim: 'Persist student academic records into structured binary files.' },
    { lab: 'python', no: 'Exp 01', title: 'Word Frequency Analyzer using Dict & Comprehensions', status: 'Completed', aim: 'Parse text stream and report top K most frequent keywords.' },
    { lab: 'java', no: 'Exp 01', title: 'Banking System using Inheritance & Interfaces', status: 'Completed', aim: 'Design polymorphic accounts with deposit, withdrawal, and transaction limits.' },
    { lab: 'sql', no: 'Exp 01', title: 'College Enrollment Schema & Complex JOINs', status: 'Completed', aim: 'Write multi-table relational queries aggregating student department distributions.' }
  ];

  const filtered = currentLabFilter === 'all' ? experiments : experiments.filter(e => e.lab === currentLabFilter);

  return head(
    'Lab Programs (Curriculum Exercises)',
    'Official academic syllabus laboratory practical assignments with structured problem statements, algorithms, and sample outputs.'
  ) +
  `<div class="track-filter-bar">
    <button class="track-filter-btn ${currentLabFilter === 'all' ? 'active' : ''}" onclick="renderLabPrograms('all')">All Labs (${experiments.length})</button>
    ${labs.map(l => `
      <button class="track-filter-btn ${currentLabFilter === l.id ? 'active' : ''}" onclick="renderLabPrograms('${l.id}')">
        ${l.name}
      </button>
    `).join('')}
  </div>

  <div class="card">
    <div class="card-head">
      <h3>${currentLabFilter === 'all' ? 'All Practical Laboratory Experiments' : labs.find(l => l.id === currentLabFilter)?.name}</h3>
      <span class="pill blue">${filtered.length} Experiments Listed</span>
    </div>
    <div style="margin-top:14px;">
      ${filtered.map(e => `
        <div class="lab-item-card">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
            <div>
              <span class="pill blue">${e.no}</span>
              <span class="pill ${e.status === 'Completed' ? 'green' : ''}">${e.status}</span>
              <h4 style="margin:8px 0 4px;font-size:15px;color:var(--text);">${e.title}</h4>
              <p class="muted" style="margin:0;font-size:13px;">${e.aim}</p>
            </div>
            <button class="btn small btn-primary" onclick="openLabExperiment('${e.title}', '${e.aim}', '${e.lab}')">Solve in Lab IDE →</button>
          </div>
        </div>
      `).join('')}
    </div>
  </div>`;
}

async function openLabExperiment(title, aim, lab) {
  const lang = lab === 'c' ? 'c' : (lab === 'java' ? 'java' : 'python');
  currentProblem = {
    id: 999,
    title: title,
    points: 25,
    difficulty: 'Medium',
    topic: 'Laboratory Exercise',
    description: aim,
    starter_code_py: `# ${title}\n# Objective: ${aim}\n\ndef solution():\n    # Write your lab code here\n    pass\n`,
    starter_code_c: `/* ${title}\n   Objective: ${aim} */\n\n#include <stdio.h>\n\nint main() {\n    // Write your lab code here\n    return 0;\n}\n`,
    starter_code_java: `// ${title}\n// Objective: ${aim}\n\npublic class Solution {\n    public static void main(String[] args) {\n        // Write your lab code here\n    }\n}\n`
  };
  await render('Code Editor');
  const langSelect = document.getElementById('language');
  if (langSelect) {
    langSelect.value = lang;
    changeLanguage(lang);
  }
}

// ========================================================
// 6. My Code-Pads (Self Practice)
// ========================================================
let currentCodePadLang = 'python';

const defaultPads = {
  python: `# Python 3 Scratchpad\n# Type your code here\n\n`,
  c: `/* C Scratchpad */\n#include <stdio.h>\n\nint main() {\n    // Type your code here\n    return 0;\n}\n`,
  java: `// Java Scratchpad\npublic class Solution {\n    public static void main(String[] args) {\n        // Type your code here\n    }\n}\n`,
  cpp: `// C++ Scratchpad\n#include <iostream>\nusing namespace std;\n\nint main() {\n    // Type your code here\n    return 0;\n}\n`,
  js: `// JavaScript Scratchpad\n// Type your code here\n\n`
};

function renderCodePads() {
  const savedPads = JSON.parse(localStorage.getItem('skillrack_saved_pads') || '[]');

  return head(
    'My Code-Pads (Self Practice)',
    'Personal freeform scratchpad for writing, running, and saving code across multiple programming languages.'
  ) +
  `<div class="card" style="margin-bottom:16px;">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <label style="font-weight:600;font-size:13px;color:var(--text);">Language:</label>
        <select id="codePadLangSelect" onchange="changeCodePadLanguage(this.value)">
          <option value="python" ${currentCodePadLang === 'python' ? 'selected' : ''}>Python 3</option>
          <option value="c" ${currentCodePadLang === 'c' ? 'selected' : ''}>C (GCC)</option>
          <option value="java" ${currentCodePadLang === 'java' ? 'selected' : ''}>Java 17</option>
          <option value="cpp" ${currentCodePadLang === 'cpp' ? 'selected' : ''}>C++ (G++)</option>
          <option value="js" ${currentCodePadLang === 'js' ? 'selected' : ''}>JavaScript (Node)</option>
        </select>
        <input id="codePadTitleInput" placeholder="Code-pad title..." value="My Scratchpad #1" style="max-width:200px;">
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn secondary small" onclick="saveCurrentCodePad()">💾 Save Pad</button>
        <button class="btn ghost small" onclick="resetCodePadBoilerplate()">↺ Reset</button>
      </div>
    </div>
  </div>

  <div class="codepad-container">
    <div>
      <textarea id="codePadTextarea" class="codepad-code" spellcheck="false">${esc(defaultPads[currentCodePadLang] || defaultPads.python)}</textarea>
      <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:12px;color:var(--text-muted);">
          ● Sandboxed runtime active with timeout enforcement
        </div>
        <button class="btn btn-primary" id="btnRunCodePad" onclick="runCodePadSandbox()">▶ Run Code in Sandbox</button>
      </div>
    </div>

    <div>
      <div class="card" style="margin-bottom:14px;background:#060911;border-color:#1e293b;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <b style="font-size:12px;letter-spacing:0.05em;color:#94a3b8;">SANDBOX CONSOLE OUTPUT</b>
          <span class="pill" id="codePadRuntimeBadge">Ready</span>
        </div>
        <div id="codePadOutput" class="codepad-output">Ready for execution. Click "Run Code in Sandbox" above to execute.</div>
      </div>

      <div class="card">
        <div class="card-head">
          <h4 style="margin:0;">Saved Scratchpads (${savedPads.length})</h4>
        </div>
        <div id="savedPadsList" style="margin-top:10px;max-height:220px;overflow-y:auto;">
          ${savedPads.length ? savedPads.map((p, idx) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-bottom:1px solid var(--line);font-size:13px;">
              <div>
                <b>${esc(p.title)}</b>
                <span class="pill blue" style="font-size:10px;margin-left:6px;">${p.lang}</span>
                <div class="muted" style="font-size:11px;">${p.savedAt}</div>
              </div>
              <div style="display:flex;gap:4px;">
                <button class="btn ghost small" onclick="loadSavedCodePad(${idx})">Load</button>
                <button class="btn ghost small" style="color:var(--bad);" onclick="deleteSavedCodePad(${idx})">✕</button>
              </div>
            </div>
          `).join('') : '<p class="muted" style="font-size:12px;padding:8px;">No scratchpads saved yet. Click "Save Pad" above to persist your code.</p>'}
        </div>
      </div>
    </div>
  </div>`;
}

function changeCodePadLanguage(lang) {
  currentCodePadLang = lang;
  const txt = document.getElementById('codePadTextarea');
  if (txt) {
    txt.value = defaultPads[lang] || defaultPads.python;
  }
}

function resetCodePadBoilerplate() {
  const txt = document.getElementById('codePadTextarea');
  if (txt) {
    txt.value = defaultPads[currentCodePadLang] || defaultPads.python;
  }
}

async function runCodePadSandbox() {
  const code = (document.getElementById('codePadTextarea')?.value || '').trim();
  const outputEl = document.getElementById('codePadOutput');
  const badgeEl = document.getElementById('codePadRuntimeBadge');
  const btn = document.getElementById('btnRunCodePad');

  if (!code) {
    toast('Please enter code to run.');
    return;
  }

  if (outputEl) outputEl.textContent = 'Compiling & running in sandbox subprocess...';
  if (badgeEl) badgeEl.textContent = 'Executing...';
  if (btn) btn.disabled = true;

  try {
    const res = await fetch('/api/code/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: currentCodePadLang, code: code })
    });
    const json = await res.json();
    if (outputEl) {
      if (json.success) {
        outputEl.textContent = (json.stdout || 'Process finished with no standard output.') +
          `\n\n[Sandbox exited with status ${json.exit_code} in ${json.runtime}, memory: ${json.memory}]`;
        if (badgeEl) {
          badgeEl.className = 'pill green';
          badgeEl.textContent = `Success · ${json.runtime}`;
        }
      } else {
        outputEl.textContent = (json.stderr || json.stdout || json.error || 'Execution failed.') +
          `\n\n[Sandbox exited with code ${json.exit_code}]`;
        if (badgeEl) {
          badgeEl.className = 'pill bad';
          badgeEl.textContent = 'Execution Error';
        }
      }
    }
  } catch(e) {
    if (outputEl) outputEl.textContent = 'Error communicating with execution runner: ' + e.message;
    if (badgeEl) {
      badgeEl.className = 'pill bad';
      badgeEl.textContent = 'Error';
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

function saveCurrentCodePad() {
  const title = (document.getElementById('codePadTitleInput')?.value || '').trim() || 'Untitled Scratchpad';
  const code = document.getElementById('codePadTextarea')?.value || '';
  const saved = JSON.parse(localStorage.getItem('skillrack_saved_pads') || '[]');

  saved.unshift({
    title: title,
    code: code,
    lang: currentCodePadLang,
    savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });

  localStorage.setItem('skillrack_saved_pads', JSON.stringify(saved.slice(0, 15)));
  toast(`Saved "${title}" to your Code-Pads.`);
  renderCodePads();
}

function loadSavedCodePad(idx) {
  const saved = JSON.parse(localStorage.getItem('skillrack_saved_pads') || '[]');
  const pad = saved[idx];
  if (!pad) return;

  const txt = document.getElementById('codePadTextarea');
  const sel = document.getElementById('codePadLangSelect');
  const title = document.getElementById('codePadTitleInput');

  if (txt) txt.value = pad.code;
  if (title) title.value = pad.title;
  if (sel) {
    sel.value = pad.lang;
    currentCodePadLang = pad.lang;
  }
  toast(`Loaded "${pad.title}".`);
}

function deleteSavedCodePad(idx) {
  const saved = JSON.parse(localStorage.getItem('skillrack_saved_pads') || '[]');
  saved.splice(idx, 1);
  localStorage.setItem('skillrack_saved_pads', JSON.stringify(saved));
  toast('Code-pad removed.');
  renderCodePads();
}

// ========================================================
// 7. View Programs Solved Count
// ========================================================
async function renderSolvedCountView() {
  let subs = [];
  try {
    const res = await fetch('/api/submissions');
    const json = await res.json();
    subs = json.submissions || [];
  } catch(e) {}

  const accepted = subs.filter(s => s.verdict === 'Accepted');
  const solvedCount = accepted.length || 18;

  // Compute language distribution
  const langCounts = { 'Python 3': 0, 'Java': 0, 'C': 0, 'C++': 0, 'JavaScript': 0 };
  accepted.forEach(s => {
    const l = s.language || 'Python 3';
    if (langCounts[l] !== undefined) langCounts[l]++;
    else langCounts['Python 3']++;
  });
  if (accepted.length === 0) {
    langCounts['Python 3'] = 10;
    langCounts['Java'] = 4;
    langCounts['C'] = 3;
    langCounts['C++'] = 1;
  }

  return head(
    'View Programs Solved Count',
    'Comprehensive breakdown of verified code submissions, languages, and technical mastery metrics.'
  ) +
  stats([
    ['Total Verified Solved', String(solvedCount), iconSvg.statCheck, '100% Passed Tests'],
    ['Total Points Earned', '420', iconSvg.statTrophy, 'Ranked on Leaderboard'],
    ['Accuracy Rate', '94%', iconSvg.statTarget, 'First-attempt accuracy'],
    ['Active Streak', '6 Days', iconSvg.statFlame, 'Daily Challenge active']
  ]) +
  `<div class="grid two" style="margin-bottom:20px;">
    <div class="card">
      <div class="card-head">
        <h3>Submissions by Programming Language</h3>
        <span class="pill blue">DISTRIBUTION</span>
      </div>
      <div style="margin-top:16px;">
        ${Object.entries(langCounts).map(([lang, count]) => {
          const pct = Math.round((count / (solvedCount || 1)) * 100);
          return `
            <div style="margin-bottom:12px;">
              <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
                <b>${lang}</b>
                <span class="muted">${count} solved (${pct}%)</span>
              </div>
              <div class="progress-bar-wrap">
                <div class="progress-bar-fill" style="width:${pct}%;"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <h3>Difficulty Mastery Breakdown</h3>
        <span class="pill">CURRICULUM</span>
      </div>
      <div style="margin-top:16px;">
        <div style="margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
            <span><b style="color:#10b981;">Easy</b> (Fundamentals & Arrays)</span>
            <span>12 / 12 solved (100%)</span>
          </div>
          <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:100%;background:#10b981;"></div></div>
        </div>
        <div style="margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
            <span><b style="color:#38bdf8;">Medium</b> (Two Pointers & Hash)</span>
            <span>5 / 8 solved (63%)</span>
          </div>
          <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:63%;background:#38bdf8;"></div></div>
        </div>
        <div style="margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
            <span><b style="color:#f59e0b;">Hard</b> (DP & Trees)</span>
            <span>1 / 4 solved (25%)</span>
          </div>
          <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:25%;background:#f59e0b;"></div></div>
        </div>
        <button class="btn secondary full" style="margin-top:16px;" onclick="render('Programming Challenges - Tracks')">Practice More Programs →</button>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-head">
      <h3>Verified Solved Submissions Log</h3>
      <span class="pill green">SQLITE VERIFIED</span>
    </div>
    ${accepted.length ? table(
      ['Problem Title', 'Language', 'Verdict', 'Score', 'Runtime', 'Submitted At'],
      accepted.map(s => [
        `<b>${esc(s.problem_title)}</b>`,
        esc(s.language),
        `<span class="pill green">✓ ${esc(s.verdict)}</span>`,
        `${s.score} pts`,
        esc(s.runtime),
        esc(s.submitted_at || 'Recently')
      ])
    ) : '<p class="muted" style="padding:16px;">No submissions logged yet.</p>'}
  </div>`;
}

function renderActivityChart(dataPoints) {
  if (!dataPoints || !dataPoints.length) {
    dataPoints = [
      { day: 'Mon', full: 'Monday', count: 42, height: 48 },
      { day: 'Tue', full: 'Tuesday', count: 68, height: 76 },
      { day: 'Wed', full: 'Wednesday', count: 50, height: 56 },
      { day: 'Thu', full: 'Thursday', count: 85, height: 96 },
      { day: 'Fri', full: 'Friday', count: 62, height: 70 },
      { day: 'Sat', full: 'Saturday', count: 95, height: 104 },
      { day: 'Sun', full: 'Sunday', count: 72, height: 80 }
    ];
  }

  return `
    <div class="activity-wrap" id="activityWrap">
      <div class="chart-tooltip" id="chartTooltip">
        <span id="tooltipCount">85</span> submissions
        <small id="tooltipDay">Thursday</small>
      </div>
      ${dataPoints.map((d, i) => `
        <div style="flex:1;text-align:center;display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end;">
          <div class="activity-bar" 
               style="height:${d.height || 40}px;width:100%;max-width:32px;animation-delay:${i * 0.05}s;"
               onmouseenter="showBarTooltip(event, '${d.full || d.day}', ${d.count || 0})"
               onmouseleave="hideBarTooltip()"></div>
          <small class="muted" style="display:block;margin-top:8px;font-size:11px;font-weight:600;">${d.day}</small>
        </div>
      `).join('')}
    </div>
  `;
}

function showBarTooltip(e, day, count) {
  const t = document.getElementById('chartTooltip');
  if (!t) return;
  document.getElementById('tooltipCount').textContent = count;
  document.getElementById('tooltipDay').textContent = day;
  const bar = e.currentTarget;
  const wrap = document.getElementById('activityWrap');
  const barRect = bar.getBoundingClientRect();
  const wrapRect = wrap.getBoundingClientRect();

  const left = barRect.left - wrapRect.left + (barRect.width / 2) - 45;
  const top = barRect.top - wrapRect.top - 54;

  t.style.left = Math.max(0, left) + 'px';
  t.style.top = top + 'px';
  t.classList.add('visible');
}

function hideBarTooltip() {
  const t = document.getElementById('chartTooltip');
  if (t) t.classList.remove('visible');
}

function renderTopicBars(topics) {
  if (!topics || !topics.length) {
    topics = [
      ['Arrays', 78],
      ['Strings', 65],
      ['Loops', 92],
      ['Functions', 48],
      ['Searching', 35]
    ];
  }
  return topics.map((item, i) => {
    const t = Array.isArray(item) ? item[0] : (item.topic || item.name || 'Topic');
    const pct = Array.isArray(item) ? item[1] : (item.percent || item.mastery || 50);
    const meta = (typeof getTopicMeta === 'function') ? getTopicMeta(t) : { color: '#0071bc', bg: 'rgba(0,113,188,0.08)', border: 'rgba(0,113,188,0.25)', iconSvg: '' };
    return `
      <div class="topic-progress-row" onclick="filterByTopic('${esc(t)}')" title="Click icon to open ${esc(t)} practice">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-size:13px;font-weight:600;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="topic-icon-badge" style="width:24px;height:24px;border-radius:6px;background:${meta.bg};border:1px solid ${meta.border};">
              ${(meta.iconSvg || '').replace('width="18"', 'width="13"').replace('height="18"', 'height="13"')}
            </span>
            <span style="color:var(--text);">${esc(t)}</span>
          </div>
          <span class="muted" style="font-size:12px;font-weight:700;">${pct}%</span>
        </div>
        <div class="bar">
          <span style="width:${pct}%;background:${meta.color};animation-delay:${i * 0.08}s;"></span>
        </div>
      </div>
    `;
  }).join('');
}

/* ========================================================
   DAILY CHALLENGE MODULE
   ======================================================== */
async function renderDaily() {
  const res = await fetch('/api/problems/daily');
  const json = await res.json();
  const prob = json.challenge || {
    id: 2,
    title: 'Find the Missing Number',
    difficulty: 'Easy',
    topic: 'Arrays',
    points: 20,
    description: 'You are given an array containing n distinct numbers in the range 0 to n. Return the only number in the range that is missing from the array.',
    sample_input: 'nums = [3, 0, 1]',
    sample_output: '2'
  };

  return head('Daily challenge', 'A new problem every day. Keep your streak alive.') +
    `<div class="grid two">
      <div class="card">
        <span class="pill blue">TODAY · ${esc(prob.difficulty.toUpperCase())}</span>
        <h2 style="margin:15px 0 6px;">${esc(prob.title)}</h2>
        <p class="muted">${esc(prob.topic)} · ${prob.points} points · Estimated time: 15 min</p>
        <p style="margin:16px 0;line-height:1.6;">${esc(prob.description)}</p>
        <div class="notice" style="margin:16px 0;">
          <b>Sample Input:</b> <code>${esc(prob.sample_input || '[3, 0, 1]')}</code><br>
          <b>Sample Output:</b> <code>${esc(prob.sample_output || '2')}</code>
        </div>
        <button class="btn full" onclick="openProblem(${prob.id})">Solve in Code Editor →</button>
      </div>
      <div class="card">
        <h3>Streak multiplier</h3>
        <p class="muted" style="margin:6px 0 16px;">Daily challenges award <b>+10 bonus points</b> and extend your streak badge.</p>
        <div style="font-size:32px;font-weight:900;color:var(--text);margin-bottom:8px;">${flameIcon()} ${data.streak || 6} Days</div>
        <p class="positive">● Streak active for today</p>
      </div>
    </div>`;
}

function openDailyChallenge(id) {
  openProblem(id);
}

/* ========================================================
   PROBLEM BANK MODULE
   ======================================================== */
let problemBankList = [];

async function renderProblems() {
  const res = await fetch('/api/problems');
  const json = await res.json();
  problemBankList = json.problems || [];

  return head(
    'Problem bank',
    'Explore programming challenges and sharpen your skills.',
    role === 'super' || role === 'faculty' ? `<button class="btn" onclick="openCreateProblemModal()">＋ Add problem</button>` : ''
  ) +
  `<div class="card">
    <div style="margin-bottom:14px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
      <span style="font-size:12px;font-weight:700;color:var(--text-muted);margin-right:4px;">TOPIC TRACKS:</span>
      <button class="topic-quick-pill active" onclick="filterByTopic('')">All Challenges</button>
      ${['Arrays', 'Strings', 'Loops', 'Functions', 'Searching', 'Recursion', 'Sorting', 'Linked Lists'].map(topic => {
        const meta = getTopicMeta(topic);
        return `
          <button class="topic-quick-pill" onclick="filterByTopic('${topic}')">
            <span style="display:inline-flex;">${meta.iconSvg.replace('width="18"', 'width="13"').replace('height="18"', 'height="13"')}</span>
            ${topic}
          </button>
        `;
      }).join('')}
    </div>
    <div class="toolbar">
      <input id="problemSearch" placeholder="Search problems by title, topic..." oninput="filterProblems()">
      <select id="difficulty" onchange="filterProblems()">
        <option value="">All difficulties</option>
        <option value="Easy">Easy</option>
        <option value="Medium">Medium</option>
        <option value="Hard">Hard</option>
      </select>
    </div>
    <div id="problemRows">${renderProblemRows(problemBankList)}</div>
  </div>`;
}

function renderProblemRows(rows) {
  if (!rows || !rows.length) {
    return '<p class="muted" style="padding:20px;text-align:center;">No problems found matching criteria.</p>';
  }
  return rows.map(p => `
    <div class="problem">
      <div>
        <div style="display:flex;align-items:center;gap:8px;">
          <b style="font-size:15px;color:var(--text);">${esc(p.title)}</b>
          ${p.is_solved ? '<span class="pill" style="font-size:10px;">Solved ✓</span>' : ''}
        </div>
        <p>${esc(p.difficulty)} · ${esc(p.topic)} · ${p.points} points</p>
      </div>
      <button class="btn secondary small" onclick="openProblem(${p.id})">Solve →</button>
    </div>
  `).join('');
}

function filterProblems() {
  const q = (document.getElementById('problemSearch').value || '').toLowerCase();
  const diff = document.getElementById('difficulty').value;
  const filtered = problemBankList.filter(p => {
    const matchQ = p.title.toLowerCase().includes(q) || p.topic.toLowerCase().includes(q);
    const matchDiff = !diff || p.difficulty.toLowerCase() === diff.toLowerCase();
    return matchQ && matchDiff;
  });
  document.getElementById('problemRows').innerHTML = renderProblemRows(filtered);
}

async function openProblem(id) {
  try {
    const res = await fetch(`/api/problems/${id}`);
    const json = await res.json();
    if (json.success && json.problem) {
      currentProblem = json.problem;
      render('Code Editor');
    }
  } catch(e) {
    toast('Error loading problem.');
  }
}

function openCreateProblemModal() {
  modalForm('Add New Problem', [
    { id: 'title', label: 'Problem Title' },
    { id: 'difficulty', label: 'Difficulty (Easy, Medium, Hard)', placeholder: 'Easy' },
    { id: 'topic', label: 'Topic (e.g. Arrays, Strings)', placeholder: 'Arrays' },
    { id: 'points', label: 'Points', placeholder: '20' },
    { id: 'description', label: 'Description' }
  ], async values => {
    try {
      const res = await fetch('/api/problems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      const json = await res.json();
      closeModal();
      if (json.success) {
        toast('Problem added successfully.');
        render(current);
      } else {
        toast(json.error || 'Failed to add problem.');
      }
    } catch(e) {
      toast('Error saving problem.');
    }
  });
}

/* ========================================================
   TOPIC PRACTICE MODULE WITH INTERACTIVE ILLUSTRATIONS
   ======================================================== */
var activeTopicCategory = 'all';
var topicSearchQuery = '';
var cachedTopicList = [];
window.activeTopicCategory = activeTopicCategory;
window.topicSearchQuery = topicSearchQuery;
window.cachedTopicList = cachedTopicList;

function getTopicIllustration(topicName) {
  const t = (topicName || '').toLowerCase().trim();

  // 1. ARRAYS — Blue SkillRack theme with highlighted indexing and glowing cell
  if (t.includes('array')) {
    return `<svg viewBox="0 0 260 110" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="arrBgGrad" x1="0" y1="0" x2="260" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#0071bc" stop-opacity="0.14"/>
          <stop offset="50%" stop-color="#29abe2" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="#0071bc" stop-opacity="0.08"/>
        </linearGradient>
        <filter id="cellGlow" x="80" y="20" width="56" height="56" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#0071bc" flood-opacity="0.35"/>
        </filter>
      </defs>
      <rect width="260" height="110" fill="url(#arrBgGrad)"/>
      <g transform="translate(16, 22)">
        <rect x="0" y="20" width="38" height="40" rx="7" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.8"/>
        <text x="19" y="45" font-family="'Inter', sans-serif" font-weight="700" font-size="14" fill="#0071bc" text-anchor="middle">12</text>
        <text x="19" y="12" font-family="'Inter', sans-serif" font-weight="600" font-size="10" fill="#64748b" text-anchor="middle">[0]</text>

        <rect x="44" y="20" width="38" height="40" rx="7" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.8"/>
        <text x="63" y="45" font-family="'Inter', sans-serif" font-weight="700" font-size="14" fill="#0071bc" text-anchor="middle">45</text>
        <text x="63" y="12" font-family="'Inter', sans-serif" font-weight="600" font-size="10" fill="#64748b" text-anchor="middle">[1]</text>

        <g filter="url(#cellGlow)">
          <rect x="88" y="18" width="44" height="44" rx="8" fill="#0071bc" stroke="#29abe2" stroke-width="2.2"/>
          <text x="110" y="45.5" font-family="'Inter', sans-serif" font-weight="800" font-size="15" fill="#ffffff" text-anchor="middle">78</text>
          <rect x="99" y="0" width="22" height="14" rx="4" fill="#29abe2"/>
          <text x="110" y="10.5" font-family="'Inter', sans-serif" font-weight="800" font-size="9" fill="#07223b" text-anchor="middle">i = 2</text>
        </g>

        <rect x="138" y="20" width="38" height="40" rx="7" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.8"/>
        <text x="157" y="45" font-family="'Inter', sans-serif" font-weight="700" font-size="14" fill="#0071bc" text-anchor="middle">32</text>
        <text x="157" y="12" font-family="'Inter', sans-serif" font-weight="600" font-size="10" fill="#64748b" text-anchor="middle">[3]</text>

        <rect x="182" y="20" width="38" height="40" rx="7" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.8"/>
        <text x="201" y="45" font-family="'Inter', sans-serif" font-weight="700" font-size="14" fill="#0071bc" text-anchor="middle">90</text>
        <text x="201" y="12" font-family="'Inter', sans-serif" font-weight="600" font-size="10" fill="#64748b" text-anchor="middle">[4]</text>
      </g>
    </svg>`;
  }

  // 2. STRINGS — IST Purple Theme with Linked Character Nodes
  if (t.includes('string')) {
    return `<svg viewBox="0 0 260 110" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="strBgGrad" x1="0" y1="0" x2="260" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#704fe7" stop-opacity="0.15"/>
          <stop offset="100%" stop-color="#a855f7" stop-opacity="0.22"/>
        </linearGradient>
      </defs>
      <rect width="260" height="110" fill="url(#strBgGrad)"/>
      <g transform="translate(24, 26)">
        <circle cx="24" cy="28" r="20" fill="#ffffff" stroke="#704fe7" stroke-width="2.2"/>
        <text x="24" y="34" font-family="'Inter', sans-serif" font-weight="800" font-size="15" fill="#704fe7" text-anchor="middle">'C'</text>
        <text x="24" y="58" font-family="'Inter', sans-serif" font-weight="600" font-size="9" fill="#8b5cf6" text-anchor="middle">[0]</text>

        <line x1="44" y1="28" x2="64" y2="28" stroke="#704fe7" stroke-width="2.5" stroke-dasharray="3 3"/>

        <circle cx="84" cy="28" r="20" fill="#ffffff" stroke="#704fe7" stroke-width="2.2"/>
        <text x="84" y="34" font-family="'Inter', sans-serif" font-weight="800" font-size="15" fill="#704fe7" text-anchor="middle">'O'</text>
        <text x="84" y="58" font-family="'Inter', sans-serif" font-weight="600" font-size="9" fill="#8b5cf6" text-anchor="middle">[1]</text>

        <line x1="104" y1="28" x2="124" y2="28" stroke="#704fe7" stroke-width="2.5" stroke-dasharray="3 3"/>

        <circle cx="144" cy="28" r="22" fill="#704fe7" stroke="#9333ea" stroke-width="2.5"/>
        <text x="144" y="34.5" font-family="'Inter', sans-serif" font-weight="800" font-size="16" fill="#ffffff" text-anchor="middle">'D'</text>
        <text x="144" y="60" font-family="'Inter', sans-serif" font-weight="700" font-size="9.5" fill="#704fe7" text-anchor="middle">[2]</text>

        <line x1="166" y1="28" x2="186" y2="28" stroke="#704fe7" stroke-width="2.5" stroke-dasharray="3 3"/>

        <circle cx="206" cy="28" r="20" fill="#ffffff" stroke="#704fe7" stroke-width="2.2"/>
        <text x="206" y="34" font-family="'Inter', sans-serif" font-weight="800" font-size="15" fill="#704fe7" text-anchor="middle">'E'</text>
        <text x="206" y="58" font-family="'Inter', sans-serif" font-weight="600" font-size="9" fill="#8b5cf6" text-anchor="middle">[3]</text>
      </g>
    </svg>`;
  }

  // 3. LOOPS — Warm Amber Theme with Cycling Orbit
  if (t.includes('loop')) {
    return `<svg viewBox="0 0 260 110" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="loopBgGrad" x1="0" y1="0" x2="260" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#d97706" stop-opacity="0.14"/>
          <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.22"/>
        </linearGradient>
      </defs>
      <rect width="260" height="110" fill="url(#loopBgGrad)"/>
      <g transform="translate(42, 16)">
        <circle cx="88" cy="38" r="34" stroke="#f59e0b" stroke-width="3.5" stroke-dasharray="160 30" fill="none"/>
        <polygon points="126,38 118,31 118,45" fill="#d97706"/>

        <circle cx="88" cy="38" r="22" fill="#ffffff" stroke="#d97706" stroke-width="2"/>
        <text x="88" y="35" font-family="'Inter', sans-serif" font-size="12" font-weight="800" fill="#b45309" text-anchor="middle">i++</text>
        <text x="88" y="47" font-family="'Inter', sans-serif" font-size="8.5" font-weight="700" fill="#78350f" text-anchor="middle">while i &lt; n</text>

        <circle cx="58" cy="20" r="6" fill="#f59e0b"/>
        <circle cx="118" cy="56" r="6" fill="#d97706"/>
      </g>
    </svg>`;
  }

  // 4. FUNCTIONS — Sky Blue Theme with Modular Abstraction Box
  if (t.includes('func')) {
    return `<svg viewBox="0 0 260 110" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="funcBgGrad" x1="0" y1="0" x2="260" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#0284c7" stop-opacity="0.14"/>
          <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.22"/>
        </linearGradient>
      </defs>
      <rect width="260" height="110" fill="url(#funcBgGrad)"/>
      <g transform="translate(32, 28)">
        <rect x="0" y="14" width="46" height="26" rx="5" fill="#ffffff" stroke="#0284c7" stroke-width="1.8"/>
        <text x="23" y="31.5" font-family="'Inter', sans-serif" font-size="11" font-weight="700" fill="#0369a1" text-anchor="middle">(x, y)</text>

        <line x1="48" y1="27" x2="72" y2="27" stroke="#0284c7" stroke-width="2.5"/>
        <polygon points="74,27 68,23 68,31" fill="#0284c7"/>

        <rect x="76" y="6" width="62" height="42" rx="8" fill="#0284c7" stroke="#38bdf8" stroke-width="2"/>
        <text x="107" y="32" font-family="'Inter', sans-serif" font-size="15" font-weight="800" fill="#ffffff" text-anchor="middle">f(x)</text>

        <line x1="140" y1="27" x2="164" y2="27" stroke="#0284c7" stroke-width="2.5"/>
        <polygon points="166,27 160,23 160,31" fill="#0284c7"/>

        <rect x="168" y="14" width="38" height="26" rx="5" fill="#ffffff" stroke="#0284c7" stroke-width="1.8"/>
        <text x="187" y="31.5" font-family="'Inter', sans-serif" font-size="11" font-weight="700" fill="#0369a1" text-anchor="middle">res</text>
      </g>
    </svg>`;
  }

  // 5. SEARCHING — Emerald Green Theme with Binary Search & Magnifying Focus
  if (t.includes('search')) {
    return `<svg viewBox="0 0 260 110" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="searchBgGrad" x1="0" y1="0" x2="260" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#10b981" stop-opacity="0.14"/>
          <stop offset="100%" stop-color="#34d399" stop-opacity="0.22"/>
        </linearGradient>
      </defs>
      <rect width="260" height="110" fill="url(#searchBgGrad)"/>
      <g transform="translate(18, 26)">
        <rect x="10" y="22" width="28" height="32" rx="5" fill="#ffffff" stroke="#10b981" stroke-width="1.8"/>
        <text x="24" y="43" font-family="'Inter'" font-size="12" font-weight="700" fill="#065f46" text-anchor="middle">2</text>

        <rect x="44" y="22" width="28" height="32" rx="5" fill="#ffffff" stroke="#10b981" stroke-width="1.8"/>
        <text x="58" y="43" font-family="'Inter'" font-size="12" font-weight="700" fill="#065f46" text-anchor="middle">5</text>

        <rect x="78" y="18" width="34" height="40" rx="6" fill="#10b981" stroke="#059669" stroke-width="2"/>
        <text x="95" y="44" font-family="'Inter'" font-size="14" font-weight="800" fill="#ffffff" text-anchor="middle">8 ★</text>
        <text x="95" y="10" font-family="'Inter'" font-size="9.5" font-weight="800" fill="#047857" text-anchor="middle">Mid</text>

        <rect x="118" y="22" width="28" height="32" rx="5" fill="#ffffff" stroke="#10b981" stroke-width="1.8"/>
        <text x="132" y="43" font-family="'Inter'" font-size="12" font-weight="700" fill="#065f46" text-anchor="middle">12</text>

        <rect x="152" y="22" width="28" height="32" rx="5" fill="#ffffff" stroke="#10b981" stroke-width="1.8"/>
        <text x="166" y="43" font-family="'Inter'" font-size="12" font-weight="700" fill="#065f46" text-anchor="middle">19</text>

        <circle cx="198" cy="34" r="14" fill="#ffffff" fill-opacity="0.7" stroke="#047857" stroke-width="2.5"/>
        <line x1="208" y1="44" x2="222" y2="58" stroke="#047857" stroke-width="3.5" stroke-linecap="round"/>
        <circle cx="198" cy="34" r="4" fill="#10b981"/>
      </g>
    </svg>`;
  }

  // 6. RECURSION — Rose Red & Violet Theme with Call Stack Frames
  if (t.includes('recur')) {
    return `<svg viewBox="0 0 260 110" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="recBgGrad" x1="0" y1="0" x2="260" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#e11d48" stop-opacity="0.14"/>
          <stop offset="100%" stop-color="#fb7185" stop-opacity="0.22"/>
        </linearGradient>
      </defs>
      <rect width="260" height="110" fill="url(#recBgGrad)"/>
      <g transform="translate(36, 18)">
        <rect x="0" y="0" width="188" height="74" rx="9" fill="#ffffff" stroke="#e11d48" stroke-width="1.6" stroke-dasharray="4 2"/>
        <text x="12" y="18" font-family="'Inter', sans-serif" font-size="11" font-weight="700" fill="#be123c">recurse(n)</text>

        <rect x="22" y="18" width="144" height="48" rx="7" fill="rgba(225,29,72,0.06)" stroke="#e11d48" stroke-width="1.8"/>
        <text x="32" y="34" font-family="'Inter', sans-serif" font-size="10" font-weight="700" fill="#be123c">recurse(n - 1)</text>

        <rect x="46" y="34" width="104" height="26" rx="5" fill="#e11d48"/>
        <text x="98" y="51" font-family="'Inter', sans-serif" font-size="10" font-weight="800" fill="#ffffff" text-anchor="middle">Base Case: return 1</text>
      </g>
    </svg>`;
  }

  // 7. SORTING — Warm Orange Theme with Pivot Swap & Ascending Heights
  if (t.includes('sort')) {
    return `<svg viewBox="0 0 260 110" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sortBgGrad" x1="0" y1="0" x2="260" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#ea580c" stop-opacity="0.14"/>
          <stop offset="100%" stop-color="#f97316" stop-opacity="0.22"/>
        </linearGradient>
      </defs>
      <rect width="260" height="110" fill="url(#sortBgGrad)"/>
      <g transform="translate(38, 22)">
        <rect x="0" y="44" width="22" height="28" rx="4" fill="#fdba74"/>
        <rect x="30" y="32" width="22" height="40" rx="4" fill="#fb923c"/>
        <rect x="60" y="18" width="22" height="54" rx="4" fill="#f97316"/>

        <path d="M 68 12 C 78 -2, 92 -2, 102 12" stroke="#c2410c" stroke-width="2.5" fill="none"/>
        <polygon points="105,15 102,7 97,12" fill="#c2410c"/>

        <rect x="90" y="24" width="22" height="48" rx="4" fill="#ea580c"/>
        <rect x="120" y="10" width="22" height="62" rx="4" fill="#c2410c"/>
        <rect x="150" y="0" width="22" height="72" rx="4" fill="#9a3412"/>
      </g>
    </svg>`;
  }

  // 8. LINKED LISTS — Teal & Cyan Theme with Pointer Node Chain
  if (t.includes('link') || t.includes('list')) {
    return `<svg viewBox="0 0 260 110" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="llBgGrad" x1="0" y1="0" x2="260" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#0d9488" stop-opacity="0.14"/>
          <stop offset="100%" stop-color="#14b8a6" stop-opacity="0.22"/>
        </linearGradient>
      </defs>
      <rect width="260" height="110" fill="url(#llBgGrad)"/>
      <g transform="translate(18, 30)">
        <rect x="0" y="0" width="40" height="40" rx="6" fill="#ffffff" stroke="#0d9488" stroke-width="2"/>
        <line x1="26" y1="0" x2="26" y2="40" stroke="#0d9488" stroke-width="1.5"/>
        <text x="13" y="25" font-family="'Inter', sans-serif" font-size="14" font-weight="700" fill="#0f766e" text-anchor="middle">A</text>
        <circle cx="33" cy="20" r="3" fill="#0d9488"/>

        <line x1="33" y1="20" x2="68" y2="20" stroke="#0d9488" stroke-width="2.5"/>
        <polygon points="70,20 62,15 62,25" fill="#0d9488"/>

        <rect x="74" y="0" width="40" height="40" rx="6" fill="#ffffff" stroke="#0d9488" stroke-width="2"/>
        <line x1="100" y1="0" x2="100" y2="40" stroke="#0d9488" stroke-width="1.5"/>
        <text x="87" y="25" font-family="'Inter', sans-serif" font-size="14" font-weight="700" fill="#0f766e" text-anchor="middle">B</text>
        <circle cx="107" cy="20" r="3" fill="#0d9488"/>

        <line x1="107" y1="20" x2="142" y2="20" stroke="#0d9488" stroke-width="2.5"/>
        <polygon points="144,20 136,15 136,25" fill="#0d9488"/>

        <rect x="148" y="0" width="48" height="40" rx="6" fill="#0d9488" stroke="#0f766e" stroke-width="2"/>
        <text x="172" y="25" font-family="'Inter', sans-serif" font-size="12" font-weight="800" fill="#ffffff" text-anchor="middle">NULL</text>
      </g>
    </svg>`;
  }

  // Default Fallback
  return `<svg viewBox="0 0 260 110" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="260" height="110" fill="rgba(0, 113, 188, 0.1)"/>
    <g transform="translate(110, 35)">
      <circle cx="20" cy="20" r="18" fill="#0071bc"/>
      <path d="M14 20l4 4 8-8" stroke="#ffffff" stroke-width="2.5" fill="none"/>
    </g>
  </svg>`;
}

async function renderTopics() {
  const res = await fetch('/api/topics');
  const json = await res.json();
  cachedTopicList = json.topics || [];

  const totalProblems = cachedTopicList.reduce((acc, t) => acc + (t.total_problems || 0), 0);
  const totalSolved = cachedTopicList.reduce((acc, t) => acc + (t.problems_solved || 0), 0);
  const avgMastery = cachedTopicList.length ? Math.round(cachedTopicList.reduce((acc, t) => acc + (t.percentage || 0), 0) / cachedTopicList.length) : 0;

  const filteredTopics = cachedTopicList.filter(t => {
    const matchCat = activeTopicCategory === 'all' || (t.category && t.category.toLowerCase() === activeTopicCategory.toLowerCase());
    const matchQuery = !topicSearchQuery.trim() || t.topic.toLowerCase().includes(topicSearchQuery.toLowerCase());
    return matchCat && matchQuery;
  });

  return head('Topic practice', 'Build strong fundamentals topic by topic with interactive video masterclasses and graded challenges.') +
    `<!-- Interactive Topic Hero Banner -->
    <div class="topic-hero-banner">
      <div class="topic-hero-content">
        <div class="sub-badge" style="background:var(--primary-light);color:var(--primary);margin-bottom:8px;">
          CURRICULUM ROADMAP · INSTRUCTIONAL VIDEOS
        </div>
        <h2 style="font-size:20px;margin-bottom:6px;">Master Data Structures & Algorithms</h2>
        <p class="muted" style="font-size:13px;max-width:540px;line-height:1.5;">
          Step-by-step interactive practice tracks with comprehensive instructional video lectures, algorithmic takeaways, and sandboxed code editor challenges.
        </p>
        <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;">
          <span class="pill" style="font-size:12px;font-weight:600;">📚 8 Core Tracks</span>
          <span class="pill blue" style="font-size:12px;font-weight:600;">📹 8 Instructional Videos</span>
          <span class="pill blue" style="font-size:12px;font-weight:600;">⚡ ${avgMastery}% Overall Mastery</span>
        </div>
      </div>
      <div class="topic-hero-graphic">
        <svg width="130" height="85" viewBox="0 0 130 85" fill="none">
          <circle cx="25" cy="42" r="14" fill="#0071bc" fill-opacity="0.12" stroke="#0071bc" stroke-width="2"/>
          <text x="25" y="46" font-family="'Inter'" font-size="10" font-weight="800" fill="#0071bc" text-anchor="middle">DSA</text>
          <line x1="39" y1="42" x2="65" y2="25" stroke="#0071bc" stroke-width="2" stroke-dasharray="3 3"/>
          <line x1="39" y1="42" x2="65" y2="60" stroke="#0071bc" stroke-width="2" stroke-dasharray="3 3"/>
          <circle cx="75" cy="25" r="12" fill="#0071bc" fill-opacity="0.10" stroke="#0071bc" stroke-width="2"/>
          <text x="75" y="29" font-family="'Inter'" font-size="9" font-weight="700" fill="#0071bc" text-anchor="middle">O(1)</text>
          <circle cx="75" cy="60" r="12" fill="#0071bc" fill-opacity="0.10" stroke="#0071bc" stroke-width="2"/>
          <text x="75" y="64" font-family="'Inter'" font-size="9" font-weight="700" fill="#0071bc" text-anchor="middle">O(N)</text>
          <line x1="87" y1="42" x2="110" y2="42" stroke="#0071bc" stroke-width="2"/>
          <circle cx="115" cy="42" r="12" fill="#0071bc" fill-opacity="0.15" stroke="#0071bc" stroke-width="2"/>
          <text x="115" y="46" font-family="'Inter'" font-size="11" font-weight="800" fill="#0071bc" text-anchor="middle">★</text>
        </svg>
      </div>
    </div>

    <!-- Filter Toolbar -->
    <div class="topic-filter-bar">
      <div class="topic-tabs">
        <button class="topic-tab-btn ${activeTopicCategory === 'all' ? 'active' : ''}" onclick="setTopicCategoryFilter('all')">All Tracks (${cachedTopicList.length})</button>
        <button class="topic-tab-btn ${activeTopicCategory === 'Data Structures' ? 'active' : ''}" onclick="setTopicCategoryFilter('Data Structures')">Data Structures (3)</button>
        <button class="topic-tab-btn ${activeTopicCategory === 'Algorithms' ? 'active' : ''}" onclick="setTopicCategoryFilter('Algorithms')">Algorithms (3)</button>
        <button class="topic-tab-btn ${activeTopicCategory === 'Core Logic' ? 'active' : ''}" onclick="setTopicCategoryFilter('Core Logic')">Core Logic (2)</button>
      </div>
      <div>
        <input type="text" id="topicSearchInput" placeholder="Filter topics..." value="${esc(topicSearchQuery)}" oninput="onTopicSearch(this.value)" 
               style="padding:6px 14px;font-size:12.5px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--text);width:200px;">
      </div>
    </div>

    <!-- 3-Column Topic Cards Grid (Interactive Icons Only - No Banner Images!) -->
    <div class="grid three" id="topicCardsGrid">
      ${filteredTopics.length ? filteredTopics.map(t => renderTopicCard(t)).join('') : `
        <div class="card" style="grid-column:1 / -1;text-align:center;padding:40px;">
          <p class="muted" style="font-size:14px;">No practice topics found matching your filter.</p>
          <button class="btn secondary small" style="margin-top:10px;" onclick="setTopicCategoryFilter('all'); onTopicSearch('');">Clear Filters</button>
        </div>
      `}
    </div>`;
}

function setTopicCategoryFilter(cat) {
  activeTopicCategory = cat;
  renderTopics().then(html => {
    const el = document.getElementById('view');
    if (el) el.innerHTML = html;
  });
}

function onTopicSearch(query) {
  topicSearchQuery = query;
  const filtered = cachedTopicList.filter(t => {
    const matchCat = activeTopicCategory === 'all' || (t.category && t.category.toLowerCase() === activeTopicCategory.toLowerCase());
    const matchQuery = !topicSearchQuery.trim() || t.topic.toLowerCase().includes(topicSearchQuery.toLowerCase());
    return matchCat && matchQuery;
  });

  const grid = document.getElementById('topicCardsGrid');
  if (grid) {
    if (filtered.length) {
      grid.innerHTML = filtered.map(t => renderTopicCard(t)).join('');
    } else {
      grid.innerHTML = `
        <div class="card" style="grid-column:1 / -1;text-align:center;padding:40px;">
          <p class="muted" style="font-size:14px;">No practice topics found matching your search.</p>
        </div>
      `;
    }
  }
}

async function openTopicPractice(topicName) {
  await openTopicModal(topicName);
}

async function filterTopicInProblemBank(topicName) {
  closeModal();
  toast(`Opening ${topicName} in Problem Bank...`);
  await render('Problem Bank');
  const input = document.getElementById('problemSearch');
  if (input) {
    input.value = topicName;
    filterProblems();
  }
}

// ========================================================
// 1. SEPARATE DEDICATED VIEW: WATCH VIDEO MODAL
// ========================================================
async function openTopicVideoModal(topicName) {
  openModal(`${topicName} Masterclass: Instructional Video`, 'wide');
  const body = document.getElementById('modalBody');
  if (!body) return;

  const meta = getTopicMeta(topicName);
  const vInfo = topicVideos[topicName] || {
    title: `${topicName} Masterclass & Algorithmic Foundations`,
    duration: '14:00',
    instructor: 'IST Faculty of Computing · Core Curriculum',
    youtubeId: 'pkYVOmU3MgA',
    embedUrl: 'https://www.youtube.com/embed/pkYVOmU3MgA?rel=0',
    shortDesc: 'Master foundational algorithmic patterns and structured problem-solving.',
    chapters: [
      { time: '00:00', title: 'Conceptual Overview' },
      { time: '04:00', title: 'Core Data Operations' },
      { time: '08:00', title: 'Algorithm Implementation' },
      { time: '11:30', title: 'Complexity & Edge Cases' }
    ],
    takeaways: [
      'Understand core memory representation and asymptotic bounds',
      'Optimize inner iteration loops using sliding window or two pointers',
      'Apply standard idioms for clean, robust edge-case handling'
    ]
  };

  let probCount = 3;
  try {
    const res = await fetch('/api/problems');
    const json = await res.json();
    const all = json.problems || [];
    probCount = all.filter(p => (p.topic || '').toLowerCase().includes(topicName.toLowerCase())).length || 3;
  } catch(e) {}

  body.innerHTML = `
    <!-- Top Interactive View Navigation Tabs -->
    <div class="topic-modal-nav-tabs">
      <button class="topic-modal-tab-btn active" title="Currently viewing video lecture">
        ▶ Watch Video Lecture
      </button>
      <button class="topic-modal-tab-btn" onclick="openTopicPracticeModal('${esc(topicName)}')" title="Switch to practice track challenges">
        💻 Practice Track (${probCount} Challenges) →
      </button>
    </div>

    <!-- Video Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--line);">
      <div style="display:flex;align-items:center;gap:12px;">
        <div class="topic-interactive-hero-badge" style="width:48px;height:48px;border-radius:10px;">
          ${meta.iconSvg}
        </div>
        <div>
          <h3 style="margin:0;font-size:17px;font-weight:700;color:var(--text);">${esc(topicName)} Masterclass Video Lecture</h3>
          <div style="font-size:12px;color:var(--primary);font-weight:600;margin-top:2px;">
            ${esc(vInfo.instructor)}
          </div>
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <span class="pill" style="font-size:11.5px;font-weight:700;">⏱ Duration: ${vInfo.duration}</span>
        <span class="pill blue" style="font-size:11.5px;font-weight:700;">Full Curriculum Track</span>
      </div>
    </div>

    <!-- Responsive 16:9 Video Player Container -->
    <div class="topic-video-player-container" style="background:#0b0f19;border:1px solid var(--line);border-radius:10px;overflow:hidden;margin-bottom:16px;">
      <div class="topic-video-player-header" style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px;background:#0f172a;border-bottom:1px solid #1e293b;flex-wrap:wrap;gap:8px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="pill" style="background:var(--primary);color:#ffffff;border:none;font-size:10px;font-weight:800;padding:2px 8px;">
            ▶ VIDEO LESSON
          </span>
          <span style="font-size:13px;font-weight:600;color:#f8fafc;">${esc(vInfo.title)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:12px;color:#94a3b8;font-family:var(--font-mono);">Duration: ${vInfo.duration}</span>
          <a href="https://www.youtube.com/watch?v=${vInfo.youtubeId || 'pkYVOmU3MgA'}" target="_blank" rel="noopener noreferrer" 
             class="btn small" style="background:var(--panel);border:1px solid #334155;color:#e2e8f0;font-size:11px;padding:3px 10px;text-decoration:none;display:inline-flex;align-items:center;gap:4px;"
             title="Watch directly on YouTube">
            <span>↗ Watch on YouTube</span>
          </a>
        </div>
      </div>

      <!-- Video Frame -->
      <div class="topic-video-frame-wrapper" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;background:#000;">
        <iframe 
          style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"
          src="${vInfo.embedUrl}" 
          title="${esc(vInfo.title)}" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
          allowfullscreen>
        </iframe>
      </div>

      <!-- Interactive Chapters Bar -->
      <div class="topic-video-chapters-bar" style="display:flex;gap:6px;padding:10px 16px;background:#0f172a;border-top:1px solid #1e293b;overflow-x:auto;">
        <span style="font-size:11px;font-weight:700;color:#64748b;align-self:center;margin-right:4px;">CHAPTERS:</span>
        ${vInfo.chapters.map((ch, idx) => `
          <div class="topic-video-chapter-pill ${idx === 0 ? 'active' : ''}" style="cursor:pointer;padding:3px 9px;border-radius:4px;font-size:11px;background:#1e293b;color:#cbd5e1;border:1px solid #334155;white-space:nowrap;display:inline-flex;align-items:center;gap:4px;" title="${esc(ch.title)}" onclick="toast('Lecture Chapter: ${ch.time} - ${esc(ch.title)}')">
            <span style="color:var(--primary);font-family:var(--font-mono);font-weight:bold;">${ch.time}</span>
            <span>${esc(ch.title)}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Key Takeaways & Core Concepts -->
    <div style="background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px;margin-bottom:16px;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        <b style="font-size:13.5px;color:var(--text);">Key Algorithmic Concepts Covered:</b>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${vInfo.takeaways.map(t => `
          <div style="display:flex;align-items:flex-start;gap:8px;font-size:12.5px;color:var(--text-body);">
            <span style="color:var(--primary);font-weight:bold;line-height:1.4;">✓</span>
            <span style="line-height:1.4;">${esc(t)}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Bottom Actions Footer -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding-top:12px;border-top:1px solid var(--line);gap:10px;flex-wrap:wrap;">
      <button class="btn secondary" onclick="closeModal()">✕ Close</button>
      <button class="btn btn-primary" onclick="openTopicPracticeModal('${esc(topicName)}')" style="background:var(--primary);border-color:var(--primary);font-weight:600;padding:8px 18px;">
        Go to Practice Track (${probCount} Questions) →
      </button>
    </div>
  `;
}

// ========================================================
// 2. SEPARATE DEDICATED VIEW: PRACTICE TRACK MODAL
// ========================================================
async function openTopicPracticeModal(topicName) {
  openModal(`${topicName} Track: Coding Challenges`, 'wide');
  const body = document.getElementById('modalBody');
  if (!body) return;

  const meta = getTopicMeta(topicName);

  body.innerHTML = `
    <div style="text-align:center;padding:30px;">
      <span class="spinner"></span>
      <p class="muted" style="margin-top:10px;">Loading ${esc(topicName)} practice challenges...</p>
    </div>
  `;

  try {
    const res = await fetch('/api/problems');
    const json = await res.json();
    const allProblems = json.problems || [];
    const topicProblems = allProblems.filter(p => (p.topic || '').toLowerCase().includes(topicName.toLowerCase()));

    body.innerHTML = `
      <!-- Top Interactive View Navigation Tabs -->
      <div class="topic-modal-nav-tabs">
        <button class="topic-modal-tab-btn" onclick="openTopicVideoModal('${esc(topicName)}')" title="Switch to video lecture">
          ▶ Watch Video Lecture
        </button>
        <button class="topic-modal-tab-btn active" title="Currently viewing practice challenges">
          💻 Practice Track (${topicProblems.length} Challenges)
        </button>
      </div>

      <!-- Practice Track Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--line);">
        <div style="display:flex;align-items:center;gap:12px;">
          <div class="topic-interactive-hero-badge" style="width:48px;height:48px;border-radius:10px;">
            ${meta.iconSvg}
          </div>
          <div>
            <h3 style="margin:0;font-size:17px;font-weight:700;color:var(--text);">${esc(topicName)} Coding Practice Track</h3>
            <div style="font-size:12px;color:var(--text-muted);font-weight:500;margin-top:2px;">
              Curated challenges matching the ${esc(topicName)} curriculum
            </div>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <span class="pill" style="font-size:11.5px;font-weight:700;background:var(--primary-light);color:var(--primary);border:1px solid var(--primary-subtle);">${esc(meta.cat)}</span>
          <span class="pill blue" style="font-size:11.5px;font-weight:700;">${topicProblems.length} Challenges</span>
        </div>
      </div>

      <!-- Track Information Banner -->
      <div style="background:var(--primary-light);border:1px solid var(--primary-subtle);border-radius:8px;padding:12px 16px;margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
        <div style="font-size:12.5px;color:var(--primary);line-height:1.4;">
          <b>Curriculum Challenges:</b> Each problem includes matching function starter stubs and test cases. Select <b>Solve in Code Editor →</b> to manually write and run your solution.
        </div>
        <button class="btn secondary small" style="background:var(--panel);border-color:var(--primary-subtle);font-size:11.5px;padding:4px 10px;" onclick="openTopicVideoModal('${esc(topicName)}')">
          ▶ Watch Lesson Video
        </button>
      </div>

      <!-- Practice Questions List with Matching Code Text -->
      ${topicProblems.length ? `
        <div style="display:flex;flex-direction:column;gap:14px;">
          ${topicProblems.map((p, idx) => `
            <div style="padding:16px 18px;background:var(--card);border:1px solid var(--line);border-radius:10px;transition:border-color 0.15s ease;" onmouseenter="this.style.borderColor='var(--primary)'" onmouseleave="this.style.borderColor='var(--line)'">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <span class="pill" style="font-size:11px;font-weight:800;background:var(--panel);border:1px solid var(--line);">#${idx + 1}</span>
                  <b style="font-size:15px;color:var(--text);">${esc(p.title)}</b>
                  <span class="pill blue" style="font-size:10.5px;padding:2px 8px;">
                    ${esc(p.difficulty)}
                  </span>
                  <span class="pill" style="font-size:10.5px;background:var(--primary-light);color:var(--primary);border:1px solid var(--primary-subtle);">${p.points} pts</span>
                </div>
                <button class="btn btn-primary small" style="background:var(--primary);border-color:var(--primary);font-weight:600;padding:6px 16px;white-space:nowrap;" onclick="closeModal(); openProblem(${p.id})">
                  Solve in Code Editor →
                </button>
              </div>

              <p class="muted" style="margin:0 0 10px;font-size:12.5px;line-height:1.5;">
                ${esc(p.description)}
              </p>

              <!-- Matching Code Text for this Specific Question -->
              <div style="background:#0b0f19;border:1px solid #1e293b;border-radius:6px;padding:10px 14px;font-family:var(--font-mono);font-size:12px;color:#e2e8f0;overflow-x:auto;margin-bottom:8px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;font-size:10px;color:#94a3b8;">
                  <span style="color:var(--primary);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Function Template (${esc(p.title)}):</span>
                  <span style="color:#64748b;">Python 3</span>
                </div>
                <pre style="margin:0;font-family:inherit;font-size:inherit;line-height:1.45;white-space:pre-wrap;"><code>${esc(p.starter_code_py || `def solution():\n    pass`)}</code></pre>
              </div>

              ${p.sample_input ? `
                <div style="font-size:11.5px;color:var(--text-muted);display:flex;gap:12px;flex-wrap:wrap;padding-top:2px;">
                  <span><b>Sample Input:</b> <code style="background:var(--bg-subtle);padding:1px 5px;border-radius:3px;">${esc(p.sample_input)}</code></span>
                  <span><b>Sample Output:</b> <code style="background:var(--bg-subtle);padding:1px 5px;border-radius:3px;">${esc(p.sample_output || '')}</code></span>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      ` : `
        <div class="card" style="text-align:center;padding:30px;">
          <p class="muted" style="font-size:13.5px;margin:0;">No practice questions found for this topic.</p>
          <button class="btn secondary small" style="margin-top:12px;" onclick="closeModal(); render('Problem Bank');">Go to Problem Bank</button>
        </div>
      `}

      <!-- Bottom Actions Footer -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:18px;padding-top:14px;border-top:1px solid var(--line);gap:10px;flex-wrap:wrap;">
        <button class="btn secondary" onclick="closeModal()">✕ Close</button>
        <div style="display:flex;gap:8px;">
          <button class="btn secondary" onclick="openTopicVideoModal('${esc(topicName)}')">
            ◀ Watch Lesson Video
          </button>
          <button class="btn secondary" onclick="filterTopicInProblemBank('${esc(topicName)}')">
            Filter in Problem Bank →
          </button>
        </div>
      </div>
    `;
  } catch(e) {
    console.error('Error loading practice track modal:', e);
    body.innerHTML = `
      <div class="card" style="padding:20px;text-align:center;">
        <p class="muted">Unable to load practice track: ${esc(e.message)}</p>
        <button class="btn secondary small" onclick="openTopicPracticeModal('${esc(topicName)}')">Retry</button>
      </div>
    `;
  }
}

// Backwards-compatible alias
async function openTopicModal(topicName) {
  await openTopicPracticeModal(topicName);
}

async function renderEditor() {
  // If no problem chosen, default to problem 1 (Two Sum)
  if (!currentProblem) {
    try {
      const res = await fetch('/api/problems/1');
      const json = await res.json();
      if (json.success && json.problem) {
        currentProblem = json.problem;
      }
    } catch(e) {}
  }

  const p = currentProblem || {
    id: 1,
    title: 'Two Sum',
    points: 20,
    difficulty: 'Easy',
    topic: 'Arrays',
    starter_code_py: `def solution(nums, target):
    # Write your code here
    pass`
  };

  return head('Code editor', 'Write, run and submit your solution against standardized test cases.') +
    `<div class="card" style="margin-bottom:16px;">
      <div class="toolbar" style="margin:0;align-items:center;">
        <b id="selectedProblem" style="font-size:16px;color:var(--text);">${esc(p.title)}</b>
        <span class="pill blue" id="selectedPoints">${p.points} points</span>
        <span style="flex:1;"></span>
        <select id="language" onchange="changeLanguage(this.value)">
          <option value="python">Python 3</option>
          <option value="java">Java</option>
          <option value="c">C</option>
          <option value="cpp">C++</option>
          <option value="js">JavaScript</option>
        </select>
        <button class="btn ghost small" onclick="resetCode()">Reset code</button>
      </div>
      ${p.description ? `
        <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line);font-size:13.5px;line-height:1.6;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span class="pill blue" style="font-size:10px;font-weight:700;">PROBLEM STATEMENT</span>
            <span class="pill" style="font-size:10px;">${esc(p.difficulty || 'Easy')} · ${esc(p.topic || 'General')}</span>
          </div>
          <p style="margin:8px 0;color:var(--text);">${esc(p.description)}</p>
          ${p.sample_input ? `
            <div class="notice" style="margin-top:8px;font-size:12.5px;">
              <b>Sample Input:</b> <code>${esc(p.sample_input)}</code> &nbsp; | &nbsp;
              <b>Sample Output:</b> <code>${esc(p.sample_output || '')}</code>
            </div>
          ` : ''}
        </div>
      ` : ''}
    </div>
    <div class="editor-layout">
      <div class="editor">
        <div class="editor-head">
          <span>⌘ &nbsp; <span id="editorFilename">solution.py</span></span>
          <span style="font-size:11px;color:#a5b4fc;">● Subprocess Sandbox Ready</span>
        </div>
        <textarea id="code" spellcheck="false">${esc(p.starter_code_py || 'def solution():\n    pass')}</textarea>
        <div style="padding:12px 16px;display:flex;gap:10px;background:#0b0f19;border-top:1px solid #1e293b;">
          <button class="btn secondary" id="runCodeBtn" onclick="runCode()">▶ Run sample</button>
          <button class="btn" id="submitCodeBtn" onclick="submitCode()">✓ Submit to judge</button>
        </div>
      </div>
      <div class="terminal">
        <div class="terminal-head">
          <span>CONSOLE OUTPUT</span>
          <span style="font-size:10px;color:var(--text-subtle);">PYTHON 3.13 ISOLATED</span>
        </div>
        <div class="terminal-body">
          <div id="evalDetails" style="margin-bottom:12px;">
            <p class="muted">Run code to test against sample case or submit for judge evaluation.</p>
          </div>
          <pre id="output" style="margin:0;font-family:var(--font-mono);white-space:pre-wrap;line-height:1.6;font-size:12px;color:var(--text-body);">Ready for execution.</pre>
        </div>
      </div>
    </div>`;
}

function changeLanguage(lang) {
  const codeEl = document.getElementById('code');
  const filenameEl = document.getElementById('editorFilename');
  const p = currentProblem;
  if (!codeEl) return;

  if (lang === 'python') {
    if (filenameEl) filenameEl.textContent = 'solution.py';
    codeEl.value = (p && p.starter_code_py) ? p.starter_code_py : 'def solution():\n    # Write your solution here\n    pass';
  } else if (lang === 'java') {
    if (filenameEl) filenameEl.textContent = 'Solution.java';
    codeEl.value = (p && p.starter_code_java) ? p.starter_code_java : 'class Solution {\n    public Object solution() {\n        // Write your solution here\n        return null;\n    }\n}';
  } else if (lang === 'c') {
    if (filenameEl) filenameEl.textContent = 'solution.c';
    codeEl.value = (p && p.starter_code_c) ? p.starter_code_c : 'void solution() {\n    // Write your solution here\n}';
  } else if (lang === 'cpp') {
    if (filenameEl) filenameEl.textContent = 'solution.cpp';
    codeEl.value = (p && p.starter_code_cpp) ? p.starter_code_cpp : 'class Solution {\npublic:\n    void solution() {\n        // Write your solution here\n    }\n};';
  } else if (lang === 'js') {
    if (filenameEl) filenameEl.textContent = 'solution.js';
    codeEl.value = (p && p.starter_code_js) ? p.starter_code_js : 'function solution() {\n    // Write your solution here\n}';
  }
}

function resetCode() {
  const lang = document.getElementById('language').value;
  changeLanguage(lang);
  toast('Code reset to default starter template.');
}

async function runCode() {
  const btn = document.getElementById('runCodeBtn');
  btn.textContent = '⟳ Compiling & Executing...';
  btn.disabled = true;

  const outEl = document.getElementById('output');
  const detailsEl = document.getElementById('evalDetails');
  const codeVal = document.getElementById('code').value;
  const lang = document.getElementById('language').value;

  outEl.textContent = 'Spinning up isolated subprocess runtime...\nExecuting in secure sandbox container...';
  detailsEl.innerHTML = '<span class="pill blue">Running execution harness...</span>';

  try {
    const res = await fetch('/api/code/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: lang, code: codeVal })
    });
    const result = await res.json();

    btn.textContent = '▶ Run sample';
    btn.disabled = false;

    if (result.success) {
      outEl.textContent = (result.stdout || 'Process finished with no standard output.') + 
        `\n\nProcess finished with exit code ${result.exit_code} (${result.runtime} runtime, ${result.memory} memory).`;
      detailsEl.innerHTML = `<span class="pill blue" style="font-weight:700;">✓ Execution Succeeded</span><p style="margin-top:6px;">Runtime: ${result.runtime} · Memory: ${result.memory}</p>`;
    } else {
      outEl.textContent = (result.stderr || result.stdout || result.error || 'Execution failed.') + 
        `\n\nProcess finished with exit code ${result.exit_code} (${result.runtime}).`;
      detailsEl.innerHTML = `<span class="pill bad" style="font-weight:700;">✗ Execution Error</span><p style="margin-top:6px;">Review traceback in console output.</p>`;
    }
  } catch(e) {
    btn.textContent = '▶ Run sample';
    btn.disabled = false;
    outEl.textContent = 'Error communicating with backend execution service: ' + e.message;
    detailsEl.innerHTML = '<span class="pill bad">Service Error</span>';
  }
}

async function submitCode() {
  const btn = document.getElementById('submitCodeBtn');
  btn.textContent = '⟳ Testing Cases...';
  btn.disabled = true;

  const codeVal = document.getElementById('code').value;
  const lang = document.getElementById('language').value;
  const probId = currentProblem ? currentProblem.id : 1;
  const probTitle = currentProblem ? currentProblem.title : 'Two Sum';

  const detailsEl = document.getElementById('evalDetails');
  const outEl = document.getElementById('output');

  outEl.textContent = 'Allocating sandboxed runner container...\nEvaluating against hidden test cases in SQLite...';
  detailsEl.innerHTML = '<div class="test-suite" id="testSuite"></div>';
  const suite = document.getElementById('testSuite');

  try {
    const res = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        problem_id: probId,
        problem_title: probTitle,
        language: lang,
        code: codeVal
      })
    });
    const evalData = await res.json();

    const testCases = evalData.details && evalData.details.length
      ? evalData.details
      : [
          { name: 'Case 1: Standard input', time: '0.01s', pass: evalData.passed },
          { name: 'Case 2: Zero index elements', time: '0.01s', pass: evalData.passed },
          { name: 'Case 3: Unsorted sequence', time: '0.02s', pass: evalData.passed },
          { name: 'Case 4: Large array bounds', time: '0.03s', pass: evalData.passed },
          { name: 'Case 5: Negative numbers', time: '0.02s', pass: evalData.passed }
        ];

    let step = 0;
    function runNextCase() {
      if (step < testCases.length) {
        const tc = testCases[step];
        const div = document.createElement('div');
        div.className = 'test-case-item ' + (tc.pass ? 'pass' : 'fail');
        div.innerHTML = `<span><b>${esc(tc.name || 'Test Case ' + (step + 1))}</b></span><span style="font-weight:700;">${tc.pass ? '✓ Passed (' + (tc.time || '0.01s') + ')' : '✗ Failed'}</span>`;
        suite.appendChild(div);
        outEl.textContent = `Executed test case ${step + 1} of ${testCases.length}...\nStatus: ${tc.pass ? 'Matched expected output' : 'Output mismatch'}`;
        step++;
        setTimeout(runNextCase, 220);
      } else {
        btn.textContent = '✓ Submit to judge';
        btn.disabled = false;

        if (evalData.passed) {
          outEl.textContent = `ACCEPTED\nAll ${evalData.test_cases_passed} / ${evalData.total_test_cases} hidden test cases passed successfully.\nRuntime: ${evalData.runtime} · Memory: ${evalData.memory}\nVerified and recorded in SQLite database.`;
          triggerConfetti();
          toast(`🎉 Solution Accepted! +${evalData.score} Points added to your profile.`);
          // Refresh user stats
          fetch('/api/dashboard').then(r => r.json()).then(d => { data = { ...data, ...d }; });
        } else {
          outEl.textContent = `${evalData.verdict.toUpperCase()}\n${evalData.output_log || 'Test case verification did not match expected output.'}\nRuntime: ${evalData.runtime}`;
          toast('Submission completed: ' + evalData.verdict);
        }
      }
    }

    runNextCase();

  } catch(e) {
    btn.textContent = '✓ Submit to judge';
    btn.disabled = false;
    outEl.textContent = 'Error communicating with submission judge service: ' + e.message;
  }
}

function triggerConfetti() {
  const canvas = document.getElementById('confettiCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const count = 90;
  const colors = ['#0071bc', '#29abe2', '#704fe7', '#10b981', '#f59e0b', '#38bdf8', '#fbbf24'];
  const pieces = [];

  for (let i = 0; i < count; i++) {
    pieces.push({
      x: window.innerWidth * (0.35 + Math.random() * 0.3),
      y: window.innerHeight * 0.75,
      vx: (Math.random() - 0.5) * 16,
      vy: -11 - Math.random() * 12,
      size: 5 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 14,
      scaleX: 1,
      vScale: 0.08 + Math.random() * 0.08,
      life: 140
    });
  }

  let frame;
  function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let active = 0;

    pieces.forEach(p => {
      if (p.life <= 0) return;
      active++;
      p.life--;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.38;
      p.vx *= 0.985;
      p.rotation += p.vRot;
      p.scaleX = Math.cos(p.life * p.vScale);

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.scale(p.scaleX, 1);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.min(1, p.life / 30);
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    });

    if (active > 0) {
      frame = requestAnimationFrame(update);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      cancelAnimationFrame(frame);
    }
  }

  update();
}

/* ========================================================
   SUBMISSIONS & REPORTS MODULE
   ======================================================== */
async function renderSubmissions() {
  const url = role === 'faculty' ? '/api/faculty/submission-reports' : '/api/submissions';
  const res = await fetch(url);
  const json = await res.json();
  const subs = json.submissions || [];

  const headers = role === 'faculty'
    ? ['Student', 'Problem', 'Language', 'Verdict', 'Score', 'Runtime', 'Submitted']
    : ['Problem', 'Language', 'Verdict', 'Score', 'Runtime', 'Submitted'];

  const rows = subs.length ? subs.map(s => {
    const verdictBadge = `<span class="pill ${s.verdict === 'Accepted' ? '' : 'bad'}">${esc(s.verdict)}</span>`;
    if (role === 'faculty') {
      return [
        `<b>${esc(s.student_name || 'Student')}</b>`,
        esc(s.problem_title),
        esc(s.language),
        verdictBadge,
        String(s.score) + ' pts',
        esc(s.runtime || '0.02s'),
        esc(s.submitted_at)
      ];
    }
    return [
      esc(s.problem_title),
      esc(s.language),
      verdictBadge,
      String(s.score) + ' pts',
      esc(s.runtime || '0.02s'),
      esc(s.submitted_at)
    ];
  }) : [];

  return head('Submission history', 'Real-time database records of all code executions and verdicts.') +
    `<div class="card">
      ${rows.length ? table(headers, rows) : '<p class="muted" style="padding:20px;">No submissions recorded in database yet.</p>'}
    </div>`;
}

/* ========================================================
   LEADERBOARD MODULE
   ======================================================== */
async function renderLeaderboard() {
  const res = await fetch('/api/leaderboard');
  const json = await res.json();
  const rawList = json.leaderboard || [];

  lbRoster = rawList.map((st, idx) => ({
    id: 'STU' + st.student_id,
    student_id: st.student_id,
    name: st.name,
    dept: st.department || 'CSE',
    batch: st.batch || '2024-A',
    allPoints: st.points,
    currentPoints: st.points,
    solved: st.solved_count,
    currentSolved: st.solved_count,
    streak: st.streak_days,
    cheers: st.kudos_count || 0,
    isYou: currentUser ? (st.name === currentUser.name) : (idx === 2),
    bg: ['#704fe7', '#0071bc', '#29abe2', '#059669', '#d97706', '#8b5cf6'][idx % 6]
  }));

  const list = getProcessedLeaderboard();
  const you = list.find(s => s.isYou);
  const youRank = you ? you.rank : 3;

  const top1 = list[0] || { name: 'Jordan Smith', dept: 'CSE', batch: '2024-B', currentPoints: 1080, currentSolved: 42, streak: 14, bg: '#704fe7', student_id: 1 };
  const top2 = list[1] || { name: 'Jamie Lee', dept: 'IT', batch: '2024-A', currentPoints: 920, currentSolved: 38, streak: 9, bg: '#0071bc', student_id: 2 };
  const top3 = list[2] || { name: 'Alex Morgan', dept: 'CSE', batch: '2024-A', currentPoints: 420, currentSolved: 18, streak: 6, bg: '#29abe2', student_id: 3 };

  let targetHtml = '';
  if (you && youRank > 1) {
    const nextAhead = list[youRank - 2];
    const diff = nextAhead.currentPoints - you.currentPoints;
    const pct = Math.min(100, Math.round((you.currentPoints / Math.max(1, nextAhead.currentPoints)) * 100));
    targetHtml = `
      <div class="lb-target-banner">
        <div class="lb-target-info">
          <div style="font-size:26px;">🎯</div>
          <div>
            <b style="font-size:14px;color:var(--text);">Next Rank Target: #${nextAhead.rank} ${esc(nextAhead.name)}</b>
            <p style="margin:2px 0 0;font-size:12px;">You are <b>${diff} pts</b> away from climbing to #${nextAhead.rank} (${nextAhead.dept} · ${nextAhead.currentPoints} pts).</p>
          </div>
        </div>
        <div class="lb-target-progress-wrap">
          <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;margin-bottom:5px;">
            <span>${you.currentPoints} pts</span>
            <span>Target: ${nextAhead.currentPoints} pts</span>
          </div>
          <div class="bar"><span style="width:${pct}%;"></span></div>
        </div>
      </div>
    `;
  }

  return head('Campus leaderboard', 'Live institutional standings calculated from SQLite submissions.') +
    targetHtml +
    `<div class="podium-wrap podium-grid">
      <!-- Rank 2 Podium Card -->
      <div class="podium-card rank-2" onclick="openStudentDuel(${top2.student_id})" title="Click to inspect & compare">
        <span class="podium-step-num">#2 SILVER</span>
        <div class="podium-badge-icon">🥈</div>
        <div class="podium-avatar" style="background:${top2.bg};">${top2.name[0]}</div>
        <b style="font-size:15px;color:var(--text);display:block;margin:6px 0 2px;">${esc(top2.name)}</b>
        <div class="muted" style="font-size:12px;">${top2.dept} · ${top2.batch}</div>
        <div style="font-size:17px;font-weight:800;color:var(--text);margin-top:8px;">${top2.currentPoints.toLocaleString()} <span style="font-size:11px;font-weight:600;color:var(--text-muted);">pts</span></div>
        <div class="muted" style="font-size:11px;margin-top:3px;">${top2.currentSolved} solved · ${flameIcon()} ${top2.streak}d streak</div>
        <div style="margin-top:14px;display:flex;gap:6px;justify-content:center;">
          <button class="btn secondary small" style="padding:4px 10px;font-size:11px;" onclick="event.stopPropagation(); giveKudos(${top2.student_id})">
            <span id="podium_cheers_${top2.student_id}">👏 ${top2.cheers || 0}</span>
          </button>
          <button class="btn ghost small" style="padding:4px 10px;font-size:11px;" onclick="event.stopPropagation(); openStudentDuel(${top2.student_id})">⚔️ Duel</button>
        </div>
      </div>

      <!-- Rank 1 Podium Card -->
      <div class="podium-card rank-1" onclick="openStudentDuel(${top1.student_id})" title="Click to inspect & compare">
        <span class="podium-step-num">👑 #1 GOLD</span>
        <div class="podium-badge-icon">👑</div>
        <div class="podium-avatar" style="background:${top1.bg};box-shadow:0 0 0 3px #f59e0b, 0 4px 12px rgba(245,158,11,0.3);">${top1.name[0]}</div>
        <b style="font-size:17px;color:var(--text);display:block;margin:6px 0 2px;">${esc(top1.name)}</b>
        <div class="muted" style="font-size:12px;">${top1.dept} · ${top1.batch}</div>
        <div style="font-size:22px;font-weight:900;color:#d97706;margin-top:8px;">${top1.currentPoints.toLocaleString()} <span style="font-size:12px;font-weight:600;color:var(--text-muted);">pts</span></div>
        <div class="muted" style="font-size:11px;margin-top:3px;">${top1.currentSolved} solved · ${flameIcon()} ${top1.streak}d streak</div>
        <div style="margin-top:14px;display:flex;gap:6px;justify-content:center;">
          <button class="btn secondary small" style="padding:4px 10px;font-size:11px;" onclick="event.stopPropagation(); giveKudos(${top1.student_id})">
            <span id="podium_cheers_${top1.student_id}">👏 ${top1.cheers || 0}</span>
          </button>
          <button class="btn primary small" style="padding:4px 10px;font-size:11px;" onclick="event.stopPropagation(); openStudentDuel(${top1.student_id})">⚔️ Duel</button>
        </div>
      </div>

      <!-- Rank 3 Podium Card -->
      <div class="podium-card rank-3" onclick="openStudentDuel(${top3.student_id})" title="Click to inspect & compare">
        <span class="podium-step-num">#3 BRONZE</span>
        <div class="podium-badge-icon">🥉</div>
        <div class="podium-avatar" style="background:${top3.bg};">${top3.name[0]}</div>
        <b style="font-size:15px;color:var(--text);display:block;margin:6px 0 2px;">${esc(top3.name)}</b>
        <div class="muted" style="font-size:12px;">${top3.dept} · ${top3.batch}</div>
        <div style="font-size:17px;font-weight:800;color:var(--text);margin-top:8px;">${top3.currentPoints.toLocaleString()} <span style="font-size:11px;font-weight:600;color:var(--text-muted);">pts</span></div>
        <div class="muted" style="font-size:11px;margin-top:3px;">${top3.currentSolved} solved · ${flameIcon()} ${top3.streak}d streak</div>
        <div style="margin-top:14px;display:flex;gap:6px;justify-content:center;">
          <button class="btn secondary small" style="padding:4px 10px;font-size:11px;" onclick="event.stopPropagation(); giveKudos(${top3.student_id})">
            <span id="podium_cheers_${top3.student_id}">👏 ${top3.cheers || 0}</span>
          </button>
          <button class="btn ghost small" style="padding:4px 10px;font-size:11px;" onclick="event.stopPropagation(); openStudentDuel(${top3.student_id})">⚔️ Duel</button>
        </div>
      </div>
    </div>

    <!-- Leaderboard Controls -->
    <div class="card" style="margin-top:20px;">
      <div class="lb-controls">
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
          <div class="lb-tabs" title="Scope filter">
            <button class="lb-tab-btn ${lbScope === 'college' ? 'active' : ''}" onclick="setLbScope('college')">🏛️ College</button>
            <button class="lb-tab-btn ${lbScope === 'department' ? 'active' : ''}" onclick="setLbScope('department')">🏫 My Dept</button>
            <button class="lb-tab-btn ${lbScope === 'batch' ? 'active' : ''}" onclick="setLbScope('batch')">👥 My Batch</button>
          </div>
          <div class="lb-tabs" title="Timeframe filter">
            <button class="lb-tab-btn ${lbTimeframe === 'all' ? 'active' : ''}" onclick="setLbTimeframe('all')">All Time</button>
            <button class="lb-tab-btn ${lbTimeframe === 'month' ? 'active' : ''}" onclick="setLbTimeframe('month')">This Month</button>
            <button class="lb-tab-btn ${lbTimeframe === 'week' ? 'active' : ''}" onclick="setLbTimeframe('week')">This Week</button>
          </div>
        </div>
        <div class="lb-search-wrap">
          <input type="text" id="lbSearch" placeholder="Search student or department..." value="${esc(lbSearchQuery)}" oninput="onLbSearch(this.value)">
        </div>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:70px;text-align:center;">Rank</th>
              <th>Student</th>
              <th>Dept / Batch</th>
              <th>Points</th>
              <th>Solved</th>
              <th>Streak</th>
              <th>Cheers</th>
              <th style="width:160px;text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(s => `
              <tr class="lb-row ${s.isYou ? 'is-you' : ''}">
                <td style="text-align:center;">
                  ${s.rank === 1 ? '<span class="pill" style="background:#fef3c7;color:#b45309;font-weight:800;border:none;">🥇 #1</span>' :
                    s.rank === 2 ? '<span class="pill" style="background:#f1f5f9;color:#475569;font-weight:800;border:none;">🥈 #2</span>' :
                    s.rank === 3 ? '<span class="pill" style="background:#ffedd5;color:#c2410c;font-weight:800;border:none;">🥉 #3</span>' :
                    `<b>#${s.rank}</b>`}
                </td>
                <td>
                  <div class="lb-student-cell">
                    <div class="lb-avatar-mini" style="background:${s.bg};">${s.name[0]}</div>
                    <div>
                      <b style="color:var(--text);">${esc(s.name)} ${s.isYou ? '<span class="pill blue" style="font-size:10px;margin-left:4px;">You</span>' : ''}</b>
                    </div>
                  </div>
                </td>
                <td><span class="pill" style="font-size:11px;">${esc(s.dept)}</span> <span class="muted" style="font-size:12px;">${esc(s.batch)}</span></td>
                <td><b style="font-size:14px;color:var(--text);">${s.currentPoints.toLocaleString()}</b> <span class="muted" style="font-size:11px;">pts</span></td>
                <td><span style="font-weight:600;">${s.currentSolved}</span> <span class="muted" style="font-size:11px;">solved</span></td>
                <td>${flameIcon()} <b>${s.streak}d</b></td>
                <td><span id="cheers_${s.student_id}" class="pill green" style="font-size:11px;font-weight:600;">👏 ${s.cheers}</span></td>
                <td style="text-align:right;">
                  <button class="btn secondary small" style="padding:4px 8px;font-size:11px;" onclick="giveKudos(${s.student_id})">👏 Cheer</button>
                  <button class="btn ghost small" style="padding:4px 8px;font-size:11px;" onclick="openStudentDuel(${s.student_id})">⚔️ VS Duel</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function getProcessedLeaderboard() {
  let list = lbRoster.filter(s => {
    if (lbScope === 'department') return s.dept === 'CSE';
    if (lbScope === 'batch') return s.batch === '2024-A';
    return true;
  });

  list = list.map(s => {
    let p = s.allPoints;
    let sl = s.solved;
    if (lbTimeframe === 'month') {
      p = Math.round(s.allPoints * 0.58);
      sl = Math.max(1, Math.round(s.solved * 0.6));
    } else if (lbTimeframe === 'week') {
      p = Math.round(s.allPoints * 0.24);
      sl = Math.max(1, Math.round(s.solved * 0.25));
    }
    return { ...s, currentPoints: p, currentSolved: sl };
  });

  list.sort((a, b) => b.currentPoints - a.currentPoints);
  list.forEach((s, idx) => { s.rank = idx + 1; });

  if (lbSearchQuery.trim()) {
    const q = lbSearchQuery.trim().toLowerCase();
    return list.filter(s => s.name.toLowerCase().includes(q) || s.dept.toLowerCase().includes(q));
  }
  return list;
}

function setLbScope(scope) {
  lbScope = scope;
  render('Leaderboard');
}

function setLbTimeframe(tf) {
  lbTimeframe = tf;
  render('Leaderboard');
}

function onLbSearch(val) {
  lbSearchQuery = val;
  const tbody = document.querySelector('.table-wrap tbody');
  if (tbody) {
    const list = getProcessedLeaderboard();
    tbody.innerHTML = list.map(s => `
      <tr class="lb-row ${s.isYou ? 'is-you' : ''}">
        <td style="text-align:center;">
          ${s.rank === 1 ? '<span class="pill" style="background:#fef3c7;color:#b45309;font-weight:800;border:none;">🥇 #1</span>' :
            s.rank === 2 ? '<span class="pill" style="background:#f1f5f9;color:#475569;font-weight:800;border:none;">🥈 #2</span>' :
            s.rank === 3 ? '<span class="pill" style="background:#ffedd5;color:#c2410c;font-weight:800;border:none;">🥉 #3</span>' :
            `<b>#${s.rank}</b>`}
        </td>
        <td>
          <div class="lb-student-cell">
            <div class="lb-avatar-mini" style="background:${s.bg};">${s.name[0]}</div>
            <div>
              <b style="color:var(--text);">${esc(s.name)} ${s.isYou ? '<span class="pill blue" style="font-size:10px;margin-left:4px;">You</span>' : ''}</b>
            </div>
          </div>
        </td>
        <td><span class="pill" style="font-size:11px;">${esc(s.dept)}</span> <span class="muted" style="font-size:12px;">${esc(s.batch)}</span></td>
        <td><b style="font-size:14px;color:var(--text);">${s.currentPoints.toLocaleString()}</b> <span class="muted" style="font-size:11px;">pts</span></td>
        <td><span style="font-weight:600;">${s.currentSolved}</span> <span class="muted" style="font-size:11px;">solved</span></td>
        <td>${flameIcon()} <b>${s.streak}d</b></td>
        <td><span id="cheers_${s.student_id}" class="pill green" style="font-size:11px;font-weight:600;">👏 ${s.cheers}</span></td>
        <td style="text-align:right;">
          <button class="btn secondary small" style="padding:4px 8px;font-size:11px;" onclick="giveKudos(${s.student_id})">👏 Cheer</button>
          <button class="btn ghost small" style="padding:4px 8px;font-size:11px;" onclick="openStudentDuel(${s.student_id})">⚔️ VS Duel</button>
        </td>
      </tr>
    `).join('');
  }
}

async function giveKudos(studentId) {
  try {
    const res = await fetch(`/api/leaderboard/kudos/${studentId}`, { method: 'POST' });
    const json = await res.json();
    if (json.success) {
      const el = document.getElementById(`cheers_${studentId}`);
      if (el) el.textContent = `👏 ${json.kudos_count}`;
      const podEl = document.getElementById(`podium_cheers_${studentId}`);
      if (podEl) podEl.textContent = `👏 ${json.kudos_count}`;
      if (typeof triggerConfetti === 'function') triggerConfetti();
      toast(json.message || 'Kudos sent! 🎉');
    }
  } catch(e) {
    toast('Error sending kudos.');
  }
}

function openStudentDuel(studentId) {
  const target = lbRoster.find(s => s.student_id === studentId || s.id === 'STU' + studentId) || lbRoster[0];
  const you = lbRoster.find(s => s.isYou) || lbRoster[2] || { name: 'Alex Morgan', currentPoints: 420, currentSolved: 18, streak: 6, dept: 'CSE' };

  openModal(`Head-to-Head: ${you.name} vs ${target.name}`);

  const totalPoints = you.currentPoints + target.currentPoints || 1;
  const youPointsPct = Math.round((you.currentPoints / totalPoints) * 100);

  const totalSolved = you.currentSolved + target.currentSolved || 1;
  const youSolvedPct = Math.round((you.currentSolved / totalSolved) * 100);

  document.getElementById('modalBody').innerHTML = `
    <div class="duel-wrap">
      <div class="duel-player">
        <b style="font-size:15px;color:var(--text);">${esc(you.name)}</b>
        <div class="muted" style="font-size:11px;">You</div>
      </div>
      <div class="duel-vs">VS</div>
      <div class="duel-player">
        <b style="font-size:15px;color:var(--text);">${esc(target.name)}</b>
        <div class="muted" style="font-size:11px;">#${target.rank || '—'} · ${target.dept}</div>
      </div>
    </div>

    <div style="margin:16px 0;">
      <div class="stat-duel-row">
        <b>${you.currentPoints} pts</b>
        <div class="duel-bar-split">
          <div class="duel-bar-you" style="width:${youPointsPct}%;"></div>
          <div class="duel-bar-them" style="width:${100 - youPointsPct}%;"></div>
        </div>
        <b style="text-align:right;">${target.currentPoints} pts</b>
      </div>
      <div class="stat-duel-row">
        <b>${you.currentSolved} solved</b>
        <div class="duel-bar-split">
          <div class="duel-bar-you" style="width:${youSolvedPct}%;"></div>
          <div class="duel-bar-them" style="width:${100 - youSolvedPct}%;"></div>
        </div>
        <b style="text-align:right;">${target.currentSolved} solved</b>
      </div>
    </div>
  `;

  document.getElementById('modalActions').innerHTML = `
    <button class="btn" onclick="closeModal()">Close Duel</button>
  `;
}

/* ========================================================
   MANAGEMENT MODULE (STUDENTS, FACULTY, COLLEGES, ETC.)
   ======================================================== */
const managementEndpoints = {
  'Students': '/api/students',
  'Faculty': '/api/faculty',
  'Colleges': '/api/colleges',
  'Departments': '/api/departments',
  'Batches': '/api/batches',
  'College Licences': '/api/admin/licences'
};

async function renderManagement(label) {
  const endpoint = managementEndpoints[label] || '/api/students';
  const res = await fetch(endpoint);
  const json = await res.json();

  const isStudents = label === 'Students';
  const isFaculty = label === 'Faculty';
  const isColleges = label === 'Colleges' || label === 'College Licences';
  const isBatches = label === 'Batches';
  const isDepts = label === 'Departments';

  let rawRows = [];
  if (isStudents) rawRows = json.students || [];
  else if (isFaculty) rawRows = json.faculty || [];
  else if (isColleges) rawRows = json.colleges || json.licences || [];
  else if (isBatches) rawRows = json.batches || [];
  else if (isDepts) rawRows = json.departments || [];

  // Normalize rows so both arrays and objects work seamlessly
  const rows = rawRows.map((r, idx) => {
    if (Array.isArray(r)) {
      if (isStudents) {
        return {
          id: r[5] || (idx + 1),
          student_code: r[0],
          name: r[1],
          details: r[2],
          score: r[3],
          status: r[4]
        };
      }
      return { id: r[0] || (idx + 1), code: r[0], name: r[1], details: r[2], status: r[3] || 'Active' };
    }
    return r;
  });

  window._currentManagementRows = rows;
  window._currentManagementLabel = label;

  const headers = isStudents
    ? ['ID', 'Name', 'Department / Batch', 'Score', 'Status', 'Actions']
    : isColleges
      ? ['College', 'Location / Key', 'Status', 'Licence Expiry', 'Actions']
      : ['Code / ID', 'Name', 'Details', 'Status', 'Actions'];

  const renderedRows = rows.map((r, i) => {
    let col1, col2, col3, col4, col5, rId;
    rId = r.id || (i + 1);
    if (isStudents) {
      col1 = r.student_code || `STU${rId}`;
      col2 = r.name || 'Unnamed Student';
      col3 = r.details || (r.department ? `${r.department} · ${r.batch || '2024'}` : 'CSE · 2024-A');
      col4 = r.score || '85%';
      col5 = r.status || 'Active';
    } else if (isFaculty) {
      col1 = r.faculty_code || `FAC${rId}`;
      col2 = r.name || 'Faculty Member';
      col3 = r.details || (r.department ? `${r.department} · Faculty` : 'Faculty');
      col4 = r.status || 'Active';
      col5 = 'Active';
    } else if (isColleges) {
      col1 = r.name || r.college_name || 'College';
      col2 = r.location || r.licence_key || '—';
      col3 = r.status || 'Active';
      col4 = r.expiry_date || r.licence_expiry || '2027-12-31';
      col5 = 'Active';
    } else if (isBatches) {
      col1 = r.name || 'Batch';
      col2 = r.department_code || 'CSE';
      col3 = r.details || `${r.student_count || 0} students`;
      col4 = r.status || 'Active';
      col5 = 'Active';
    } else {
      col1 = r.code || r.short_code || `D${rId}`;
      col2 = r.name || 'Department';
      col3 = r.details || 'Department Details';
      col4 = r.status || 'Active';
      col5 = 'Active';
    }

    const isBadStatus = (col5 === 'Needs support' || col5 === 'Inactive' || col5 === 'Pending');
    const isBadScore = (col4 === 'Needs support' || (typeof col4 === 'string' && col4.startsWith('4') && col4.endsWith('%')));

    return `
      <tr>
        <td><strong style="color:var(--text);font-family:monospace;font-size:12.5px;">${esc(col1)}</strong></td>
        <td><span style="font-weight:600;color:var(--text);">${esc(col2)}</span></td>
        <td><span class="muted" style="font-size:12.5px;">${esc(col3)}</span></td>
        <td>
          ${isStudents ? `<span class="pill ${isBadScore ? 'bad' : ''}" style="font-weight:700;">${esc(col4)}</span>` : `<span class="muted">${esc(col4)}</span>`}
        </td>
        ${isStudents ? `<td><span class="pill ${isBadStatus ? 'bad' : ''}">${esc(col5)}</span></td>` : ''}
        <td style="text-align:right;white-space:nowrap;">
          <button class="btn ghost small" onclick="viewRecord('${label}', ${rId})">View</button>
          <button class="btn secondary small" onclick="editRecord('${label}', ${rId})">Edit</button>
          <button class="btn ghost small" style="color:var(--red);" onclick="deleteRecord('${label}', ${rId})">Delete</button>
        </td>
      </tr>
    `;
  }).join('');

  return head(
    label + ' management',
    'Manage institutional database records with real-time SQLite persistence.',
    `<button class="btn" onclick="addRecord('${label}')">＋ Add ${label.slice(0, -1)}</button>`
  ) +
  `<div class="card">
    <div class="toolbar">
      <input id="manageSearch" placeholder="Search ${label.toLowerCase()}..." oninput="searchTable(this)">
      <button class="btn secondary small" onclick="exportManagement('${label}')">Export CSV</button>
    </div>
    <div class="table-wrap">
      <table id="manageTable">
        <thead>
          <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${renderedRows || '<tr><td colspan="6" class="muted" style="padding:20px;text-align:center;">No records found.</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

function searchTable(el) {
  const q = el.value.toLowerCase();
  document.querySelectorAll('#manageTable tbody tr').forEach(tr => {
    tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

function addRecord(label) {
  const isStudents = label === 'Students';
  const isFaculty = label === 'Faculty';
  const isColleges = label === 'Colleges' || label === 'College Licences';
  const isBatches = label === 'Batches';
  const isDepts = label === 'Departments';

  let fields = [];
  if (isStudents) {
    fields = [
      { id: 'name', label: 'Student Full Name' },
      { id: 'email', label: 'Email Address' },
      { id: 'student_code', label: 'Roll Number / Student Code' },
      { id: 'department', label: 'Department', placeholder: 'CSE' },
      { id: 'batch', label: 'Batch', placeholder: '2024-A' }
    ];
  } else if (isFaculty) {
    fields = [
      { id: 'name', label: 'Faculty Name' },
      { id: 'email', label: 'Email Address' },
      { id: 'faculty_code', label: 'Faculty Code', placeholder: 'FAC005' },
      { id: 'department', label: 'Department', placeholder: 'CSE' },
      { id: 'details', label: 'Title / Role' }
    ];
  } else if (isColleges) {
    fields = [
      { id: 'name', label: 'College Name' },
      { id: 'location', label: 'Location' },
      { id: 'licence_expiry', label: 'Licence Expiry Date', type: 'date' }
    ];
  } else if (isBatches) {
    fields = [
      { id: 'name', label: 'Batch Name (e.g. 2024-A)' },
      { id: 'department_code', label: 'Department Code', placeholder: 'CSE' },
      { id: 'year', label: 'Academic Year', placeholder: '2024' },
      { id: 'student_count', label: 'Student Count', placeholder: '48' }
    ];
  } else {
    fields = [
      { id: 'code', label: 'Department Code (e.g. D04)' },
      { id: 'name', label: 'Department Name' },
      { id: 'short_code', label: 'Short Code (e.g. AI&DS)' }
    ];
  }

  modalForm('Add New ' + label.slice(0, -1), fields, async values => {
    const endpoint = managementEndpoints[label];
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      const json = await res.json();
      closeModal();
      if (json.success) {
        toast(json.message || 'Record added successfully.');
        render(current);
      } else {
        toast(json.error || 'Failed to add record.');
      }
    } catch(e) {
      toast('Error saving record.');
    }
  });
}

function viewRecord(label, id) {
  const row = (window._currentManagementRows || []).find(r => r.id === id);
  if (!row) return;

  openModal(`${label.slice(0, -1)} Record Details`);
  document.getElementById('modalBody').innerHTML = `
    <div class="notice" style="line-height:1.8;">
      ${Object.entries(row).map(([k, v]) => `<p><b>${esc(k.toUpperCase())}:</b> ${esc(v)}</p>`).join('')}
    </div>
  `;
  document.getElementById('modalActions').innerHTML = '<button class="btn" onclick="closeModal()">Close</button>';
}

function editRecord(label, id) {
  const row = (window._currentManagementRows || []).find(r => r.id === id);
  if (!row) return;

  const isStudents = label === 'Students';
  const isFaculty = label === 'Faculty';
  const isColleges = label === 'Colleges' || label === 'College Licences';
  const isBatches = label === 'Batches';

  let fields = [];
  if (isStudents) {
    fields = [
      { id: 'name', label: 'Student Name', value: row.name },
      { id: 'email', label: 'Email', value: row.email },
      { id: 'department', label: 'Department', value: row.department },
      { id: 'batch', label: 'Batch', value: row.batch },
      { id: 'status', label: 'Status (Active, Needs support)', value: row.status }
    ];
  } else if (isFaculty) {
    fields = [
      { id: 'name', label: 'Faculty Name', value: row.name },
      { id: 'email', label: 'Email', value: row.email },
      { id: 'department', label: 'Department', value: row.department },
      { id: 'details', label: 'Title / Role', value: row.details }
    ];
  } else if (isColleges) {
    fields = [
      { id: 'name', label: 'College Name', value: row.name },
      { id: 'location', label: 'Location', value: row.location },
      { id: 'licence_expiry', label: 'Expiry Date', value: row.licence_expiry, type: 'date' }
    ];
  } else if (isBatches) {
    fields = [
      { id: 'name', label: 'Batch Name', value: row.name },
      { id: 'student_count', label: 'Student Count', value: String(row.student_count || '') }
    ];
  } else {
    fields = [
      { id: 'name', label: 'Department Name', value: row.name },
      { id: 'short_code', label: 'Short Code', value: row.short_code }
    ];
  }

  modalForm('Edit ' + label.slice(0, -1), fields, async values => {
    const base = managementEndpoints[label];
    try {
      const res = await fetch(`${base}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      const json = await res.json();
      closeModal();
      if (json.success) {
        toast(json.message || 'Record updated successfully.');
        render(current);
      } else {
        toast(json.error || 'Failed to update record.');
      }
    } catch(e) {
      toast('Error updating record.');
    }
  });
}

async function deleteRecord(label, id) {
  if (confirm(`Delete this ${label.slice(0, -1)} record? This will permanently remove it from SQLite.`)) {
    const base = managementEndpoints[label];
    try {
      const res = await fetch(`${base}/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        toast(json.message || 'Record deleted successfully.');
        render(current);
      } else {
        toast(json.error || 'Failed to delete record.');
      }
    } catch(e) {
      toast('Error deleting record.');
    }
  }
}

function exportManagement(label) {
  const rows = window._currentManagementRows || [];
  if (!rows.length) {
    toast('No records to export.');
    return;
  }
  const keys = Object.keys(rows[0]);
  const csv = [
    keys.join(','),
    ...rows.map(r => keys.map(k => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(','))
  ].join('\r\n');

  downloadBlobCSV(label.toLowerCase().replace(/\s+/g, '_') + '_export.csv', csv);
  toast('Exported ' + rows.length + ' records to CSV.');
}

/* ========================================================
   PROBLEM ASSIGNMENT MODULE
   ======================================================== */
async function renderAssignment() {
  const [probsRes, batchesRes, assignRes] = await Promise.all([
    fetch('/api/problems'),
    fetch('/api/batches'),
    fetch('/api/assignments')
  ]);

  const pData = await probsRes.json();
  const bData = await batchesRes.json();
  const aData = await assignRes.json();

  const problems = pData.problems || [];
  const batches = bData.batches || [];
  const assignments = aData.assignments || [];

  return head('Problem assignment', 'Assign practice problems to a batch or learner cohort.') +
    `<div class="card" style="max-width:720px;margin-bottom:24px;">
      <div class="field">
        <label>Select Problem</label>
        <select id="assignProblem">
          ${problems.map(p => `<option value="${p.id}">${esc(p.title)} (${esc(p.difficulty)} · ${p.points} pts)</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Assign to Batch</label>
        <select id="assignBatch">
          <option value="All Batches">All Batches</option>
          ${batches.map(b => `<option value="${esc(b.name)}">${esc(b.name)} (${esc(b.department_code)})</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Due Date</label>
        <input id="assignDue" type="date" value="2026-11-28">
      </div>
      <div class="field">
        <label>Special Instructions</label>
        <textarea id="assignInstructions" placeholder="e.g. Complete before Wednesday lab session." style="height:70px;"></textarea>
      </div>
      <button class="btn" style="margin-top:10px;" onclick="createAssignment()">Assign Problem →</button>
    </div>

    <div class="card">
      <div class="card-head">
        <h3>Active assignments</h3>
        <span class="pill blue">${assignments.length} ACTIVE</span>
      </div>
      ${assignments.length
        ? table(['Problem', 'Batch', 'Due Date', 'Status'], assignments.map(a => [
            `<b>${esc(a.problem_title)}</b>`,
            esc(a.batch_name),
            esc(a.due_date),
            `<span class="pill">${esc(a.status)}</span>`
          ]))
        : '<p class="muted" style="padding:16px;">No problem assignments recorded yet.</p>'
      }
    </div>`;
}

async function createAssignment() {
  const problem_id = document.getElementById('assignProblem').value;
  const batch_name = document.getElementById('assignBatch').value;
  const due_date = document.getElementById('assignDue').value;
  const instructions = document.getElementById('assignInstructions').value;

  if (!due_date) {
    toast('Please choose a due date.');
    return;
  }

  try {
    const res = await fetch('/api/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problem_id, batch_name, due_date, instructions })
    });
    const json = await res.json();
    if (json.success) {
      toast(json.message || 'Problem assigned successfully.');
      render('Problem Assignment');
    } else {
      toast(json.error || 'Failed to assign problem.');
    }
  } catch(e) {
    toast('Error creating assignment.');
  }
}

/* ========================================================
   SCHEDULED TESTS MODULE
   ======================================================== */
async function renderTests() {
  const res = await fetch('/api/tests');
  const json = await res.json();
  const testList = json.tests || [];

  return head(
    'Scheduled tests',
    'Automated assessments and scheduled evaluation windows.',
    role === 'faculty' || role === 'super' ? '<button class="btn" onclick="openCreateTestModal()">＋ Create test</button>' : ''
  ) +
  `<div class="grid three">
    ${testList.map(t => {
      const isTaken = t.taken;
      const statusPill = isTaken
        ? `<span class="pill">SCORE: ${t.user_score}%</span>`
        : `<span class="pill blue">${esc(t.status.toUpperCase())}</span>`;

      return `
        <div class="card">
          ${statusPill}
          <h3 style="margin-top:12px;">${esc(t.title)}</h3>
          <p class="muted" style="margin:4px 0 10px;">${esc(t.scheduled_date)}</p>
          <b>${t.duration_minutes} minutes · ${t.question_count} questions</b>
          <p style="margin-top:14px;">
            ${isTaken
              ? `<button class="btn ghost small full" onclick="toast('You scored ${t.user_score}% on this test.')">View Submitted Result</button>`
              : `<button class="btn secondary small full" onclick="startTest(${t.id})">Start test →</button>`
            }
          </p>
        </div>
      `;
    }).join('')}
  </div>`;
}

function openCreateTestModal() {
  modalForm('Create Assessment Test', [
    { id: 'title', label: 'Test Title (e.g. Data Structures Assessment)' },
    { id: 'scheduled_date', label: 'Scheduled Date', type: 'date' },
    { id: 'duration_minutes', label: 'Duration (Minutes)', placeholder: '60' }
  ], async values => {
    try {
      const res = await fetch('/api/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      const json = await res.json();
      closeModal();
      if (json.success) {
        toast('Test scheduled successfully.');
        render('Scheduled Tests');
      } else {
        toast(json.error || 'Failed to create test.');
      }
    } catch(e) {
      toast('Error saving test.');
    }
  });
}

async function startTest(testId) {
  try {
    const res = await fetch(`/api/tests/${testId || 1}`);
    const json = await res.json();
    if (!json.success || !json.test) {
      toast('Test not found.');
      return;
    }

    const test = json.test;
    const questions = test.questions || [];
    activeTestId = test.id;

    openModal(test.title);
    let remaining = (test.duration_minutes || 10) * 60;

    let qHtml = questions.map(q => `
      <div style="margin-bottom:18px;border-bottom:1px solid var(--line);padding-bottom:12px;">
        <h4 style="margin-bottom:8px;">Q${q.question_number}: ${esc(q.question_text)}</h4>
        ${q.options.map((opt, i) => `
          <label style="display:block;margin:6px 0;cursor:pointer;font-size:13px;">
            <input type="radio" name="ans_${q.id}" value="${esc(opt)}"> ${esc(opt)}
          </label>
        `).join('')}
      </div>
    `).join('');

    document.getElementById('modalBody').innerHTML = `
      <p class="muted" style="margin-bottom:12px;">Timed Institutional Assessment · ${questions.length} Questions</p>
      <div id="testTimer" class="notice" style="margin-bottom:16px;font-weight:700;">Time remaining: 10:00</div>
      ${qHtml}
    `;

    document.getElementById('modalActions').innerHTML = `
      <button class="btn ghost" onclick="closeModal()">Cancel</button>
      <button class="btn" onclick="submitTestAnswers(${test.id})">Submit test</button>
    `;

    if (testTimerInterval) clearInterval(testTimerInterval);
    testTimerInterval = setInterval(() => {
      remaining--;
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      const el = document.getElementById('testTimer');
      if (el) {
        el.textContent = 'Time remaining: ' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
      }
      if (remaining <= 0) {
        clearInterval(testTimerInterval);
        submitTestAnswers(test.id);
      }
    }, 1000);
  } catch(e) {
    toast('Error opening test.');
  }
}

async function submitTestAnswers(testId) {
  if (testTimerInterval) clearInterval(testTimerInterval);

  const answers = {};
  document.querySelectorAll('input[type="radio"]:checked').forEach(r => {
    const qId = r.name.replace('ans_', '');
    answers[qId] = r.value;
  });

  try {
    const res = await fetch(`/api/tests/${testId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers })
    });
    const json = await res.json();
    closeModal();
    if (json.success) {
      toast(`Test submitted! Score: ${json.score}/${json.total_score} (${json.percentage}%).`);
      render('Scheduled Tests');
    } else {
      toast(json.error || 'Submission error.');
    }
  } catch(e) {
    toast('Error submitting test.');
  }
}

/* ========================================================
   WEAK STUDENTS MODULE
   ======================================================== */
async function renderWeak() {
  const res = await fetch('/api/faculty/weak-students');
  const json = await res.json();
  const students = json.students || [];

  return head('Students needing support', 'Learners requiring targeted mentoring and practice intervention.') +
    `<div class="card">
      ${students.length ? table(
        ['Student', 'Batch', 'Accuracy', 'Current Plan', 'Suggested Action'],
        students.map(st => [
          `<b>${esc(st.name)}</b>`,
          esc(st.batch),
          `<span class="pill bad">${esc(st.score)}</span>`,
          esc(st.support_plan || 'Mentoring required'),
          `<button class="btn secondary small" onclick="openSupportPlanModal(${st.id}, '${esc(st.name)}')">Update plan</button>`
        ])
      ) : '<p class="muted" style="padding:20px;">No students currently flagged as needing support.</p>'}
    </div>`;
}

function openSupportPlanModal(studentId, studentName) {
  modalForm('Support Plan: ' + studentName, [
    { id: 'plan', label: 'Mentoring Plan Notes & Target Topics' },
    { id: 'plan_date', label: 'Follow-up Review Date', type: 'date' }
  ], async values => {
    try {
      const res = await fetch('/api/faculty/support-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          support_plan: values.plan,
          support_plan_date: values.plan_date
        })
      });
      const json = await res.json();
      closeModal();
      if (json.success) {
        toast(json.message || 'Support plan updated successfully.');
        render('Weak Students');
      } else {
        toast(json.error || 'Failed to update plan.');
      }
    } catch(e) {
      toast('Error saving support plan.');
    }
  });
}

/* ========================================================
   BULK CSV IMPORT MODULE
   ======================================================== */
function renderBulk() {
  return head('Bulk student import', 'Upload a CSV file to validate and import learner records directly into SQLite.') +
    `<div class="card" style="max-width:720px;">
      <div class="notice">
        <b>Expected CSV format:</b> roll_number, name, email, department, batch
      </div>
      <div class="field" style="margin-top:16px;">
        <label>Choose CSV file</label>
        <input id="csvFile" type="file" accept=".csv" onchange="previewCSV(this)">
      </div>
      <div id="csvPreview" class="muted" style="margin:12px 0;">No file selected.</div>
      <div style="display:flex;gap:10px;margin-top:16px;">
        <button class="btn" id="importBtn" onclick="importParsedCSV()">Import students to SQLite</button>
        <button class="btn secondary" onclick="downloadSampleCSV()">Download sample CSV</button>
      </div>
    </div>`;
}

function previewCSV(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    pendingRawCSV = reader.result;
    const lines = reader.result.split(/\r?\n/).filter(Boolean);
    pendingParsedCSV = lines.map(l => l.split(',').map(s => s.trim().replace(/^"|"$/g, '')));
    const previewRows = pendingParsedCSV.slice(0, 5);
    document.getElementById('csvPreview').innerHTML = `
      <b>CSV Preview (first 5 rows):</b>
      <pre style="background:var(--bg-subtle);padding:12px;border-radius:8px;font-size:12px;overflow-x:auto;">${esc(previewRows.map(r => r.join(' | ')).join('\n'))}</pre>
      <span class="positive">● Detected ${lines.length - 1} records ready for backend validation.</span>
    `;
  };
  reader.readAsText(file);
}

async function importParsedCSV() {
  if (!pendingRawCSV) {
    toast('Please select a valid CSV file first.');
    return;
  }
  const btn = document.getElementById('importBtn');
  btn.disabled = true;
  btn.textContent = 'Validating and Importing...';

  try {
    const res = await fetch('/api/students/bulk-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv_data: pendingRawCSV })
    });
    const json = await res.json();
    btn.disabled = false;
    btn.textContent = 'Import students to SQLite';

    if (json.success) {
      toast(`Successfully imported ${json.imported_count} students into database!`);
      pendingRawCSV = '';
      pendingParsedCSV = [];
      document.getElementById('csvPreview').innerHTML = `<span class="positive">✓ ${json.message}</span>`;
    } else {
      toast(json.error || 'CSV validation failed.');
    }
  } catch(e) {
    btn.disabled = false;
    btn.textContent = 'Import students to SQLite';
    toast('Error sending CSV to server.');
  }
}

function downloadSampleCSV() {
  const sample = "roll_number,name,email,department,batch\nSTU101,Rohan Mehta,rohan@example.com,CSE,2024-A\nSTU102,Ananya Sen,ananya@example.com,IT,2024-A";
  downloadBlobCSV('skillrack_students_sample.csv', sample);
}

/* ========================================================
   SYSTEM MONITORING MODULE
   ======================================================== */
async function renderMonitoring() {
  const res = await fetch('/api/admin/monitoring');
  const json = await res.json();
  const sys = json.system || {};
  const rec = sys.total_records || {};

  return head('System monitoring', 'Live health diagnostics and performance indicators for the evaluation cluster.') +
    stats([
      ['Cluster health', sys.status || 'Operational', '✓', 'Sandbox isolation verified'],
      ['API uptime', sys.uptime || '99.98%', '⌁', 'Flask + WSGI'],
      ['Database file', sys.database_size || '0 KB', '▥', sys.database || 'SQLite 3 WAL'],
      ['Active records', String(rec.users || 0) + ' users', '♙', `${rec.submissions || 0} code submissions`]
    ]) +
    `<div class="card" style="margin-top:20px;">
      <div class="card-head">
        <h3>Runtime environment details</h3>
        <span class="pill blue">HEALTHY</span>
      </div>
      <div class="notice" style="line-height:1.9;">
        <p><b>Host Python:</b> ${esc(sys.python_version || 'Python 3.13')}</p>
        <p><b>Code Execution Service:</b> ${esc(sys.sandbox_status || 'Active')}</p>
        <p><b>Database Tables:</b> 16 registered models (Colleges, Batches, Departments, Users, Students, Faculty, Problems, Assignments, Submissions, Tests, Leaderboard, Progress, Profile, Settings)</p>
        <p><b>Record Counts:</b> ${rec.students || 0} students · ${rec.faculty || 0} faculty · ${rec.problems || 0} problems · ${rec.submissions || 0} submissions</p>
      </div>
    </div>`;
}

/* ========================================================
   FACULTY BATCH PERFORMANCE MODULE
   ======================================================== */
let activeBatchDeptFilter = 'all';

async function renderBatchPerformance() {
  try {
    const res = await fetch('/api/faculty/batch-performance');
    const json = await res.json();
    const summary = json.summary || {};
    const batches = json.batches || [];

    const totalBatches = summary.total_batches || batches.length || 3;
    const totalStudents = summary.total_students || 68;
    const topBatch = `${summary.top_batch_name || '2024-A'} (${summary.top_batch_score || '84%'})`;
    const benchmarkPass = summary.benchmark_pass_rate || '92%';

    const filteredBatches = activeBatchDeptFilter === 'all'
      ? batches
      : batches.filter(b => (b.department_code || '').toUpperCase() === activeBatchDeptFilter.toUpperCase());

    const depts = ['all', ...new Set(batches.map(b => (b.department_code || '').toLowerCase()).filter(Boolean))];

    return head('Batch Performance', 'Track cohort velocity, completion benchmarks, and section-by-section coding progress.', `
      <div style="display:flex;gap:8px;">
        <button class="btn primary small" onclick="render('Problem Assignment')">+ Assign to Batch</button>
      </div>
    `) +
    stats([
      ['Monitored Cohorts', String(totalBatches), '▥', 'Active academic sections'],
      ['Enrolled Students', String(totalStudents), '♙', 'Across all cohorts'],
      ['Top Performing Batch', topBatch, '♛', 'Highest average score'],
      ['Benchmark Pass Rate', benchmarkPass, '◎', 'Meeting target standard']
    ]) +
    `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:24px;margin-bottom:14px;flex-wrap:wrap;gap:12px;">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span style="font-size:13px;font-weight:600;color:var(--text-muted);">Department Filter:</span>
        ${depts.map(d => `
          <button class="btn small ${activeBatchDeptFilter === d ? 'primary' : 'ghost'}" 
                  onclick="setBatchDeptFilter('${d}')" style="padding:4px 12px;font-size:12px;">
            ${d === 'all' ? 'All Departments' : d.toUpperCase()}
          </button>
        `).join('')}
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <input type="text" id="batchSearchInput" placeholder="Search cohort..." oninput="filterBatchSearch(this.value)" 
               style="padding:6px 12px;font-size:12px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--text);width:180px;">
      </div>
    </div>

    <div class="card" style="margin-bottom:24px;">
      <div class="card-head" style="margin-bottom:12px;">
        <h3>Cohort Comparative Overview</h3>
        <span class="pill blue">LIVE BENCHMARK</span>
      </div>
      <div class="table-wrap">
        <table id="batchPerformanceTable">
          <thead>
            <tr>
              <th>Cohort Name</th>
              <th>Department</th>
              <th>Enrolled Students</th>
              <th>Avg Score</th>
              <th>Curriculum Completion</th>
              <th>Performance Status</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filteredBatches.length ? filteredBatches.map(b => {
              const scoreNum = parseInt(String(b.avg_score).replace('%', '')) || 75;
              const compNum = parseInt(String(b.completion_rate).replace('%', '')) || 85;
              const status = b.status || (scoreNum >= 80 ? 'On Track' : 'Needs Attention');
              const statusPill = scoreNum >= 80 ? 'green' : 'amber';
              return `
                <tr>
                  <td><b>${esc(b.batch_name)}</b></td>
                  <td><span class="pill" style="font-size:11px;">${esc(b.department_code || 'CSE')}</span></td>
                  <td><b>${b.student_count}</b> students</td>
                  <td>
                    <span class="pill ${statusPill}" style="font-weight:600;">${esc(b.avg_score)}</span>
                  </td>
                  <td>
                    <div style="display:flex;align-items:center;gap:8px;min-width:140px;">
                      <div class="bar" style="flex:1;height:8px;">
                        <span style="width:${compNum}%;background:${compNum >= 80 ? 'var(--blue)' : 'var(--accent)'};"></span>
                      </div>
                      <span style="font-size:12px;font-weight:600;min-width:32px;">${esc(b.completion_rate)}</span>
                    </div>
                  </td>
                  <td>
                    <span class="pill ${statusPill}">${esc(status)}</span>
                  </td>
                  <td style="text-align:right;">
                    <button class="btn small ghost" onclick="filterStudentsByBatch('${esc(b.batch_name)}')" title="View students in this cohort">
                      View Students →
                    </button>
                  </td>
                </tr>
              `;
            }).join('') : `
              <tr>
                <td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted);">
                  No batches match the selected department filter.
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Cohort Spotlight Cards Grid -->
    <h3 style="margin-bottom:14px;font-size:16px;">Cohort Deep Dive</h3>
    <div class="grid three">
      ${batches.map(b => {
        const scoreNum = parseInt(String(b.avg_score).replace('%', '')) || 75;
        const compNum = parseInt(String(b.completion_rate).replace('%', '')) || 85;
        return `
          <div class="card" style="display:flex;flex-direction:column;justify-content:space-between;">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
                <div>
                  <h4 style="margin:0;font-size:16px;">${esc(b.batch_name)}</h4>
                  <span class="muted" style="font-size:12px;">Dept: ${esc(b.department_code)}</span>
                </div>
                <span class="pill ${scoreNum >= 80 ? 'green' : 'amber'}">${esc(b.avg_score)}</span>
              </div>
              <p style="font-size:13px;color:var(--text-muted);margin:8px 0;">
                <b>${b.student_count}</b> active learners enrolled.
              </p>
              <div style="margin:14px 0;">
                <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
                  <span>Curriculum Progress</span>
                  <span style="font-weight:600;">${esc(b.completion_rate)}</span>
                </div>
                <div class="bar" style="height:7px;">
                  <span style="width:${compNum}%;background:var(--blue);"></span>
                </div>
              </div>
            </div>
            <div style="margin-top:14px;padding-top:10px;border-top:1px solid var(--line);display:flex;gap:8px;">
              <button class="btn small ghost" style="flex:1;" onclick="filterStudentsByBatch('${esc(b.batch_name)}')">Roster</button>
              <button class="btn small primary" style="flex:1;" onclick="render('Problem Assignment')">Assign</button>
            </div>
          </div>
        `;
      }).join('')}
    </div>`;
  } catch (err) {
    console.error('Batch Performance render error:', err);
    return `<div class="card"><p style="color:red;">Error loading batch performance: ${esc(err.message)}</p></div>`;
  }
}

function setBatchDeptFilter(dept) {
  activeBatchDeptFilter = dept;
  render('Batch Performance');
}

function filterBatchSearch(query) {
  const q = (query || '').toLowerCase().trim();
  const rows = document.querySelectorAll('#batchPerformanceTable tbody tr');
  rows.forEach(r => {
    const text = r.textContent.toLowerCase();
    r.style.display = (!q || text.includes(q)) ? '' : 'none';
  });
}

function filterStudentsByBatch(batchName) {
  render('Student Management').then(() => {
    setTimeout(() => {
      const searchBox = document.querySelector('input[placeholder*="Search"]');
      if (searchBox) {
        searchBox.value = batchName;
        searchBox.dispatchEvent(new Event('input', { bubbles: true }));
      }
      toast(`Filtered student management by ${batchName}`);
    }, 100);
  });
}

/* ========================================================
   FACULTY ANALYTICS & INSIGHTS MODULE
   ======================================================== */
async function renderFacultyAnalytics() {
  try {
    const res = await fetch('/api/faculty/analytics');
    const json = await res.json();
    const summary = json.summary || {};
    const topics = json.topics || [];
    const languages = json.languages || [];
    const verdicts = json.verdicts || [];
    const difficulties = json.difficulties || [];
    const weekly = json.weekly_activity || [];

    return head('Faculty Analytics & Insights', 'Comprehensive curriculum mastery, compiler execution rates, and student learning trends.', `
      <div style="display:flex;gap:8px;">
        <button class="btn ghost small" onclick="exportAnalyticsReport()">Export Report</button>
      </div>
    `) +
    stats([
      ['Overall Student Accuracy', summary.accuracy || '86%', '◎', 'Accepted / evaluated solutions'],
      ['Total Code Executions', String(summary.total_submissions || 240), '⌘', 'Sandboxed code executions'],
      ['Dominant Language', 'Python 3 (62%)', '⌥', 'Primary compiler preference'],
      ['Strongest Topic', summary.top_topic || 'Sorting & Searching (91%)', '◈', 'Highest cohort proficiency']
    ]) +
    `<div class="grid two" style="margin-top:20px;">
      <!-- Column 1 -->
      <div style="display:flex;flex-direction:column;gap:20px;">
        <!-- Card 1: Curriculum Topic Mastery -->
        <div class="card">
          <div class="card-head">
            <h3>Curriculum Topic Mastery</h3>
            <span class="pill">MASTERY</span>
          </div>
          <p class="muted" style="font-size:12px;margin-bottom:16px;">Proficiency rate calculated across all evaluated topic exercises.</p>
          <div>
            ${topics.map((t, idx) => `
              <div style="margin-bottom:14px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:5px;font-size:13px;font-weight:600;">
                  <span>${esc(t.topic)}</span>
                  <span style="color:var(--text-muted);font-size:12px;"><b>${t.mastery}%</b> (${t.solved}/${t.problems} solved)</span>
                </div>
                <div class="bar" style="height:8px;">
                  <span style="width:${t.mastery}%;background:${t.color || 'var(--blue)'};animation-delay:${idx * 0.08}s;"></span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Card 2: Code Submission Verdicts -->
        <div class="card">
          <div class="card-head">
            <h3>Submission Verdicts Breakdown</h3>
            <span class="pill green">JUDGE METRICS</span>
          </div>
          <p class="muted" style="font-size:12px;margin-bottom:14px;">Distribution of execution results from the isolated sandboxed judge.</p>
          <div style="display:flex;flex-direction:column;gap:12px;">
            ${verdicts.map(v => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--bg-subtle);border-radius:6px;border:1px solid var(--line);">
                <div style="display:flex;align-items:center;gap:10px;">
                  <span style="width:10px;height:10px;border-radius:50%;background:${v.color};display:inline-block;"></span>
                  <span style="font-size:13px;font-weight:500;">${esc(v.label)}</span>
                </div>
                <div style="display:flex;align-items:center;gap:10px;">
                  <span class="muted" style="font-size:12px;">${v.count} cases</span>
                  <span class="pill" style="font-size:11px;font-weight:600;">${esc(v.percentage)}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Column 2 -->
      <div style="display:flex;flex-direction:column;gap:20px;">
        <!-- Card 3: 7-Day Activity Velocity Chart -->
        <div class="card">
          <div class="card-head">
            <h3>7-Day Practice Velocity</h3>
            <span class="pill blue">WEEKLY INTENSITY</span>
          </div>
          <p class="muted" style="font-size:12px;margin-bottom:12px;">Daily volume of code executions across all student cohorts.</p>
          ${renderActivityChart(weekly.length ? weekly : data.weekly_activity)}
        </div>

        <!-- Card 4: Programming Language Adoption -->
        <div class="card">
          <div class="card-head">
            <h3>Programming Language Adoption</h3>
            <span class="pill">LANGUAGES</span>
          </div>
          <p class="muted" style="font-size:12px;margin-bottom:14px;">Distribution of compiler environments chosen by learners.</p>
          <div style="display:flex;height:12px;border-radius:6px;overflow:hidden;margin-bottom:16px;border:1px solid var(--line);">
            ${languages.map(l => `
              <div style="width:${l.percentage}%;background:${l.color};" title="${l.name}: ${l.percentage}%"></div>
            `).join('')}
          </div>
          <div class="grid two" style="gap:10px;">
            ${languages.map(l => `
              <div style="display:flex;align-items:center;gap:8px;font-size:12px;">
                <span style="width:10px;height:10px;border-radius:3px;background:${l.color};display:inline-block;"></span>
                <span style="font-weight:600;">${esc(l.name)}</span>
                <span class="muted">(${l.percentage}%)</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Card 5: Problem Difficulty Pass Rate -->
        <div class="card">
          <div class="card-head">
            <h3>Difficulty Tier Pass Rates</h3>
            <span class="pill amber">TIER BENCHMARKS</span>
          </div>
          <div class="grid three" style="gap:10px;margin-top:8px;">
            ${difficulties.map(d => `
              <div style="text-align:center;padding:12px 8px;background:var(--bg-subtle);border-radius:8px;border:1px solid var(--line);">
                <span class="pill" style="font-size:11px;margin-bottom:6px;display:inline-block;border-color:${d.color};color:${d.color};">${d.level}</span>
                <div style="font-size:20px;font-weight:700;color:var(--text);">${d.pass_rate}</div>
                <div class="muted" style="font-size:11px;margin-top:2px;">${d.attempted} solutions</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>`;
  } catch (err) {
    console.error('Faculty Analytics render error:', err);
    return `<div class="card"><p style="color:red;">Error loading analytics: ${esc(err.message)}</p></div>`;
  }
}

function exportAnalyticsReport() {
  toast('Exporting comprehensive faculty analytics CSV report...');
  const csvContent = "data:text/csv;charset=utf-8,Topic,Mastery,Problems,Solved\nArrays & Hashing,88%,14,12\nStrings & Two Pointers,82%,10,8\nSorting & Searching,91%,8,7\nRecursion & Backtracking,74%,6,4\nTrees & Binary Search,64%,8,5\nDynamic Programming,52%,6,3";
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Faculty_Analytics_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/* ========================================================
   STUDENT PROGRESS MODULE
   ======================================================== */
async function renderStudentProgress() {
  try {
    const res = await fetch('/api/dashboard');
    const json = await res.json();
    const d = json.data || json;

    return head('My Learning Progress', 'Track your personal problem-solving trajectory, topic mastery, and coding streak.') +
    stats([
      ['Total Points', `${d.points || 420} pts`, '★', 'Earned from solved problems'],
      ['Problems Solved', String(d.solved || 18), '✓', 'Verified code solutions'],
      ['Coding Streak', `${d.streak || 6} Days`, '☀', 'Consecutive practice days'],
      ['Global Rank', `#${d.rank || 3}`, '♛', 'Institution-wide position']
    ]) +
    `<div class="grid two" style="margin-top:20px;">
      <div class="card">
        <div class="card-head">
          <h3>Curriculum Topic Mastery</h3>
          <span class="pill">PROGRESS</span>
        </div>
        <p class="muted" style="font-size:12px;margin-bottom:14px;">Your verified proficiency across core curriculum topics.</p>
        ${renderTopicBars(d.topic_progress)}
      </div>
      <div class="card">
        <div class="card-head">
          <h3>Weekly Practice Activity</h3>
          <span class="pill blue">ACTIVE STREAK</span>
        </div>
        <p class="muted" style="font-size:12px;margin-bottom:14px;">Submissions evaluated over the last 7 days.</p>
        ${renderActivityChart(d.weekly_activity)}
      </div>
    </div>
    <div class="card" style="margin-top:20px;">
      <div class="card-head">
        <h3>Difficulty Breakdown</h3>
        <span class="pill green">ACCURACY ${d.accuracy || '86%'}</span>
      </div>
      <div class="grid three" style="margin-top:12px;">
        <div style="padding:16px;background:var(--bg-subtle);border-radius:8px;border:1px solid var(--line);text-align:center;">
          <span class="pill green" style="margin-bottom:8px;display:inline-block;">Easy</span>
          <div style="font-size:24px;font-weight:700;">10 / 10</div>
          <div class="muted" style="font-size:12px;margin-top:4px;">100% completed</div>
        </div>
        <div style="padding:16px;background:var(--bg-subtle);border-radius:8px;border:1px solid var(--line);text-align:center;">
          <span class="pill amber" style="margin-bottom:8px;display:inline-block;">Medium</span>
          <div style="font-size:24px;font-weight:700;">6 / 10</div>
          <div class="muted" style="font-size:12px;margin-top:4px;">60% completed</div>
        </div>
        <div style="padding:16px;background:var(--bg-subtle);border-radius:8px;border:1px solid var(--line);text-align:center;">
          <span class="pill danger" style="margin-bottom:8px;display:inline-block;">Hard</span>
          <div style="font-size:24px;font-weight:700;">2 / 5</div>
          <div class="muted" style="font-size:12px;margin-top:4px;">40% completed</div>
        </div>
      </div>
    </div>`;
  } catch (err) {
    console.error('Student progress render error:', err);
    return `<div class="card"><p style="color:red;">Error loading progress: ${esc(err.message)}</p></div>`;
  }
}

/* ========================================================
   COLLEGE REPORTS MODULE
   ======================================================== */
async function renderCollegeReports() {
  try {
    const res = await fetch('/api/admin/reports');
    const json = await res.json();
    const summary = json.summary || {};
    const depts = summary.departments || [];

    return head('College Institutional Reports', 'Institutional performance metrics, departmental enrollment, and pass benchmarks.') +
    stats([
      ['Total Enrolled', String(summary.total_students || 0), '♙', 'Students in college'],
      ['Faculty Count', String(summary.total_faculty || 0), '♟', 'Active instructors'],
      ['Pass Percentage', summary.pass_percentage || '82%', '◎', 'Average pass rate'],
      ['Academic Batches', String(summary.total_batches || 0), '▥', 'Registered cohorts']
    ]) +
    `<div class="grid two" style="margin-top:20px;">
      <div class="card">
        <div class="card-head">
          <h3>Department Enrollment Distribution</h3>
          <span class="pill">DEPARTMENTS</span>
        </div>
        ${depts.length ? table(
          ['Department', 'Short Code', 'Enrolled Students'],
          depts.map(d => [
            `<b>${esc(d.name)}</b>`,
            `<span class="pill">${esc(d.code)}</span>`,
            `${d.student_count} students`
          ])
        ) : '<p class="muted" style="padding:16px;">No department records.</p>'}
      </div>
      <div class="card">
        <div class="card-head">
          <h3>Practice Volume Intensity</h3>
          <span class="pill blue">ACTIVITY</span>
        </div>
        ${renderActivityChart(data.weekly_activity)}
      </div>
    </div>`;
  } catch (err) {
    console.error('College Reports render error:', err);
    return `<div class="card"><p style="color:red;">Error loading college reports: ${esc(err.message)}</p></div>`;
  }
}

/* ========================================================
   PLATFORM ANALYTICS MODULE
   ======================================================== */
async function renderPlatformAnalytics() {
  try {
    const [dashRes, repRes] = await Promise.all([
      fetch('/api/dashboard'),
      fetch('/api/admin/reports')
    ]);
    const dash = (await dashRes.json()).data || {};
    const rep = (await repRes.json()).summary || {};

    return head('Platform Analytics', 'Cross-institutional telemetry, tenant college adoption, and system load.') +
    stats([
      ['Affiliated Colleges', String(dash.total_colleges || 8), '▦', 'Registered institutions'],
      ['Active Licences', String(dash.active_licences || 8), '◷', 'Valid enterprise keys'],
      ['Platform Users', String(dash.total_users || 100), '♙', 'Students, faculty & admins'],
      ['Problem Bank', String(dash.total_problems || 25), '▤', 'Active coding challenges']
    ]) +
    `<div class="grid two" style="margin-top:20px;">
      <div class="card">
        <div class="card-head">
          <h3>Platform Code Executions</h3>
          <span class="pill green">SYSTEM HEALTH</span>
        </div>
        <p class="muted" style="font-size:12px;margin-bottom:14px;">Live sandbox execution throughput across all colleges.</p>
        ${renderActivityChart(data.weekly_activity)}
      </div>
      <div class="card">
        <div class="card-head">
          <h3>Institutional Capacity</h3>
          <span class="pill blue">TENANCY</span>
        </div>
        <p class="muted" style="font-size:12px;margin-bottom:14px;">Active capacity allocation per college license.</p>
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div style="padding:12px;background:var(--bg-subtle);border-radius:6px;border:1px solid var(--line);">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:13px;font-weight:600;">
              <span>ABC Engineering College</span>
              <span class="pill green">94% Capacity</span>
            </div>
            <div class="bar" style="height:6px;"><span style="width:94%;"></span></div>
          </div>
          <div style="padding:12px;background:var(--bg-subtle);border-radius:6px;border:1px solid var(--line);">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:13px;font-weight:600;">
              <span>XYZ Institute of Technology</span>
              <span class="pill blue">72% Capacity</span>
            </div>
            <div class="bar" style="height:6px;"><span style="width:72%;"></span></div>
          </div>
          <div style="padding:12px;background:var(--bg-subtle);border-radius:6px;border:1px solid var(--line);">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:13px;font-weight:600;">
              <span>National Engineering Campus</span>
              <span class="pill amber">58% Capacity</span>
            </div>
            <div class="bar" style="height:6px;"><span style="width:58%;"></span></div>
          </div>
        </div>
      </div>
    </div>`;
  } catch (err) {
    console.error('Platform Analytics render error:', err);
    return `<div class="card"><p style="color:red;">Error loading platform analytics: ${esc(err.message)}</p></div>`;
  }
}

/* Fallback for general analytics */
async function renderAnalytics(p) {
  if (p === 'Batch Performance') return await renderBatchPerformance();
  if (p === 'Analytics') return await renderFacultyAnalytics();
  if (p === 'My Progress') return await renderStudentProgress();
  if (p === 'College Reports') return await renderCollegeReports();
  if (p === 'Platform Analytics') return await renderPlatformAnalytics();
  return await renderFacultyAnalytics();
}

/* ========================================================
   PROFILE MODULE
   ======================================================== */
async function renderProfile() {
  const res = await fetch('/api/profile');
  const json = await res.json();
  const p = json.profile || {};
  const r = roles[role] || roles.student;

  return head('My profile', 'Manage institutional credentials and student portfolio details.') +
    `<div class="card" style="max-width:760px;">
      <div class="profile-row">
        <div class="big-avatar">${(p.full_name || r.person)[0]}</div>
        <div>
          <h2 style="margin:0;">${esc(p.full_name || r.person)}</h2>
          <span class="muted">${esc(p.email || r.email)} · ${r.name}</span>
        </div>
      </div>
      <div class="grid two" style="margin-top:24px;">
        <div class="field">
          <label>Full name</label>
          <input id="profileName" value="${esc(p.full_name || r.person)}">
        </div>
        <div class="field">
          <label>Email address</label>
          <input id="profileEmail" value="${esc(p.email || r.email)}" readonly style="opacity:0.8;">
        </div>
        <div class="field">
          <label>Roll number / Institutional ID</label>
          <input id="profileRoll" value="${esc(p.roll_number || 'STU001')}">
        </div>
        <div class="field">
          <label>Department</label>
          <input id="profileDept" value="${esc(p.department || 'Computer Science and Engineering')}">
        </div>
        <div class="field">
          <label>Batch / Section</label>
          <input id="profileBatch" value="${esc(p.batch || '2024 - 2028 · Section A')}">
        </div>
        <div class="field">
          <label>College</label>
          <input id="profileCollege" value="${esc(p.college || 'ABC Engineering College')}">
        </div>
      </div>
      <div class="field" style="margin-top:14px;">
        <label>Bio / Research Interests</label>
        <textarea id="profileBio" style="height:80px;">${esc(p.bio || 'Passionate about algorithms and scalable system design.')}</textarea>
      </div>
      <div style="display:flex;gap:12px;margin-top:20px;">
        <button class="btn" onclick="saveProfile()">Save profile changes</button>
      </div>
    </div>`;
}

async function saveProfile() {
  const full_name = document.getElementById('profileName').value.trim();
  const department = document.getElementById('profileDept').value.trim();
  const batch = document.getElementById('profileBatch').value.trim();
  const college = document.getElementById('profileCollege').value.trim();
  const bio = document.getElementById('profileBio').value.trim();

  try {
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name, department, batch, college, bio })
    });
    const json = await res.json();
    if (json.success) {
      if (currentUser) currentUser.name = full_name;
      updateRoleUI();
      toast('Profile updated successfully.');
    } else {
      toast(json.error || 'Failed to update profile.');
    }
  } catch(e) {
    toast('Error updating profile.');
  }
}

/* ========================================================
   SETTINGS MODULE
   ======================================================== */
async function renderSettings() {
  const res = await fetch('/api/settings');
  const json = await res.json();
  const s = json.settings || {};

  return head('Settings', 'Personalize your SKILLRACK experience and system preferences.') +
    `<div class="card" style="max-width:720px;">
      <h3>Appearance</h3>
      <p class="muted" style="margin:4px 0 14px;">Switch between light palette and dark high-contrast mode.</p>
      <button class="btn secondary" onclick="toggleTheme()">Toggle light / dark theme</button>
      <hr style="border:0;border-top:1px solid var(--line);margin:22px 0;">
      <h3>Account preferences</h3>
      <div style="margin:16px 0;">
        <label style="display:flex;align-items:center;gap:8px;margin-bottom:10px;cursor:pointer;">
          <input type="checkbox" id="setNotif" ${s.email_notifications ? 'checked' : ''}> Email notifications for assigned problems
        </label>
        <label style="display:flex;align-items:center;gap:8px;margin-bottom:10px;cursor:pointer;">
          <input type="checkbox" id="setDaily" ${s.daily_reminders ? 'checked' : ''}> Daily streak reminders
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
          <input type="checkbox" id="setWeekly" ${s.weekly_summary ? 'checked' : ''}> Weekly performance summary email
        </label>
      </div>
      <button class="btn" onclick="saveSettings()">Save preferences</button>
    </div>`;
}

async function saveSettings() {
  const email_notifications = document.getElementById('setNotif').checked;
  const daily_reminders = document.getElementById('setDaily').checked;
  const weekly_summary = document.getElementById('setWeekly').checked;

  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_notifications, daily_reminders, weekly_summary })
    });
    const json = await res.json();
    if (json.success) {
      toast('Preferences saved to database.');
    }
  } catch(e) {
    toast('Error saving settings.');
  }
}

async function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  toast(`Switched to ${next} theme.`);

  try {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: next })
    });
  } catch(e) {}
}

/* ========================================================
   MODAL DIALOG ENGINE
   ======================================================== */
function modalForm(title, fields, onSave) {
  const body = fields.map(f => `
    <div class="field">
      <label>${esc(f.label)}</label>
      <input id="formField_${f.id}" ${f.type === 'date' ? 'type="date"' : 'type="text"'} value="${esc(f.value || '')}" placeholder="${esc(f.placeholder || '')}">
    </div>
  `).join('');

  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-back" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <h2>${esc(title)}</h2>
        <div id="modalBody">${body}</div>
        <div class="modal-actions" id="modalActions">
          <button class="btn ghost" onclick="closeModal()">Cancel</button>
          <button class="btn" id="modalSaveBtn">Save</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('modalSaveBtn').onclick = () => {
    const values = {};
    let valid = true;
    fields.forEach(f => {
      const el = document.getElementById('formField_' + f.id);
      values[f.id] = el.value.trim();
      if (!values[f.id] && f.required !== false) {
        el.focus();
        valid = false;
      }
    });
    if (!valid) {
      toast('Please fill out all required fields.');
      return;
    }
    onSave(values);
  };
}

function openModal(title, customClass = '') {
  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-back" onclick="if(event.target===this)closeModal()">
      <div class="modal ${customClass}">
        <h2>${esc(title)}</h2>
        <div id="modalBody"></div>
        <div class="modal-actions" id="modalActions"></div>
      </div>
    </div>
  `;
}

function closeModal() {
  document.getElementById('modalRoot').innerHTML = '';
}

function downloadBlobCSV(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/* ========================================================
   INTERACTIVE HERO CANVAS (LOGIN VIEW)
   ======================================================== */
/* ========================================================
   INTERACTIVE HERO CANVAS & LEFT-SIDE ANIMATIONS
   ======================================================== */
let heroParticles = [];

function initHeroCanvas() {
  const canvas = document.getElementById('heroCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let width, height;
  let mouse = { x: -1000, y: -1000, radius: 170, active: false };

  const artSection = canvas.closest('.login-art') || canvas.parentElement;

  function resize() {
    if (!artSection) return;
    const rect = artSection.getBoundingClientRect();
    width = canvas.width = rect.width || window.innerWidth * 0.52;
    height = canvas.height = rect.height || window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();
  setTimeout(resize, 100);

  // Capture mouse events on the entire left section
  artSection.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    mouse.active = true;
  });
  artSection.addEventListener('mouseenter', () => {
    mouse.active = true;
  });
  artSection.addEventListener('mouseleave', () => {
    mouse.active = false;
  });

  // Clicking anywhere on left side triggers an explosive particle burst
  artSection.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    spawnParticleBurst(cx, cy, 26);
  });

  class Particle {
    constructor(x, y, vx, vy, isBurst = false) {
      this.x = x != null ? x : Math.random() * (width || 600);
      this.y = y != null ? y : Math.random() * (height || 600);
      this.vx = vx != null ? vx : (Math.random() - 0.5) * 0.85;
      this.vy = vy != null ? vy : (Math.random() - 0.5) * 0.85;
      this.radius = isBurst ? 2.4 + Math.random() * 2.6 : 1.6 + Math.random() * 2.2;
      
      const palette = [
        'rgba(41, 171, 226, ',   // IST cyan
        'rgba(147, 197, 253, ',  // soft blue
        'rgba(255, 255, 255, ',  // pure white
        'rgba(112, 79, 231, ',   // IST purple
        'rgba(254, 240, 138, '   // warm glow
      ];
      this.color = palette[Math.floor(Math.random() * palette.length)];
      this.baseAlpha = isBurst ? 0.95 : (0.35 + Math.random() * 0.45);
      this.alpha = this.baseAlpha;
      this.isBurst = isBurst;
      this.life = isBurst ? 75 : Infinity;
      this.maxLife = this.life;
      this.wobble = Math.random() * Math.PI * 2;
      this.wobbleSpeed = 0.02 + Math.random() * 0.03;
    }

    update() {
      if (this.isBurst) {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.96;
        this.vy *= 0.96;
        this.life--;
        this.alpha = (this.life / this.maxLife) * this.baseAlpha;
      } else {
        this.wobble += this.wobbleSpeed;
        this.x += this.vx + Math.sin(this.wobble) * 0.25;
        this.y += this.vy + Math.cos(this.wobble) * 0.25;

        // Bounce from walls
        if (this.x < 0 || this.x > width) this.vx *= -1;
        if (this.y < 0 || this.y > height) this.vy *= -1;

        // Interactive mouse gravity & deflection
        if (mouse.active) {
          const dx = mouse.x - this.x;
          const dy = mouse.y - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < mouse.radius) {
            const force = (1 - dist / mouse.radius) * 0.07;
            this.x -= (dx / dist) * force * 12;
            this.y -= (dy / dist) * force * 12;
            this.alpha = Math.min(1, this.baseAlpha + 0.35);
          } else {
            this.alpha = this.baseAlpha;
          }
        }
      }
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = this.color + Math.max(0, this.alpha) + ')';
      ctx.fill();
    }
  }

  const particleCount = 52;
  heroParticles = [];
  for (let i = 0; i < particleCount; i++) {
    heroParticles.push(new Particle());
  }

  window.spawnParticleBurst = function(cx, cy, count = 28) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.0 + Math.random() * 4.6;
      heroParticles.push(new Particle(
        cx, cy,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        true
      ));
    }
  };

  window.triggerHeroBurst = function(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    const rect = canvas.getBoundingClientRect();
    const cx = e ? (e.clientX - rect.left) : (rect.width * 0.22);
    const cy = e ? (e.clientY - rect.top) : 80;
    spawnParticleBurst(cx, cy, 32);
    toast('Inovate Solution Technology — SKILLRACK Workspace');
  };

  function loop() {
    const loginEl = document.getElementById('login');
    if (loginEl && loginEl.classList.contains('hidden')) {
      requestAnimationFrame(loop);
      return;
    }

    ctx.clearRect(0, 0, width, height);

    // Dynamic mouse radial glow aura
    if (mouse.active) {
      const g = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, mouse.radius);
      g.addColorStop(0, 'rgba(41, 171, 226, 0.22)');
      g.addColorStop(0.5, 'rgba(112, 79, 231, 0.07)');
      g.addColorStop(1, 'rgba(41, 171, 226, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, mouse.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Connect lines between nearby particles
    const maxDist = 120;
    for (let i = 0; i < heroParticles.length; i++) {
      const p1 = heroParticles[i];
      for (let j = i + 1; j < heroParticles.length; j++) {
        const p2 = heroParticles[j];
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < maxDist) {
          const alpha = (1 - dist / maxDist) * 0.26;
          ctx.beginPath();
          ctx.strokeStyle = `rgba(147, 197, 253, ${alpha})`;
          ctx.lineWidth = 0.85;
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }

      // Magnetic connection lines to the cursor
      if (mouse.active && !p1.isBurst) {
        const dx = p1.x - mouse.x;
        const dy = p1.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < mouse.radius) {
          const alpha = (1 - dist / mouse.radius) * 0.48;
          ctx.beginPath();
          ctx.strokeStyle = `rgba(41, 171, 226, ${alpha})`;
          ctx.lineWidth = 1.3;
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }
    }

    // Clean up expired burst particles and maintain count
    heroParticles = heroParticles.filter(p => !p.isBurst || p.life > 0);
    while (heroParticles.length < particleCount) {
      heroParticles.push(new Particle());
    }

    heroParticles.forEach(p => {
      p.update();
      p.draw();
    });

    requestAnimationFrame(loop);
  }

  loop();

  // Interactive 3D tilt on left hero brand
  const heroBrand = document.getElementById('heroBrand');
  if (heroBrand) {
    heroBrand.addEventListener('mousemove', e => {
      const rect = heroBrand.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      heroBrand.style.transform = `perspective(500px) rotateX(${-y * 0.08}deg) rotateY(${x * 0.08}deg) translateY(-3px) scale(1.02)`;
    });
    heroBrand.addEventListener('mouseleave', () => {
      heroBrand.style.transform = 'perspective(500px) rotateX(0deg) rotateY(0deg) translateY(0) scale(1)';
    });
  }
}

/* ========================================================
   CARD SPOTLIGHT HOVER EFFECT
   ======================================================== */
function initCardSpotlights() {
  document.querySelectorAll('.card, .art-stat-card').forEach(card => {
    card.onmousemove = e => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
    };
  });
}

// Interactive Tactile Click Ripple on Buttons, Chips, and Left Cards
document.addEventListener('click', e => {
  const btn = e.target.closest('.btn, .demo-chip-btn, .art-stat-card, .left-hero-brand');
  if (!btn) return;
  const rect = btn.getBoundingClientRect();
  const circle = document.createElement('span');
  const diameter = Math.max(rect.width, rect.height);
  const radius = diameter / 2;

  circle.style.width = circle.style.height = `${diameter}px`;
  circle.style.left = `${e.clientX - rect.left - radius}px`;
  circle.style.top = `${e.clientY - rect.top - radius}px`;
  circle.classList.add('btn-ripple');

  const existing = btn.querySelector('.btn-ripple');
  if (existing) existing.remove();

  btn.appendChild(circle);
  setTimeout(() => circle.remove(), 500);
});

/* ========================================================
   APPLICATION BOOTSTRAP
   ======================================================== */
window.addEventListener('DOMContentLoaded', async () => {
  initHeroCanvas();
  initCardSpotlights();
  await checkSession();
});
window.addEventListener('resize', updateRoleIndicator);