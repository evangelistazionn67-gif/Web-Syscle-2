// ==========================================
// 1. SWITCH BETWEEN LOGIN / SIGN UP / FORGOT PASSWORD (same as your original)
// ==========================================
const boxes = { login: 'login-container', register: 'register-container', forgot: 'forgot-container' };
function show(which) { Object.entries(boxes).forEach(([k, id]) => { const el = document.getElementById(id); if (el) el.style.display = k === which ? 'block' : 'none'; }); }
const wire = (id, which) => { const el = document.getElementById(id); if (el) el.addEventListener('click', e => { e.preventDefault(); show(which); }); };
wire('link-to-register', 'register'); wire('link-to-login-from-reg', 'login');
wire('link-to-forgot', 'forgot'); wire('link-to-login-from-forgot', 'login');

// ==========================================
// 2. TALK TO THE SERVER (accounts now live in SQL Server, not account.txt)
// ==========================================
async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'syscle' }, body: JSON.stringify(body) });
  let data = {}; try { data = await r.json(); } catch (e) { /* no body */ }
  return { ok: r.ok, data };
}
const val = id => (document.getElementById(id) || {}).value || '';
const on = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', e => { e.preventDefault(); fn(); }); };

on('btn-login', async () => {
  const login = val('login-email').trim(), password = val('login-password');
  if (!login || !password) return alert('Please enter your email/username and password.');
  const { ok, data } = await post('/api/auth/login', { login, password });
  if (!ok) return alert(data.error || 'Login failed.');
  location.href = data.redirect;       // Admin -> admin dashboard, Customer -> storefront (decided by the server)
});
on('btn-register', async () => {
  const username = val('reg-username').trim(), email = val('reg-email').trim(), password = val('reg-password');
  if (!username || !email || !password) return alert('Please fill in all fields.');
  if (password !== val('reg-confirm')) return alert('Passwords do not match.');
  const { ok, data } = await post('/api/auth/register', { username, email, password });
  if (!ok) return alert(data.error || 'Could not create the account.');
  alert('Account created. You can log in now.'); show('login');
});
on('btn-reset', async () => {
  const email = val('forgot-email').trim();
  if (!email) return alert('Please enter your email address.');
  const { data } = await post('/api/auth/forgot', { email });
  alert(data.message || 'Request sent.'); show('login');
});

// Already logged in? Skip the login screen.
fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(me => {
  if (me) location.href = me.role === 'Admin' ? 'Pages/adminhomepage.html' : 'Pages/homepage.html';
}).catch(() => {});

// ==========================================
// 3. WELCOME TEXT + SHOW/HIDE PASSWORD (eye button)
// ==========================================
document.title = 'Web-Syscle - Login';
document.querySelectorAll('h1,h2,h3').forEach(h => { if (/Welcome to Syscle/i.test(h.textContent)) h.textContent = h.textContent.replace(/Welcome to Syscle/i, 'Welcome to Web-Syscle'); });
const eyeCss = document.createElement('style');
eyeCss.textContent = '.sy-eyewrap{position:relative;display:block;margin-bottom:14px}.sy-eyewrap input{width:100%;box-sizing:border-box;margin:0!important;padding-right:48px!important}.sy-eye{position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:0;cursor:pointer;padding:4px;color:#222;display:flex}.sy-eye svg{width:22px;height:22px}';
document.head.appendChild(eyeCss);
const EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
document.querySelectorAll('input[type="password"]').forEach(inp => {
  const wrap = document.createElement('span'); wrap.className = 'sy-eyewrap';
  inp.parentNode.insertBefore(wrap, inp); wrap.appendChild(inp);
  const b = document.createElement('button'); b.type = 'button'; b.className = 'sy-eye'; b.setAttribute('aria-label', 'Show password'); b.innerHTML = EYE;
  b.addEventListener('click', () => { const show = inp.type === 'password'; inp.type = show ? 'text' : 'password'; b.innerHTML = show ? EYE_OFF : EYE; b.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); });
  wrap.appendChild(b);
});
