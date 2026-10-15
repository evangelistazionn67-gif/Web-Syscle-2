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
