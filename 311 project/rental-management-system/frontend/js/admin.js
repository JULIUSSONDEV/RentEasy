


(function () {
    const user = API.requireAuth(['admin']);
    if (!user) return;
})();

let _dashboardLandlords = [];
let _dashboardTenants = [];

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

const ADMIN_API_BASES = [
    window.API_BASE,
    localStorage.getItem('API_BASE'),
    'http://localhost:5000/api',
    'http://127.0.0.1:5000/api'
].map(v => String(v || '').replace(/\/+$/, '')).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);

async function downloadAdminCsv(pathWithQuery, fallbackFilename) {
    let lastError = null;
    const token = API.getToken();
    for (const base of ADMIN_API_BASES) {
        try {
            const res = await fetch(`${base}${pathWithQuery}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (!res.ok) throw new Error(`Export failed (${res.status})`);

            const blob = await res.blob();
            const cd = res.headers.get('content-disposition') || '';
            const fileMatch = cd.match(/filename="?([^";]+)"?/i);
            const filename = fileMatch ? fileMatch[1] : fallbackFilename;

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            return;
        } catch (err) {
            lastError = err;
        }
    }
    throw lastError || new Error('Failed to fetch');
}

async function openBookingDetailsModal(id) {
    const contentEl = document.getElementById('bookingDetailsContent');
    if (!contentEl) return;

    contentEl.innerHTML = '<div class="flex-center" style="padding:2rem;"><div class="spinner"></div></div>';
    openModal('bookingDetailsModal');

    try {
        const data = await API.get(`/bookings/${id}`);
        const b = data.booking;
        contentEl.innerHTML = `
            <div class="grid-2" style="gap:0.75rem;">
                <div><strong>Booking ID:</strong> #${b.id}</div>
                <div><strong>Status:</strong> ${statusBadge(b.status)}</div>
                <div><strong>Property:</strong> ${b.property_title}</div>
                <div><strong>City:</strong> ${b.city || '-'}</div>
                <div><strong>Tenant:</strong> ${b.tenant_name}</div>
                <div><strong>Tenant Email:</strong> ${b.tenant_email || '-'}</div>
                <div><strong>Tenant Phone:</strong> ${b.tenant_phone || '-'}</div>
                <div><strong>Landlord:</strong> ${b.landlord_name}</div>
                <div><strong>Landlord Email:</strong> ${b.landlord_email || '-'}</div>
                <div><strong>Landlord Phone:</strong> ${b.landlord_phone || '-'}</div>
                <div><strong>Start Date:</strong> ${formatDate(b.start_date)}</div>
                <div><strong>Rent:</strong> ${formatCurrency(b.monthly_rent)}</div>
                <div><strong>Requested:</strong> ${formatDateTime(b.created_at)}</div>
                <div><strong>Paid:</strong> ${b.is_paid ? 'Yes' : 'No'}</div>
            </div>
            ${b.message ? `<div class="card" style="margin-top:0.75rem;"><div class="card-header"><h3 class="text-base">Tenant Message</h3></div><div class="card-body"><p class="text-sm">${b.message}</p></div></div>` : ''}
            ${b.rejection_reason ? `<div class="alert alert-danger" style="margin-top:0.75rem;">Rejection reason: ${b.rejection_reason}</div>` : ''}
        `;
    } catch (err) {
        contentEl.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
}

async function setRecentBookingStatus(id, status) {
    const label = status.charAt(0).toUpperCase() + status.slice(1);
    if (!confirm(`${label} this booking?`)) return;

    const payload = { status };
    if (status === 'rejected') {
        const reason = prompt('Optional rejection reason:', 'Rejected by admin');
        if (reason !== null && reason.trim()) payload.rejection_reason = reason.trim();
    }

    try {
        await API.patch(`/bookings/${id}/status`, payload);
        showToast(`Booking ${status}.`, 'success');
        loadDashboard();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function renderDashboardPeople() {
    const landlordCountEl = document.getElementById('landlordCount');
    const landlordsList = document.getElementById('landlordsList');
    const tenantCountEl = document.getElementById('tenantCount');
    const tenantsList = document.getElementById('tenantsList');
    const search = (document.getElementById('dashboardPeopleSearch')?.value || '').trim().toLowerCase();
    const sortBy = document.getElementById('dashboardPeopleSort')?.value || 'name_asc';

    const landlords = _dashboardLandlords
        .filter(l => !search || `${l.full_name || ''} ${l.email || ''}`.toLowerCase().includes(search))
        .sort((a, b) => {
            if (sortBy === 'properties_desc') return (b.property_count || 0) - (a.property_count || 0);
            if (sortBy === 'newest') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            return String(a.full_name || '').localeCompare(String(b.full_name || ''));
        });

    const tenants = _dashboardTenants
        .filter(t => !search || `${t.full_name || ''} ${t.email || ''}`.toLowerCase().includes(search))
        .sort((a, b) => {
            if (sortBy === 'newest') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            return String(a.full_name || '').localeCompare(String(b.full_name || ''));
        });

    if (landlordCountEl) landlordCountEl.textContent = landlords.length;
    if (landlordsList) {
        landlordsList.innerHTML = landlords.length
            ? landlords.map(l => `
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:0.45rem 1rem;border-bottom:1px solid var(--gray-100);">
                        <div>
                            <div class="text-sm font-semibold">${l.full_name}</div>
                            <div class="text-xs text-muted">${l.email}</div>
                        </div>
                        <span class="badge badge-primary">${l.property_count} prop${l.property_count !== 1 ? 's' : ''}</span>
                    </div>`).join('')
            : '<p class="text-muted text-sm" style="padding:1rem;">No landlords found.</p>';
    }

    if (tenantCountEl) tenantCountEl.textContent = tenants.length;
    if (tenantsList) {
        tenantsList.innerHTML = tenants.length
            ? tenants.map(t => `
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:0.45rem 1rem;border-bottom:1px solid var(--gray-100);">
                        <div>
                            <div class="text-sm font-semibold">${t.full_name}</div>
                            <div class="text-xs text-muted">${t.email}</div>
                        </div>
                        <span class="text-xs text-muted">${formatDate(t.created_at)}</span>
                    </div>`).join('')
            : '<p class="text-muted text-sm" style="padding:1rem;">No tenants found.</p>';
    }
}


async function loadDashboard() {
    try {
        const data = await API.get('/admin/dashboard');
        const stats = data.stats || {};

        document.getElementById('statProperties').textContent = stats.total_properties || 0;
        document.getElementById('statTenants').textContent = stats.total_tenants || 0;
        document.getElementById('statLandlords').textContent = stats.total_landlords || 0;
        document.getElementById('statRevenue').textContent = formatCurrency(stats.total_revenue || 0);
        document.getElementById('statCities').textContent = stats.total_cities || 0;
        document.getElementById('statBookings').textContent = stats.total_bookings || 0;


        const chartEl = document.getElementById('revenueChart');
        if (chartEl && data.monthly_income) {
            renderIncomeChart(chartEl, data.monthly_income);
        }


        const tableEl = document.getElementById('recentBookingsAdmin');
        if (tableEl && data.recent_bookings) {
            if (!data.recent_bookings.length) {
                tableEl.innerHTML = '<div class="empty-state"><p>No bookings yet.</p></div>';
            } else {
                tableEl.innerHTML = `
                <div class="table-wrapper">
                <table class="data-table">
                    <thead><tr><th>Tenant</th><th>Property</th><th>Landlord</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                    ${data.recent_bookings.map(b => `
                        <tr>
                            <td class="text-sm">${b.tenant_name}</td>
                            <td class="text-sm">${b.property_title}</td>
                            <td class="text-sm">${b.landlord_name}</td>
                            <td class="text-xs">${formatDate(b.created_at)}</td>
                            <td>${statusBadge(b.status)}</td>
                            <td class="actions-cell">
                                ${b.status === 'pending' ? `
                                    <button class="btn btn-success btn-sm" onclick="setRecentBookingStatus(${b.id}, 'approved')">Approve</button>
                                    <button class="btn btn-danger btn-sm" onclick="setRecentBookingStatus(${b.id}, 'rejected')">Reject</button>
                                ` : ''}
                                ${b.status === 'approved' ? `
                                    <button class="btn btn-ghost btn-sm" onclick="setRecentBookingStatus(${b.id}, 'completed')">Complete</button>
                                ` : ''}
                                <button class="btn btn-ghost btn-sm" onclick="openBookingDetailsModal(${b.id})">View</button>
                                <button class="btn btn-ghost btn-sm" onclick="showSection('disputes')">Disputes</button>
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table></div>`;
            }
        }


        _dashboardLandlords = data.landlords || [];
        _dashboardTenants = data.tenants || [];
        renderDashboardPeople();


        const cityCountEl = document.getElementById('cityCount');
        const citiesList = document.getElementById('citiesList');
        const cities = data.cities || [];
        if (cityCountEl) cityCountEl.textContent = cities.length;
        if (citiesList) {
            citiesList.innerHTML = cities.length
                ? cities.map(c => `
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:0.45rem 1rem;border-bottom:1px solid var(--gray-100);">
                        <span class="text-sm font-semibold">${c.city}</span>
                        <span class="badge badge-success">${c.property_count} prop${c.property_count !== 1 ? 's' : ''}</span>
                    </div>`).join('')
                : '<p class="text-muted text-sm" style="padding:1rem;">No cities yet.</p>';
        }


        const propCountEl = document.getElementById('propertiesSummaryCount');
        const propListEl = document.getElementById('propertiesSummaryList');
        const propsList = data.properties_list || [];
        if (propCountEl) propCountEl.textContent = propsList.length;
        if (propListEl) {
            propListEl.innerHTML = propsList.length
                ? propsList.map(p => `
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:0.45rem 1rem;border-bottom:1px solid var(--gray-100);">
                        <div style="min-width:0;">
                            <div class="text-sm font-semibold" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.title}</div>
                            <div class="text-xs text-muted">${p.city} &bull; ${p.landlord_name}</div>
                        </div>
                        <div style="display:flex;gap:0.4rem;flex-shrink:0;">
                            <span class="text-xs font-semibold">${formatCurrency(p.monthly_rent)}</span>
                            ${p.is_available
                        ? '<span class="badge badge-success" style="font-size:0.6rem;">Available</span>'
                        : '<span class="badge badge-danger" style="font-size:0.6rem;">Occupied</span>'}
                        </div>
                    </div>`).join('')
                : '<p class="text-muted text-sm" style="padding:1rem;">No properties yet.</p>';
        }


        await loadNotifications();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function renderIncomeChart(el, data) {
    if (!data.length) { el.innerHTML = '<p class="text-muted text-sm" style="padding:1rem;">No income data available.</p>'; return; }
    const max = Math.max(...data.map(d => parseFloat(d.income || 0)), 1);
    el.innerHTML = `
    <div style="display:flex;align-items:flex-end;gap:0.5rem;height:120px;padding:0.5rem 0;">
        ${data.map(d => {
        const height = Math.max(4, (parseFloat(d.income || 0) / max) * 100);
        return `
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:0.25rem;">
                <div style="font-size:0.6rem;color:var(--gray-500);">${formatCurrency(d.income || 0).replace('KES ', '')}</div>
                <div style="width:100%;background:var(--primary);border-radius:3px 3px 0 0;height:${height}%;min-height:4px;opacity:0.85;"></div>
                <div style="font-size:0.6rem;color:var(--gray-500);white-space:nowrap;">${d.month || ''}</div>
            </div>`;
    }).join('')}
    </div>`;
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


let _usersPage = 1;

async function loadUsers(page = 1) {
    const el = document.getElementById('usersTable');
    if (!el) return;
    el.innerHTML = '<div class="flex-center" style="padding:2rem;"><div class="spinner"></div></div>';
    _usersPage = page;

    const role = document.getElementById('userRoleFilter')?.value || '';
    const search = document.getElementById('userSearch')?.value?.trim() || '';
    const qs = new URLSearchParams({ page, limit: 15 });
    if (role) qs.set('role', role);
    if (search) qs.set('search', search);

    try {
        const data = await API.get(`/admin/users?${qs}`);
        const users = data.users || [];
        const summary = data.summary || {};

        const usersCountAdmin = document.getElementById('usersCountAdmin');
        const usersCountLandlord = document.getElementById('usersCountLandlord');
        const usersCountTenant = document.getElementById('usersCountTenant');
        const usersCountActive = document.getElementById('usersCountActive');
        const usersCountInactive = document.getElementById('usersCountInactive');
        if (usersCountAdmin) usersCountAdmin.textContent = summary.admins || 0;
        if (usersCountLandlord) usersCountLandlord.textContent = summary.landlords || 0;
        if (usersCountTenant) usersCountTenant.textContent = summary.tenants || 0;
        if (usersCountActive) usersCountActive.textContent = summary.active || 0;
        if (usersCountInactive) usersCountInactive.textContent = summary.inactive || 0;

        if (!users.length) {
            el.innerHTML = '<div class="empty-state"><p>No users found.</p></div>';
            return;
        }

        el.innerHTML = `
        <div class="table-wrapper">
        <table class="data-table">
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Joined</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
            ${users.map(u => `
                <tr>
                    <td>
                        <div class="font-semibold text-sm">${u.full_name}</div>
                    </td>
                    <td class="text-sm">${u.email}</td>
                    <td class="text-sm">${u.phone || '-'}</td>
                    <td><span class="badge ${u.role === 'admin' ? 'badge-info' : u.role === 'landlord' ? 'badge-primary' : 'badge-gray'}">${u.role.charAt(0).toUpperCase() + u.role.slice(1)}</span></td>
                    <td class="text-xs">${formatDate(u.created_at)}</td>
                    <td>${u.is_active
                ? '<span class="badge badge-success">Active</span>'
                : '<span class="badge badge-danger">Inactive</span>'}</td>
                    <td class="actions-cell">
                        <button class="btn btn-ghost btn-sm" onclick="toggleUserStatus(${u.id}, ${u.is_active})">
                            ${u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id}, '${u.full_name.replace(/'/g, "\\'")}')">Delete</button>
                    </td>
                </tr>`).join('')}
            </tbody>
        </table></div>`;

        // Pagination
        renderUsersPagination(data.page, data.pages);
    } catch (err) {
        el.innerHTML = `<p class="text-danger" style="padding:1rem;">${err.message}</p>`;
    }
}

function renderUsersPagination(current, total) {
    const el = document.getElementById('usersPagination');
    if (!el) return;
    if (!total || total <= 1) { el.innerHTML = ''; return; }
    let html = `<button class="page-btn" onclick="loadUsers(${current - 1})" ${current === 1 ? 'disabled' : ''}>&#8592; Prev</button>`;
    for (let i = 1; i <= total; i++) {
        if (i === 1 || i === total || Math.abs(i - current) <= 1) {
            html += `<button class="page-btn ${i === current ? 'active' : ''}" onclick="loadUsers(${i})">${i}</button>`;
        } else if (Math.abs(i - current) === 2) {
            html += `<span class="page-btn" style="pointer-events:none;border:none;">...</span>`;
        }
    }
    html += `<button class="page-btn" onclick="loadUsers(${current + 1})" ${current === total ? 'disabled' : ''}>Next &#8594;</button>`;
    el.innerHTML = html;
}

async function toggleUserStatus(id, currentlyActive) {
    const action = currentlyActive ? 'deactivate' : 'activate';
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} this user?`)) return;
    try {
        await API.patch(`/admin/users/${id}`, { is_active: !currentlyActive });
        showToast(`User ${action}d.`, 'success');
        loadUsers(_usersPage);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteUser(id, name) {
    if (!confirm(`Permanently delete user "${name}"? This cannot be undone.`)) return;
    try {
        await API.delete(`/admin/users/${id}`);
        showToast('User deleted.', 'success');
        loadUsers(_usersPage);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function exportUsersCsv() {
    const role = document.getElementById('userRoleFilter')?.value || '';
    const search = document.getElementById('userSearch')?.value?.trim() || '';
    const qs = new URLSearchParams({ page: 1, limit: 5000 });
    if (role) qs.set('role', role);
    if (search) qs.set('search', search);

    try {
        await downloadAdminCsv(`/admin/users/export.csv?${qs.toString()}`, `users-${new Date().toISOString().slice(0, 10)}.csv`);
        showToast('Users CSV exported.', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

document.getElementById('userRoleFilter')?.addEventListener('change', () => loadUsers(1));
document.getElementById('userSearch')?.addEventListener('input', () => loadUsers(1));
document.getElementById('exportUsersCsvBtn')?.addEventListener('click', exportUsersCsv);

/* ============================================================
   Properties Management (Admin)
   ============================================================ */
async function loadAllProperties() {
    const el = document.getElementById('propertiesTable');
    if (!el) return;
    el.innerHTML = '<div class="flex-center" style="padding:2rem;"><div class="spinner"></div></div>';
    try {
        const data = await API.get('/admin/properties');
        const properties = data.properties || [];
        if (!properties.length) {
            el.innerHTML = '<div class="empty-state"><p>No properties found.</p></div>';
            return;
        }
        el.innerHTML = `
        <div class="table-wrapper">
        <table class="data-table">
            <thead><tr><th>Property</th><th>Landlord</th><th>Type</th><th>City</th><th>Rent/mo</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
            ${properties.map(p => `
                <tr>
                    <td>
                        ${p.cover_image ? `<img src="http://localhost:5000${p.cover_image}" style="width:36px;height:36px;object-fit:cover;border-radius:4px;margin-right:0.5rem;vertical-align:middle;">` : ''}
                        <span class="font-semibold text-sm">${p.title}</span>
                    </td>
                    <td>
                        <div class="text-sm">${p.landlord_name}</div>
                        <div class="text-xs text-muted">${p.landlord_email}</div>
                    </td>
                    <td class="text-sm">${p.property_type}</td>
                    <td class="text-sm">${p.city}</td>
                    <td class="text-sm font-semibold">${formatCurrency(p.monthly_rent)}</td>
                    <td>${p.is_available
                ? '<span class="badge badge-success">Available</span>'
                : '<span class="badge badge-danger">Not Available</span>'}</td>
                    <td class="actions-cell">
                        <a href="property-detail.html?id=${p.id}" class="btn btn-ghost btn-sm" target="_blank">View</a>
                        <button class="btn btn-danger btn-sm" onclick="adminDeleteProperty(${p.id}, '${p.title.replace(/'/g, "\\'")}')">Delete</button>
                    </td>
                </tr>`).join('')}
            </tbody>
        </table></div>`;
    } catch (err) {
        el.innerHTML = `<p class="text-danger" style="padding:1rem;">${err.message}</p>`;
    }
}

async function adminDeleteProperty(id, title) {
    if (!confirm(`Delete property "${title}"? This cannot be undone.`)) return;
    try {
        await API.delete(`/properties/${id}`);
        showToast('Property deleted.', 'success');
        loadAllProperties();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

/* ============================================================
   Payments Management (Admin)
   ============================================================ */
let _paymentsPage = 1;

async function loadAllPayments(page = 1) {
    const el = document.getElementById('paymentsTable');
    if (!el) return;
    el.innerHTML = '<div class="flex-center" style="padding:2rem;"><div class="spinner"></div></div>';
    _paymentsPage = page;

    const status = document.getElementById('paymentStatusFilter')?.value || '';
    const qs = new URLSearchParams({ page, limit: 15 });
    if (status) qs.set('status', status);

    try {
        const data = await API.get(`/admin/payments?${qs}`);
        const payments = data.payments || [];

        if (!payments.length) {
            el.innerHTML = '<div class="empty-state"><p>No payments found.</p></div>';
            return;
        }

        el.innerHTML = `
        <div class="table-wrapper">
        <table class="data-table">
            <thead><tr><th>Receipt</th><th>Tenant</th><th>Landlord</th><th>Property</th><th>Amount</th><th>Method</th><th>Reference</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
            ${payments.map(p => `
                <tr>
                    <td class="text-sm font-semibold text-primary">${p.receipt_number || '-'}</td>
                    <td class="text-sm">${p.tenant_name}</td>
                    <td class="text-sm">${p.landlord_name}</td>
                    <td class="text-sm">${p.property_title}</td>
                    <td class="text-sm font-semibold">${formatCurrency(p.amount)}</td>
                    <td class="text-sm">${p.payment_method === 'cash' ? 'Cash' : 'M-Pesa Send Money'}</td>
                    <td class="text-xs" style="font-family:monospace;">${p.transaction_reference}</td>
                    <td class="text-xs">${formatDate(p.created_at)}</td>
                    <td>${statusBadge(p.status)}</td>
                    <td class="actions-cell">
                        ${p.status === 'pending' ? `
                            <button class="btn btn-success btn-sm" onclick="verifyPayment(${p.id}, 'verified')">Verify</button>
                            <button class="btn btn-danger btn-sm" onclick="verifyPayment(${p.id}, 'failed')">Fail</button>
                        ` : ''}
                    </td>
                </tr>`).join('')}
            </tbody>
        </table></div>`;

        renderPaymentsPagination(data.page, data.pages);
    } catch (err) {
        el.innerHTML = `<p class="text-danger" style="padding:1rem;">${err.message}</p>`;
    }
}

function renderPaymentsPagination(current, total) {
    const el = document.getElementById('paymentsPagination');
    if (!el) return;
    if (!total || total <= 1) { el.innerHTML = ''; return; }
    let html = `<button class="page-btn" onclick="loadAllPayments(${current - 1})" ${current === 1 ? 'disabled' : ''}>&#8592; Prev</button>`;
    for (let i = 1; i <= total; i++) {
        if (i === 1 || i === total || Math.abs(i - current) <= 1) {
            html += `<button class="page-btn ${i === current ? 'active' : ''}" onclick="loadAllPayments(${i})">${i}</button>`;
        } else if (Math.abs(i - current) === 2) {
            html += `<span class="page-btn" style="pointer-events:none;border:none;">...</span>`;
        }
    }
    html += `<button class="page-btn" onclick="loadAllPayments(${current + 1})" ${current === total ? 'disabled' : ''}>Next &#8594;</button>`;
    el.innerHTML = html;
}

async function verifyPayment(id, status) {
    const label = status === 'verified' ? 'verify' : 'mark as failed';
    if (!confirm(`${label.charAt(0).toUpperCase() + label.slice(1)} this payment?`)) return;
    try {
        await API.patch(`/payments/${id}/verify`, { status });
        showToast(`Payment ${status}.`, 'success');
        loadAllPayments(_paymentsPage);
        loadDashboard();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function exportPaymentsCsv() {
    const status = document.getElementById('paymentStatusFilter')?.value || '';
    const fromDate = document.getElementById('paymentFromDate')?.value || '';
    const toDate = document.getElementById('paymentToDate')?.value || '';
    const qs = new URLSearchParams();
    if (status) qs.set('status', status);
    if (fromDate) qs.set('from_date', fromDate);
    if (toDate) qs.set('to_date', toDate);

    try {
        await downloadAdminCsv(`/admin/payments/export.csv?${qs.toString()}`, `payments-${new Date().toISOString().slice(0, 10)}.csv`);
        showToast('Payments CSV exported.', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

document.getElementById('paymentStatusFilter')?.addEventListener('change', () => loadAllPayments(1));
document.getElementById('exportPaymentsCsvBtn')?.addEventListener('click', exportPaymentsCsv);

/* ============================================================
   Disputes Management
   ============================================================ */
async function loadDisputes() {
    const el = document.getElementById('disputesTable');
    if (!el) return;
    el.innerHTML = '<div class="flex-center" style="padding:2rem;"><div class="spinner"></div></div>';
    try {
        const data = await API.get('/admin/disputes');
        const disputes = data.disputes || [];
        if (!disputes.length) {
            el.innerHTML = '<div class="empty-state"><p>No disputes filed.</p></div>';
            return;
        }
        el.innerHTML = `
        <div class="table-wrapper">
        <table class="data-table">
            <thead><tr><th>Subject</th><th>Filed By</th><th>Against</th><th>Type</th><th>Filed</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
            ${disputes.map(d => `
                <tr>
                    <td>
                        <div class="font-semibold text-sm">${d.subject}</div>
                        <div class="text-xs text-muted" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.description || ''}</div>
                    </td>
                    <td class="text-sm">${d.complainant_name}</td>
                    <td class="text-sm">${d.respondent_name || '-'}</td>
                    <td><span class="badge badge-gray text-xs">${d.dispute_type || '-'}</span></td>
                    <td class="text-xs">${formatDate(d.created_at)}</td>
                    <td>${statusBadge(d.status)}</td>
                    <td class="actions-cell">
                        ${d.status !== 'resolved' && d.status !== 'dismissed' ? `
                            <button class="btn btn-primary btn-sm" onclick="openResolveModal(${d.id}, '${d.subject.replace(/'/g, "\\'")}')">Resolve</button>
                        ` : `<span class="text-xs text-muted">${d.resolution_notes ? d.resolution_notes.substring(0, 40) + '...' : 'Closed'}</span>`}
                    </td>
                </tr>`).join('')}
            </tbody>
        </table></div>`;
    } catch (err) {
        el.innerHTML = `<p class="text-danger" style="padding:1rem;">${err.message}</p>`;
    }
}

let _resolveDisputeId = null;
function openResolveModal(id, subject) {
    _resolveDisputeId = id;
    const subjectEl = document.getElementById('resolveDisputeSubject');
    if (subjectEl) subjectEl.textContent = subject;
    document.getElementById('disputeStatus').value = 'investigating';
    document.getElementById('disputeNotes').value = '';
    openModal('resolveDisputeModal');
}

document.getElementById('confirmResolveBtn')?.addEventListener('click', async function () {
    const notes = document.getElementById('disputeNotes').value.trim();
    const status = document.getElementById('disputeStatus').value;
    if (!notes) { showToast('Please provide resolution notes.', 'error'); return; }
    try {
        await API.patch(`/admin/disputes/${_resolveDisputeId}`, { status, resolution_notes: notes });
        showToast('Dispute updated.', 'success');
        closeModal('resolveDisputeModal');
        loadDisputes();
        loadDashboard();
    } catch (err) {
        showToast(err.message, 'error');
    }
});

/* ============================================================
   Reports
   ============================================================ */
async function loadReports() {
    const el = document.getElementById('reportsContent');
    if (!el) return;
    el.innerHTML = '<div class="flex-center" style="padding:3rem;"><div class="spinner"></div></div>';

    const year = document.getElementById('reportYear')?.value || new Date().getFullYear();
    try {
        const data = await API.get(`/admin/reports?year=${year}`);

        const monthlyIncome = data.monthly_income || [];
        const bookingStats = data.booking_stats || [];
        const topProperties = data.top_properties || [];
        const userGrowth = data.user_growth || [];

        const totalYearIncome = monthlyIncome.reduce((s, m) => s + parseFloat(m.income || 0), 0);
        const totalBookings = bookingStats.reduce((s, b) => s + parseInt(b.count || 0), 0);

        el.innerHTML = `
        <!-- Summary Cards -->
        <div class="stats-grid" style="margin-bottom:2rem;">
            <div class="stat-card">
                <div class="stat-label">Total Income (${year})</div>
                <div class="stat-value">${formatCurrency(totalYearIncome)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Bookings (${year})</div>
                <div class="stat-value">${totalBookings}</div>
            </div>
        </div>

        <!-- Monthly Income Table -->
        <div class="section-header" style="margin-bottom:1rem;">
            <h3 class="section-title">Monthly Income Breakdown</h3>
        </div>
        <div class="table-wrapper" style="margin-bottom:2rem;">
        <table class="data-table">
            <thead><tr><th>Month</th><th>Verified Payments</th><th>Income</th></tr></thead>
            <tbody>
            ${monthlyIncome.map(m => `
                <tr>
                    <td class="text-sm">${m.month}</td>
                    <td class="text-sm">${m.payment_count}</td>
                    <td class="text-sm font-semibold">${formatCurrency(m.income)}</td>
                </tr>`).join('') || '<tr><td colspan="3" class="text-center text-muted">No data</td></tr>'}
            </tbody>
        </table></div>

        <!-- Booking Status Breakdown -->
        <div class="section-header" style="margin-bottom:1rem;">
            <h3 class="section-title">Booking Status Breakdown</h3>
        </div>
        <div class="table-wrapper" style="margin-bottom:2rem;">
        <table class="data-table">
            <thead><tr><th>Status</th><th>Count</th></tr></thead>
            <tbody>
            ${bookingStats.map(b => `
                <tr>
                    <td>${statusBadge(b.status)}</td>
                    <td class="text-sm font-semibold">${b.count}</td>
                </tr>`).join('') || '<tr><td colspan="2" class="text-center text-muted">No data</td></tr>'}
            </tbody>
        </table></div>

        <!-- Top Properties -->
        <div class="section-header" style="margin-bottom:1rem;">
            <h3 class="section-title">Top 10 Properties by Revenue</h3>
        </div>
        <div class="table-wrapper" style="margin-bottom:2rem;">
        <table class="data-table">
            <thead><tr><th>Rank</th><th>Property</th><th>Landlord</th><th>Payments</th><th>Total Revenue</th></tr></thead>
            <tbody>
            ${topProperties.map((p, i) => `
                <tr>
                    <td class="text-sm font-semibold">#${i + 1}</td>
                    <td class="text-sm">${p.title}</td>
                    <td class="text-sm">${p.landlord_name}</td>
                    <td class="text-sm">${p.payment_count}</td>
                    <td class="text-sm font-semibold">${formatCurrency(p.total_revenue)}</td>
                </tr>`).join('') || '<tr><td colspan="5" class="text-center text-muted">No data</td></tr>'}
            </tbody>
        </table></div>

        <!-- User Growth -->
        <div class="section-header" style="margin-bottom:1rem;">
            <h3 class="section-title">User Registration by Month</h3>
        </div>
        <div class="table-wrapper">
        <table class="data-table">
            <thead><tr><th>Month</th><th>New Users</th></tr></thead>
            <tbody>
            ${userGrowth.map(u => `
                <tr>
                    <td class="text-sm">${u.month}</td>
                    <td class="text-sm font-semibold">${u.new_users}</td>
                </tr>`).join('') || '<tr><td colspan="2" class="text-center text-muted">No data</td></tr>'}
            </tbody>
        </table></div>`;
    } catch (err) {
        el.innerHTML = `<p class="text-danger" style="padding:1rem;">${err.message}</p>`;
    }
}

// Populate year selector
(function () {
    const sel = document.getElementById('reportYear');
    if (!sel) return;
    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y >= currentYear - 4; y--) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        if (y === currentYear) opt.selected = true;
        sel.appendChild(opt);
    }
})();

document.getElementById('reportYear')?.addEventListener('change', loadReports);
document.getElementById('dashboardPeopleSearch')?.addEventListener('input', renderDashboardPeople);
document.getElementById('dashboardPeopleSort')?.addEventListener('change', renderDashboardPeople);

/* ============================================================
   Section loader hooks
   ============================================================ */
const originalShowSection = window.showSection;
window.showSection = function (name) {
    originalShowSection(name);
    if (name === 'users') loadUsers(1);
    if (name === 'properties') loadAllProperties();
    if (name === 'payments') loadAllPayments(1);
    if (name === 'disputes') loadDisputes();
    if (name === 'reports') loadReports();
    if (name === 'messages') loadInbox();
    if (name === 'profile') loadProfileSection();
};

document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
});
