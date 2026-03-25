// app.js - main application controller

function initApp(user) {
  document.getElementById('auth-container').classList.add('hidden');
  document.getElementById('main-container').classList.remove('hidden');

  document.getElementById('sidebar-user-name').textContent = user.name;
  document.getElementById('sidebar-user-role').textContent = user.role;
  document.getElementById('user-avatar').textContent = user.name.charAt(0).toUpperCase();

  // Adjust nav visibility
  const navTenants = document.getElementById('nav-tenants');
  if (user.role === 'tenant') {
    navTenants.style.display = 'none';
  } else {
    navTenants.style.display = '';
  }

  navigate('dashboard');
}

function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.getAttribute('onclick') && n.getAttribute('onclick').includes(`'${page}'`)) {
      n.classList.add('active');
    }
  });

  const loaders = {
    dashboard: loadDashboard,
    properties: loadProperties,
    tenants: loadTenants,
    leases: loadLeases,
    payments: loadPayments,
    maintenance: loadMaintenance,
  };

  if (loaders[page]) loaders[page]();
}

// Modal helpers
function openModal(title, bodyHTML) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHTML;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal(event) {
  if (!event || event.target === document.getElementById('modal-overlay')) {
    document.getElementById('modal-overlay').classList.add('hidden');
  }
}

// Toast helpers
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// Format helpers
function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
}

function badge(value, extra = '') {
  return `<span class="badge badge-${value} ${extra}">${value}</span>`;
}

function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem('renteasy_user')); } catch { return null; }
}

// Init on page load
window.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('renteasy_token');
  const user = getCurrentUser();
  if (token && user) {
    initApp(user);
  }
});
