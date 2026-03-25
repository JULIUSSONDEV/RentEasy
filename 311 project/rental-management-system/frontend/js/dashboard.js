


document.getElementById('sidebarToggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('show');
    document.body.classList.toggle('no-scroll');
});
document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('show');
    document.body.classList.remove('no-scroll');
});


document.getElementById('logoutBtn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to sign out?')) API.logout();
});


document.querySelectorAll('.sidebar-link[data-section]').forEach(link => {
    link.addEventListener('click', function (e) {
        e.preventDefault();
        showSection(this.dataset.section);

        document.getElementById('sidebar')?.classList.remove('open');
        document.getElementById('sidebarOverlay')?.classList.remove('show');
        document.body.classList.remove('no-scroll');
    });
});

function showSection(name) {
    document.querySelectorAll('.dash-section').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    const sec = document.getElementById('section-' + name);
    if (sec) sec.classList.remove('hidden');
    const link = document.querySelector(`.sidebar-link[data-section="${name}"]`);
    if (link) link.classList.add('active');
    const titles = {
        dashboard: 'Dashboard', search: 'Browse Properties', bookings: 'Bookings',
        payments: 'Payments', messages: 'Messages', profile: 'My Profile',
        properties: 'My Properties', users: 'User Management',
        disputes: 'Disputes', reports: 'Reports'
    };
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.textContent = titles[name] || name.charAt(0).toUpperCase() + name.slice(1);
    window._currentSection = name;
}


function initUserInfo() {
    const user = API.getUser();
    if (!user) return;
    const nameEl = document.getElementById('sidebarName');
    const avatarEl = document.getElementById('sidebarAvatar');
    if (nameEl) nameEl.textContent = user.full_name;
    if (avatarEl) {
        if (user.profile_picture) {
            avatarEl.innerHTML = `<img src="http://localhost:5000${user.profile_picture}" alt="avatar">`;
        } else {
            avatarEl.textContent = avatarInitials(user.full_name);
        }
    }
}


async function loadNotifCount() {
    try {
        const data = await API.get('/notifications?limit=1');
        const count = data.unread || 0;
        const badge = document.getElementById('notifCount');
        if (badge) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.classList.toggle('hidden', count === 0);
        }
    } catch { }
}


document.getElementById('notifBtn')?.addEventListener('click', () => {
    showSection('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
});


async function loadProfileSection() {
    try {
        const data = await API.get('/auth/profile');
        const user = data.user;
        const avatarEl = document.getElementById('profileAvatar');
        if (avatarEl) {
            if (user.profile_picture) avatarEl.innerHTML = `<img src="http://localhost:5000${user.profile_picture}" alt="avatar">`;
            else avatarEl.textContent = avatarInitials(user.full_name);
        }
        const nameEl = document.getElementById('profileName');
        if (nameEl) nameEl.textContent = user.full_name;
        const emailEl = document.getElementById('profileEmail');
        if (emailEl) emailEl.textContent = user.email;
        const editNameEl = document.getElementById('editName');
        if (editNameEl) editNameEl.value = user.full_name;
        const editPhoneEl = document.getElementById('editPhone');
        if (editPhoneEl) editPhoneEl.value = user.phone || '';
    } catch { }
}


document.getElementById('profileForm')?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const fd = new FormData(this);
    try {
        await API.request('PUT', '/auth/profile', fd);
        const newName = fd.get('full_name');
        if (newName) {
            const stored = API.getUser();
            stored.full_name = newName;
            localStorage.setItem('user', JSON.stringify(stored));
        }
        showToast('Profile updated successfully!', 'success');
        loadProfileSection();
        initUserInfo();
    } catch (err) { showToast(err.message, 'error'); }
});


document.getElementById('passwordForm')?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const current = document.getElementById('currentPwd')?.value;
    const newPwd = document.getElementById('newPwd')?.value;
    const confirm = document.getElementById('confirmPwd')?.value;
    if (newPwd !== confirm) return showToast('Passwords do not match.', 'error');
    try {
        await API.put('/auth/change-password', { current_password: current, new_password: newPwd });
        showToast('Password changed successfully!', 'success');
        this.reset();
    } catch (err) { showToast(err.message, 'error'); }
});


document.getElementById('markAllReadBtn')?.addEventListener('click', async () => {
    try {
        await API.patch('/notifications/read-all');
        showToast('All notifications marked as read.', 'success');
        loadNotifCount();
        if (typeof loadNotifications === 'function') loadNotifications();
    } catch { }
});


let currentMsgParentId = null;
let currentMsgReceiverId = null;

