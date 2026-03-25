# RentEasy - Rental Management System

A full-stack rental management web application built with Node.js, Express, MySQL, and vanilla HTML/CSS/JS. Supports three user roles: **Admin**, **Landlord**, and **Tenant**.

---

## Features

- **Tenant**: Browse and filter properties, request bookings, submit M-Pesa payments, view receipts, leave reviews, message landlords
- **Landlord**: List and manage properties with image uploads, approve/reject booking requests, track income, message tenants
- **Admin**: Manage all users, properties, payments (verify/fail), resolve disputes, generate reports

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- [MySQL](https://www.mysql.com/) v8.0 or higher
- npm (ships with Node.js)
- A code editor with Live Server support (e.g. VS Code + Live Server extension) **or** any static file server

---

## Project Structure

```
rental-management-system/
├── backend/
│   ├── config/          # Database & JWT config
│   ├── controllers/     # Route handler logic
│   ├── middleware/      # Auth, upload, validation
│   ├── routes/          # Express routers
│   ├── uploads/         # Uploaded files (auto-created)
│   ├── .env.example     # Environment variable template
│   ├── package.json
│   └── server.js
├── database/
│   ├── schema.sql       # Full database schema
│   └── seed.sql         # Sample data
└── frontend/
    ├── css/
    │   └── style.css
    ├── js/
    │   ├── api.js
    │   ├── admin.js
    │   ├── dashboard.js
    │   ├── landlord.js
    │   ├── main.js
    │   ├── properties.js
    │   ├── property-detail.js
    │   └── tenant.js
    ├── pages/
    │   ├── admin-dashboard.html
    │   ├── landlord-dashboard.html
    │   ├── tenant-dashboard.html
    │   ├── login.html
    │   ├── register.html
    │   ├── properties.html
    │   └── property-detail.html
    └── index.html
```

---

## Setup Instructions

### 1. Database Setup

Open your MySQL client (MySQL Workbench, DBeaver, or the CLI) and run:

```sql
-- Create the database
CREATE DATABASE renteasy;
USE renteasy;

-- Run schema
SOURCE /path/to/rental-management-system/database/schema.sql;

-- Load seed data
SOURCE /path/to/rental-management-system/database/seed.sql;
```

Or using the MySQL CLI directly:

```bash
mysql -u root -p renteasy < database/schema.sql
mysql -u root -p renteasy < database/seed.sql
```

> **Note:** The seed data contains a known issue — one payment record uses `'mpesa'` as the payment method. If you hit an ENUM error, edit `seed.sql` and change that value to `'send_money'` before importing.

---

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy the environment file
cp .env.example .env
```

Edit `.env` with your configuration:

```env
PORT=5000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=renteasy

# JWT
JWT_SECRET=your_super_secret_key_change_this_in_production
JWT_EXPIRES_IN=7d

# Frontend URL (for CORS)
FRONTEND_URL=http://127.0.0.1:5500

# File uploads
MAX_FILE_SIZE_MB=5
UPLOAD_PATH=uploads

# Email (optional — for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password
```

Start the backend server:

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

The API will be available at `http://localhost:5000`.

You should see:

```
Server running on port 5000
Database connected successfully
```

---

### 3. Frontend Setup

The frontend is static HTML and can be opened in two ways:

**Option A — VS Code Live Server (recommended)**

1. Open the `frontend/` folder in VS Code
2. Right-click `index.html` and choose **Open with Live Server**
3. The site opens at `http://127.0.0.1:5500`

> Make sure `FRONTEND_URL=http://127.0.0.1:5500` is set in your `.env` to allow CORS.

**Option B — Any static file server**

```bash
# Using npx serve
npx serve frontend/

# Using Python
python -m http.server 5500 --directory frontend/
```

---

## Demo Credentials

All accounts use the password: `Admin@123`

| Role     | Email                   |
|----------|-------------------------|
| Admin    | admin@renteasy.com      |
| Landlord | james.kamau@email.com   |
| Landlord | mary.wanjiku@email.com  |
| Tenant   | peter.otieno@email.com  |
| Tenant   | grace.muthoni@email.com |
| Tenant   | john.kimani@email.com   |

---

## API Endpoints Overview

| Method | Endpoint                         | Description                        | Access       |
|--------|----------------------------------|------------------------------------|--------------|
| POST   | /api/auth/register               | Register new user                  | Public       |
| POST   | /api/auth/login                  | Login and receive JWT              | Public       |
| GET    | /api/auth/profile                | Get current user profile           | Auth         |
| PUT    | /api/auth/profile                | Update profile / upload picture    | Auth         |
| GET    | /api/properties                  | List properties (with filters)     | Public       |
| GET    | /api/properties/:id              | Get property details               | Public       |
| POST   | /api/properties                  | Create property                    | Landlord     |
| PUT    | /api/properties/:id              | Update property                    | Landlord     |
| DELETE | /api/properties/:id              | Delete property                    | Landlord/Admin |
| POST   | /api/bookings                    | Request booking                    | Tenant       |
| GET    | /api/bookings/my                 | Tenant's bookings                  | Tenant       |
| GET    | /api/bookings/landlord           | Landlord's incoming bookings       | Landlord     |
| PATCH  | /api/bookings/:id/status         | Approve / reject / complete        | Landlord     |
| PATCH  | /api/bookings/:id/cancel         | Cancel pending booking             | Tenant       |
| POST   | /api/payments                    | Submit payment                     | Tenant       |
| GET    | /api/payments/my                 | Tenant's payment history           | Tenant       |
| GET    | /api/payments/landlord           | Landlord's income history          | Landlord     |
| PATCH  | /api/payments/:id/verify         | Verify or fail a payment           | Admin        |
| GET    | /api/payments/:id/receipt        | View payment receipt               | Auth         |
| POST   | /api/messages                    | Send a message                     | Auth         |
| GET    | /api/messages/inbox              | Get inbox threads                  | Auth         |
| GET    | /api/messages/unread-count       | Unread message count               | Auth         |
| POST   | /api/reviews                     | Submit property review             | Tenant       |
| GET    | /api/admin/dashboard             | Admin dashboard stats              | Admin        |
| GET    | /api/admin/users                 | All users (paginated, filtered)    | Admin        |
| PATCH  | /api/admin/users/:id             | Activate/deactivate/change role    | Admin        |
| DELETE | /api/admin/users/:id             | Delete user                        | Admin        |
| GET    | /api/admin/payments              | All payments (paginated)           | Admin        |
| GET    | /api/admin/reports               | Income/booking/growth reports      | Admin        |
| GET    | /api/admin/disputes              | All disputes                       | Admin        |
| PATCH  | /api/admin/disputes/:id          | Resolve/dismiss dispute            | Admin        |
| GET    | /api/notifications               | user notifications                 | Auth         |
| PATCH  | /api/notifications/:id/read      | Mark notification read             | Auth         |

---

## Payment Methods

The system supports the following M-Pesa and cash payment methods:

| Method       | Description                        |
|--------------|------------------------------------|
| `send_money` | M-Pesa Send Money (phone-to-phone) |
| `till_number`| M-Pesa Buy Goods (Till)            |
| `paybill`    | M-Pesa Paybill                     |
| `cash`       | Cash payment                       |
| `other`      | Other method                       |

Payments are manually recorded by the tenant with a transaction reference number. An admin then verifies or marks them as failed.

---

## Security Notes

- Passwords are hashed with **bcryptjs** (12 salt rounds)
- All protected routes require a **JWT Bearer token** in the `Authorization` header
- File uploads are restricted to JPEG, JPG, PNG, WEBP and capped at `MAX_FILE_SIZE_MB`
- Auth routes are rate-limited to **15 requests per 15 minutes**
- Global rate limit: **200 requests per 15 minutes**
- Input is validated server-side using **express-validator**
- Security headers are set via **helmet**

---

## Troubleshooting

**`CORS error` in browser console**
- Confirm `FRONTEND_URL` in `.env` exactly matches your frontend origin (e.g. `http://127.0.0.1:5500`)
- Restart the backend after editing `.env`

**`Database connected` not shown on startup**
- Verify MySQL is running and the credentials in `.env` are correct
- Ensure the `renteasy` database exists and the schema has been imported

**Images not loading**
- Uploaded files are served from `http://localhost:5000/uploads/`
- Make sure the backend is running when viewing the frontend

**Login redirect loop**
- Clear `localStorage` in the browser dev tools (`Application > Local Storage > Clear All`)
