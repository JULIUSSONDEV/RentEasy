


const propertyId = new URLSearchParams(window.location.search).get('id');


(function () {
    const user = API.getUser();
    const actionsEl = document.getElementById('navActions');
    if (!actionsEl) return;
    if (user) {
        const dashLink = user.role === 'admin' ? 'admin-dashboard.html'
            : user.role === 'landlord' ? 'landlord-dashboard.html'
                : 'tenant-dashboard.html';
        actionsEl.innerHTML = `<a href="${dashLink}" class="btn btn-primary btn-sm">Dashboard</a>`;
    }
})();

async function loadProperty() {
    const container = document.getElementById('propertyDetail');
    const breadcrumb = document.getElementById('breadcrumbTitle');
    if (!propertyId) {
        container.innerHTML = `<div class="empty-state"><h3>Property Not Found</h3><p>No property ID provided.</p><a href="properties.html" class="btn btn-primary mt-4">Browse Properties</a></div>`;
        return;
    }
    try {
        const data = await API.get(`/properties/${propertyId}`);
        const p = data.property;
        if (breadcrumb) breadcrumb.textContent = p.title;
        document.title = `${p.title} - RentEasy`;

        const images = Array.isArray(p.images) ? p.images : [];
        const coverImg = p.cover_image ? `http://localhost:5000${p.cover_image}` : 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80';

        const totalRooms = p.total_rooms || 1;
        const occupiedRooms = p.occupied_rooms || 0;
        const remainingRooms = Math.max(0, totalRooms - occupiedRooms);
        const roomsBadgeClass = remainingRooms === 0 ? 'badge-danger' : remainingRooms <= Math.ceil(totalRooms / 2) ? 'badge-warning' : 'badge-success';

        const user = API.getUser();
        const isTenant = user && user.role === 'tenant';
        const isOwner = user && user.id === p.landlord_id;

        let actionsHtml = '';
        if (!user) {
            actionsHtml = `<a href="login.html" class="btn btn-primary btn-full btn-lg">Sign In to Book</a>`;
        } else if (isTenant) {
            actionsHtml = `
                <button class="btn btn-primary btn-full btn-lg" onclick="openModal('bookingModal')">Request Booking</button>
                <button class="btn btn-secondary btn-full mt-2" onclick="openModal('messageModal')">Message Landlord</button>`;
        } else if (isOwner) {
            actionsHtml = `<div class="alert alert-info">You own this property.</div>`;
        } else {
            actionsHtml = `<div class="alert alert-info">Log in as a tenant to book.</div>`;
        }

        const amenitiesHtml = (p.amenities || []).map(a => `<span class="amenity-tag">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
            ${a}</span>`).join('');

        const reviewsHtml = data.reviews.length
            ? data.reviews.map(r => `
                <div class="card mb-4">
                    <div class="card-body">
                        <div class="flex-between mb-2">
                            <div style="display:flex;align-items:center;gap:0.75rem;">
                                <div class="message-avatar" style="width:2rem;height:2rem;font-size:0.75rem;">
                                    ${r.tenant_avatar ? `<img src="http://localhost:5000${r.tenant_avatar}" alt="">` : avatarInitials(r.tenant_name)}
                                </div>
                                <div>
                                    <div class="font-semibold text-sm">${r.tenant_name}</div>
                                    <div class="text-xs text-muted">${formatDate(r.created_at)}</div>
                                </div>
                            </div>
                            <div class="rating-stars">${renderStars(r.rating)}</div>
                        </div>
                        ${r.title ? `<div class="font-semibold mb-1">${r.title}</div>` : ''}
                        ${r.body ? `<p class="text-sm">${r.body}</p>` : ''}
                    </div>
                </div>`).join('')
            : '<p class="text-muted">No reviews yet.</p>';

        container.innerHTML = `
        <div class="grid-2" style="gap:2rem;align-items:start;">
            <div>
                <!-- Gallery -->
                <div class="property-detail-gallery mb-6">
                    <div class="gallery-main">
                        <img src="${coverImg}" alt="${p.title}"
                            onerror="this.src='https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80'">
                    </div>
                    <div class="gallery-side">
                        ${images.slice(0, 2).map(img => `<img src="http://localhost:5000${img}" alt="" onerror="this.style.display='none'">`).join('')}
                    </div>
                </div>

                <div class="flex-between mb-4">
                    <div>
                        <h2>${p.title}</h2>
                        <div style="display:flex;align-items:center;gap:0.5rem;color:var(--gray-500);margin-top:0.25rem;">
                            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                            </svg>
                            <span class="text-sm">${p.address}, ${p.city}${p.county ? ', ' + p.county : ''}</span>
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:1.75rem;font-weight:800;color:var(--primary);">${formatCurrency(p.monthly_rent)}</div>
                        <div class="text-xs text-muted">per month</div>
                    </div>
                </div>

                <div style="display:flex;gap:1.5rem;margin-bottom:1.5rem;flex-wrap:wrap;">
                    <span class="property-meta-item" style="font-size:0.875rem;">
                        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
                        </svg>
                        ${p.bedrooms} Bedroom${p.bedrooms !== 1 ? 's' : ''}
                    </span>
                    <span class="property-meta-item" style="font-size:0.875rem;">
                        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path d="M4 12h16M4 6h16M4 18h7"/>
                        </svg>
                        ${p.bathrooms} Bathroom${p.bathrooms !== 1 ? 's' : ''}
                    </span>
                    ${p.size_sqft ? `<span class="property-meta-item" style="font-size:0.875rem;">
                        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18"/></svg>
                        ${p.size_sqft} sqft
                    </span>` : ''}
                    <span class="badge ${p.is_available ? 'badge-success' : 'badge-danger'}">${p.is_available ? 'Available' : 'Not Available'}</span>
                    <span class="badge ${roomsBadgeClass}" style="font-size:0.75rem;">
                        ${remainingRooms} of ${totalRooms} room${totalRooms !== 1 ? 's' : ''} available
                    </span>
                </div>

                <div class="card mb-6">
                    <div class="card-body">
                        <h4 class="mb-4">Description</h4>
                        <p class="text-sm" style="line-height:1.8;">${p.description || 'No description provided.'}</p>
                    </div>
                </div>

                ${amenitiesHtml ? `<div class="card mb-6"><div class="card-body"><h4 class="mb-4">Amenities</h4><div class="property-amenities">${amenitiesHtml}</div></div></div>` : ''}

                <!-- Reviews -->
                <div class="section-header mt-8">
                    <h3>Reviews (${data.reviews.length})</h3>
                    ${parseFloat(p.avg_rating) > 0 ? `<div class="flex gap-2 items-center"><div class="rating-stars">${renderStars(Math.round(p.avg_rating))}</div><span class="text-sm text-muted">${parseFloat(p.avg_rating).toFixed(1)}</span></div>` : ''}
                </div>
                ${reviewsHtml}
            </div>

            <!-- Sidebar -->
            <div style="position:sticky;top:80px;">
                <!-- Landlord Card -->
                <div class="card mb-4">
                    <div class="card-body">
                        <h4 class="mb-4">Listed by</h4>
                        <div style="display:flex;align-items:center;gap:0.875rem;">
                            <div class="message-avatar" style="width:3rem;height:3rem;font-size:1rem;background:var(--primary);">
                                ${p.landlord_avatar ? `<img src="http://localhost:5000${p.landlord_avatar}" alt="">` : avatarInitials(p.landlord_name)}
                            </div>
                            <div>
                                <div class="font-semibold">${p.landlord_name}</div>
                                <div class="text-xs text-muted">${p.landlord_phone || 'No phone listed'}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Booking Card -->
                <div class="card">
                    <div class="card-body">
                        <div style="font-size:1.5rem;font-weight:800;color:var(--primary);margin-bottom:0.25rem;">${formatCurrency(p.monthly_rent)}<span style="font-size:0.875rem;font-weight:400;color:var(--gray-500);">/month</span></div>
                        <div style="margin-bottom:1.25rem;">${p.views || 0} views</div>
                        ${actionsHtml}
                    </div>
                </div>
            </div>
        </div>`;


const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateInput = document.getElementById('startDateInput') || document.getElementById('startDate');
        if (dateInput) {
            dateInput.min = tomorrow.toISOString().split('T')[0];
            dateInput.value = tomorrow.toISOString().split('T')[0];
        }


window._landlordId = p.landlord_id;

    } catch (err) {
        container.innerHTML = `<div class="empty-state"><h3>Property Not Found</h3><p>${err.message}</p><a href="properties.html" class="btn btn-primary mt-4">Back to Properties</a></div>`;
    }
}


