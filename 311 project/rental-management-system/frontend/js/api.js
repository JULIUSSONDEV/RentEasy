
const normalizeApiBase = (base) => String(base || '').replace(/\/+$/, '');

// Try multiple local API hosts to avoid "Failed to fetch" when one hostname is not reachable.
const API_BASE_CANDIDATES = [
    window.API_BASE,
    localStorage.getItem('API_BASE'),
    'http://localhost:5000/api',
    'http://127.0.0.1:5000/api'
].map(normalizeApiBase).filter(Boolean).filter((base, idx, arr) => arr.indexOf(base) === idx);

const API = {

    getToken() {
        return localStorage.getItem('token');
    },


    getUser() {
        const u = localStorage.getItem('user');
        return u ? JSON.parse(u) : null;
    },


    headers(isFormData = false) {
        const h = {};
        const token = this.getToken();
        if (token) h['Authorization'] = `Bearer ${token}`;
        if (!isFormData) h['Content-Type'] = 'application/json';
        return h;
    },


    async request(method, path, body = null) {
        const isFormData = body instanceof FormData;
        let lastNetworkError = null;

        for (const apiBase of API_BASE_CANDIDATES) {
            const options = {
                method,
                headers: this.headers(isFormData),
            };
            if (body) {
                options.body = isFormData ? body : JSON.stringify(body);
            }

            try {
                const res = await fetch(`${apiBase}${path}`, options);
                let data;
                try { data = await res.json(); } catch { data = {}; }

                if (!res.ok) {
                    throw new Error(data.error || data.message || `Request failed (${res.status})`);
                }

                return data;
            } catch (err) {
                const isNetworkError = err instanceof TypeError && err.message === 'Failed to fetch';
                if (!isNetworkError) throw err;
                lastNetworkError = err;
            }
        }

        throw lastNetworkError || new Error('Failed to fetch');
    },

    get(path) { return this.request('GET', path); },
    post(path, body) { return this.request('POST', path, body); },
    put(path, body) { return this.request('PUT', path, body); },
    patch(path, body) { return this.request('PATCH', path, body); },
    delete(path) { return this.request('DELETE', path); },


    requireAuth(allowedRoles = []) {
        const user = this.getUser();
        const token = this.getToken();
        if (!user || !token) {
            window.location.href = '../pages/login.html';
            return null;
        }
        if (allowedRoles.length && !allowedRoles.includes(user.role)) {
            window.location.href = '../pages/login.html';
            return null;
        }
        return user;
    },


    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '../pages/login.html';
    }
};


function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = {
        success: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>',
        error: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        info: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };
    toast.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(110%)'; toast.style.transition = '0.3s'; setTimeout(() => toast.remove(), 350); }, duration);
}


function openModal(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.add('open'); document.body.classList.add('no-scroll'); }
}
function closeModal(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('open'); document.body.classList.remove('no-scroll'); }
}

document.addEventListener('click', function (e) {
    if (e.target.classList.contains('modal-backdrop')) {
        e.target.classList.remove('open');
        document.body.classList.remove('no-scroll');
    }
});


function formatCurrency(amount) {
    return 'KES ' + parseFloat(amount || 0).toLocaleString('en-KE', { minimumFractionDigits: 0 });
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-KE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function statusBadge(status) {
    const map = {
        pending: 'badge-warning',
        approved: 'badge-success',
        rejected: 'badge-danger',
        cancelled: 'badge-gray',
        completed: 'badge-info',
        verified: 'badge-success',
        failed: 'badge-danger',
        open: 'badge-warning',
        investigating: 'badge-info',
        resolved: 'badge-success',
        dismissed: 'badge-gray',
    };
    return `<span class="badge ${map[status] || 'badge-gray'}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>`;
}

function avatarInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function renderStars(rating) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
        html += `<span class="star ${i <= rating ? 'filled' : ''}">&#9733;</span>`;
    }
    return html;
}

function buildPropertyCard(p, isLandlord = false) {
    const img = p.cover_image ? `http://localhost:5000${p.cover_image}` : 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&q=80';
    const available = p.is_available
        ? '<span class="badge badge-success">Available</span>'
        : '<span class="badge badge-danger">Not Available</span>';

    const totalRooms = p.total_rooms || 1;
    const occupiedRooms = p.occupied_rooms || 0;
    const remainingRooms = Math.max(0, totalRooms - occupiedRooms);
    const roomsBadgeClass = remainingRooms === 0 ? 'badge-danger' : remainingRooms <= Math.ceil(totalRooms / 2) ? 'badge-warning' : 'badge-success';
    const roomsInfo = `<span class="property-meta-item">
                    <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
                    </svg>
                    <span class="badge ${roomsBadgeClass}" style="font-size:0.65rem;padding:1px 5px;">${remainingRooms}/${totalRooms} rooms</span>
                </span>`;

    return `
    <div class="property-card">
        <div class="property-card-image">
            <img src="${img}" alt="${p.title}" loading="lazy"
                onerror="this.src='https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&q=80'">
            <div class="property-card-badge">${available}</div>
            <div class="property-card-type">${p.property_type}</div>
        </div>
        <div class="property-card-body">
            <h5 class="property-card-title truncate">${p.title}</h5>
            <div class="property-card-location">
                <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                ${p.address}, ${p.city}
            </div>
            <div class="property-card-meta">
                <span class="property-meta-item">
                    <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
                    </svg>
                    ${p.bedrooms} Bed
                </span>
                <span class="property-meta-item">
                    <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <path d="M4 12h16M4 6h16M4 18h7"/>
                    </svg>
                    ${p.bathrooms} Bath
                </span>
                ${p.size_sqft ? `<span class="property-meta-item"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18"/></svg> ${p.size_sqft} sqft</span>` : ''}
                ${roomsInfo}
            </div>
            <div class="property-card-footer">
                <div class="property-card-price">
                    ${formatCurrency(p.monthly_rent)}<span>/mo</span>
                </div>
                <div class="flex gap-2">
                    ${parseFloat(p.avg_rating) > 0 ? `<div class="rating-stars">${renderStars(Math.round(p.avg_rating))}</div>` : ''}
                    ${isLandlord
            ? `<button class="btn btn-sm btn-ghost" onclick="editProperty(${p.id})">Edit</button>
                           <button class="btn btn-sm btn-danger" onclick="confirmDeleteProperty(${p.id})">Delete</button>`
            : `<a href="property-detail.html?id=${p.id}" class="btn btn-primary btn-sm">View</a>`
        }
                </div>
            </div>
        </div>
    </div>`;
}
