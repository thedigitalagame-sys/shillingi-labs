# Shilingi Gari for Driveline Motors, Eldoret: going live

This is the live version of the Shilingi Gari demo: a real server database, sign-ins for staff and photos stored on the server. On first setup it loads Driveline Motors from the two files sent in:

- **Car Details - Driveline.xlsx**: 66 cars (23 in the yard, 43 sold), with asking prices, the checklist (wheel check, spanner, spare wheel, battery, radio) and logbook status.
- **Loan Details**: 12 credit sales (buyer, phone, amount, months, balance) and 12 logbook loans.
- **Car Pics**: 81 photos for 7 cars, resized, with location data stripped. The cover photo for each car was picked by hand.

## What the system does

| | Owner | Manager | Sales |
|---|---|---|---|
| Stock with photos, checklist, asking and lowest price | ✓ | ✓ | ✓ (no buying price or profit) |
| Add photos | ✓ | ✓ | ✓ |
| Add or edit cars, buying price, repair costs, profit per car | ✓ | ✓ | |
| Reserve with a deposit, sell (cash, credit, bank), trade-ins, sale agreement | ✓ | ✓ | ✓ (not below the lowest price) |
| Instalments: schedule, arrears, record payments | ✓ | ✓ | ✓ |
| Logbook transfer steps (held until a credit sale is fully paid) | ✓ | ✓ | ✓ |
| Logbook loans: lend, interest, repayments, due dates | ✓ | ✓ | |
| Reports, yard expenses, CSV exports | ✓ | ✓ | |
| Staff accounts, settings, activity log, cancel sales or payments | ✓ | | |

Every change is recorded in the activity log. M-Pesa codes can't be entered twice.

## 1. Folder layout

```
driveline-gari/          ← upload to your home directory, e.g. /home3/njiasmar/driveline-gari
  app/                   ← private: config, code and the Driveline data (NOT web-accessible)
  public/                ← the subdomain's document root (photos go in public/uploads/)
  sql/schema.sql
```

## 2. Database (cPanel → MySQL® Database Wizard)

1. Create a database, e.g. `njiasmar_gari`.
2. Create a user, e.g. `njiasmar_gari`, with a strong password.
3. Give that user **ALL PRIVILEGES** on the database.

## 3. Upload and configure

1. Upload `driveline-gari.zip` to your home directory (**not** `public_html`) and **Extract** it. You get a folder called `driveline-gari`.
2. In `driveline-gari/app/`, copy `config.sample.php` to `config.php` and fill in:
   - the database name, user and password from step 2;
   - `app_url`: `https://driveline.shilingilabs.co.ke` (already set);
   - `setup_key`: 20 or more random characters (you type it once on the setup page).
3. cPanel → **Select PHP Version**: **8.2** (8.1 or newer). Under Extensions tick `pdo_mysql`, `mbstring`, **`gd`** (needed for photos) and `exif` (turns phone photos the right way up).

## 4. Subdomain

cPanel → **Domains → Create A New Domain**:
- Domain: `driveline.shilingilabs.co.ke`
- Untick **Share document root**
- Document Root: `driveline-gari/public`

Then **SSL/TLS Status → Run AutoSSL**. The system forces HTTPS.

## 5. First-time setup (loads Driveline Motors)

1. Open `https://driveline.shilingilabs.co.ke/setup.php`.
2. Enter the setup key, then the business name (pre-filled "Driveline Motors"), location, phone, and the owner's name, email and password.
3. Leave **Load Driveline Motors** ticked and click **Create owner account**. Loading the photos takes up to a minute. It confirms *66 cars (23 in stock), 81 photos, 43 past sales and 12 logbook loans* and lists the points to check (below).
4. **Delete `public/setup.php`** in File Manager. You can also delete `app/seed/`.
5. Sign in. Under **Staff**, add the manager and sales people with a first password each.
6. Under **Settings**, set the default credit interest (% a month), the minimum deposit and how many days a reservation is held. These start at 0%, 30% and 7 days.

## 6. Points to check from the spreadsheets

These were found while loading. They are also listed under **Activity**.

- **Balances left blank** on Loan Details show as **Unconfirmed**: 6 credit sales and 6 logbook loans. Open each one, click **Edit**, and enter what is owed today. The difference is recorded as "paid before the system", and the dashboard totals then include it.
- **7 cars are "Sold" on Car Details but still listed on Cars Present**: KCT 512G, KCR 735A, KCE 575B, KDE 089C, KCH 569M, KDQ 512X, KCP 254P. They were loaded as sold. If any is still in the yard, cancel its sale (owner) and it goes back to stock.
- KBK 675U had no status; it was loaded as in stock. KBT 948U appears twice; the later row was used.
- KBY 912E (X-Trail) is only on Cars Present, so it was added to stock without details. KBE 623B (Nyoka) and KBJ 071G (Nissan B15) are only on Loan Details, so they were added as sold cars.
- KDT 007H (V8) had no loan amount; the balance of 5,000,000 was used.
- Sold cars from the sheet have no sale price (it wasn't recorded). Add it under **Sales → Edit** if you want it in the reports.
- The photo folders for KCV 664P and KBP 336T were empty. Add their photos from the car page.
- In-stock cars have no buying price yet. Add it under **Edit** to see profit per car.

## 7. Day-to-day

- **A car arrives:** Stock → Add a car → then **Add photos** from a phone (several at once).
- **A buyer pays a deposit:** open the car → Reserve / sell → **Reserve with deposit**. Later: **Complete sale**.
- **Credit sale:** choose *Credit*, the months and interest. The schedule, arrears and next due date are worked out, and the logbook is held until the last instalment.
- **Instalment received:** Instalments → Record payment (enter the M-Pesa code).
- **Logbook loan:** Logbook loans → New loan; record repayments as they come.

## 8. Updates and backups

- Updates: upload the new `app/` and `public/` files over the old ones. Never overwrite `app/config.php` or `public/uploads/`.
- Backups: cPanel → Backup → download the database **and** `driveline-gari/public/uploads/` (the photos) every week.
