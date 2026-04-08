// tenants.js

async function loadTenants() {
  const user = getCurrentUser();
  if (user.role !== 'landlord') return;

  const page = document.getElementById('page-tenants');

  try {
    const tenants = await api.get('/tenants');

    const rows = tenants.map(t => `
      <tr>
        <td><strong>${t.name}</strong></td>
        <td>${t.email}</td>
        <td>${t.phone || '-'}</td>
        <td>${t.property_name}</td>
        <td>${formatDate(t.start_date)} – ${formatDate(t.end_date)}</td>
        <td>${badge(t.lease_status)}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="viewTenant(${t.id})">View</button>
        </td>
      </tr>`).join('');

    page.innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">Tenants</h2>
          <div class="page-subtitle">${tenants.length} tenant${tenants.length === 1 ? '' : 's'}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-body">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Email</th><th>Phone</th><th>Property</th><th>Lease Period</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${rows || `<tr><td colspan="7" class="table-empty">No tenants found. Create a lease to add tenants.</td></tr>`}
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

async function viewTenant(id) {
  try {
    const t = await api.get(`/tenants/${id}`);
    const leaseRows = t.leases.map(l => `
      <tr>
        <td>${l.property_name}</td>
        <td>${formatDate(l.start_date)}</td>
        <td>${formatDate(l.end_date)}</td>
        <td>${formatCurrency(l.monthly_rent)}</td>
        <td>${badge(l.status)}</td>
      </tr>`).join('') || '<tr><td colspan="5" class="table-empty">No leases</td></tr>';

    openModal('Tenant Details', `
      <div class="detail-grid" style="margin-bottom:20px">
        <div class="detail-item"><div class="detail-label">Name</div><div class="detail-value">${t.name}</div></div>
        <div class="detail-item"><div class="detail-label">Email</div><div class="detail-value">${t.email}</div></div>
        <div class="detail-item"><div class="detail-label">Phone</div><div class="detail-value">${t.phone || '-'}</div></div>
        <div class="detail-item"><div class="detail-label">Member Since</div><div class="detail-value">${formatDate(t.created_at)}</div></div>
      </div>
      <h4 style="font-size:.875rem;font-weight:600;margin-bottom:10px">Lease History</h4>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Property</th><th>Start</th><th>End</th><th>Rent</th><th>Status</th></tr></thead>
          <tbody>${leaseRows}</tbody>
        </table>
      </div>
    `);
  } catch (err) {
    showToast(err.message, 'error');
  }
}
