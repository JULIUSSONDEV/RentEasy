// dashboard.js

async function loadDashboard() {
  const user = getCurrentUser();
  const page = document.getElementById('page-dashboard');

  try {
    const data = await api.get('/dashboard');

    if (user.role === 'landlord') {
      page.innerHTML = `
        <div class="page-header">
          <div>
            <h2 class="page-title">Dashboard</h2>
            <div class="page-subtitle">Welcome back, ${user.name}!</div>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card blue">
            <div class="stat-icon">🏢</div>
            <div class="stat-value">${data.totalProperties}</div>
            <div class="stat-label">Total Properties</div>
          </div>
          <div class="stat-card green">
            <div class="stat-icon">✅</div>
            <div class="stat-value">${data.occupiedProperties}</div>
            <div class="stat-label">Occupied</div>
          </div>
          <div class="stat-card cyan">
            <div class="stat-icon">🔓</div>
            <div class="stat-value">${data.availableProperties}</div>
            <div class="stat-label">Available</div>
          </div>
          <div class="stat-card blue">
            <div class="stat-icon">📄</div>
            <div class="stat-value">${data.activeLeases}</div>
            <div class="stat-label">Active Leases</div>
          </div>
          <div class="stat-card yellow">
            <div class="stat-icon">⏳</div>
            <div class="stat-value">${data.pendingPayments}</div>
            <div class="stat-label">Pending Payments</div>
          </div>
          <div class="stat-card red">
            <div class="stat-icon">⚠️</div>
            <div class="stat-value">${data.overduePayments}</div>
            <div class="stat-label">Overdue Payments</div>
          </div>
          <div class="stat-card yellow">
            <div class="stat-icon">🔧</div>
            <div class="stat-value">${data.openMaintenance}</div>
            <div class="stat-label">Open Requests</div>
          </div>
          <div class="stat-card green">
            <div class="stat-icon">💰</div>
            <div class="stat-value">${formatCurrency(data.monthlyRevenue)}</div>
            <div class="stat-label">This Month's Revenue</div>
          </div>
        </div>

        <div class="grid-2">
          <div class="card">
            <div class="card-header"><span class="card-title">Recent Payments</span></div>
            <div class="card-body">
              ${data.recentPayments.length ? `
                <div class="table-wrap">
                  <table>
                    <thead><tr><th>Tenant</th><th>Property</th><th>Amount</th><th>Status</th></tr></thead>
                    <tbody>${data.recentPayments.map(p => `
                      <tr>
                        <td>${p.tenant_name}</td>
                        <td>${p.property_name}</td>
                        <td>${formatCurrency(p.amount)}</td>
                        <td>${badge(p.status)}</td>
                      </tr>`).join('')}
                    </tbody>
                  </table>
                </div>` : '<div class="table-empty">No payments yet</div>'}
            </div>
          </div>

          <div class="card">
            <div class="card-header"><span class="card-title">Recent Maintenance</span></div>
            <div class="card-body">
              ${data.recentMaintenance.length ? `
                <div class="table-wrap">
                  <table>
                    <thead><tr><th>Title</th><th>Property</th><th>Priority</th><th>Status</th></tr></thead>
                    <tbody>${data.recentMaintenance.map(m => `
                      <tr>
                        <td>${m.title}</td>
                        <td>${m.property_name}</td>
                        <td>${badge(m.priority)}</td>
                        <td>${badge(m.status)}</td>
                      </tr>`).join('')}
                    </tbody>
                  </table>
                </div>` : '<div class="table-empty">No maintenance requests</div>'}
            </div>
          </div>
        </div>
      `;
    } else {
      // Tenant dashboard
      const leaseRows = data.activeLeases.map(l => `
        <div class="stat-card blue">
          <div class="stat-icon">🏠</div>
          <div class="stat-value" style="font-size:1.1rem">${l.property_name}</div>
          <div class="stat-label">${l.property_address}</div>
          <div class="text-sm mt-4">Lease: ${formatDate(l.start_date)} – ${formatDate(l.end_date)}</div>
          <div class="text-sm">${formatCurrency(l.monthly_rent)}/mo</div>
        </div>`).join('') || '<div class="text-muted">No active leases</div>';

      const paymentRows = data.pendingPayments.length ? `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Property</th><th>Amount</th><th>Due Date</th><th>Status</th></tr></thead>
            <tbody>${data.pendingPayments.map(p => `
              <tr>
                <td>${p.property_name}</td>
                <td>${formatCurrency(p.amount)}</td>
                <td>${formatDate(p.due_date)}</td>
                <td>${badge(p.status)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>` : '<div class="table-empty">No pending payments 🎉</div>';

      const maintRows = data.openMaintenance.length ? `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Title</th><th>Property</th><th>Priority</th><th>Status</th></tr></thead>
            <tbody>${data.openMaintenance.map(m => `
              <tr>
                <td>${m.title}</td>
                <td>${m.property_name}</td>
                <td>${badge(m.priority)}</td>
                <td>${badge(m.status)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>` : '<div class="table-empty">No open maintenance requests</div>';

      page.innerHTML = `
        <div class="page-header">
          <div>
            <h2 class="page-title">My Dashboard</h2>
            <div class="page-subtitle">Welcome back, ${user.name}!</div>
          </div>
        </div>

        <h3 style="font-size:.95rem;font-weight:600;color:var(--gray-700);margin-bottom:12px">MY PROPERTIES</h3>
        <div class="stats-grid mb-4">${leaseRows}</div>

        <div class="grid-2 mt-6">
          <div class="card">
            <div class="card-header"><span class="card-title">Pending Payments</span></div>
            <div class="card-body">${paymentRows}</div>
          </div>
          <div class="card">
            <div class="card-header"><span class="card-title">Open Maintenance</span></div>
            <div class="card-body">${maintRows}</div>
          </div>
        </div>
      `;
    }
  } catch (err) {
    page.innerHTML = `<div class="alert alert-error">Failed to load dashboard: ${err.message}</div>`;
  }
}
