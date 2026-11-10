-- Shilingi Gari (production) — car yard stock, sales, credit sales and logbook loans
-- MySQL 5.7+ / MariaDB 10.3+, utf8mb4

CREATE TABLE IF NOT EXISTS settings (
  k VARCHAR(64) PRIMARY KEY,
  v TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  phone VARCHAR(30) NULL,
  role ENUM('owner','manager','sales') NOT NULL DEFAULT 'sales',
  password_hash VARCHAR(255) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  last_login DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS login_attempts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NULL,
  ip VARCHAR(64) NOT NULL,
  success TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY k_la (created_at, email, ip)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_log (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL,
  action VARCHAR(60) NOT NULL,
  entity VARCHAR(30) NULL,
  entity_id INT UNSIGNED NULL,
  details TEXT NULL,
  ip VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY k_audit (entity, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cars (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  plate VARCHAR(20) NULL,
  make VARCHAR(40) NULL,
  model VARCHAR(60) NOT NULL,
  body ENUM('hatch','sedan','wagon','suv','pickup','van') NOT NULL DEFAULT 'sedan',
  year SMALLINT UNSIGNED NULL,
  mileage INT UNSIGNED NULL,
  cc SMALLINT UNSIGNED NULL,
  fuel VARCHAR(20) NULL,
  gearbox VARCHAR(20) NULL,
  color VARCHAR(30) NULL,
  chassis VARCHAR(40) NULL,
  source ENUM('local','import','tradein') NOT NULL DEFAULT 'local',
  buy_price DECIMAL(12,2) NULL,             -- what the yard paid (owner and managers only)
  ask_price DECIMAL(12,2) NULL,
  floor_price DECIMAL(12,2) NULL,
  status ENUM('prep','available','reserved','sold') NOT NULL DEFAULT 'available',
  in_date DATE NULL,
  sold_date DATE NULL,
  featured TINYINT(1) NOT NULL DEFAULT 0,
  inspection TEXT NULL,                     -- JSON: wheel check, spanner, spare wheel, battery, radio
  logbook VARCHAR(20) NULL,                 -- present / missing / with buyer
  logbook_status ENUM('with_us','not_received','in_process') NULL,   -- the car's own logbook, from the previous owner
  logbook_no VARCHAR(40) NULL,
  logbook_date DATE NULL,
  logbook_office VARCHAR(60) NULL,
  logbook_remarks VARCHAR(300) NULL,
  logbook_file VARCHAR(120) NULL,           -- scan, stored privately under app/storage/logbooks
  notes TEXT NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  deleted_at DATETIME NULL,
  KEY k_cars_status (status),
  KEY k_cars_plate (plate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS car_costs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  car_id INT UNSIGNED NOT NULL,
  date DATE NOT NULL,
  category VARCHAR(60) NOT NULL,
  description VARCHAR(200) NULL,
  amount DECIMAL(12,2) NOT NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY k_costs_car (car_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS car_photos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  car_id INT UNSIGNED NOT NULL,
  file VARCHAR(120) NOT NULL,               -- under public/uploads/
  thumb VARCHAR(120) NOT NULL,
  sort SMALLINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY k_photos_car (car_id, sort)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sales (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  car_id INT UNSIGNED NOT NULL,
  date DATE NULL,
  buyer_name VARCHAR(120) NULL,
  buyer_phone VARCHAR(30) NULL,
  buyer_phone2 VARCHAR(30) NULL,
  buyer_id_no VARCHAR(30) NULL,
  buyer_kra VARCHAR(30) NULL,
  price DECIMAL(12,2) NULL,                 -- NULL = not recorded (cars sold before the system)
  type ENUM('cash','credit','bank') NOT NULL DEFAULT 'cash',
  reserved TINYINT(1) NOT NULL DEFAULT 0,
  hold_until DATE NULL,
  credit_amount DECIMAL(12,2) NULL,         -- amount the buyer pays over time (price less deposit and trade-in)
  credit_months TINYINT UNSIGNED NULL,
  credit_rate DECIMAL(5,2) NULL,            -- % a month, flat, on the credit amount
  credit_interest DECIMAL(12,2) NULL,
  credit_monthly DECIMAL(12,2) NULL,
  credit_start DATE NULL,                   -- first instalment falls one month after this date
  balance_known TINYINT(1) NOT NULL DEFAULT 1,
  bank VARCHAR(60) NULL,
  trade_in_car INT UNSIGNED NULL,
  trade_in_value DECIMAL(12,2) NULL,
  logbook ENUM('pending','initiated','transferred','held') NOT NULL DEFAULT 'pending',
  agent_id INT UNSIGNED NULL,
  notes TEXT NULL,
  legacy TINYINT(1) NOT NULL DEFAULT 0,     -- loaded from the old spreadsheet
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  voided_at DATETIME NULL,
  void_reason VARCHAR(200) NULL,
  KEY k_sales_car (car_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS loans (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  date DATE NULL,
  borrower VARCHAR(120) NOT NULL,
  phone VARCHAR(30) NULL,
  phone2 VARCHAR(30) NULL,
  id_no VARCHAR(30) NULL,
  vehicle VARCHAR(80) NULL,
  plate VARCHAR(20) NULL,
  amount DECIMAL(12,2) NOT NULL,
  months TINYINT UNSIGNED NULL,
  rate DECIMAL(5,2) NULL,                   -- % a month, flat
  interest DECIMAL(12,2) NOT NULL DEFAULT 0,
  due_date DATE NULL,
  balance_known TINYINT(1) NOT NULL DEFAULT 1,
  status ENUM('active','cleared','written_off') NOT NULL DEFAULT 'active',
  logbook_held TINYINT(1) NOT NULL DEFAULT 1,
  notes TEXT NULL,
  legacy TINYINT(1) NOT NULL DEFAULT 0,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sale_id INT UNSIGNED NULL,
  loan_id INT UNSIGNED NULL,
  date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  method VARCHAR(20) NOT NULL,              -- mpesa, bank, cash, cheque, tradein, before
  reference VARCHAR(60) NULL,
  note VARCHAR(200) NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  voided_at DATETIME NULL,
  void_reason VARCHAR(200) NULL,
  KEY k_pay_sale (sale_id),
  KEY k_pay_loan (loan_id),
  KEY k_pay_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS car_logbook_log (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  car_id INT UNSIGNED NOT NULL,
  date DATE NOT NULL,
  status VARCHAR(20) NOT NULL,
  remarks VARCHAR(300) NULL,
  user_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY k_lblog_car (car_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expenses (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL,
  category VARCHAR(60) NOT NULL,
  description VARCHAR(200) NULL,
  amount DECIMAL(12,2) NOT NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