async function loadInbox() {
    const inboxEl = document.getElementById('inboxList');
    if (!inboxEl) return;
    inboxEl.innerHTML = '<div class="flex-center p-4"><div class="spinner"></div></div>';
    try {
        const data = await API.get('/messages/inbox');
        const msgBadge = document.getElementById('msgBadge') || document.getElementById('msgBadgeSidebar');
        if (msgBadge) {
            msgBadge.textContent = data.unread_count;
            msgBadge.classList.toggle('hidden', data.unread_count === 0);
        }
        if (!data.messages.length) {
            inboxEl.innerHTML = '<div class="empty-state"><p>No messages yet.</p></div>';
            return;
        }
        const user = API.getUser();
        inboxEl.innerHTML = data.messages.map(m => {
            const isSent = m.sender_id === user.id;
            const displayName = isSent ? (m.receiver_name || 'Sent') : m.sender_name;
            const displayAvatar = isSent ? m.receiver_avatar : m.sender_avatar;
            const otherId = isSent ? m.receiver_id : m.sender_id;
            return `
            <div class="message-item ${!isSent && !m.is_read ? 'unread' : ''}" id="msg-${m.id}">
                <div class="message-avatar" onclick="openMessage(${m.id}, ${otherId}, '${(m.subject || 'No Subject').replace(/'/g, "\\'")}')">
                    ${displayAvatar ? `<img src="http://localhost:5000${displayAvatar}" alt="">` : avatarInitials(displayName)}
                </div>
                <div class="message-content" style="cursor:pointer;" onclick="openMessage(${m.id}, ${otherId}, '${(m.subject || 'No Subject').replace(/'/g, "\\'")}')">
                    <div class="message-sender">${displayName}${isSent ? ' <span class="text-xs text-muted">(sent)</span>' : ''}</div>
                    <div class="message-subject">${m.subject || '(No subject)'}</div>
                    <div class="message-preview">${m.body.substring(0, 80)}...</div>
                </div>
                <div class="message-meta">
                    <span class="message-time">${formatDate(m.created_at)}</span>
                    ${!isSent && !m.is_read ? '<span class="badge badge-primary" style="font-size:0.6rem;">New</span>' : ''}
                    <button class="btn-icon" onclick="deleteMessageItem(${m.id})" title="Delete" style="color:var(--gray-400);padding:0.25rem;margin-top:0.25rem;">
                        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                            <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                        </svg>
                    </button>
                </div>
            </div>`;
        }).join('');
    } catch (err) {
        inboxEl.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`;
    }
}

async function openMessage(msgId, senderId, subject) {
    const panel = document.getElementById('msgThreadPanel');
    const threadEl = document.getElementById('msgThread');
    const subjectEl = document.getElementById('threadSubject');
    if (!panel || !threadEl) return;

    currentMsgParentId = msgId;
    currentMsgReceiverId = senderId;
    subjectEl.textContent = subject;
    panel.style.display = '';
    threadEl.innerHTML = '<div class="flex-center p-4"><div class="spinner"></div></div>';

    try {
        const data = await API.get(`/messages/${msgId}`);
        const user = API.getUser();
        const msgs = [data.message, ...data.replies];
        threadEl.innerHTML = msgs.map(m => {
            const sent = m.sender_id === user.id;
            return `<div class="chat-bubble ${sent ? 'sent' : 'received'}">
                <div class="bubble-body">${m.body}</div>
                <div class="bubble-time">${formatDateTime(m.created_at)}</div>
            </div>`;
        }).join('');
        threadEl.scrollTop = threadEl.scrollHeight;
        loadInbox();
        loadNotifCount();
    } catch (err) { threadEl.innerHTML = `<p class="text-danger p-4">${err.message}</p>`; }
}

async function deleteMessageItem(id) {
    if (!confirm('Delete this message and its replies?')) return;
    try {
        await API.delete(`/messages/${id}`);
        const el = document.getElementById(`msg-${id}`);
        if (el) el.remove();
        const panel = document.getElementById('msgThreadPanel');
        if (panel && currentMsgParentId === id) panel.style.display = 'none';
        const inboxEl = document.getElementById('inboxList');
        if (inboxEl && !inboxEl.querySelector('.message-item')) {
            inboxEl.innerHTML = '<div class="empty-state"><p>No messages yet.</p></div>';
        }
        showToast('Message deleted.', 'success');
    } catch (err) { showToast(err.message, 'error'); }
}

document.getElementById('replyForm')?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const input = document.getElementById('replyInput');
    const body = input.value.trim();
    if (!body || !currentMsgReceiverId) return;
    try {
        await API.post('/messages', { receiver_id: currentMsgReceiverId, body, parent_id: currentMsgParentId });
        input.value = '';
        openMessage(currentMsgParentId, currentMsgReceiverId, document.getElementById('threadSubject').textContent);
    } catch (err) { showToast(err.message, 'error'); }
});


document.getElementById('composeForm')?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const alertEl = document.getElementById('composeAlert');
    const phone = document.getElementById('recipientPhone')?.value?.trim();
    const subject = document.getElementById('composeSubject')?.value;
    const body = document.getElementById('composeBody')?.value?.trim();
    if (!phone) return showToast('Landlord phone number is required.', 'error');
    if (!body) return showToast('Message body is required.', 'error');
    try {
        await API.post('/messages', { receiver_phone: phone, subject, body });
        showToast('Message sent!', 'success');
        closeModal('composeModal');
        this.reset();
        loadInbox();
    } catch (err) {
        alertEl.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
});


document.addEventListener('DOMContentLoaded', () => {
    initUserInfo();
    loadNotifCount();
    setInterval(loadNotifCount, 30000);
});


document.getElementById('confirmDeleteAccountBtn')?.addEventListener('click', async function () {
    const pwd = document.getElementById('deleteAccountPwd')?.value?.trim();
    const alertEl = document.getElementById('deleteAccountAlert');
    if (!pwd) {
        alertEl.innerHTML = '<div style="color:#000000;font-size:0.85rem;margin-top:0.25rem;">Password is required.</div>';
        return;
    }
    this.disabled = true;
    this.textContent = 'Deleting...';
    try {
        await API.request('DELETE', '/auth/account', { password: pwd });
        closeModal('deleteAccountModal');
        showToast('Your account has been deleted.', 'success');
        setTimeout(() => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '../index.html';
        }, 1500);
    } catch (err) {
        alertEl.innerHTML = `<div style="color:#000000;font-size:0.85rem;margin-top:0.25rem;">${err.message}</div>`;
        this.disabled = false;
        this.textContent = 'Delete My Account';
    }
});


document.querySelector('#deleteAccountModal .modal-close')?.addEventListener('click', () => {
    const pwd = document.getElementById('deleteAccountPwd');
    const alertEl = document.getElementById('deleteAccountAlert');
    if (pwd) pwd.value = '';
    if (alertEl) alertEl.innerHTML = '';
});
