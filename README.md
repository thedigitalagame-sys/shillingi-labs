# Shilingi Gari

Shilingi Gari is the internal vehicle-yard management system used by Driveline Motors in
Eldoret. It brings vehicle inventory, sales, customer credit, logbooks, expenses, staff access,
and operational reporting into one application.

Production: [driveline.shilingilabs.co.ke](https://driveline.shilingilabs.co.ke)

Built by Shilingi Labs Tech Solutions.

## Features

- Vehicle inventory with specifications, photos, inspection details, and preparation status
- Buying price, asking price, minimum price, vehicle costs, and profit tracking
- Reservations, deposits, trade-ins, and cash, credit, or bank-financed sales
- Credit schedules, instalment payments, balances, and arrears
- Vehicle logbook status, document storage, history, and buyer-transfer tracking
- Logbook-backed loans with interest, repayments, due dates, and closure status
- Yard expenses, sales reports, collection reports, and CSV exports
- Owner, manager, and sales staff access levels
- Activity logging and reversible transaction cancellation
- Duplicate M-Pesa reference protection

## Roles

| Capability                                | Owner | Manager | Sales |
| ----------------------------------------- | :---: | :-----: | :---: |
| View stock and add photos                 |  Yes  |   Yes   |  Yes  |
| Reserve and sell vehicles                 |  Yes  |   Yes   |  Yes  |
| Record instalment payments                |  Yes  |   Yes   |  Yes  |
| View buying prices and profit             |  Yes  |   Yes   |  No   |
| Manage vehicles, costs, and logbook loans |  Yes  |   Yes   |  No   |
| View reports and manage expenses          |  Yes  |   Yes   |  No   |
| Manage staff, settings, and cancellations |  Yes  |   No    |  No   |

## Technology

- PHP 8.1 or newer
- MySQL 5.7+ or MariaDB 10.3+
- PDO MySQL, GD, EXIF, and mbstring PHP extensions
- Browser-native JavaScript with no frontend framework or build step
- Custom modular CSS
- Chart.js for reports
- Apache-compatible shared hosting, including cPanel

## Project structure

```text
app/
├── api/
│   └── routes.php          API route handlers
├── lib/
│   ├── auth.php            sessions, authentication, and authorization
│   ├── db.php              PDO and database helpers
│   ├── gari.php            car-yard business rules and state assembly
│   ├── migrate.php         incremental schema migrations
│   ├── photos.php          image validation, resizing, and storage
│   └── util.php            validation and shared utilities
├── bootstrap.php           application initialization
└── config.sample.php       configuration template

public/                     web server document root
├── admin/
│   ├── index.html          authenticated application entry point
│   └── js/
│       ├── core/           API, state, layout, modal, and shared helpers
│       ├── features/       inventory, sales, loans, reports, and admin screens
│       └── bootstrap.js    frontend startup
├── api/
│   └── index.php           HTTP API entry point
├── shared/
│   ├── assets/             images and bundled Chart.js
│   └── css/                modular application styles
├── uploads/                uploaded vehicle photos
├── index.html              redirects to the admin application
└── setup.php               one-time installation screen

sql/
└── schema.sql              initial database schema

DEPLOY.md                   production and cPanel deployment guide
```

## Local setup

### 1. Create the database

```bash
mysql -e "CREATE DATABASE gari CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
```

### 2. Create the configuration file

```bash
cp app/config.sample.php app/config.php
```

Update `app/config.php` with the local database credentials, application URL, timezone, and a
random setup key of at least 20 characters. The configuration file contains secrets and must not
be committed.

### 3. Start the local server

```bash
cd public
php -S 127.0.0.1:8090
```

### 4. Create the owner account

Open [http://127.0.0.1:8090/setup.php](http://127.0.0.1:8090/setup.php), enter the setup key, and
create the initial owner account.

After setup, open [http://127.0.0.1:8090/admin/](http://127.0.0.1:8090/admin/) to sign in.

Delete or disable `public/setup.php` after completing a production installation.

## Frontend organization

The application intentionally avoids a build tool so it can run on ordinary shared hosting.
JavaScript files are loaded in dependency order by `public/admin/index.html`.

CSS is loaded through `public/shared/css/index.css`, which imports base, layout, component,
feature, responsive, and Driveline theme styles in cascade order.

See the frontend-specific notes in:

- `public/admin/js/README.md`
- `public/shared/css/README.md`

## Formatting

The repository uses Prettier with the settings in `.prettierrc.json`. The bundled Chart.js file
and runtime uploads are excluded through `.prettierignore`.

Format the first-party CSS and JavaScript with:

```bash
npx prettier --write "public/admin/js/**/*.js" "public/shared/css/**/*.css"
```

PHP formatting requires `@prettier/plugin-php`.

## Security and data handling

- Passwords are stored using PHP's password-hashing API.
- API mutations require CSRF tokens and role authorization.
- Login attempts are rate-limited.
- Sessions use strict, HTTP-only, same-site cookies.
- Uploaded images are validated, resized, and re-encoded to remove embedded metadata.
- Logbook scans are stored outside the public document root.
- Financial changes and important staff actions are written to the activity log.
- Deletions and cancellations use soft-delete or void records where appropriate.

The following production data is intentionally excluded from version control:

- `app/config.php`
- Client import spreadsheets and seed photos under `app/seed/`
- Uploaded vehicle photos under `public/uploads/cars/`
- Private logbook documents and session files under `app/storage/`

## Deployment and backups

Use [DEPLOY.md](DEPLOY.md) for the complete cPanel installation and update procedure.

When deploying updates:

- Preserve `app/config.php`.
- Preserve `public/uploads/`.
- Delete or disable `public/setup.php` after installation.
- Increase the relevant `?v=` value in `public/admin/index.html` when browser assets change.

Back up both the database and uploaded/private files regularly. A database-only backup is not
enough because vehicle photos and logbook documents are stored on disk.
