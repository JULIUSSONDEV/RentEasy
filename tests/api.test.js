/**
 * RentEasy API Integration Tests
 */

const request = require('supertest');
const path = require('path');
const fs = require('fs');

// Use a test database
process.env.NODE_ENV = 'test';
const TEST_DB_DIR = path.join(__dirname, '../data/test');
if (!fs.existsSync(TEST_DB_DIR)) fs.mkdirSync(TEST_DB_DIR, { recursive: true });

// Override DB path before loading database module
const dbModule = require('../src/db/database');
const app = require('../src/app');

let landlordToken, tenantToken;
let landlordId, tenantId;
let propertyId, leaseId, paymentId, maintenanceId;

const LANDLORD = { name: 'Alice Landlord', email: 'alice@test.com', password: 'password123', role: 'landlord', phone: '555-1001' };
const TENANT   = { name: 'Bob Tenant',     email: 'bob@test.com',   password: 'password456', role: 'tenant',   phone: '555-2002' };

describe('Auth API', () => {
  it('should register a landlord', async () => {
    const res = await request(app).post('/api/auth/register').send(LANDLORD);
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('landlord');
    landlordToken = res.body.token;
    landlordId = res.body.user.id;
  });

  it('should register a tenant', async () => {
    const res = await request(app).post('/api/auth/register').send(TENANT);
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('tenant');
    tenantToken = res.body.token;
    tenantId = res.body.user.id;
  });

  it('should reject duplicate email', async () => {
    const res = await request(app).post('/api/auth/register').send(LANDLORD);
    expect(res.status).toBe(409);
  });

  it('should login with valid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: LANDLORD.email, password: LANDLORD.password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('should reject invalid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: LANDLORD.email, password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it('should require auth on protected routes', async () => {
    const res = await request(app).get('/api/properties');
    expect(res.status).toBe(401);
  });
});

describe('Properties API', () => {
  it('landlord can create a property', async () => {
    const res = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ name: 'Sunny Studio', address: '10 Main St', type: 'studio', rent_amount: 1200, bedrooms: 0, bathrooms: 1 });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Sunny Studio');
    expect(res.body.status).toBe('available');
    propertyId = res.body.id;
  });

  it('landlord can list their properties', async () => {
    const res = await request(app)
      .get('/api/properties')
      .set('Authorization', `Bearer ${landlordToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('tenant can list available properties', async () => {
    const res = await request(app)
      .get('/api/properties')
      .set('Authorization', `Bearer ${tenantToken}`);
    expect(res.status).toBe(200);
  });

  it('tenant cannot create a property', async () => {
    const res = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ name: 'Test', address: 'Addr', type: 'apartment', rent_amount: 500 });
    expect(res.status).toBe(403);
  });

  it('landlord can update a property', async () => {
    const res = await request(app)
      .put(`/api/properties/${propertyId}`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ description: 'Great studio downtown' });
    expect(res.status).toBe(200);
    expect(res.body.description).toBe('Great studio downtown');
  });
});

describe('Leases API', () => {
  it('landlord can create a lease', async () => {
    const res = await request(app)
      .post('/api/leases')
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({
        property_id: propertyId,
        tenant_id: tenantId,
        start_date: '2025-01-01',
        end_date: '2025-12-31',
        monthly_rent: 1200,
        deposit: 2400,
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('active');
    leaseId = res.body.id;
  });

  it('property should now be occupied', async () => {
    const res = await request(app)
      .get(`/api/properties/${propertyId}`)
      .set('Authorization', `Bearer ${landlordToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('occupied');
  });

  it('cannot create duplicate active lease for same property', async () => {
    const res = await request(app)
      .post('/api/leases')
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({
        property_id: propertyId,
        tenant_id: tenantId,
        start_date: '2025-02-01',
        end_date: '2025-12-31',
        monthly_rent: 1200,
        deposit: 0,
      });
    expect(res.status).toBe(409);
  });

  it('landlord can list leases', async () => {
    const res = await request(app)
      .get('/api/leases')
      .set('Authorization', `Bearer ${landlordToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('tenant can see their own lease', async () => {
    const res = await request(app)
      .get('/api/leases')
      .set('Authorization', `Bearer ${tenantToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });
});

describe('Payments API', () => {
  it('landlord can create a payment record', async () => {
    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ lease_id: leaseId, amount: 1200, due_date: '2025-02-01' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
    paymentId = res.body.id;
  });

  it('landlord can mark payment as paid', async () => {
    const res = await request(app)
      .put(`/api/payments/${paymentId}`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ status: 'paid', payment_method: 'Bank Transfer' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('paid');
    expect(res.body.payment_method).toBe('Bank Transfer');
  });

  it('tenant can view their payments', async () => {
    const res = await request(app)
      .get('/api/payments')
      .set('Authorization', `Bearer ${tenantToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });
});

describe('Maintenance API', () => {
  it('tenant can submit a maintenance request', async () => {
    const res = await request(app)
      .post('/api/maintenance')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({
        property_id: propertyId,
        title: 'Broken AC',
        description: 'The air conditioning unit stopped working.',
        priority: 'high',
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('open');
    maintenanceId = res.body.id;
  });

  it('tenant cannot submit maintenance for a property without active lease', async () => {
    // Create another property not leased to this tenant
    const propRes = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ name: 'Other Unit', address: '99 Other St', type: 'apartment', rent_amount: 2000 });

    const res = await request(app)
      .post('/api/maintenance')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({
        property_id: propRes.body.id,
        title: 'Issue',
        description: 'Some issue',
      });
    expect(res.status).toBe(403);
  });

  it('landlord can view maintenance requests', async () => {
    const res = await request(app)
      .get('/api/maintenance')
      .set('Authorization', `Bearer ${landlordToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('landlord can update maintenance request', async () => {
    const res = await request(app)
      .put(`/api/maintenance/${maintenanceId}`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ status: 'resolved', resolution_notes: 'Replaced AC unit' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('resolved');
    expect(res.body.resolution_notes).toBe('Replaced AC unit');
  });
});

describe('Tenants API', () => {
  it('landlord can search tenant by email', async () => {
    const res = await request(app)
      .get(`/api/tenants/search/by-email?email=${TENANT.email}`)
      .set('Authorization', `Bearer ${landlordToken}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(TENANT.email);
  });

  it('landlord can list tenants', async () => {
    const res = await request(app)
      .get('/api/tenants')
      .set('Authorization', `Bearer ${landlordToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('tenant cannot access tenant list', async () => {
    const res = await request(app)
      .get('/api/tenants')
      .set('Authorization', `Bearer ${tenantToken}`);
    expect(res.status).toBe(403);
  });
});

describe('Dashboard API', () => {
  it('landlord gets dashboard stats', async () => {
    const res = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${landlordToken}`);
    expect(res.status).toBe(200);
    expect(res.body.totalProperties).toBeDefined();
    expect(res.body.activeLeases).toBeDefined();
    expect(res.body.recentPayments).toBeDefined();
  });

  it('tenant gets dashboard with lease info', async () => {
    const res = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${tenantToken}`);
    expect(res.status).toBe(200);
    expect(res.body.activeLeases).toBeDefined();
    expect(res.body.pendingPayments).toBeDefined();
  });
});

describe('Health Check', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

afterAll(() => {
  dbModule.close();
  // Clean up test DB
  try {
    const testDbPath = path.join(__dirname, '../data/renteasy.db');
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  } catch {}
});
