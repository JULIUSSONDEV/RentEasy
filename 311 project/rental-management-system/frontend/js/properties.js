

let currentPage = 1;

async function loadProperties(page = 1) {
    const container = document.getElementById('propertiesContainer');
    const countEl = document.getElementById('resultCount');
    container.innerHTML = `<div class="flex-center" style="padding:4rem;"><div class="spinner" style="width:2.5rem;height:2.5rem;border-width:3px;"></div></div>`;

    const params = new URLSearchParams(window.location.search);
    const search = document.getElementById('searchInput')?.value || params.get('search') || '';
    const city = document.getElementById('cityInput')?.value || params.get('city') || '';
    const type = document.getElementById('typeSelect')?.value || params.get('type') || '';
    const bedrooms = document.getElementById('bedroomsSelect')?.value || params.get('bedrooms') || '';
    const minRent = document.getElementById('minRent')?.value || params.get('min_rent') || '';
    const maxRent = document.getElementById('maxRent')?.value || params.get('max_rent') || '';

    const availableOnly = document.getElementById('availableOnly');
    const isAvailable = availableOnly ? availableOnly.checked : true;

    const qs = new URLSearchParams();
    if (search) qs.set('search', search);
    if (city) qs.set('city', city);
    if (type) qs.set('type', type);
    if (bedrooms) qs.set('bedrooms', bedrooms);
    if (minRent) qs.set('min_rent', minRent);
    if (maxRent) qs.set('max_rent', maxRent);
    if (isAvailable) qs.set('is_available', 1);
    qs.set('page', page);
    qs.set('limit', 9);

    try {
        const data = await API.get(`/properties?${qs.toString()}`);
        currentPage = data.page;
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
            document.getElementById('paginationContainer').innerHTML = '';
            return;
        }

        container.innerHTML = `<div class="property-grid">${data.properties.map(p => buildPropertyCard(p)).join('')}</div>`;
        renderPagination(data.page, data.pages);
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><p>Error: ${err.message}</p></div>`;
    }
}

function renderPagination(current, total) {
    const el = document.getElementById('paginationContainer');
    if (!el || total <= 1) { el.innerHTML = ''; return; }
    let html = `<button class="page-btn" onclick="loadProperties(${current - 1})" ${current === 1 ? 'disabled' : ''}>&#8592; Prev</button>`;
    for (let i = 1; i <= total; i++) {
        if (i === 1 || i === total || Math.abs(i - current) <= 2) {
            html += `<button class="page-btn ${i === current ? 'active' : ''}" onclick="loadProperties(${i})">${i}</button>`;
        } else if (Math.abs(i - current) === 3) {
            html += `<span class="page-btn" style="pointer-events:none;border:none;">...</span>`;
        }
    }
    html += `<button class="page-btn" onclick="loadProperties(${current + 1})" ${current === total ? 'disabled' : ''}>Next &#8594;</button>`;
    el.innerHTML = html;
}


document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('search')) document.getElementById('searchInput').value = params.get('search');
    if (params.get('city')) document.getElementById('cityInput').value = params.get('city');
    if (params.get('type')) document.getElementById('typeSelect').value = params.get('type');
    if (params.get('bedrooms')) document.getElementById('bedroomsSelect').value = params.get('bedrooms');
    if (params.get('min_rent')) document.getElementById('minRent').value = params.get('min_rent');
    if (params.get('max_rent')) document.getElementById('maxRent').value = params.get('max_rent');
    const availableOnly = document.getElementById('availableOnly');
    if (availableOnly && params.has('is_available')) {
        availableOnly.checked = params.get('is_available') === '1';
    }
    loadProperties(1);
});

document.getElementById('filterForm')?.addEventListener('submit', e => { e.preventDefault(); loadProperties(1); });
document.getElementById('clearBtn')?.addEventListener('click', () => {
    document.getElementById('filterForm').reset();
    const availableOnly = document.getElementById('availableOnly');
    if (availableOnly) availableOnly.checked = true;
    window.history.replaceState({}, '', window.location.pathname);
    loadProperties(1);
});
