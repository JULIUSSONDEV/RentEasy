


(function () {
    const user = API.requireAuth(['tenant']);
    if (!user) return;
})();

async function loadDashboard() {
    try {
        const [bookingsData, paymentsData, msgData] = await Promise.all([
            API.get('/bookings/my'),
            API.get('/payments/my'),
            API.get('/messages/unread-count')
        ]);
        const bookings = bookingsData.bookings || [];
        const payments = paymentsData.payments || [];


        document.getElementById('statTotalBookings').textContent = bookings.length;
        document.getElementById('statActiveRentals').textContent = bookings.filter(b => b.status === 'approved').length;
        document.getElementById('statPayments').textContent = payments.length;
        document.getElementById('statMessages').textContent = msgData.unread_count || 0;


        const badge = document.getElementById('msgBadge');
        if (badge) {
            badge.textContent = msgData.unread_count;
            badge.classList.toggle('hidden', msgData.unread_count === 0);
        }


        const tableEl = document.getElementById('recentBookingsTable');
        if (tableEl) {
            if (!bookings.length) {
                tableEl.innerHTML = '<div class="empty-state"><p>No bookings yet. <a href="properties.html">Browse properties</a> to get started.</p></div>';
            } else {
                tableEl.innerHTML = `
                <div class="table-wrapper">
                <table class="data-table">
                    <thead><tr><th>Property</th><th>Landlord</th><th>Rent</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                    ${bookings.slice(0, 5).map(b => `
                        <tr>
                            <td>
                                <div class="font-semibold text-sm">${b.property_title}</div>
                                <div class="text-xs text-muted">${b.city}</div>
                            </td>
                            <td>
                                <div class="text-sm">${b.landlord_name || '-'}</div>
                                ${b.landlord_phone ? `<div class="text-xs text-muted" style="font-family:monospace;">${b.landlord_phone}</div>` : ''}
                            </td>
                            <td class="text-sm font-semibold">${formatCurrency(b.monthly_rent)}</td>
                            <td>${statusBadge(b.status)}</td>
                            <td class="actions-cell">
                                ${b.status === 'pending' ? `<button class="btn btn-danger btn-sm" onclick="cancelBooking(${b.id})">Cancel</button>` : ''}
                                ${b.status === 'approved' ? `<button class="btn btn-primary btn-sm" onclick="openPaymentForm(${b.id}, ${b.monthly_rent})">Pay Rent</button>` : ''}
                                ${b.status === 'approved' && !b.reviewed ? `<button class="btn btn-ghost btn-sm" onclick="openReviewModal(${b.id})">Review</button>` : ''}
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table></div>`;
            }
        }


        await loadNotifications();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function loadNotifications() {
    const el = document.getElementById('notificationsPanel');
    if (!el) return;
    try {
        const data = await API.get('/notifications?limit=10');
        if (!data.notifications.length) {
            el.innerHTML = '<div class="empty-state" style="padding:1.5rem;"><p>No notifications yet.</p></div>';
            return;
        }
        el.innerHTML = data.notifications.map(n => `
            <div class="message-item ${!n.is_read ? 'unread' : ''}" id="notif-${n.id}">
                <div style="flex:1;cursor:pointer;" onclick="markNotifRead(${n.id}, this.parentElement)">
                    <div class="font-semibold text-sm">${n.title}</div>
                    <div class="text-xs text-muted">${n.body || ''}</div>
                    <div class="text-xs" style="color:var(--gray-400);margin-top:0.25rem;">${formatDateTime(n.created_at)}</div>
                </div>
                <div style="display:flex;align-items:center;gap:0.5rem;">
                    ${!n.is_read ? '<span class="badge badge-primary" style="font-size:0.6rem;">New</span>' : ''}
                    <button class="btn-icon" onclick="deleteNotification(${n.id})" title="Delete" style="color:var(--gray-400);padding:0.25rem;">
                        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                            <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                        </svg>
                    </button>
                </div>
            </div>`).join('');
    } catch { }
}

async function markNotifRead(id, el) {
    try {
        await API.patch(`/notifications/${id}/read`);
        el.classList.remove('unread');
        el.querySelector('.badge')?.remove();
        loadNotifCount();
    } catch { }
}

async function deleteNotification(id) {
    try {
        await API.delete(`/notifications/${id}`);
        const el = document.getElementById(`notif-${id}`);
        if (el) el.remove();
        loadNotifCount();
        const panel = document.getElementById('notificationsPanel');
        if (panel && !panel.querySelector('.message-item')) {
            panel.innerHTML = '<div class="empty-state" style="padding:1.5rem;"><p>No notifications yet.</p></div>';
        }
    } catch (err) { showToast(err.message, 'error'); }
}

async function loadAllBookings() {
    const el = document.getElementById('bookingsTable');
    if (!el) return;
    el.innerHTML = '<div class="flex-center" style="padding:2rem;"><div class="spinner"></div></div>';
    try {
        const data = await API.get('/bookings/my');
        const bookings = data.bookings || [];
        if (!bookings.length) {
            el.innerHTML = '<div class="empty-state"><p>No bookings found. <a href="properties.html">Browse properties</a>.</p></div>';
            return;
        }
        el.innerHTML = `
        <div class="table-wrapper">
        <table class="data-table">
            <thead><tr><th>Property</th><th>Landlord</th><th>Start Date</th><th>Rent/mo</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
            ${bookings.map(b => `
                <tr>
                    <td>
                        ${b.cover_image ? `<img src="http://localhost:5000${b.cover_image}" style="width:2.5rem;height:2rem;object-fit:cover;border-radius:4px;display:inline-block;vertical-align:middle;margin-right:0.5rem;" alt="">` : ''}
                        <div style="display:inline-block;vertical-align:middle;">
                            <div class="font-semibold text-sm">${b.property_title}</div>
                            <div class="text-xs text-muted">${b.city}</div>
                        </div>
                    </td>
                    <td>
                        <div class="font-semibold text-sm">${b.landlord_name || '-'}</div>
                        ${b.landlord_phone ? `<div class="text-xs text-muted" style="font-family:monospace;">${b.landlord_phone}</div>` : ''}
                    </td>
                    <td class="text-sm">${formatDate(b.start_date)}</td>
                    <td class="text-sm font-semibold">${formatCurrency(b.monthly_rent)}</td>
                    <td>${statusBadge(b.status)}</td>
                    <td class="actions-cell">
                        ${b.status === 'pending' ? `<button class="btn btn-danger btn-sm" onclick="cancelBooking(${b.id})">Cancel</button>` : ''}
                        ${b.status === 'approved' ? `<button class="btn btn-primary btn-sm" onclick="openPaymentForm(${b.id}, ${b.monthly_rent})">Pay Rent</button>` : ''}
                        ${b.status === 'rejected' && b.rejection_reason ? `<span class="text-xs text-muted">Reason: ${b.rejection_reason}</span>` : ''}
                    </td>
                </tr>`).join('')}
            </tbody>
        </table></div>`;
    } catch (err) {
        el.innerHTML = `<p class="text-danger" style="padding:1rem;">${err.message}</p>`;
    }
}

async function cancelBooking(id) {
    if (!confirm('Cancel this booking request?')) return;
    try {
        await API.patch(`/bookings/${id}/cancel`);
        showToast('Booking cancelled.', 'success');
        loadDashboard();
        if (window._currentSection === 'bookings') loadAllBookings();
    } catch (err) { showToast(err.message, 'error'); }
}

async function loadPayments() {
    const el = document.getElementById('paymentsTable');
    if (!el) return;
    el.innerHTML = '<div class="flex-center" style="padding:2rem;"><div class="spinner"></div></div>';
    try {
        const data = await API.get('/payments/my');
        const payments = data.payments || [];
        if (!payments.length) {
            el.innerHTML = '<div class="empty-state"><p>No payments recorded yet.</p></div>';
            return;
        }
        el.innerHTML = `
        <div class="table-wrapper">
        <table class="data-table">
            <thead><tr><th>Receipt #</th><th>Property</th><th>Amount</th><th>Period</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
            ${payments.map(p => `
                <tr>
                    <td class="text-sm font-semibold" style="font-family:monospace;">
                        ${p.status === 'verified'
                ? `<span style="color:var(--primary);cursor:pointer;" onclick="viewReceipt(${p.id})">${p.receipt_number || '-'}</span>`
                : `<span style="color:var(--gray-400);">${p.receipt_number || '-'}</span>`
            }
                    </td>
                    <td class="text-sm">${p.property_title}</td>
                    <td class="text-sm font-semibold">${formatCurrency(p.amount)}</td>
                    <td class="text-xs">${formatDate(p.payment_period_start)} &rarr; ${formatDate(p.payment_period_end)}</td>
                    <td class="text-xs">${formatDate(p.created_at)}</td>
                    <td>${statusBadge(p.status)}</td>
                    <td>
                        ${p.status === 'verified'
                ? `<button class="btn btn-primary btn-sm" onclick="viewReceipt(${p.id})">
                                <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" style="margin-right:4px;">
                                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                                    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                                </svg>Download Receipt</button>`
                : `<span class="text-xs text-muted">${p.status === 'pending' ? 'Awaiting confirmation' : 'Not available'}</span>`
            }
                    </td>
                </tr>`).join('')}
            </tbody>
        </table></div>`;
    } catch (err) {
        el.innerHTML = `<p class="text-danger" style="padding:1rem;">${err.message}</p>`;
    }
}

async function viewReceipt(id) {
    try {
        const data = await API.get(`/payments/${id}/receipt`);
        const r = data.receipt;
        const win = window.open('', '_blank');
        win.document.write(`<!DOCTYPE html><html><head><title>Receipt ${r.receipt_number}</title>
        <style>
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:Arial,sans-serif;background:#f3f4f6;display:flex;flex-direction:column;align-items:center;padding:2rem 1rem;}
        .toolbar{display:flex;gap:0.75rem;margin-bottom:1.5rem;}
        .btn{padding:0.6rem 1.4rem;border:2px solid #000;border-radius:6px;font-size:0.875rem;font-weight:600;cursor:pointer;}
        .btn-download{background:#000;color:#fff;}
        .btn-close{background:#fff;color:#000;}
        .receipt{max-width:480px;width:100%;background:white;border-radius:0.75rem;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.12);}
        .rh{background:#000;color:#fff;text-align:center;padding:1.75rem 1.5rem;}
        .rh-label{font-size:0.75rem;letter-spacing:0.12em;text-transform:uppercase;opacity:0.7;margin-bottom:0.4rem;}
        .rn{font-size:1.6rem;font-weight:800;letter-spacing:0.06em;}
        .rh-brand{font-size:0.8rem;opacity:0.6;margin-top:0.5rem;}
        .rb{padding:1.5rem;}
        .section-title{font-size:0.68rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9ca3af;margin:1.1rem 0 0.35rem;}
        .row{display:flex;justify-content:space-between;align-items:flex-start;padding:0.55rem 0;border-bottom:1px dashed #e5e7eb;}
        .row:last-child{border:none;}
        .lbl{font-size:0.78rem;color:#6b7280;}
        .val{font-size:0.78rem;font-weight:600;text-align:right;max-width:60%;}
        .total{background:#000;color:#fff;padding:1rem 1.25rem;display:flex;justify-content:space-between;align-items:center;border-radius:0.5rem;margin-top:1.25rem;}
        .total-label{font-size:0.85rem;font-weight:600;}
        .total-amount{font-size:1.3rem;font-weight:800;}
        .footer{text-align:center;padding:1rem 1.5rem;font-size:0.72rem;color:#9ca3af;border-top:1px solid #f3f4f6;}
        @media print{
            body{background:white;padding:0;}
            .toolbar{display:none;}
            .receipt{box-shadow:none;border-radius:0;}
        }
        </style></head><body>
        <div class="toolbar">
            <button class="btn btn-download" onclick="window.print()">&#8595; Download / Print PDF</button>
            <button class="btn btn-close" onclick="window.close()">Close</button>
        </div>
        <div class="receipt">
            <div class="rh">
                <div class="rh-label">Payment Receipt</div>
                <div class="rn">${r.receipt_number}</div>
                <div class="rh-brand">RentEasy</div>
            </div>
            <div class="rb">
                <div class="section-title">Tenant Details</div>
                <div class="row"><span class="lbl">Name</span><span class="val">${r.tenant_name}</span></div>
                <div class="row"><span class="lbl">Email</span><span class="val">${r.tenant_email || '-'}</span></div>
                <div class="row"><span class="lbl">Phone</span><span class="val">${r.tenant_phone || '-'}</span></div>

                <div class="section-title">Property</div>
                <div class="row"><span class="lbl">Name</span><span class="val">${r.property_title}</span></div>
                <div class="row"><span class="lbl">Location</span><span class="val">${[r.address, r.city].filter(Boolean).join(', ') || '-'}</span></div>

                <div class="section-title">Paid To (Landlord)</div>
                <div class="row"><span class="lbl">Name</span><span class="val">${r.landlord_name}</span></div>
                <div class="row"><span class="lbl">Email</span><span class="val">${r.landlord_email || '-'}</span></div>
                <div class="row"><span class="lbl">Phone</span><span class="val">${r.landlord_phone || '-'}</span></div>

                <div class="section-title">Payment Details</div>
                <div class="row"><span class="lbl">Method</span><span class="val">${r.payment_method === 'cash' ? 'Cash' : 'M-Pesa Send Money'}</span></div>
                ${r.payment_method !== 'cash' && r.phone_used ? `<div class="row"><span class="lbl">Phone Used</span><span class="val">${r.phone_used}</span></div>` : ''}
                <div class="row"><span class="lbl">Transaction Ref</span><span class="val" style="font-family:monospace;font-size:0.72rem;">${r.transaction_reference}</span></div>
                <div class="row"><span class="lbl">Period</span><span class="val">${r.payment_period_start} &rarr; ${r.payment_period_end}</span></div>
                <div class="row"><span class="lbl">Date Paid</span><span class="val">${r.created_at}</span></div>
                <div class="row"><span class="lbl">Status</span><span class="val">${r.status.toUpperCase()}</span></div>
                <div class="total">
                    <span class="total-label">Total Paid</span>
                    <span class="total-amount">KES ${parseFloat(r.amount).toLocaleString()}</span>
                </div>
            </div>
            <div class="footer">To download: click "Download / Print PDF" &rarr; choose "Save as PDF" in the print dialog.</div>
        </div>
        </body></html>`);
        win.document.close();
    } catch (err) { showToast(err.message, 'error'); }
}

function openPaymentForm(bookingId, amount) {
    openPaymentModal(bookingId, amount);
}


async function loadApprovedBookings(selectedId = null) {
    try {
        const data = await API.get('/bookings/my');
        const select = document.getElementById('payBookingId');
        if (!select) return;


        while (select.options.length > 1) select.remove(1);

        const approved = (data.bookings || []).filter(b => b.status === 'approved');
        if (!approved.length) {
            const opt = document.createElement('option');
            opt.disabled = true;
            opt.textContent = 'No approved bookings found';
            select.appendChild(opt);
            updateLandlordHint();
            return;
        }
        approved.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.textContent = `${b.property_title} — KES ${parseFloat(b.monthly_rent).toLocaleString()}/mo`;
            opt.dataset.landlordName = b.landlord_name || '';
            opt.dataset.landlordPhone = b.landlord_phone || '';
            if (selectedId && b.id == selectedId) opt.selected = true;
            select.appendChild(opt);
        });
        updateLandlordHint();
    } catch { }
}

function updateLandlordHint() {
    const select = document.getElementById('payBookingId');
    const hint = document.getElementById('landlordHint');
    if (!select || !hint) return;
    const opt = select.options[select.selectedIndex];
    const phone = opt?.dataset?.landlordPhone;
    const name = opt?.dataset?.landlordName;
    if (phone) {
        document.getElementById('landlordHintName').textContent = name || '';
        document.getElementById('landlordHintPhone').textContent = phone;
        hint.style.display = 'block';
    } else {
        hint.style.display = 'none';
    }
}

document.getElementById('payBookingId')?.addEventListener('change', updateLandlordHint);


document.getElementById('payMethod')?.addEventListener('change', function () {
    const cashRefGroup = document.getElementById('cashRefGroup');
    const cashRefInput = document.getElementById('cashReference');
    const isCash = this.value === 'cash';
    cashRefGroup.style.display = isCash ? 'none' : '';
    cashRefInput.required = !isCash;
});

async function openPaymentModal(bookingId = null, amount = null) {
    document.getElementById('paymentForm').reset();
    document.getElementById('paymentAlert').innerHTML = '';

    document.getElementById('payPhoneGroup').style.display = 'none';
    document.getElementById('payPhone').required = false;
    document.getElementById('cashRefGroup').style.display = '';
    document.getElementById('cashReference').required = true;
    showPaymentForm();


    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    document.getElementById('periodStart').value = start.toISOString().split('T')[0];
    document.getElementById('periodEnd').value = end.toISOString().split('T')[0];

    if (amount) document.getElementById('payAmount').value = amount;

    await loadApprovedBookings(bookingId);
    openModal('paymentModal');
}

function showPaymentForm() {
    document.getElementById('paymentForm').style.display = '';
    document.getElementById('pinPromptStep').style.display = 'none';
    document.getElementById('paymentSuccessStep').style.display = 'none';
}

function showSuccessStep(paymentId) {
    const receiptNum = `RCP-${String(paymentId).padStart(6, '0')}`;
    document.getElementById('paymentForm').style.display = 'none';
    document.getElementById('pinPromptStep').style.display = 'none';
    document.getElementById('paymentSuccessStep').style.display = '';
    document.getElementById('successReceiptNum').textContent = receiptNum;
    document.getElementById('downloadReceiptBtn').onclick = () => viewReceipt(paymentId);
}

function showPinPrompt(phone, amount) {
    document.getElementById('pinPhone').textContent = phone || 'your registered number';
    document.getElementById('pinAmount').textContent = 'KES ' + parseFloat(amount).toLocaleString();
    document.getElementById('paymentForm').style.display = 'none';
    document.getElementById('pinPromptStep').style.display = '';
    const msg = document.getElementById('pinStatusMsg');
    if (msg) msg.textContent = 'Waiting for confirmation...';
}


document.getElementById('paymentForm')?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const alertEl = document.getElementById('paymentAlert');
    alertEl.innerHTML = '';

    const payMethod = document.getElementById('payMethod').value;
    const isCash = payMethod === 'cash';
    const phone = document.getElementById('payPhone').value.trim();
    const amount = document.getElementById('payAmount').value;
    const bookingId = document.getElementById('payBookingId').value;

    if (!bookingId) {
        alertEl.innerHTML = '<div class="alert alert-danger">Please select a booking.</div>';
        return;
    }
    if (!isCash && !document.getElementById('cashReference').value.trim()) {
        alertEl.innerHTML = '<div class="alert alert-danger">Please enter the M-Pesa reference code.</div>';
        return;
    }

    const submitBtn = document.getElementById('submitPayBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Recording payment...';

    try {
        const payload = {
            booking_id: parseInt(bookingId),
            amount,
            payment_method: payMethod,
            payment_period_start: document.getElementById('periodStart').value,
            payment_period_end: document.getElementById('periodEnd').value,
            notes: document.getElementById('payNotes').value || undefined,
            cash_reference: document.getElementById('cashReference').value.trim() || undefined
        };

        const data = await API.post('/payments', payload);

        showSuccessStep(data.payment_id);
        loadPayments();
        loadDashboard();
    } catch (err) {
        alertEl.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Payment';
    }
});


let _pollInterval = null;

function pollPaymentStatus(paymentId) {
    let attempts = 0;
    const MAX_ATTEMPTS = 30;

    _pollInterval = setInterval(async () => {
        attempts++;
        try {
            const data = await API.get(`/payments/${paymentId}/status`);

            if (data.status === 'verified') {
                stopPoll();
                showSuccessStep(paymentId);
                loadPayments();
                loadDashboard();
            } else if (data.status === 'failed') {
                stopPoll();
                showPaymentForm();
                document.getElementById('paymentAlert').innerHTML =
                    '<div class="alert alert-danger">Payment failed or was cancelled. Please try again.</div>';
            } else if (attempts >= MAX_ATTEMPTS) {
                stopPoll();
                showPaymentForm();
                document.getElementById('paymentAlert').innerHTML =
                    '<div class="alert alert-danger">Payment timed out. If you entered your PIN, check your payment history before retrying.</div>';
            } else {

                const dots = '.'.repeat((attempts % 3) + 1);
                const el = document.getElementById('pinStatusMsg');
                if (el) el.textContent = `Waiting for confirmation${dots}`;
            }
        } catch (_) { }
    }, 3000);
}

function stopPoll() {
    if (_pollInterval) { clearInterval(_pollInterval); _pollInterval = null; }
}

function cancelPaymentPoll() {
    stopPoll();
    showPaymentForm();
}


function openReviewModal(bookingId) {
    document.getElementById('reviewBookingId').value = bookingId;
    document.getElementById('selectedRating').value = 0;
    document.querySelectorAll('#starRating .star').forEach(s => s.classList.remove('filled'));
    openModal('reviewModal');
}

document.querySelectorAll('#starRating .star').forEach(star => {
    star.addEventListener('click', function () {
        const val = parseInt(this.dataset.val);
        document.getElementById('selectedRating').value = val;
        document.querySelectorAll('#starRating .star').forEach((s, i) => {
            s.style.color = i < val ? 'var(--accent)' : 'var(--gray-300)';
        });
    });
});

document.getElementById('reviewForm')?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const alertEl = document.getElementById('reviewAlert');
    const rating = parseInt(document.getElementById('selectedRating').value);
    if (rating === 0) { alertEl.innerHTML = '<div class="alert alert-danger">Please select a rating.</div>'; return; }
    try {
        await API.post('/reviews', {
            booking_id: parseInt(document.getElementById('reviewBookingId').value),
            rating, title: document.getElementById('reviewTitle').value,
            body: document.getElementById('reviewBody').value
        });
        showToast('Review submitted!', 'success');
        closeModal('reviewModal');
        this.reset();
    } catch (err) { alertEl.innerHTML = `<div class="alert alert-danger">${err.message}</div>`; }
});


let _dashSearchPage = 1;

async function loadSearchSection(page = 1) {
    const container = document.getElementById('dashPropertiesContainer');
    const countEl = document.getElementById('dashResultCount');
    if (!container) return;
    container.innerHTML = `<div class="flex-center" style="padding:4rem;"><div class="spinner" style="width:2.5rem;height:2.5rem;border-width:3px;"></div></div>`;

    const search = document.getElementById('dashSearch')?.value || '';
    const city = document.getElementById('dashCity')?.value || '';
    const type = document.getElementById('dashType')?.value || '';
    const bedrooms = document.getElementById('dashBedrooms')?.value || '';
    const minRent = document.getElementById('dashMinRent')?.value || '';
    const maxRent = document.getElementById('dashMaxRent')?.value || '';
    const available = document.getElementById('dashAvailable')?.checked ?? true;

    const qs = new URLSearchParams();
    if (search) qs.set('search', search);
    if (city) qs.set('city', city);
    if (type) qs.set('type', type);
    if (bedrooms) qs.set('bedrooms', bedrooms);
    if (minRent) qs.set('min_rent', minRent);
    if (maxRent) qs.set('max_rent', maxRent);
    if (available) qs.set('is_available', 1);
    qs.set('page', page);
    qs.set('limit', 9);

    try {
        const data = await API.get(`/properties?${qs.toString()}`);
        _dashSearchPage = data.page;
        if (countEl) countEl.textContent = `${data.total} ${data.total === 1 ? 'property' : 'properties'} found`;

        if (!data.properties.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg class="empty-state-icon" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                    </svg>
                    <h3>No Properties Found</h3>
                    <p>Try adjusting your search filters.</p>
                </div>`;
            const pag = document.getElementById('dashPagination');
            if (pag) pag.innerHTML = '';
            return;
        }

        container.innerHTML = `<div class="property-grid">${data.properties.map(p => buildPropertyCard(p)).join('')}</div>`;
        renderDashPagination(data.page, data.pages);
    } catch (err) {
        const isNetErr = err instanceof TypeError && err.message === 'Failed to fetch';
        const hint = isNetErr
            ? '<br><small>Make sure the server is running — open <b>START SERVER.bat</b> and keep that window open.</small>'
            : '';
        container.innerHTML = `<div class="empty-state"><p>Error: ${err.message}${hint}</p></div>`;
    }
}

function renderDashPagination(current, total) {
    const el = document.getElementById('dashPagination');
    if (!el || total <= 1) { if (el) el.innerHTML = ''; return; }
    let html = `<button class="page-btn" onclick="loadSearchSection(${current - 1})" ${current === 1 ? 'disabled' : ''}>&#8592; Prev</button>`;
    for (let i = 1; i <= total; i++) {
        if (i === 1 || i === total || Math.abs(i - current) <= 2) {
            html += `<button class="page-btn ${i === current ? 'active' : ''}" onclick="loadSearchSection(${i})">${i}</button>`;
        } else if (Math.abs(i - current) === 3) {
            html += `<span class="page-btn" style="pointer-events:none;border:none;">...</span>`;
        }
    }
    html += `<button class="page-btn" onclick="loadSearchSection(${current + 1})" ${current === total ? 'disabled' : ''}>Next &#8594;</button>`;
    el.innerHTML = html;
}

document.getElementById('dashSearchForm')?.addEventListener('submit', e => { e.preventDefault(); loadSearchSection(1); });
document.getElementById('dashClearBtn')?.addEventListener('click', () => {
    document.getElementById('dashSearchForm').reset();
    const avail = document.getElementById('dashAvailable');
    if (avail) avail.checked = true;
    loadSearchSection(1);
});

const originalShowSection = window.showSection;
window.showSection = function (name) {
    originalShowSection(name);
    if (name === 'bookings') loadAllBookings();
    if (name === 'payments') loadPayments();
    if (name === 'messages') loadInbox();
    if (name === 'profile') loadProfileSection();
    if (name === 'search') loadSearchSection(1);
};

document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
});
