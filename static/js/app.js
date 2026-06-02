let apps = [];

document.addEventListener('DOMContentLoaded', () => {
  loadApps();
  updateGreeting();
  setInterval(updateGreeting, 60000);
  fetch('/auth/status').then(r => r.json()).then(s => {
    if (s.username) document.getElementById('navUser').textContent = s.username;
  });
});

function toggleTheme() {
  const next = (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  document.documentElement.setAttribute('data-bs-theme', next);
  localStorage.setItem('portal-theme', next);
}

function updateGreeting() {
  const h = new Date().getHours();
  let greet = 'Good evening';
  if (h < 12) greet = 'Good morning';
  else if (h < 17) greet = 'Good afternoon';

  const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  document.getElementById('greeting').innerHTML = `<span class="time">${time}</span>${greet}. <span class="text-muted" style="font-size:.85rem;">${date}</span>`;
}

async function loadApps() {
  try {
    const res = await fetch('/api/apps');
    apps = await res.json();
    renderApps();
    // Check health for each app
    apps.forEach(app => checkHealth(app.id));
  } catch { }
}

function renderApps() {
  const grid = document.getElementById('appGrid');
  let html = '';

  for (const app of apps) {
    html += `<a class="app-card" href="${esc(app.url)}" target="_blank" data-id="${app.id}">
      <div class="card-status status-checking" id="status-${app.id}"></div>
      <button class="card-edit" onclick="event.preventDefault();event.stopPropagation();editApp(${app.id});" title="Edit">✏️</button>
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${esc(app.color)};border-radius:14px 14px 0 0;"></div>
      <div class="card-icon">${app.icon || '📦'}</div>
      <div class="card-name">${esc(app.name)}</div>
      <div class="card-desc">${esc(app.description)}</div>
      <div class="card-url">${esc(app.url)}</div>
    </a>`;
  }

  // Add app card
  html += `<div class="app-card add-card" onclick="openAddApp()">
    <div class="plus">+</div>
    Add App
  </div>`;

  grid.innerHTML = html;
}

async function checkHealth(id) {
  const el = document.getElementById('status-' + id);
  if (!el) return;
  try {
    const res = await fetch(`/api/apps/${id}/health`);
    const data = await res.json();
    el.className = 'card-status ' + (data.status === 'up' ? 'status-up' : 'status-down');
  } catch {
    el.className = 'card-status status-down';
  }
}

function openAddApp() {
  document.getElementById('editAppId').value = '';
  document.getElementById('appName').value = '';
  document.getElementById('appUrl').value = '';
  document.getElementById('appDesc').value = '';
  document.getElementById('appIcon').value = '📦';
  document.getElementById('appColor').value = '#6366f1';
  document.getElementById('appModalTitle').textContent = 'Add App';
  document.getElementById('deleteAppBtn').style.display = 'none';
  new bootstrap.Modal(document.getElementById('addAppModal')).show();
}

function editApp(id) {
  const app = apps.find(a => a.id === id);
  if (!app) return;
  document.getElementById('editAppId').value = app.id;
  document.getElementById('appName').value = app.name;
  document.getElementById('appUrl').value = app.url;
  document.getElementById('appDesc').value = app.description || '';
  document.getElementById('appIcon').value = app.icon || '📦';
  document.getElementById('appColor').value = app.color || '#6366f1';
  document.getElementById('appModalTitle').textContent = 'Edit ' + app.name;
  document.getElementById('deleteAppBtn').style.display = 'inline-block';
  new bootstrap.Modal(document.getElementById('addAppModal')).show();
}

async function saveApp() {
  const id = document.getElementById('editAppId').value;
  const data = {
    name: document.getElementById('appName').value.trim(),
    url: document.getElementById('appUrl').value.trim(),
    description: document.getElementById('appDesc').value.trim(),
    icon: document.getElementById('appIcon').value.trim() || '📦',
    color: document.getElementById('appColor').value
  };
  if (!data.name || !data.url) { alert('Name and URL required'); return; }

  const endpoint = id ? `/api/apps/${id}` : '/api/apps';
  const method = id ? 'PUT' : 'POST';
  await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  bootstrap.Modal.getInstance(document.getElementById('addAppModal')).hide();
  loadApps();
}

async function deleteApp() {
  const id = document.getElementById('editAppId').value;
  if (!id || !confirm('Remove this app?')) return;
  await fetch(`/api/apps/${id}`, { method: 'DELETE' });
  bootstrap.Modal.getInstance(document.getElementById('addAppModal')).hide();
  loadApps();
}

function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

async function logout() {
  await fetch('/auth/logout', { method: 'POST' });
  location.href = '/login';
}
