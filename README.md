# Shilingi Gari: Driveline Motors Eldoret

Car yard system for Driveline Motors, Eldoret: stock with photos, buying price and costs per car, reservations and sales (cash, credit, bank), instalment schedules and arrears, logbook loans, logbook transfers, reports, yard expenses, staff roles and an activity log.

Live: https://driveline.shilingilabs.co.ke

By Shilingi Labs Tech Solutions.

## Stack

- PHP 8.1+ (PDO MySQL, GD, EXIF), MySQL / MariaDB
- Modular plain-JavaScript single-page app (`public/admin/js/`), Chart.js
- Runs on shared cPanel hosting

## Layout

```
app/            private: config, API routes, business logic (not web-accessible)
  api/routes.php
  lib/          auth, db, photos, car-yard rules (gari.php), schema upgrades
public/         document root
  admin/        authenticated staff application and feature modules
  api/          public API entry point (authentication enforced by routes)
  shared/       modular styles, images and third-party browser assets
  uploads/      uploaded car photos
  index.html    lightweight entry point to the admin application
  setup.php     one-time installation screen
sql/schema.sql
DEPLOY.md       step-by-step cPanel setup
```

## Not in this repository

- `app/config.php` (database password and setup key). Copy `app/config.sample.php` to make it.
- `app/seed/`: the client's spreadsheets and photos used for the first load. They contain buyers' names and phone numbers, so they are kept out of version control.
- `public/uploads/cars/`: car photos uploaded on the live site. Back them up from the server.

## Run locally

```
mysql -e "CREATE DATABASE gari CHARACTER SET utf8mb4"
cp app/config.sample.php app/config.php   # fill in the database details and a setup key
cd public && php -S 127.0.0.1:8090
```

Open http://127.0.0.1:8090/setup.php to create the owner account, then sign in at http://127.0.0.1:8090/.

## Deploying an update

Upload the changed files in `app/` and `public/` over the live ones. Never overwrite `app/config.php` or `public/uploads/`. Bump the `?v=` number for a changed browser file in `public/admin/index.html`.
# shillingi-labs
