


(function () {
    const user = API.requireAuth(['landlord']);
    if (!user) return;
})();

let _activeTenants = [];
let _landlordPayments = [];
let _tenantPage = 1;
const TENANTS_PER_PAGE = 6;
let _openBookingDetailsId = null;

function csvEscape(value) {
    if (value === null || value === undefined) return '';
    const str = String(value).replace(/"/g, '""');
    return /[",\n]/.test(str) ? `"${str}"` : str;
}

function downloadCsv(filename, headers, rows) {
    const csv = [headers.join(','), ...rows.map(row => row.map(csvEscape).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function getFilteredTenants() {
    const term = (document.getElementById('tenantSearchInput')?.value || '').trim().toLowerCase();
    return _activeTenants.filter(t => {
        if (!term) return true;
        return (`${t.name || ''} ${t.email || ''} ${t.phone || ''} ${t.property_title || ''}`).toLowerCase().includes(term);
    });
}

function getTenantPageCount(filteredTenants) {
    return Math.max(1, Math.ceil(filteredTenants.length / TENANTS_PER_PAGE));
}

function getVisibleTenants() {
    const filtered = getFilteredTenants();
    const pages = getTenantPageCount(filtered);
    if (_tenantPage > pages) _tenantPage = pages;
    const start = (_tenantPage - 1) * TENANTS_PER_PAGE;
    return {
        filtered,
        visible: filtered.slice(start, start + TENANTS_PER_PAGE),
        pages
    };
}

function renderTenantsPreview() {
    const tenantsEl = document.getElementById('tenantsPreview');
    if (!tenantsEl) return;
    const { filtered, visible, pages } = getVisibleTenants();

    if (!filtered.length) {
        tenantsEl.innerHTML = '<div class="empty-state"><p>No active tenants found.</p></div>';
        return;
    }

    tenantsEl.innerHTML = `
    <div class="table-wrapper">
    <table class="data-table">
        <thead><tr><th>Tenant</th><th>Phone</th><th>Current Property</th><th>Move-in Date</th><th>Status</th></tr></thead>
        <tbody>
        ${visible.map(t => `
            <tr>
                <td>
                    <div class="font-semibold text-sm">${t.name || '-'}</div>
                    <div class="text-xs text-muted">${t.email || '-'}</div>
                </td>
                <td class="text-sm">${t.phone || '-'}</td>
                <td class="text-sm">${t.property_title || '-'}</td>
                <td class="text-sm">${formatDate(t.start_date)}</td>
                <td>${statusBadge(t.status || 'approved')}</td>
            </tr>`).join('')}
        </tbody>
    </table></div>
    <div class="flex-between" style="margin-top:0.75rem;">
        <div class="text-xs text-muted">Showing ${visible.length} of ${filtered.length} tenants</div>
        <div style="display:flex;gap:0.4rem;align-items:center;">
            <button class="page-btn" onclick="changeTenantPage(${_tenantPage - 1})" ${_tenantPage === 1 ? 'disabled' : ''}>Prev</button>
            <span class="text-xs text-muted">Page ${_tenantPage} of ${pages}</span>
            <button class="page-btn" onclick="changeTenantPage(${_tenantPage + 1})" ${_tenantPage === pages ? 'disabled' : ''}>Next</button>
        </div>
    </div>`;
}

function changeTenantPage(page) {
    const { pages } = getVisibleTenants();
    _tenantPage = Math.min(Math.max(1, page), pages);
    renderTenantsPreview();
}

function exportTenantsCsv() {
    const { visible: tenants } = getVisibleTenants();
    if (!tenants.length) {
        showToast('No visible tenants to export.', 'info');
        return;
    }
    const rows = tenants.map(t => [
        t.name || '',
        t.email || '',
        t.phone || '',
        t.property_title || '',
        t.start_date || '',
        t.status || 'approved'
    ]);
    downloadCsv(
        `tenants-${new Date().toISOString().slice(0, 10)}.csv`,
        ['Name', 'Email', 'Phone', 'Property', 'Move-in Date', 'Status'],
        rows
    );
    showToast('Tenants CSV exported.', 'success');
}

function getFilteredPayments() {
    const fromDate = document.getElementById('paymentFromDate')?.value || '';
    const toDate = document.getElementById('paymentToDate')?.value || '';

    return _landlordPayments.filter(p => {
        const d = p.created_at ? new Date(p.created_at) : null;
        if (!d || Number.isNaN(d.getTime())) return true;
        const paymentDate = d.toISOString().slice(0, 10);
        if (fromDate && paymentDate < fromDate) return false;
        if (toDate && paymentDate > toDate) return false;
        return true;
    });
}

function renderPaymentsTable(payments) {
    const el = document.getElementById('paymentsTable');
    if (!el) return;
    if (!payments.length) {
        el.innerHTML = '<div class="empty-state"><p>No payments found for selected date range.</p></div>';
        return;
    }
    el.innerHTML = `
    <div class="table-wrapper">
    <table class="data-table">
        <thead><tr><th>Receipt</th><th>Tenant</th><th>Property</th><th>Amount</th><th>Method</th><th>Reference</th><th>Period</th><th>Status</th></tr></thead>
        <tbody>
        ${payments.map(p => `
            <tr>
                <td class="text-sm font-semibold text-primary">${p.receipt_number || '-'}</td>
                <td>
                    <div class="text-sm font-semibold">${p.tenant_name}</div>
                    <div class="text-xs text-muted">${p.tenant_email}</div>
                </td>
                <td class="text-sm">${p.property_title}</td>
                <td class="text-sm font-semibold">${formatCurrency(p.amount)}</td>
                <td class="text-sm">${p.payment_method === 'cash' ? 'Cash' : 'M-Pesa Send Money'}</td>
                <td class="text-xs" style="font-family:monospace;">${p.transaction_reference || '-'}</td>
                <td class="text-xs">${formatDate(p.payment_period_start)} - ${formatDate(p.payment_period_end)}</td>
                <td>${statusBadge(p.status)}</td>
            </tr>`).join('')}
        </tbody>
    </table></div>`;
}

function exportPaymentsCsv() {
    const payments = getFilteredPayments();
    if (!payments.length) {
        showToast('No payments to export.', 'info');
        return;
    }
    const rows = payments.map(p => [
        p.receipt_number || '',
        p.tenant_name || '',
        p.tenant_email || '',
        p.property_title || '',
        p.amount || 0,
        p.payment_method || '',
        p.transaction_reference || '',
        p.payment_period_start || '',
        p.payment_period_end || '',
        p.status || '',
        p.created_at || ''
    ]);
    downloadCsv(
        `payments-${new Date().toISOString().slice(0, 10)}.csv`,
        ['Receipt', 'Tenant', 'Tenant Email', 'Property', 'Amount', 'Method', 'Reference', 'Period Start', 'Period End', 'Status', 'Created At'],
        rows
    );
    showToast('Payments CSV exported.', 'success');
}

async function openBookingDetailsModal(id) {
    const contentEl = document.getElementById('bookingDetailsContent');
    if (!contentEl) return;

    contentEl.innerHTML = '<div class="flex-center" style="padding:2rem;"><div class="spinner"></div></div>';
    openModal('bookingDetailsModal');

    try {
        const data = await API.get(`/bookings/${id}`);
        const b = data.booking;
        _openBookingDetailsId = b.id;
        contentEl.innerHTML = `
            <div class="grid-2" style="gap:0.75rem;">
                <div><strong>Booking ID:</strong> #${b.id}</div>
                <div><strong>Status:</strong> ${statusBadge(b.status)}</div>
                <div><strong>Property:</strong> ${b.property_title}</div>
                <div><strong>Address:</strong> ${(b.address || '-')}, ${(b.city || '-')}</div>
                <div><strong>Tenant:</strong> ${b.tenant_name}</div>
                <div><strong>Tenant Email:</strong> ${b.tenant_email || '-'}</div>
                <div><strong>Tenant Phone:</strong> ${b.tenant_phone || '-'}</div>
                <div><strong>Start Date:</strong> ${formatDate(b.start_date)}</div>
                <div><strong>Rent:</strong> ${formatCurrency(b.monthly_rent)}</div>
                <div><strong>Requested:</strong> ${formatDateTime(b.created_at)}</div>
            </div>
            ${b.message ? `<div class="card" style="margin-top:0.75rem;"><div class="card-header"><h3 class="text-base">Tenant Message</h3></div><div class="card-body"><p class="text-sm">${b.message}</p></div></div>` : ''}
            ${b.rejection_reason ? `<div class="alert alert-danger" style="margin-top:0.75rem;">Rejection reason: ${b.rejection_reason}</div>` : ''}
        `;
        renderBookingDetailsActions(b);
    } catch (err) {
        contentEl.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
        renderBookingDetailsActions(null);
    }
}

function renderBookingDetailsActions(booking) {
    const actionsEl = document.getElementById('bookingDetailsActions');
    if (!actionsEl) return;
    if (!booking) {
        actionsEl.innerHTML = '';
        return;
    }

    if (booking.status === 'pending') {
        actionsEl.innerHTML = `
            <button type="button" class="btn btn-success btn-sm" onclick="updateBookingFromModal('approved')">Approve</button>
            <button type="button" class="btn btn-danger btn-sm" onclick="updateBookingFromModal('rejected')">Reject</button>
        `;
        return;
    }
    if (booking.status === 'approved') {
        actionsEl.innerHTML = `<button type="button" class="btn btn-primary btn-sm" onclick="updateBookingFromModal('completed')">Mark Complete</button>`;
        return;
    }
    actionsEl.innerHTML = '<span class="text-xs text-muted">No actions available for this status.</span>';
}

async function updateBookingFromModal(status) {
    if (!_openBookingDetailsId) return;
    const payload = { status };
    if (status === 'rejected') {
        const reason = prompt('Reason for rejection:');
        if (!reason || !reason.trim()) {
            showToast('Rejection reason is required.', 'error');
            return;
        }
        payload.rejection_reason = reason.trim();
    }

    try {
        await API.patch(`/bookings/${_openBookingDetailsId}/status`, payload);
        showToast(`Booking ${status}.`, 'success');
        await loadDashboard();
        if (window._currentSection === 'bookings') await loadBookingRequests();
        await openBookingDetailsModal(_openBookingDetailsId);
    } catch (err) {
        showToast(err.message, 'error');
    }
}


async function loadDashboard() {
    try {
        const [propsData, bookingsData, approvedData, paymentsData, msgData] = await Promise.all([
            API.get('/properties/mine'),
            API.get('/bookings/landlord?status=pending'),
            API.get('/bookings/landlord?status=approved'),
            API.get('/payments/landlord'),
            API.get('/messages/unread-count')
        ]);

        const properties = propsData.properties || [];
        const pendingBookings = bookingsData.bookings || [];
        const approvedBookings = approvedData.bookings || [];
        const payments = paymentsData.payments || [];
        const uniqueActiveTenants = [...new Map(
            approvedBookings.map(b => [
                `${(b.tenant_email || '').toLowerCase()}|${b.tenant_name || ''}`,
                {
                    name: b.tenant_name,
                    email: b.tenant_email,
                    phone: b.tenant_phone,
                    property_title: b.property_title,
                    start_date: b.start_date,
                    status: b.status
                }
            ])
        ).values()];


        document.getElementById('statProps').textContent = properties.length;
        document.getElementById('statPending').textContent = pendingBookings.length;
        document.getElementById('statActiveTenants').textContent = uniqueActiveTenants.length;

        const totalIncome = payments
            .filter(p => p.status === 'verified')
            .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
        document.getElementById('statIncome').textContent = formatCurrency(totalIncome);

        const badge = document.getElementById('msgBadge');
        if (badge) {
            badge.textContent = msgData.unread_count;
            badge.classList.toggle('hidden', (msgData.unread_count || 0) === 0);
        }


        const previewEl = document.getElementById('pendingBookingsPreview');
        if (previewEl) {
            if (!pendingBookings.length) {
                previewEl.innerHTML = '<div class="empty-state"><p>No pending booking requests.</p></div>';
            } else {
                previewEl.innerHTML = `
                <div class="table-wrapper">
                <table class="data-table">
                    <thead><tr><th>Tenant</th><th>Property</th><th>Start Date</th><th>Rent</th><th>Actions</th></tr></thead>
                    <tbody>
                    ${pendingBookings.slice(0, 5).map(b => `
                        <tr>
                            <td>
                                <div class="font-semibold text-sm">${b.tenant_name}</div>
                                <div class="text-xs text-muted">${b.tenant_email}</div>
                            </td>
                            <td class="text-sm">${b.property_title}</td>
                            <td class="text-sm">${formatDate(b.start_date)}</td>
                            <td class="text-sm font-semibold">${formatCurrency(b.monthly_rent)}</td>
                            <td class="actions-cell">
                                <button class="btn btn-success btn-sm" onclick="approveBooking(${b.id})">Approve</button>
                                <button class="btn btn-danger btn-sm" onclick="openRejectModal(${b.id})">Reject</button>
                                <button class="btn btn-ghost btn-sm" onclick="openBookingDetailsModal(${b.id})">View</button>
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table></div>`;
            }
        }

        _activeTenants = uniqueActiveTenants;
        _tenantPage = 1;
        renderTenantsPreview();


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
            <div class="message-item ${!n.is_read ? 'unread' : ''}" onclick="markNotifRead(${n.id}, this)">
                <div style="flex:1;">
                    <div class="font-semibold text-sm">${n.title}</div>
                    <div class="text-xs text-muted">${n.body || ''}</div>
                    <div class="text-xs" style="color:var(--gray-400);margin-top:0.25rem;">${formatDateTime(n.created_at)}</div>
                </div>
                ${!n.is_read ? '<span class="badge badge-primary" style="font-size:0.6rem;">New</span>' : ''}
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


async function loadMyProperties() {
    const el = document.getElementById('propertiesGrid');
    if (!el) return;
    el.innerHTML = '<div class="flex-center" style="padding:3rem;"><div class="spinner"></div></div>';
    try {
        const data = await API.get('/properties/mine');
        const properties = data.properties || [];
        if (!properties.length) {
            el.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1;">
                <svg class="empty-state-icon" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                </svg>
                <h3>No Properties Yet</h3>
                <p>Click "Add Property" to list your first property.</p>
            </div>`;
            return;
        }
        el.innerHTML = properties.map(p => buildPropertyCard(p, true)).join('');
    } catch (err) {
        el.innerHTML = `<p class="text-danger" style="padding:1rem;">${err.message}</p>`;
    }
}

function openAddPropertyModal() {
    document.getElementById('propertyModalTitle').textContent = 'Add New Property';
    document.getElementById('propertyForm').reset();
    document.getElementById('editPropertyId').value = '';
    openModal('addPropertyModal');
}

async function editProperty(id) {
    try {
        const data = await API.get(`/properties/${id}`);
        const p = data.property;
        document.getElementById('propertyModalTitle').textContent = 'Edit Property';
        document.getElementById('editPropertyId').value = p.id;
        document.getElementById('propTitle').value = p.title;
        document.getElementById('propType').value = p.property_type;
        document.getElementById('propAddress').value = p.address;
        document.getElementById('propCity').value = p.city;
        document.getElementById('propCounty').value = p.county || '';
        document.getElementById('propRent').value = p.monthly_rent;
        document.getElementById('propBeds').value = p.bedrooms;
        document.getElementById('propBaths').value = p.bathrooms;
        document.getElementById('propSize').value = p.size_sqft || '';
        document.getElementById('propDesc').value = p.description || '';
        document.getElementById('propAvailable').value = p.is_available ? '1' : '0';
        document.getElementById('propTotalRooms').value = p.total_rooms || 1;


        const amenities = p.amenities || [];
        document.getElementById('propAmenities').value = amenities.join(', ');

        openModal('addPropertyModal');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function confirmDeleteProperty(id) {
    if (!confirm('Delete this property? This action cannot be undone.')) return;
    try {
        await API.delete(`/properties/${id}`);
        showToast('Property deleted.', 'success');
        loadMyProperties();
        loadDashboard();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

document.getElementById('propertyForm')?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const alertEl = document.getElementById('propertyAlert');
    const btn = document.getElementById('savePropertyBtn');
    const id = document.getElementById('editPropertyId').value;


    const amenitiesText = document.getElementById('propAmenities').value;
    const amenities = amenitiesText
        ? amenitiesText.split(',').map(s => s.trim()).filter(Boolean)
        : [];

    const formData = new FormData();
    formData.append('title', document.getElementById('propTitle').value.trim());
    formData.append('property_type', document.getElementById('propType').value);
    formData.append('address', document.getElementById('propAddress').value.trim());
    formData.append('city', document.getElementById('propCity').value.trim());
    formData.append('county', document.getElementById('propCounty').value.trim());
    formData.append('monthly_rent', document.getElementById('propRent').value);
    formData.append('bedrooms', document.getElementById('propBeds').value);
    formData.append('bathrooms', document.getElementById('propBaths').value);
    formData.append('size_sqft', document.getElementById('propSize').value || '');
    formData.append('description', document.getElementById('propDesc').value || '');
    formData.append('is_available', document.getElementById('propAvailable').value);
    formData.append('total_rooms', document.getElementById('propTotalRooms').value || '1');
    formData.append('amenities', JSON.stringify(amenities));

    const coverFile = document.getElementById('propCoverImage').files[0];
    if (coverFile) formData.append('cover_image', coverFile);

    const extraFiles = document.getElementById('propImages').files;
    for (const file of extraFiles) formData.append('images', file);

    btn.disabled = true;
    alertEl.innerHTML = '';

    try {
        if (id) {
            await API.put(`/properties/${id}`, formData);
            showToast('Property updated successfully.', 'success');
        } else {
            await API.post('/properties', formData);
            showToast('Property listed successfully.', 'success');
        }
        closeModal('addPropertyModal');
        this.reset();
        loadMyProperties();
        loadDashboard();
    } catch (err) {
        alertEl.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    } finally {
        btn.disabled = false;
    }
});


async function loadBookingRequests() {
    const el = document.getElementById('bookingsTable');
    if (!el) return;
    el.innerHTML = '<div class="flex-center" style="padding:2rem;"><div class="spinner"></div></div>';

    const statusFilter = document.getElementById('bookingStatusFilter')?.value || '';
    const url = statusFilter ? `/bookings/landlord?status=${statusFilter}` : '/bookings/landlord';

    try {
        const data = await API.get(url);
        const bookings = data.bookings || [];
        if (!bookings.length) {
            el.innerHTML = '<div class="empty-state"><p>No booking requests found.</p></div>';
            return;
        }
        el.innerHTML = `
        <div class="table-wrapper">
        <table class="data-table">
            <thead><tr><th>Tenant</th><th>Property</th><th>Start Date</th><th>Rent</th><th>Requested</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
            ${bookings.map(b => `
                <tr>
                    <td>
                        <div class="font-semibold text-sm">${b.tenant_name}</div>
                        <div class="text-xs text-muted">${b.tenant_email}</div>
                        ${b.tenant_phone ? `<div class="text-xs text-muted">${b.tenant_phone}</div>` : ''}
                    </td>
                    <td class="text-sm">${b.property_title}</td>
                    <td class="text-sm">${formatDate(b.start_date)}</td>
                    <td class="text-sm font-semibold">${formatCurrency(b.monthly_rent)}</td>
                    <td class="text-xs">${formatDateTime(b.created_at)}</td>
                    <td>${statusBadge(b.status)}</td>
                    <td class="actions-cell">
                        ${b.status === 'pending' ? `
                            <button class="btn btn-success btn-sm" onclick="approveBooking(${b.id})">Approve</button>
                            <button class="btn btn-danger btn-sm" onclick="openRejectModal(${b.id})">Reject</button>
                        ` : ''}
                        ${b.status === 'approved' ? `
                            <button class="btn btn-ghost btn-sm" onclick="completeBooking(${b.id})">Mark Complete</button>
                        ` : ''}
                        <button class="btn btn-ghost btn-sm" onclick="openBookingDetailsModal(${b.id})">View</button>
                        ${b.status === 'rejected' && b.rejection_reason ? `
                            <span class="text-xs text-muted">Reason: ${b.rejection_reason}</span>
                        ` : ''}
                    </td>
                </tr>`).join('')}
            </tbody>
        </table></div>`;
    } catch (err) {
        el.innerHTML = `<p class="text-danger" style="padding:1rem;">${err.message}</p>`;
    }
}

async function approveBooking(id) {
    if (!confirm('Approve this booking request?')) return;
    try {
        await API.patch(`/bookings/${id}/status`, { status: 'approved' });
        showToast('Booking approved.', 'success');
        loadDashboard();
        if (window._currentSection === 'bookings') loadBookingRequests();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function completeBooking(id) {
    if (!confirm('Mark this booking as completed?')) return;
    try {
        await API.patch(`/bookings/${id}/status`, { status: 'completed' });
        showToast('Booking marked as completed.', 'success');
        if (window._currentSection === 'bookings') loadBookingRequests();
    } catch (err) {
        showToast(err.message, 'error');
    }
}


let _rejectBookingId = null;
function openRejectModal(id) {
    _rejectBookingId = id;
    document.getElementById('rejectionReason').value = '';
    openModal('rejectModal');
}

document.getElementById('confirmRejectBtn')?.addEventListener('click', async function () {
    const reason = document.getElementById('rejectionReason').value.trim();
    if (!reason) { showToast('Please provide a rejection reason.', 'error'); return; }
    try {
        await API.patch(`/bookings/${_rejectBookingId}/status`, { status: 'rejected', rejection_reason: reason });
        showToast('Booking rejected.', 'success');
        closeModal('rejectModal');
        loadDashboard();
        if (window._currentSection === 'bookings') loadBookingRequests();
    } catch (err) {
        showToast(err.message, 'error');
    }
});


async function loadLandlordPayments() {
    const el = document.getElementById('paymentsTable');
    if (!el) return;
    el.innerHTML = '<div class="flex-center" style="padding:2rem;"><div class="spinner"></div></div>';
    try {
        const data = await API.get('/payments/landlord');
        _landlordPayments = data.payments || [];
        if (!_landlordPayments.length) {
            el.innerHTML = '<div class="empty-state"><p>No payments recorded yet.</p></div>';
            return;
        }
        renderPaymentsTable(getFilteredPayments());
    } catch (err) {
        el.innerHTML = `<p class="text-danger" style="padding:1rem;">${err.message}</p>`;
    }
}


const originalShowSection = window.showSection;
window.showSection = function (name) {
    originalShowSection(name);
    if (name === 'properties') loadMyProperties();
    if (name === 'bookings') loadBookingRequests();
    if (name === 'payments') loadLandlordPayments();
    if (name === 'messages') loadInbox();
    if (name === 'profile') loadProfileSection();
};

document.getElementById('bookingStatusFilter')?.addEventListener('change', loadBookingRequests);
document.getElementById('tenantSearchInput')?.addEventListener('input', () => {
    _tenantPage = 1;
    renderTenantsPreview();
});
document.getElementById('exportTenantsCsvBtn')?.addEventListener('click', exportTenantsCsv);
document.getElementById('paymentFromDate')?.addEventListener('change', () => renderPaymentsTable(getFilteredPayments()));
document.getElementById('paymentToDate')?.addEventListener('change', () => renderPaymentsTable(getFilteredPayments()));
document.getElementById('exportLandlordPaymentsCsvBtn')?.addEventListener('click', exportPaymentsCsv);

document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
});
