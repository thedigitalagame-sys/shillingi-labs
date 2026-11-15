<?php
declare(strict_types=1);

define('APP_DIR', __DIR__);
define('PUBLIC_DIR', dirname(__DIR__) . '/public');
if (!is_file(APP_DIR . '/config.php')) {
  http_response_code(500);
  exit('Missing app/config.php — copy config.sample.php to config.php and fill it in.');
}
$config = require APP_DIR . '/config.php';
date_default_timezone_set($config['timezone'] ?? 'Africa/Nairobi');
ini_set('display_errors', !empty($config['debug']) ? '1' : '0');
error_reporting(E_ALL);

require APP_DIR . '/lib/util.php';
require APP_DIR . '/lib/db.php';
require APP_DIR . '/lib/auth.php';
require APP_DIR . '/lib/photos.php';
require APP_DIR . '/lib/gari.php';
require APP_DIR . '/lib/migrate.php';
if (!defined('NO_MIGRATE')) {
  try {
    migrate();
  } catch (Throwable $e) {
    error_log('[gari migrate] ' . $e->getMessage());
  }
}
