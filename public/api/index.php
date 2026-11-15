<?php
declare(strict_types=1);
require dirname(__DIR__, 2) . '/app/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

try {
  start_session();
  $r = (string) ($_GET['r'] ?? '');
  $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
  $routes = require APP_DIR . '/api/routes.php';
  if (!isset($routes[$r])) {
    fail('Not found.', 404);
  }
  [$m, $fn] = $routes[$r];
  if ($m !== $method) {
    fail('Method not allowed.', 405);
  }
  if ($method === 'POST') {
    check_csrf();
  }
  json_out($fn(input()));
} catch (ApiError $e) {
  json_out(['error' => $e->getMessage()], $e->getCode() ?: 400);
} catch (Throwable $e) {
  error_log('[gari] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
  json_out(
    [
      'error' => !empty($config['debug'])
        ? $e->getMessage()
        : 'Something went wrong. Please try again.',
    ],
    500,
  );
}
