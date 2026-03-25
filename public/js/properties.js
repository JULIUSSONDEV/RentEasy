// properties.js

async function loadProperties() {
  const user = getCurrentUser();
  const page = document.getElementById('page-properties');

  try {
    const properties = await api.get('/properties');

    const addBtn = user.role === 'landlord'
      ? `<button class="btn btn-primary" onclick="showAddPropertyModal()">+ Add Property</button>`
      : '';

    const rows = properties.map(p => `
      <tr>
        <td><strong>${p.name}</strong></td>
        <td>${p.address}</td>
        <td>${p.type}</td>
        <td>${p.bedrooms} bed / ${p.bathrooms} bath</td>
        <td>${formatCurrency(p.rent_amount)}/mo</td>
        <td>${badge(p.status)}</td>
        <td>
          <div class="flex gap-2">
            <button class="btn btn-secondary btn-sm" onclick="viewProperty(${p.id})">View</button>
            ${user.role === 'landlord' ? `
              <button class="btn btn-primary btn-sm" onclick="showEditPropertyModal(${p.id})">Edit</button>
              <button class="btn btn-danger btn-sm" onclick="deleteProperty(${p.id})">Delete</button>
            ` : ''}
          </div>
        </td>
      </tr>`).join('');

    page.innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">Properties</h2>
          <div class="page-subtitle">${properties.length} propert${properties.length === 1 ? 'y' : 'ies'} found</div>
        </div>
        ${addBtn}
      </div>

      <div class="card">
        <div class="card-body">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Address</th><th>Type</th><th>Size</th><th>Rent</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${rows || `<tr><td colspan="7" class="table-empty">No properties found. ${user.role === 'landlord' ? 'Add your first property!' : ''}</td></tr>`}
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

async function viewProperty(id) {
  try {
    const p = await api.get(`/properties/${id}`);
    openModal('Property Details', `
      <div class="detail-grid">
        <div class="detail-item"><div class="detail-label">Name</div><div class="detail-value">${p.name}</div></div>
        <div class="detail-item"><div class="detail-label">Type</div><div class="detail-value">${p.type}</div></div>
        <div class="detail-item"><div class="detail-label">Address</div><div class="detail-value">${p.address}</div></div>
        <div class="detail-item"><div class="detail-label">Status</div><div class="detail-value">${badge(p.status)}</div></div>
        <div class="detail-item"><div class="detail-label">Bedrooms</div><div class="detail-value">${p.bedrooms}</div></div>
        <div class="detail-item"><div class="detail-label">Bathrooms</div><div class="detail-value">${p.bathrooms}</div></div>
        <div class="detail-item"><div class="detail-label">Monthly Rent</div><div class="detail-value">${formatCurrency(p.rent_amount)}</div></div>
        <div class="detail-item"><div class="detail-label">Added</div><div class="detail-value">${formatDate(p.created_at)}</div></div>
      </div>
      ${p.description ? `<div class="mt-4"><div class="detail-label">Description</div><p style="margin-top:4px">${p.description}</p></div>` : ''}
    `);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function showAddPropertyModal() {
  openModal('Add New Property', `
    <form onsubmit="submitAddProperty(event)">
      <div class="form-group">
        <label>Property Name *</label>
        <input type="text" id="prop-name" placeholder="e.g. Sunset Apartments Unit 3" required />
      </div>
      <div class="form-group">
        <label>Address *</label>
        <input type="text" id="prop-address" placeholder="123 Main St, City, State" required />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Type *</label>
          <select id="prop-type" required>
            <option value="">Select type</option>
            <option value="apartment">Apartment</option>
            <option value="house">House</option>
            <option value="condo">Condo</option>
            <option value="townhouse">Townhouse</option>
            <option value="studio">Studio</option>
            <option value="commercial">Commercial</option>
          </select>
        </div>
        <div class="form-group">
          <label>Monthly Rent ($) *</label>
          <input type="number" id="prop-rent" placeholder="1500" min="0" step="0.01" required />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Bedrooms</label>
          <input type="number" id="prop-bed" value="1" min="0" />
        </div>
        <div class="form-group">
          <label>Bathrooms</label>
          <input type="number" id="prop-bath" value="1" min="0" />
        </div>
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea id="prop-desc" placeholder="Optional description..."></textarea>
      </div>
      <div id="prop-error" class="alert alert-error hidden"></div>
      <div class="flex gap-2" style="justify-content:flex-end;margin-top:8px">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Add Property</button>
      </div>
    </form>
  `);
}

async function submitAddProperty(e) {
  e.preventDefault();
  const errEl = document.getElementById('prop-error');
  errEl.classList.add('hidden');
  try {
    await api.post('/properties', {
      name: document.getElementById('prop-name').value,
      address: document.getElementById('prop-address').value,
      type: document.getElementById('prop-type').value,
      rent_amount: parseFloat(document.getElementById('prop-rent').value),
      bedrooms: parseInt(document.getElementById('prop-bed').value),
      bathrooms: parseInt(document.getElementById('prop-bath').value),
      description: document.getElementById('prop-desc').value,
    });
    closeModal();
    showToast('Property added successfully!', 'success');
    loadProperties();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

async function showEditPropertyModal(id) {
  try {
    const p = await api.get(`/properties/${id}`);
    openModal('Edit Property', `
      <form onsubmit="submitEditProperty(event, ${id})">
        <div class="form-group">
          <label>Property Name</label>
          <input type="text" id="eprop-name" value="${p.name}" required />
        </div>
        <div class="form-group">
          <label>Address</label>
          <input type="text" id="eprop-address" value="${p.address}" required />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Type</label>
            <select id="eprop-type">
              ${['apartment','house','condo','townhouse','studio','commercial'].map(t =>
                `<option value="${t}" ${p.type === t ? 'selected' : ''}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Monthly Rent ($)</label>
            <input type="number" id="eprop-rent" value="${p.rent_amount}" min="0" step="0.01" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Bedrooms</label>
            <input type="number" id="eprop-bed" value="${p.bedrooms}" min="0" />
          </div>
          <div class="form-group">
            <label>Bathrooms</label>
            <input type="number" id="eprop-bath" value="${p.bathrooms}" min="0" />
          </div>
        </div>
        <div class="form-group">
          <label>Status</label>
          <select id="eprop-status">
            ${['available','occupied','maintenance'].map(s =>
              `<option value="${s}" ${p.status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea id="eprop-desc">${p.description || ''}</textarea>
        </div>
        <div id="eprop-error" class="alert alert-error hidden"></div>
        <div class="flex gap-2" style="justify-content:flex-end;margin-top:8px">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Changes</button>
        </div>
      </form>
    `);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function submitEditProperty(e, id) {
  e.preventDefault();
  const errEl = document.getElementById('eprop-error');
  errEl.classList.add('hidden');
  try {
    await api.put(`/properties/${id}`, {
      name: document.getElementById('eprop-name').value,
      address: document.getElementById('eprop-address').value,
      type: document.getElementById('eprop-type').value,
      rent_amount: parseFloat(document.getElementById('eprop-rent').value),
      bedrooms: parseInt(document.getElementById('eprop-bed').value),
      bathrooms: parseInt(document.getElementById('eprop-bath').value),
      status: document.getElementById('eprop-status').value,
      description: document.getElementById('eprop-desc').value,
    });
    closeModal();
    showToast('Property updated!', 'success');
    loadProperties();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

async function deleteProperty(id) {
  if (!confirm('Are you sure you want to delete this property? This cannot be undone.')) return;
  try {
    await api.delete(`/properties/${id}`);
    showToast('Property deleted', 'info');
    loadProperties();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
