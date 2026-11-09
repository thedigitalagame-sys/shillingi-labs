<?php
declare(strict_types=1);
/*
 * Small, idempotent schema upgrades. Runs automatically (once) after an update is uploaded,
 * so nobody has to run SQL by hand. Each step checks before it changes anything.
 */
const SCHEMA_VERSION = 1;

function column_exists(string $table, string $col): bool {
    return (bool)val('SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?', [$table, $col]);
}
function migrate(): void {
    if (!(bool)val("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'settings'")) return;   // before setup
    $v = (int)setting('schema_version', '1');
    if ($v >= SCHEMA_VERSION) return;
    set_setting('schema_version', (string)SCHEMA_VERSION);
}
