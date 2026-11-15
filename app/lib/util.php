<?php
declare(strict_types=1);

final class ApiError extends Exception {}

function fail(string $msg, int $code = 400): never
{
  throw new ApiError($msg, $code);
}

function json_out($data, int $code = 200): never
{
  http_response_code($code);
  echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit();
}

function input(): array
{
  static $in = null;
  if ($in !== null) {
    return $in;
  }
  $raw = file_get_contents('php://input') ?: '';
  $in = $raw !== '' ? (json_decode($raw, true) ?: []) : [];
  return $in = array_merge($_GET, $_POST, is_array($in) ? $in : []);
}

function str_in(array $in, string $k, int $max = 200, bool $required = false): ?string
{
  $v = isset($in[$k]) ? trim((string) $in[$k]) : '';
  if ($v === '') {
    if ($required) {
      fail('Please fill in ' . str_replace('_', ' ', $k) . '.');
    }
    return null;
  }
  return mb_substr($v, 0, $max);
}
function int_in(array $in, string $k, bool $required = true): ?int
{
  if (!isset($in[$k]) || $in[$k] === '' || $in[$k] === null) {
    if ($required) {
      fail("Missing $k.");
    }
    return null;
  }
  if (!is_numeric($in[$k])) {
    fail("Invalid $k.");
  }
  return (int) $in[$k];
}
function money_in(array $in, string $k, bool $required = true, bool $allowZero = true): float
{
  $v = $in[$k] ?? null;
  if ($v === null || $v === '') {
    if ($required) {
      fail('Please enter ' . str_replace('_', ' ', $k) . '.');
    }
    return 0.0;
  }
  if (!is_numeric($v)) {
    fail('Invalid amount for ' . str_replace('_', ' ', $k) . '.');
  }
  $f = round((float) $v, 2);
  if ($f < 0 || (!$allowZero && $f == 0.0)) {
    fail('Amount for ' . str_replace('_', ' ', $k) . ' must be more than zero.');
  }
  if ($f > 100000000) {
    fail('Amount is too large.');
  }
  return $f;
}
function date_in(array $in, string $k, bool $required = true): ?string
{
  $v = trim((string) ($in[$k] ?? ''));
  if ($v === '') {
    if ($required) {
      fail('Please enter a date for ' . str_replace('_', ' ', $k) . '.');
    }
    return null;
  }
  $d = DateTime::createFromFormat('!Y-m-d', $v);
  if (!$d || $d->format('Y-m-d') !== $v) {
    fail('Invalid date.');
  }
  return $v;
}
function period_in(array $in, string $k = 'period'): string
{
  $v = trim((string) ($in[$k] ?? date('Y-m')));
  if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $v)) {
    fail('Invalid month.');
  }
  return $v;
}
function today(): string
{
  return date('Y-m-d');
}
function period_of(string $date): string
{
  return substr($date, 0, 7);
}
function period_label(string $p): string
{
  return date('F Y', strtotime($p . '-01'));
}
function norm_ref(?string $s): string
{
  return strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) $s));
}
function kes($n): string
{
  return 'KES ' . number_format((float) $n, 0);
}
function phone_e164(?string $p): ?string
{
  $d = preg_replace('/\D/', '', (string) $p);
  if ($d === '') {
    return null;
  }
  if (str_starts_with($d, '254') && strlen($d) === 12) {
    return '+' . $d;
  }
  if (str_starts_with($d, '0') && strlen($d) === 10) {
    return '+254' . substr($d, 1);
  }
  if (strlen($d) === 9 && ($d[0] === '7' || $d[0] === '1')) {
    return '+254' . $d;
  }
  return null;
}
function client_ip(): string
{
  return substr((string) ($_SERVER['REMOTE_ADDR'] ?? 'cli'), 0, 64);
}
