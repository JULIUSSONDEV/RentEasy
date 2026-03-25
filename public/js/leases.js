// leases.js

async function loadLeases() {
  const user = getCurrentUser();
  const page = document.getElementById('page-leases');

  try {
    const leases = await api.get('/leases');

    const addBtn = user.role === 'landlord'
      ? `<button class="btn btn-primary" onclick="showAddLeaseModal()">+ Add Lease</button>`
      : '';

    const rows = leases.map(l => {
      const nameCol = user.role === 'landlord'
        ? `<td>${l.tenant_name}<br><span class="text-sm text-muted">${l.tenant_email}</span></td>`
        : `<td>${l.landlord_name}<br><span class="text-sm text-muted">${l.landlord_email}</span></td>`;

      return `<tr>
        <td><strong>${l.property_name}</strong><br><span class="text-sm text-muted">${l.property_address}</span></td>
        ${nameCol}
        <td>${formatDate(l.start_date)}</td>
        <td>${formatDate(l.end_date)}</td>
        <td>${formatCurrency(l.monthly_rent)}/mo</td>
        <td>${formatCurrency(l.deposit)}</td>
        <td>${badge(l.status)}</td>
        <td>
          <div class="flex gap-2">
            <button class="btn btn-secondary btn-sm" onclick="viewLease(${l.id})">View</button>
            ${user.role === 'landlord' ? `<button class="btn btn-primary btn-sm" onclick="showEditLeaseModal(${l.id})">Edit</button>` : ''}
          </div>
        </td>
      </tr>`;
    }).join('');

    const headerSecond = user.role === 'landlord' ? '<th>Tenant</th>' : '<th>Landlord</th>';

    page.innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">Leases</h2>
          <div class="page-subtitle">${leases.length} lease${leases.length === 1 ? '' : 's'}</div>
        </div>
        ${addBtn}
      </div>

      <div class="card">
        <div class="card-body">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Property</th>${headerSecond}<th>Start</th><th>End</th><th>Rent</th><th>Deposit</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${rows || `<tr><td colspan="8" class="table-empty">No leases found.</td></tr>`}
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

async function viewLease(id) {
  try {
    const l = await api.get(`/leases/${id}`);
    openModal('Lease Details', `
      <div class="detail-grid">
        <div class="detail-item"><div class="detail-label">Property</div><div class="detail-value">${l.property_name}</div></div>
        <div class="detail-item"><div class="detail-label">Status</div><div class="detail-value">${badge(l.status)}</div></div>
        <div class="detail-item"><div class="detail-label">Tenant</div><div class="detail-value">${l.tenant_name}</div></div>
        <div class="detail-item"><div class="detail-label">Landlord</div><div class="detail-value">${l.landlord_name}</div></div>
        <div class="detail-item"><div class="detail-label">Start Date</div><div class="detail-value">${formatDate(l.start_date)}</div></div>
        <div class="detail-item"><div class="detail-label">End Date</div><div class="detail-value">${formatDate(l.end_date)}</div></div>
        <div class="detail-item"><div class="detail-label">Monthly Rent</div><div class="detail-value">${formatCurrency(l.monthly_rent)}</div></div>
        <div class="detail-item"><div class="detail-label">Deposit</div><div class="detail-value">${formatCurrency(l.deposit)}</div></div>
      </div>
      ${l.notes ? `<div class="mt-4"><div class="detail-label">Notes</div><p style="margin-top:4px">${l.notes}</p></div>` : ''}
    `);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function showAddLeaseModal() {
  try {
    const properties = await api.get('/properties');
    const availableProps = properties.filter(p => p.status === 'available');

    openModal('Add New Lease', `
      <form onsubmit="submitAddLease(event)">
        <div class="form-group">
          <label>Property *</label>
          <select id="lease-property" required>
            <option value="">Select property</option>
            ${availableProps.map(p => `<option value="${p.id}">${p.name} — ${p.address}</option>`).join('')}
          </select>
          ${availableProps.length === 0 ? '<small style="color:var(--warning)">No available properties. Change a property status to "available" first.</small>' : ''}
        </div>
        <div class="form-group">
          <label>Tenant Email *</label>
          <div class="flex gap-2">
            <input type="email" id="lease-tenant-email" placeholder="tenant@email.com" style="flex:1" />
            <button type="button" class="btn btn-secondary" onclick="searchTenant()">Search</button>
          </div>
          <div id="lease-tenant-info" class="mt-4 hidden"></div>
          <input type="hidden" id="lease-tenant-id" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Start Date *</label>
            <input type="date" id="lease-start" required />
          </div>
          <div class="form-group">
            <label>End Date *</label>
            <input type="date" id="lease-end" required />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Monthly Rent ($) *</label>
            <input type="number" id="lease-rent" min="0" step="0.01" required />
          </div>
          <div class="form-group">
            <label>Security Deposit ($)</label>
            <input type="number" id="lease-deposit" min="0" step="0.01" value="0" />
          </div>
        </div>
        <div class="form-group">
          <label>Notes</label>
          <textarea id="lease-notes" placeholder="Optional notes..."></textarea>
        </div>
        <div id="lease-error" class="alert alert-error hidden"></div>
        <div class="flex gap-2" style="justify-content:flex-end;margin-top:8px">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Create Lease</button>
        </div>
      </form>
    `);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function searchTenant() {
  const email = document.getElementById('lease-tenant-email').value;
  if (!email) return;
  try {
    const tenant = await api.get(`/tenants/search/by-email?email=${encodeURIComponent(email)}`);
    document.getElementById('lease-tenant-id').value = tenant.id;
    document.getElementById('lease-tenant-info').innerHTML = `
      <div class="alert alert-success">
        Found: <strong>${tenant.name}</strong> (${tenant.email})${tenant.phone ? ` · ${tenant.phone}` : ''}
      </div>`;
    document.getElementById('lease-tenant-info').classList.remove('hidden');
  } catch (err) {
    document.getElementById('lease-tenant-id').value = '';
    document.getElementById('lease-tenant-info').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    document.getElementById('lease-tenant-info').classList.remove('hidden');
  }
}

async function submitAddLease(e) {
  e.preventDefault();
  const errEl = document.getElementById('lease-error');
  errEl.classList.add('hidden');

  const tenantId = document.getElementById('lease-tenant-id').value;
  if (!tenantId) {
    errEl.textContent = 'Please search and confirm a tenant before submitting.';
    errEl.classList.remove('hidden');
    return;
  }

  try {
    await api.post('/leases', {
      property_id: parseInt(document.getElementById('lease-property').value),
      tenant_id: parseInt(tenantId),
      start_date: document.getElementById('lease-start').value,
      end_date: document.getElementById('lease-end').value,
      monthly_rent: parseFloat(document.getElementById('lease-rent').value),
      deposit: parseFloat(document.getElementById('lease-deposit').value),
      notes: document.getElementById('lease-notes').value,
    });
    closeModal();
    showToast('Lease created!', 'success');
    loadLeases();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

async function showEditLeaseModal(id) {
  try {
    const l = await api.get(`/leases/${id}`);
    openModal('Edit Lease', `
      <form onsubmit="submitEditLease(event, ${id})">
        <div class="form-group">
          <label>End Date</label>
          <input type="date" id="elease-end" value="${l.end_date}" />
        </div>
        <div class="form-group">
          <label>Status</label>
          <select id="elease-status">
            ${['active','expired','terminated'].map(s =>
              `<option value="${s}" ${l.status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Notes</label>
          <textarea id="elease-notes">${l.notes || ''}</textarea>
        </div>
        <div id="elease-error" class="alert alert-error hidden"></div>
        <div class="flex gap-2" style="justify-content:flex-end;margin-top:8px">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Changes</button>
        </div>
      </form>
    `);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function submitEditLease(e, id) {
  e.preventDefault();
  try {
    await api.put(`/leases/${id}`, {
      end_date: document.getElementById('elease-end').value,
      status: document.getElementById('elease-status').value,
      notes: document.getElementById('elease-notes').value,
    });
    closeModal();
    showToast('Lease updated!', 'success');
    loadLeases();
  } catch (err) {
    document.getElementById('elease-error').textContent = err.message;
    document.getElementById('elease-error').classList.remove('hidden');
  }
}
