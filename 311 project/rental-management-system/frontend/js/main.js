


document.getElementById('navToggle')?.addEventListener('click', () => {
    document.getElementById('navMobile').classList.toggle('open');
});


(function () {
    const user = API.getUser();
    const actionsEl = document.getElementById('navActions');
    if (!actionsEl) return;
    if (user) {
        const dashLink = user.role === 'admin' ? 'pages/admin-dashboard.html'
            : user.role === 'landlord' ? 'pages/landlord-dashboard.html'
                : 'pages/tenant-dashboard.html';
        actionsEl.innerHTML = `<a href="${dashLink}" class="btn btn-primary btn-sm">Dashboard</a>`;
    }
})();


async function loadFeaturedProperties() {
    const container = document.getElementById('featuredProperties');
    if (!container) return;
    try {
        const data = await API.get('/properties?limit=6');
        if (!data.properties.length) {
            container.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><p>No properties available yet.</p></div>';
            return;
        }
        container.innerHTML = data.properties.map(p => buildPropertyCard(p)).join('');
    } catch (err) {
        container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><p>Could not load properties: ${err.message}</p></div>`;
    }
}


document.getElementById('searchForm')?.addEventListener('submit', function (e) {
    e.preventDefault();
    const params = new URLSearchParams(new FormData(this)).toString();
    window.location.href = `pages/properties.html?${params}`;
});

document.addEventListener('DOMContentLoaded', () => {
    loadFeaturedProperties();
    loadStats();
});


const _statsCurrent = { statProps: 0, statTenants: 0, statLandlords: 0, statCities: 0 };

function animateCount(el, from, to) {
    if (from === to) return;
    const duration = 800;
    const start = performance.now();
    function step(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); 
        el.textContent = Math.round(from + (to - from) * eased).toLocaleString() + '+';
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

async function loadStats() {
    try {
        const data = await API.get('/stats');
        const map = {
            statProps:     data.properties || 0,
            statTenants:   data.tenants    || 0,
            statLandlords: data.landlords  || 0,
            statCities:    data.cities     || 0
        };
        Object.entries(map).forEach(([id, newVal]) => {
            const el = document.getElementById(id);
            if (!el) return;
            const oldVal = _statsCurrent[id];
            if (newVal !== oldVal) {
                animateCount(el, oldVal, newVal);
                _statsCurrent[id] = newVal;
            }
        });
    } catch {
        
    }
}


setInterval(loadStats, 30000);
