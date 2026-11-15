<?php
declare(strict_types=1);

function db(): PDO
{
  static $pdo = null;
  if ($pdo) {
    return $pdo;
  }
  global $config;
  $c = $config['db'];
  $pdo = new PDO(
    "mysql:host={$c['host']};dbname={$c['name']};charset=utf8mb4",
    $c['user'],
    $c['pass'],
    [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
      PDO::ATTR_EMULATE_PREPARES => false,
    ],
  );
  $pdo->exec("SET time_zone = '+03:00'");
  return $pdo;
}
function q(string $sql, array $p = []): PDOStatement
{
  $s = db()->prepare($sql);
  $s->execute(array_values($p));
  return $s;
}
function rows(string $sql, array $p = []): array
{
  return q($sql, $p)->fetchAll();
}
function row(string $sql, array $p = []): ?array
{
  $r = q($sql, $p)->fetch();
  return $r ?: null;
}
function val(string $sql, array $p = [])
{
  $v = q($sql, $p)->fetchColumn();
  return $v === false ? null : $v;
}
function insert(string $table, array $data): int
{
  $cols = array_keys($data);
  q(
    "INSERT INTO `$table` (`" .
      implode('`,`', $cols) .
      '`) VALUES (' .
      rtrim(str_repeat('?,', count($cols)), ',') .
      ')',
    array_values($data),
  );
  return (int) db()->lastInsertId();
}
function update(string $table, array $data, string $where, array $wp): void
{
  $set = implode(',', array_map(fn($c) => "`$c`=?", array_keys($data)));
  q("UPDATE `$table` SET $set WHERE $where", array_merge(array_values($data), $wp));
}
function tx(callable $fn)
{
  $pdo = db();
  if ($pdo->inTransaction()) {
    return $fn();
  } // nested: the outer transaction commits or rolls back everything
  $pdo->beginTransaction();
  try {
    $r = $fn();
    $pdo->commit();
    return $r;
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) {
      $pdo->rollBack();
    }
    throw $e;
  }
}
function is_duplicate(Throwable $e): bool
{
  return $e instanceof PDOException && ($e->errorInfo[1] ?? 0) == 1062;
}

$GLOBALS['__settings'] = null;
function setting(string $k, $default = null)
{
  if ($GLOBALS['__settings'] === null) {
    $c = [];
    foreach (rows('SELECT k, v FROM settings') as $r) {
      $c[$r['k']] = $r['v'];
    }
    $GLOBALS['__settings'] = $c;
  }
  $c = $GLOBALS['__settings'];
  return isset($c[$k]) && $c[$k] !== '' ? $c[$k] : $default;
}
function set_setting(string $k, ?string $v): void
{
  q('INSERT INTO settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)', [$k, $v]);
  $GLOBALS['__settings'] = null;
}
function audit(string $action, ?string $entity = null, ?int $id = null, array $details = []): void
{
  $u = function_exists('current_user') ? current_user() : null;
  insert('audit_log', [
    'user_id' => $u['id'] ?? null,
    'action' => $action,
    'entity' => $entity,
    'entity_id' => $id,
    'details' => $details ? json_encode($details, JSON_UNESCAPED_UNICODE) : null,
    'ip' => client_ip(),
  ]);
}
