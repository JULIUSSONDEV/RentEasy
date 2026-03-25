// payments.js

async function loadPayments() {
  const user = getCurrentUser();
  const page = document.getElementById('page-payments');

  try {
    const payments = await api.get('/payments');

    const addBtn = user.role === 'landlord'
      ? `<button class="btn btn-primary" onclick="showAddPaymentModal()">+ Add Payment Record</button>`
      : '';

    const rows = payments.map(p => `
      <tr>
        <td><strong>${p.property_name}</strong></td>
        ${user.role === 'landlord' ? `<td>${p.tenant_name}</td>` : ''}
        <td>${formatCurrency(p.amount)}</td>
        <td>${formatDate(p.due_date)}</td>
        <td>${p.paid_date ? formatDate(p.paid_date) : '-'}</td>
        <td>${p.payment_method || '-'}</td>
        <td>${badge(p.status)}</td>
        <td>
          <div class="flex gap-2">
            ${user.role === 'landlord' && p.status !== 'paid' ? `
              <button class="btn btn-success btn-sm" onclick="markPaymentPaid(${p.id})">Mark Paid</button>
              <button class="btn btn-danger btn-sm" onclick="deletePayment(${p.id})">Delete</button>
            ` : ''}
            ${p.status === 'paid' ? `<span class="text-sm text-muted">✓ Paid ${formatDate(p.paid_date)}</span>` : ''}
          </div>
        </td>
      </tr>`).join('');

    const tenantHeader = user.role === 'landlord' ? '<th>Tenant</th>' : '';

    page.innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">Payments</h2>
          <div class="page-subtitle">${payments.length} record${payments.length === 1 ? '' : 's'}</div>
        </div>
        ${addBtn}
      </div>

      <div class="card">
        <div class="card-body">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Property</th>${tenantHeader}<th>Amount</th><th>Due Date</th><th>Paid Date</th><th>Method</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${rows || `<tr><td colspan="8" class="table-empty">No payment records found.</td></tr>`}
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

async function showAddPaymentModal() {
  try {
    const leases = await api.get('/leases');
    const activeLeases = leases.filter(l => l.status === 'active');

    openModal('Add Payment Record', `
      <form onsubmit="submitAddPayment(event)">
        <div class="form-group">
          <label>Lease *</label>
          <select id="pay-lease" required>
            <option value="">Select lease</option>
            ${activeLeases.map(l => `<option value="${l.id}">${l.property_name} — ${l.tenant_name} (${formatCurrency(l.monthly_rent)}/mo)</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Amount ($) *</label>
            <input type="number" id="pay-amount" min="0" step="0.01" required />
          </div>
          <div class="form-group">
            <label>Due Date *</label>
            <input type="date" id="pay-due" required />
          </div>
        </div>
        <div class="form-group">
          <label>Notes</label>
          <input type="text" id="pay-notes" placeholder="Optional notes" />
        </div>
        <div id="pay-error" class="alert alert-error hidden"></div>
        <div class="flex gap-2" style="justify-content:flex-end;margin-top:8px">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Create Record</button>
        </div>
      </form>
    `);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function submitAddPayment(e) {
  e.preventDefault();
  const errEl = document.getElementById('pay-error');
  errEl.classList.add('hidden');
  try {
    await api.post('/payments', {
      lease_id: parseInt(document.getElementById('pay-lease').value),
      amount: parseFloat(document.getElementById('pay-amount').value),
      due_date: document.getElementById('pay-due').value,
      notes: document.getElementById('pay-notes').value,
    });
    closeModal();
    showToast('Payment record created!', 'success');
    loadPayments();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

async function markPaymentPaid(id) {
  try {
    const method = prompt('Payment method (e.g. Bank Transfer, Cash, Check):', 'Bank Transfer');
    if (method === null) return;

    await api.put(`/payments/${id}`, {
      status: 'paid',
      payment_method: method,
    });
    showToast('Payment marked as paid!', 'success');
    loadPayments();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deletePayment(id) {
  if (!confirm('Delete this payment record?')) return;
  try {
    await api.delete(`/payments/${id}`);
    showToast('Payment record deleted', 'info');
    loadPayments();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