document.getElementById('bookingForm')?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const btn = document.getElementById('submitBookingBtn');
    const alertEl = document.getElementById('bookingAlert');
    const startDate = document.getElementById('startDate').value;
    const message = document.getElementById('bookingMessage').value;

    btn.disabled = true;
    btn.textContent = 'Submitting...';
    alertEl.innerHTML = '';

    try {
        await API.post('/bookings', { property_id: parseInt(propertyId), start_date: startDate, message });
        showToast('Booking request submitted successfully!', 'success');
        closeModal('bookingModal');
    } catch (err) {
        alertEl.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Submit Request';
    }
});


document.getElementById('messageForm')?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const btn = document.getElementById('sendMsgBtn');
    const alertEl = document.getElementById('messageAlert');
    const subject = document.getElementById('msgSubject').value;
    const body = document.getElementById('msgBody').value.trim();
    if (!body) return;

    btn.disabled = true;
    alertEl.innerHTML = '';

    try {
        await API.post('/messages', {
            receiver_id: window._landlordId,
            property_id: parseInt(propertyId),
            subject, body
        });
        showToast('Message sent!', 'success');
        closeModal('messageModal');
        this.reset();
    } catch (err) {
        alertEl.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    } finally {
        btn.disabled = false;
    }
});

document.addEventListener('DOMContentLoaded', loadProperty);
