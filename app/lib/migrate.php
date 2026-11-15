<?php
declare(strict_types=1);
/*
 * Small, idempotent schema upgrades. Runs automatically (once) after an update is uploaded,
 * so nobody has to run SQL by hand. Each step checks before it changes anything.
 */
const SCHEMA_VERSION = 2;

function column_exists(string $table, string $col): bool
{
  return (bool) val(
    'SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [$table, $col],
  );
}
function migrate(): void
{
  if (
    !(bool) val(
      "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'settings'",
    )
  ) {
    return;
  } // before setup
  $v = (int) setting('schema_version', '1');
  if ($v >= SCHEMA_VERSION) {
    return;
  }
  if ($v < 2) {
    // v2: the car's own logbook (number, office, date, scan, history)
    $cols = [
      'logbook_status' => "ENUM('with_us','not_received','in_process') NULL",
      'logbook_no' => 'VARCHAR(40) NULL',
      'logbook_date' => 'DATE NULL',
      'logbook_office' => 'VARCHAR(60) NULL',
      'logbook_remarks' => 'VARCHAR(300) NULL',
      'logbook_file' => 'VARCHAR(120) NULL',
    ];
    foreach ($cols as $c => $def) {
      if (!column_exists('cars', $c)) {
        db()->exec("ALTER TABLE cars ADD COLUMN $c $def");
      }
    }
    db()
      ->exec("CREATE TABLE IF NOT EXISTS car_logbook_log (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, car_id INT UNSIGNED NOT NULL, date DATE NOT NULL,
            status VARCHAR(20) NOT NULL, remarks VARCHAR(300) NULL, user_id INT UNSIGNED NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY k_lblog_car (car_id))
            ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    q(
      "UPDATE cars SET logbook_status = 'with_us' WHERE logbook = 'present' AND logbook_status IS NULL",
    );
    q(
      "UPDATE cars SET logbook_status = 'not_received' WHERE (logbook = 'missing' OR logbook IS NULL) AND status <> 'sold' AND logbook_status IS NULL",
    );
    q("INSERT INTO car_logbook_log (car_id, date, status, remarks) SELECT id, COALESCE(in_date, DATE(created_at)), logbook_status, 'From the Car Details sheet' FROM cars
           WHERE logbook_status IS NOT NULL AND id NOT IN (SELECT car_id FROM car_logbook_log)");
  }
  set_setting('schema_version', (string) SCHEMA_VERSION);
}
