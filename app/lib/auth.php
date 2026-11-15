<?php
declare(strict_types=1);

const ROLES = ['owner' => 'Owner', 'manager' => 'Manager', 'sales' => 'Sales'];

function is_https(): bool
{
  return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ||
    ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https' ||
    ($_SERVER['SERVER_PORT'] ?? '') == 443;
}

const REMEMBER_DAYS = 30;
function start_session(): void
{
  // own folder, so the host's session clean-up does not sign people out early
  $dir = APP_DIR . '/storage/sessions';
  if (!is_dir($dir)) {
    @mkdir($dir, 0700, true);
  }
  if (is_dir($dir) && is_writable($dir)) {
    session_save_path($dir);
  }
  ini_set('session.gc_maxlifetime', (string) (REMEMBER_DAYS * 86400));
  session_name('GARI');
  session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => is_https(),
    'httponly' => true,
    'samesite' => 'Strict',
  ]);
  ini_set('session.use_strict_mode', '1');
  session_start();
  $idle = !empty($_SESSION['remember']) ? REMEMBER_DAYS * 86400 : 8 * 3600;
  if (!empty($_SESSION['uid']) && time() - ($_SESSION['last'] ?? 0) > $idle) {
    $_SESSION = [];
    session_regenerate_id(true);
  }
  $_SESSION['last'] = time();
  if (empty($_SESSION['csrf'])) {
    $_SESSION['csrf'] = bin2hex(random_bytes(20));
  }
  if (!empty($_SESSION['remember'])) {
    remember_cookie();
  }
}
/** Keeps the sign-in cookie for 30 days (sliding) when "Remember me" was ticked. */
function remember_cookie(): void
{
  setcookie(session_name(), session_id(), [
    'expires' => time() + REMEMBER_DAYS * 86400,
    'path' => '/',
    'secure' => is_https(),
    'httponly' => true,
    'samesite' => 'Strict',
  ]);
}

$GLOBALS['__user'] = false;
function current_user(): ?array
{
  if ($GLOBALS['__user'] !== false) {
    return $GLOBALS['__user'];
  }
  $u = null;
  if (!empty($_SESSION['uid'])) {
    $u = row('SELECT id, name, email, phone, role, active FROM users WHERE id = ?', [
      $_SESSION['uid'],
    ]);
    if (!$u || !$u['active']) {
      $u = null;
    } else {
      $u['id'] = (int) $u['id'];
    }
  }
  return $GLOBALS['__user'] = $u;
}
/** $level: null = any signed-in user, 'manager' = owner or manager, 'owner' = owner only. */
function require_user(?string $level = null): array
{
  $u = current_user();
  if (!$u) {
    fail('Please sign in.', 401);
  }
  if ($level === 'owner' && $u['role'] !== 'owner') {
    fail('Only the owner can do this.', 403);
  }
  if ($level === 'manager' && !in_array($u['role'], ['owner', 'manager'], true)) {
    fail('Only the owner or a manager can do this.', 403);
  }
  return $u;
}
function sees_costs(?array $u): bool
{
  return $u && in_array($u['role'], ['owner', 'manager'], true);
}
function check_csrf(): void
{
  $h = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
  if ($h === '' || !hash_equals((string) ($_SESSION['csrf'] ?? ''), $h)) {
    fail('Your session has expired. Please reload the page.', 419);
  }
}

function do_login(string $email, string $pass, bool $remember = false): array
{
  $email = strtolower(trim($email));
  $ip = client_ip();
  $recent = (int) val(
    'SELECT COUNT(*) FROM login_attempts WHERE success = 0 AND created_at > (NOW() - INTERVAL 15 MINUTE) AND (email = ? OR ip = ?)',
    [$email, $ip],
  );
  if ($recent >= 8) {
    fail('Too many failed attempts. Please wait 15 minutes and try again.', 429);
  }
  $u = row('SELECT * FROM users WHERE email = ?', [$email]);
  $ok = $u && $u['active'] && password_verify($pass, $u['password_hash']);
  insert('login_attempts', ['email' => $email, 'ip' => $ip, 'success' => $ok ? 1 : 0]);
  if (!$ok) {
    usleep(400000);
    fail('Wrong email or password.', 401);
  }
  if (password_needs_rehash($u['password_hash'], PASSWORD_DEFAULT)) {
    update('users', ['password_hash' => password_hash($pass, PASSWORD_DEFAULT)], 'id = ?', [
      $u['id'],
    ]);
  }
  session_regenerate_id(true);
  $_SESSION['uid'] = (int) $u['id'];
  $_SESSION['remember'] = $remember ? 1 : 0;
  if ($remember) {
    remember_cookie();
  }
  $_SESSION['csrf'] = bin2hex(random_bytes(20));
  $GLOBALS['__user'] = false;
  update('users', ['last_login' => date('Y-m-d H:i:s')], 'id = ?', [$u['id']]);
  audit('login', 'user', (int) $u['id']);
  return current_user();
}
function check_password_strength(string $p): void
{
  if (strlen($p) < 8) {
    fail('Password must be at least 8 characters.');
  }
  if (!preg_match('/[A-Za-z]/', $p) || !preg_match('/\d/', $p)) {
    fail('Password must contain letters and numbers.');
  }
}
