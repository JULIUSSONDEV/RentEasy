// auth.js - authentication logic

function showAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((t, i) => {
    t.classList.toggle('active', (i === 0 && tab === 'login') || (i === 1 && tab === 'register'));
  });
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');

  try {
    const { token, user } = await api.post('/auth/login', { email, password });
    localStorage.setItem('renteasy_token', token);
    localStorage.setItem('renteasy_user', JSON.stringify(user));
    initApp(user);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value;
  const email = document.getElementById('reg-email').value;
  const phone = document.getElementById('reg-phone').value;
  const password = document.getElementById('reg-password').value;
  const role = document.getElementById('reg-role').value;
  const errEl = document.getElementById('reg-error');
  errEl.classList.add('hidden');

  try {
    const { token, user } = await api.post('/auth/register', { name, email, phone, password, role });
    localStorage.setItem('renteasy_token', token);
    localStorage.setItem('renteasy_user', JSON.stringify(user));
    initApp(user);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

function logout() {
  localStorage.removeItem('renteasy_token');
  localStorage.removeItem('renteasy_user');
  document.getElementById('main-container').classList.add('hidden');
  document.getElementById('auth-container').classList.remove('hidden');
}
