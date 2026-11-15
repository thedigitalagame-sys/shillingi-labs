<?php
/*
 * One-time setup: creates the tables, the first OWNER account and (optionally) loads
 * Driveline Motors' cars, photos, credit sales and logbook loans from app/seed/.
 * Protected by the setup_key in app/config.php. Stops working once an account exists.
 * Delete this file after setup.
 */
declare(strict_types=1);
define('NO_MIGRATE', true);
require dirname(__DIR__) . '/app/bootstrap.php';
header('X-Frame-Options: DENY');
@set_time_limit(300);

$seedDir = dirname(__DIR__) . '/app/seed';
$seed = is_file("$seedDir/driveline.json")
  ? json_decode((string) file_get_contents("$seedDir/driveline.json"), true)
  : null;

$msg = '';
$ok = false;
$loaded = null;
function tables_exist(): bool
{
  return (bool) val(
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'users'",
  );
}

try {
  $done = tables_exist() && (int) val('SELECT COUNT(*) FROM users') > 0;
  if ($done) {
    $msg = 'Setup is already complete. Delete setup.php from the server and sign in.';
    $ok = true;
  } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (
      !hash_equals((string) $config['setup_key'], (string) ($_POST['setup_key'] ?? '')) ||
      str_starts_with((string) $config['setup_key'], 'CHANGE-ME')
    ) {
      sleep(2);
      throw new ApiError('Wrong setup key (or the key in config.php has not been changed).');
    }
    $name = trim((string) $_POST['name']);
    $email = strtolower(trim((string) $_POST['email']));
    $pass = (string) $_POST['password'];
    $biz = trim((string) $_POST['business']);
    if ($name === '' || $biz === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
      throw new ApiError('Fill in all fields with a valid email.');
    }
    check_password_strength($pass);
    if (!empty($_POST['load_seed']) && !function_exists('imagecreatefromstring')) {
      throw new ApiError(
        'The PHP GD extension is off, so the car photos cannot be loaded. Turn on "gd" in cPanel → Select PHP Version → Extensions, then try again.',
      );
    }
    if (!tables_exist()) {
      $sql = file_get_contents(dirname(__DIR__) . '/sql/schema.sql');
      foreach (
        array_filter(array_map('trim', preg_split('/;\s*\n/', preg_replace('/^--.*$/m', '', $sql))))
        as $stmt
      ) {
        db()->exec($stmt);
      }
    }
    migrate();
    $uid = insert('users', [
      'name' => $name,
      'email' => $email,
      'role' => 'owner',
      'password_hash' => password_hash($pass, PASSWORD_DEFAULT),
    ]);
    set_setting('business_name', $biz);
    set_setting('location', trim((string) ($_POST['location'] ?? '')) ?: null);
    set_setting('phone', trim((string) ($_POST['phone'] ?? '')) ?: null);
    set_setting('credit_rate', '0');
    set_setting('min_deposit', '30');
    set_setting('hold_days', '7');
    if ($seed && !empty($_POST['load_seed'])) {
      $loaded = load_seed($seed, $seedDir, $uid);
    }
    audit('setup_complete');
    $msg =
      'Done! Your owner account is ready. Now DELETE setup.php from the server, then open the home page and sign in.';
    $ok = true;
  }
} catch (ApiError $e) {
  $msg = $e->getMessage();
} catch (Throwable $e) {
  $msg = 'Setup error: ' . $e->getMessage();
}
$h = fn($s) => htmlspecialchars((string) $s);
$issues = $seed['issues'] ?? [];
?><!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>Setup — Shilingi Gari</title>
<link rel="icon" href="shared/assets/favicon.png" type="image/png">
<style>body{font-family:system-ui,Segoe UI,Roboto,sans-serif;background:#F3F5F9;color:#18212F;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px}
form,.box{background:#fff;border:1px solid #E2E7EF;border-radius:12px;padding:24px;max-width:520px;width:100%;display:flex;flex-direction:column;gap:12px;box-sizing:border-box}
label{display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:600;color:#5E6A7D}label.ck{flex-direction:row;align-items:flex-start;gap:8px;font-weight:500;color:#18212F}
input{padding:9px 10px;border:1px solid #E2E7EF;border-radius:8px;font:inherit}button{background:#0B2A5B;color:#fff;border:0;border-radius:8px;padding:10px;font-weight:700;cursor:pointer}
.m{padding:10px;border-radius:8px;background:<?= $ok
  ? '#DCFCE7'
  : '#FEE2E2' ?>;font-size:14px}.s{background:#E7F4F2;border-radius:8px;padding:10px 12px;font-size:13px}.f{font-size:11px;color:#8A95A6;text-align:center}
ul{margin:6px 0 0;padding-left:18px;max-height:220px;overflow:auto}li{margin:2px 0}</style></head><body>
<?php if (
  $ok
): ?><div class="box"><h2 style="margin:0">Shilingi Gari setup</h2><div class="m"><?= $h(
  $msg,
) ?></div>
<?php if ($loaded): ?><div class="s"><b><?= $h($seed['business']['name']) ?></b>: <?= (int) $loaded[
  'cars'
] ?> cars (<?= (int) $loaded['stock'] ?> in stock), <?= (int) $loaded[
   'photos'
 ] ?> photos, <?= (int) $loaded['sales'] ?> past sales and <?= (int) $loaded[
   'loans'
 ] ?> logbook loans loaded.
<?php if ($issues): ?><div style="margin-top:8px"><b>Please check these <?= count(
  $issues,
) ?> points from the spreadsheets</b> (also listed under Activity in the app):</div><ul><?php foreach (
   $issues
   as $i
 ): ?><li><?= $h($i) ?></li><?php endforeach; ?></ul><?php endif; ?></div><?php endif; ?>
<a href="./">Go to sign in →</a><div class="f">Shilingi Gari · Shilingi Labs Tech Solutions</div></div>
<?php else: ?><form method="post"><h2 style="margin:0">Shilingi Gari — first-time setup</h2>
<?php if ($msg): ?><div class="m"><?= $h($msg) ?></div><?php endif; ?>
<label>Setup key (from app/config.php)<input name="setup_key" type="password" required></label>
<label>Business name (shown on agreements and receipts)<input name="business" required value="<?= $h(
  $_POST['business'] ?? ($seed['business']['name'] ?? ''),
) ?>"></label>
<label>Location<input name="location" value="<?= $h(
  $_POST['location'] ?? ($seed['business']['location'] ?? ''),
) ?>"></label>
<label>Business phone<input name="phone" value="<?= $h($_POST['phone'] ?? '') ?>"></label>
<label>Owner's full name<input name="name" required value="<?= $h($_POST['name'] ?? '') ?>"></label>
<label>Owner's email (used to sign in)<input name="email" type="email" required value="<?= $h(
  $_POST['email'] ?? '',
) ?>"></label>
<label>Password (8+ characters, letters and numbers)<input name="password" type="password" required minlength="8"></label>
<?php if (
  $seed
): ?><div class="s"><label class="ck"><input type="checkbox" name="load_seed" value="1" checked> <span>Load <b><?= $h(
  $seed['business']['name'],
) ?></b>: <?= count($seed['cars']) ?> cars with photos, <?= count(
   $seed['credit_sales'],
 ) ?> credit sales and <?= count(
   $seed['loans'],
 ) ?> logbook loans from the spreadsheets.</span></label>
<div style="font-size:12px;color:#5E6A7D;margin-top:4px">Loading the photos takes up to a minute. Balances that were blank on the sheet are marked "unconfirmed" until you set them.</div></div><?php endif; ?>
<button>Create owner account</button><div class="f">Shilingi Gari · Shilingi Labs Tech Solutions</div></form><?php endif; ?></body></html>
