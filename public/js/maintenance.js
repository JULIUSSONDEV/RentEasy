// maintenance.js

async function loadMaintenance() {
  const user = getCurrentUser();
  const page = document.getElementById('page-maintenance');

  try {
    const requests = await api.get('/maintenance');

    const addBtn = user.role === 'tenant'
      ? `<button class="btn btn-primary" onclick="showAddMaintenanceModal()">+ New Request</button>`
      : '';

    const rows = requests.map(r => `
      <tr>
        <td><strong>${r.title}</strong></td>
        <td>${r.property_name}</td>
        ${user.role === 'landlord' ? `<td>${r.tenant_name}</td>` : ''}
        <td>${badge(r.priority)}</td>
        <td>${badge(r.status)}</td>
        <td>${formatDate(r.created_at)}</td>
        <td>
          <div class="flex gap-2">
            <button class="btn btn-secondary btn-sm" onclick="viewMaintenanceRequest(${r.id})">View</button>
            ${user.role === 'landlord' ? `<button class="btn btn-primary btn-sm" onclick="showUpdateMaintenanceModal(${r.id})">Update</button>` : ''}
          </div>
        </td>
      </tr>`).join('');

    const tenantCol = user.role === 'landlord' ? '<th>Tenant</th>' : '';

    page.innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">Maintenance Requests</h2>
          <div class="page-subtitle">${requests.length} request${requests.length === 1 ? '' : 's'}</div>
        </div>
        ${addBtn}
      </div>

      <div class="card">
        <div class="card-body">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Title</th><th>Property</th>${tenantCol}<th>Priority</th><th>Status</th><th>Submitted</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${rows || `<tr><td colspan="7" class="table-empty">No maintenance requests found.</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    page.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

async function viewMaintenanceRequest(id) {
  try {
    const r = await api.get(`/maintenance/${id}`);
    openModal('Maintenance Request', `
      <div class="detail-grid" style="margin-bottom:16px">
        <div class="detail-item"><div class="detail-label">Title</div><div class="detail-value">${r.title}</div></div>
        <div class="detail-item"><div class="detail-label">Status</div><div class="detail-value">${badge(r.status)}</div></div>
        <div class="detail-item"><div class="detail-label">Priority</div><div class="detail-value">${badge(r.priority)}</div></div>
        <div class="detail-item"><div class="detail-label">Submitted</div><div class="detail-value">${formatDate(r.created_at)}</div></div>
        <div class="detail-item"><div class="detail-label">Last Updated</div><div class="detail-value">${formatDate(r.updated_at)}</div></div>
      </div>
      <div class="form-group">
        <div class="detail-label">Description</div>
        <p style="margin-top:4px;color:var(--gray-700)">${r.description}</p>
      </div>
      ${r.resolution_notes ? `
        <div class="form-group">
          <div class="detail-label">Resolution Notes</div>
          <p style="margin-top:4px;color:var(--gray-700)">${r.resolution_notes}</p>
        </div>` : ''}
    `);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function showAddMaintenanceModal() {
  try {
    const leases = await api.get('/leases');
    const activeLeases = leases.filter(l => l.status === 'active');

    openModal('Submit Maintenance Request', `
      <form onsubmit="submitAddMaintenance(event)">
        <div class="form-group">
          <label>Property *</label>
          <select id="maint-property" required>
            <option value="">Select property</option>
            ${activeLeases.map(l => `<option value="${l.property_id}">${l.property_name} — ${l.property_address}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Title *</label>
          <input type="text" id="maint-title" placeholder="e.g. Leaking kitchen faucet" required />
        </div>
        <div class="form-group">
          <label>Priority</label>
          <select id="maint-priority">
            <option value="low">Low</option>
            <option value="medium" selected>Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div class="form-group">
          <label>Description *</label>
          <textarea id="maint-desc" placeholder="Please describe the issue in detail..." required></textarea>
        </div>
        <div id="maint-error" class="alert alert-error hidden"></div>
        <div class="flex gap-2" style="justify-content:flex-end;margin-top:8px">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Submit Request</button>
        </div>
      </form>
    `);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function submitAddMaintenance(e) {
  e.preventDefault();
  const errEl = document.getElementById('maint-error');
  errEl.classList.add('hidden');
  try {
    await api.post('/maintenance', {
      property_id: parseInt(document.getElementById('maint-property').value),
      title: document.getElementById('maint-title').value,
      priority: document.getElementById('maint-priority').value,
      description: document.getElementById('maint-desc').value,
    });
    closeModal();
    showToast('Maintenance request submitted!', 'success');
    loadMaintenance();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

async function showUpdateMaintenanceModal(id) {
  try {
    const r = await api.get(`/maintenance/${id}`);
    openModal('Update Maintenance Request', `
      <form onsubmit="submitUpdateMaintenance(event, ${id})">
        <p style="color:var(--gray-600);margin-bottom:16px"><strong>${r.title}</strong> — ${r.property_name}</p>
        <div class="form-row">
          <div class="form-group">
            <label>Status</label>
            <select id="umaint-status">
              ${['open','in_progress','resolved','closed'].map(s =>
                `<option value="${s}" ${r.status === s ? 'selected' : ''}>${s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Priority</label>
            <select id="umaint-priority">
              ${['low','medium','high','urgent'].map(p =>
                `<option value="${p}" ${r.priority === p ? 'selected' : ''}>${p.charAt(0).toUpperCase() + p.slice(1)}</option>`
              ).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Resolution Notes</label>
          <textarea id="umaint-notes" placeholder="Describe what was done to resolve this...">${r.resolution_notes || ''}</textarea>
        </div>
        <div id="umaint-error" class="alert alert-error hidden"></div>
        <div class="flex gap-2" style="justify-content:flex-end;margin-top:8px">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Update</button>
        </div>
      </form>
    `);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function submitUpdateMaintenance(e, id) {
  e.preventDefault();
  try {
    await api.put(`/maintenance/${id}`, {
      status: document.getElementById('umaint-status').value,
      priority: document.getElementById('umaint-priority').value,
      resolution_notes: document.getElementById('umaint-notes').value,
    });
    closeModal();
    showToast('Maintenance request updated!', 'success');
    loadMaintenance();
  } catch (err) {
    document.getElementById('umaint-error').textContent = err.message;
    document.getElementById('umaint-error').classList.remove('hidden');
  }
}
