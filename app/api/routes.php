<?php
declare(strict_types=1);

/* API routes: 'name' => [HTTP method, handler(array $in)] */

function car_or_fail(int $id): array {
    $c = row('SELECT * FROM cars WHERE id = ? AND deleted_at IS NULL', [$id]);
    if (!$c) fail('Car not found.', 404);
    return $c;
}
function plate_in(array $in): ?string {
    $p = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string)($in['plate'] ?? '')));
    if ($p === '') return null;
    if (preg_match('/^([A-Z]{3})(\d{1,4})([A-Z]?)$/', $p, $m)) return "$m[1] $m[2]$m[3]";
    return mb_substr($p, 0, 20);
}
function engine_cc($v): ?int {      // "2.0L", "2.0", "1998", "1500cc" -> cc
    $s = strtolower(trim((string)$v)); if ($s === '') return null;
    if (!preg_match('/^(\d+(?:\.\d+)?)\s*(l|litres?|cc)?$/', $s, $m)) fail('Enter the engine as litres (e.g. 2.0L) or cc (e.g. 1998).');
    $n = (float)$m[1]; $cc = ($m[2] ?? '') !== '' && $m[2] !== 'cc' || $n < 20 ? (int)round($n * 1000) : (int)round($n);
    if ($cc < 500 || $cc > 9000) fail('Check the engine size.');
    return $cc;
}
function logbook_in(array $in, array $old = []): array {
    $st = (string)($in['logbook_status'] ?? '');
    if ($st !== '' && !isset(LOGBOOK_STATUS[$st])) fail('Choose the logbook status.');
    return ['logbook_status' => $st ?: null, 'logbook_no' => ($n = str_in($in, 'logbook_no', 40)) ? strtoupper($n) : null, 'logbook_date' => date_in($in, 'logbook_date', false),
            'logbook_office' => str_in($in, 'logbook_office', 60), 'logbook_remarks' => str_in($in, 'logbook_remarks', 300),
            'logbook' => $st === 'with_us' ? 'present' : ($st ? 'missing' : ($old['logbook'] ?? null))];
}
function logbook_logged(int $carId, array $old, array $new, int $uid): void {
    if (($old['logbook_status'] ?? null) === $new['logbook_status'] && ($old['logbook_no'] ?? null) === $new['logbook_no'] && ($old['logbook_remarks'] ?? null) === $new['logbook_remarks']) return;
    if (!$new['logbook_status']) return;
    insert('car_logbook_log', ['car_id' => $carId, 'date' => $new['logbook_status'] === 'with_us' && $new['logbook_date'] ? $new['logbook_date'] : today(), 'status' => $new['logbook_status'],
        'remarks' => $new['logbook_remarks'] ?? null, 'user_id' => $uid]);
    audit('car_logbook', 'car', $carId, ['status' => $new['logbook_status'], 'no' => $new['logbook_no']]);
}
function logbook_dir(): string { return APP_DIR . '/storage/logbooks'; }
function phone_ok(?string $p, string $label): ?string {
    if ($p === null || trim($p) === '') return null;
    if (!phone_e164($p)) fail("Enter a valid Kenyan $label, e.g. 0712 345 678.");
    return trim($p);
}
function method_in(array $in): string {
    $m = (string)($in['method'] ?? 'mpesa');
    if (!isset(PAY_METHODS[$m]) || in_array($m, ['tradein', 'before'], true)) fail('Choose how it was paid.');
    return $m;
}
function add_payment(array $data): int {
    if ($data['method'] === 'mpesa' && $data['amount'] > MPESA_MAX) fail('M-Pesa allows up to KES ' . number_format(MPESA_MAX) . ' in one transaction. Record it as two payments, or as a bank transfer.');
    if ($data['method'] === 'mpesa' && !empty($data['reference'])) {
        $ref = strtoupper(preg_replace('/\s+/', '', $data['reference']));
        if (val('SELECT id FROM payments WHERE voided_at IS NULL AND method = "mpesa" AND reference = ?', [$ref])) fail("M-Pesa code $ref has already been recorded.");
        $data['reference'] = $ref;
    }
    return insert('payments', $data);
}

return [

/* ---------- sign in ---------- */
'auth.me' => ['GET', function () {
    $u = current_user();
    return ['user' => $u, 'csrf' => $_SESSION['csrf'], 'business' => setting('business_name', 'Car yard'), 'location' => setting('location', '')];
}],
'auth.login' => ['POST', function ($in) {
    $u = do_login((string)($in['email'] ?? ''), (string)($in['password'] ?? ''), !empty($in['remember']));
    return ['user' => $u, 'csrf' => $_SESSION['csrf']];
}],
'auth.logout' => ['POST', function () {
    if (current_user()) audit('logout');
    $_SESSION = []; session_regenerate_id(true); $_SESSION['csrf'] = bin2hex(random_bytes(20));
    return ['ok' => true, 'csrf' => $_SESSION['csrf']];
}],
'auth.password' => ['POST', function ($in) {
    $u = require_user();
    $row = row('SELECT password_hash FROM users WHERE id = ?', [$u['id']]);
    if (!password_verify((string)($in['current'] ?? ''), $row['password_hash'])) fail('Your current password is not right.');
    check_password_strength((string)($in['new'] ?? ''));
    update('users', ['password_hash' => password_hash((string)$in['new'], PASSWORD_DEFAULT)], 'id = ?', [$u['id']]);
    audit('password_change', 'user', $u['id']);
    return ['ok' => true];
}],

'state' => ['GET', function () { return app_state(require_user()); }],

/* ---------- stock ---------- */
'cars.save' => ['POST', function ($in) {
    $u = require_user('manager');
    $id = int_in($in, 'id', false);
    $model = str_in($in, 'model', 60, true);
    $body = (string)($in['body'] ?? 'sedan'); if (!in_array($body, BODIES, true)) $body = 'sedan';
    $year = int_in($in, 'year', false); if ($year !== null && ($year < 1950 || $year > (int)date('Y') + 1)) fail('Check the year of manufacture.');
    $ask = isset($in['ask']) && $in['ask'] !== '' ? money_in($in, 'ask') : null;
    $floor = isset($in['floor']) && $in['floor'] !== '' ? money_in($in, 'floor') : null;
    if ($ask !== null && $floor !== null && $floor > $ask) fail('The lowest price cannot be above the asking price.');
    $insp = [];
    foreach (INSPECTION_KEYS as $k) { $v = str_in($in['inspection'] ?? [], $k, 40); if ($v !== null) $insp[$k] = $v; }
    if (!$id) {   // a new car needs the main details
        foreach (['make' => 'the make', 'plate' => 'the plate', 'body' => 'the body type', 'year' => 'the year of manufacture', 'color' => 'the colour', 'fuel' => 'the fuel type', 'gearbox' => 'the gearbox',
                  'ask' => 'the asking price', 'logbook_status' => 'the logbook status'] as $k => $l)
            if (trim((string)($in[$k] ?? '')) === '') fail("Please fill in $l.");
    }
    $plate = plate_in($in);
    if ($plate && val('SELECT id FROM cars WHERE plate = ? AND deleted_at IS NULL AND status <> "sold" AND id <> ?', [$plate, (int)$id])) fail("$plate is already in stock.");
    $data = ['plate' => $plate, 'make' => str_in($in, 'make', 40), 'model' => $model, 'body' => $body, 'year' => $year,
        'mileage' => int_in($in, 'mileage', false), 'cc' => array_key_exists('engine', $in) ? engine_cc($in['engine']) : int_in($in, 'cc', false), 'fuel' => str_in($in, 'fuel', 20), 'gearbox' => str_in($in, 'gearbox', 20),
        'color' => str_in($in, 'color', 30), 'chassis' => str_in($in, 'chassis', 40), 'ask_price' => $ask, 'floor_price' => $floor,
        'buy_price' => isset($in['buy']) && $in['buy'] !== '' ? money_in($in, 'buy') : null,
        'source' => in_array($in['source'] ?? '', ['local', 'import', 'tradein'], true) ? $in['source'] : 'local',
        'in_date' => date_in($in, 'in_date', false) ?? today(), 'inspection' => $insp ? json_encode($insp) : null,
        'featured' => !empty($in['featured']) ? 1 : 0, 'notes' => str_in($in, 'notes', 2000)];
    if ($id) {
        $c = car_or_fail($id);
        $lb = logbook_in($in, $c); $data += $lb;
        update('cars', $data + ['updated_at' => date('Y-m-d H:i:s')], 'id = ?', [$id]);
        logbook_logged($id, $c, $lb, $u['id']);
        $changed = []; foreach (['ask_price', 'floor_price', 'buy_price', 'plate', 'model'] as $k) if ((string)$c[$k] !== (string)$data[$k]) $changed[$k] = [$c[$k], $data[$k]];
        audit('car_update', 'car', $id, $changed);
    } else {
        $data['status'] = !empty($in['ready']) ? 'available' : 'prep'; $data['created_by'] = $u['id'];
        $lb = logbook_in($in); $data += $lb;
        $id = insert('cars', $data);
        logbook_logged($id, [], $lb, $u['id']);
        audit('car_add', 'car', $id, ['plate' => $plate, 'model' => $model]);
    }
    return ['ok' => true, 'id' => $id];
}],
'cars.status' => ['POST', function ($in) {
    require_user('manager');
    $c = car_or_fail(int_in($in, 'id'));
    $to = (string)($in['status'] ?? '');
    if (!in_array($to, ['prep', 'available'], true) || !in_array($c['status'], ['prep', 'available'], true)) fail('That change is not possible for this car.');
    update('cars', ['status' => $to, 'updated_at' => date('Y-m-d H:i:s')], 'id = ?', [$c['id']]);
    audit('car_status', 'car', (int)$c['id'], ['to' => $to]);
    return ['ok' => true];
}],
'cars.delete' => ['POST', function ($in) {
    require_user('owner');
    $c = car_or_fail(int_in($in, 'id'));
    if (val('SELECT id FROM sales WHERE car_id = ? AND voided_at IS NULL', [$c['id']])) fail('This car has a sale. Cancel the sale first.');
    update('cars', ['deleted_at' => date('Y-m-d H:i:s')], 'id = ?', [$c['id']]);
    audit('car_delete', 'car', (int)$c['id'], ['plate' => $c['plate'], 'reason' => str_in($in, 'reason', 200)]);
    return ['ok' => true];
}],
'cars.history' => ['GET', function ($in) {
    require_user();
    $c = car_or_fail(int_in($in, 'id'));
    $sales = array_map('intval', array_column(rows('SELECT id FROM sales WHERE car_id = ?', [$c['id']]), 'id'));
    $ev = rows('SELECT a.created_at, a.action, a.details, u.name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id WHERE (a.entity = "car" AND a.entity_id = ?)'
        . ($sales ? ' OR (a.entity = "sale" AND a.entity_id IN (' . implode(',', $sales) . '))' : '') . ' ORDER BY a.id', [$c['id']]);
    $price = null; foreach ($ev as $e) if ($e['action'] === 'car_update' && strpos((string)$e['details'], 'ask_price') !== false) $price = substr($e['created_at'], 0, 10);
    $res = null; $sold = null;
    foreach ($ev as $e) { if ($e['action'] === 'car_reserved') $res = substr($e['created_at'], 0, 10); if ($e['action'] === 'car_sold') $sold = substr($e['created_at'], 0, 10); }
    $s = row('SELECT date, reserved FROM sales WHERE car_id = ? AND voided_at IS NULL ORDER BY id DESC LIMIT 1', [$c['id']]);
    if ($s && !$s['reserved'] && !$sold) $sold = $s['date'] ?: $c['sold_date'];
    $lbIn = val('SELECT MIN(date) FROM car_logbook_log WHERE car_id = ? AND status = "with_us"', [$c['id']]);
    return ['steps' => [['k' => 'added', 'date' => $c['in_date'] ?: substr($c['created_at'], 0, 10)], ['k' => 'logbook', 'date' => $c['logbook_date'] ?: $lbIn],
        ['k' => 'price', 'date' => $price], ['k' => 'reserved', 'date' => $res], ['k' => 'sold', 'date' => $c['status'] === 'sold' ? ($sold ?: $c['sold_date']) : null]],
        'events' => array_map(fn($e) => ['at' => $e['created_at'], 'action' => $e['action'], 'by' => $e['name']], array_slice(array_reverse($ev), 0, 30))];
}],

/* ---------- the car's own logbook ---------- */
'logbooks.save' => ['POST', function ($in) {
    $u = require_user('manager');
    $c = car_or_fail(int_in($in, 'car_id'));
    $lb = logbook_in($in, $c);
    if (!$lb['logbook_status']) fail('Choose the logbook status.');
    if ($lb['logbook_status'] === 'with_us' && !$lb['logbook_no']) fail('Enter the logbook number.');
    update('cars', $lb + ['updated_at' => date('Y-m-d H:i:s')], 'id = ?', [$c['id']]);
    logbook_logged((int)$c['id'], $c, $lb, $u['id']);
    return ['ok' => true];
}],
'logbooks.history' => ['GET', function ($in) {
    require_user('manager');
    return rows('SELECT l.date, l.status, l.remarks, u.name FROM car_logbook_log l LEFT JOIN users u ON u.id = l.user_id WHERE l.car_id = ? ORDER BY l.date DESC, l.id DESC', [int_in($in, 'car_id')]);
}],
'logbooks.upload' => ['POST', function ($in) {
    $u = require_user('manager');
    $c = car_or_fail(int_in($in, 'car_id'));
    $f = $_FILES['file'] ?? null;
    if (!$f || $f['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) fail('Choose the logbook scan or photo.');
    if ($f['size'] > 5 * 1024 * 1024) fail('The file is over 5 MB.');
    $bin = file_get_contents($f['tmp_name']);
    $dir = logbook_dir(); if (!is_dir($dir) && !mkdir($dir, 0750, true) && !is_dir($dir)) fail('Could not create the logbook folder on the server.');
    $name = 'lb' . $c['id'] . '-' . bin2hex(random_bytes(8));
    if (str_starts_with($bin, '%PDF-')) { $name .= '.pdf'; if (!move_uploaded_file($f['tmp_name'], "$dir/$name")) fail('Could not save the file.'); }
    else {
        $info = @getimagesizefromstring($bin);
        if (!$info || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG], true)) fail('The logbook must be a PDF, JPG or PNG.');
        $img = @imagecreatefromstring($bin); if (!$img) fail('That image could not be read.');
        $name .= '.jpg'; resize_save($img, 2200, "$dir/$name", 85); imagedestroy($img);   // re-encoded: no hidden data
    }
    if ($c['logbook_file'] && is_file("$dir/" . basename($c['logbook_file']))) @unlink("$dir/" . basename($c['logbook_file']));
    update('cars', ['logbook_file' => $name], 'id = ?', [$c['id']]);
    audit('logbook_scan', 'car', (int)$c['id']);
    return ['ok' => true];
}],
'logbooks.file' => ['GET', function ($in) {
    require_user('manager');
    $c = car_or_fail(int_in($in, 'car_id'));
    $p = logbook_dir() . '/' . basename((string)$c['logbook_file']);
    if (!$c['logbook_file'] || !is_file($p)) fail('No logbook scan for this car.', 404);
    header('Content-Type: ' . (str_ends_with($p, '.pdf') ? 'application/pdf' : 'image/jpeg'));
    header('Content-Disposition: inline; filename="logbook-' . preg_replace('/[^A-Za-z0-9]/', '', (string)$c['plate']) . (str_ends_with($p, '.pdf') ? '.pdf' : '.jpg') . '"');
    header('Content-Length: ' . filesize($p)); header('Cache-Control: private, no-store');
    readfile($p); exit;
}],

'costs.add' => ['POST', function ($in) {
    $u = require_user('manager');
    $c = car_or_fail(int_in($in, 'car_id'));
    $cat = (string)($in['category'] ?? ''); if (!in_array($cat, COST_TYPES, true)) fail('Choose the type of cost.');
    $id = insert('car_costs', ['car_id' => $c['id'], 'date' => date_in($in, 'date', false) ?? today(), 'category' => $cat, 'description' => str_in($in, 'description', 200),
        'amount' => money_in($in, 'amount', true, false), 'created_by' => $u['id']]);
    audit('cost_add', 'car', (int)$c['id'], ['cost' => $id, 'amount' => $in['amount']]);
    return ['ok' => true];
}],
'costs.delete' => ['POST', function ($in) {
    require_user('manager');
    $x = row('SELECT * FROM car_costs WHERE id = ? AND deleted_at IS NULL', [int_in($in, 'id')]);
    if (!$x) fail('Cost not found.', 404);
    update('car_costs', ['deleted_at' => date('Y-m-d H:i:s')], 'id = ?', [$x['id']]);
    audit('cost_delete', 'car', (int)$x['car_id'], ['amount' => $x['amount'], 'category' => $x['category']]);
    return ['ok' => true];
}],
'photos.upload' => ['POST', function ($in) {
    require_user();
    $c = car_or_fail(int_in($in, 'car_id'));
    $files = $_FILES['photos'] ?? null;
    if (!$files) fail('Choose the photos to add.');
    $names = is_array($files['tmp_name']) ? $files['tmp_name'] : [$files['tmp_name']];
    $errs = is_array($files['error']) ? $files['error'] : [$files['error']];
    if (count($names) > 20) fail('Add up to 20 photos at a time.');
    $added = 0;
    foreach ($names as $i => $tmp) {
        if (($errs[$i] ?? 0) !== UPLOAD_ERR_OK) fail(($errs[$i] ?? 0) === UPLOAD_ERR_INI_SIZE ? 'A photo is too large for the server.' : 'A photo did not upload. Please try again.');
        if (!is_uploaded_file($tmp)) fail('Upload failed.');
        save_car_photo((int)$c['id'], $tmp); $added++;
    }
    audit('photos_add', 'car', (int)$c['id'], ['count' => $added]);
    return ['ok' => true, 'added' => $added];
}],
'photos.delete' => ['POST', function ($in) {
    require_user('manager');
    $p = row('SELECT * FROM car_photos WHERE id = ?', [int_in($in, 'id')]);
    if (!$p) fail('Photo not found.', 404);
    q('DELETE FROM car_photos WHERE id = ?', [$p['id']]);
    delete_photo_files($p);
    audit('photo_delete', 'car', (int)$p['car_id']);
    return ['ok' => true];
}],
'photos.cover' => ['POST', function ($in) {
    require_user('manager');
    $p = row('SELECT * FROM car_photos WHERE id = ?', [int_in($in, 'id')]);
    if (!$p) fail('Photo not found.', 404);
    q('UPDATE car_photos SET sort = sort + 1 WHERE car_id = ?', [$p['car_id']]);
    update('car_photos', ['sort' => 0], 'id = ?', [$p['id']]);
    return ['ok' => true];
}],

/* ---------- selling ---------- */
'sales.create' => ['POST', function ($in) {
    $u = require_user();
    return tx(function () use ($u, $in) {
        $c = car_or_fail(int_in($in, 'car_id'));
        $existing = null;
        if ($c['status'] === 'reserved') {
            $existing = row('SELECT * FROM sales WHERE car_id = ? AND reserved = 1 AND voided_at IS NULL ORDER BY id DESC LIMIT 1', [$c['id']]);
        } elseif (!in_array($c['status'], ['available', 'prep'], true)) fail('This car is not on sale.');
        $reserveOnly = !empty($in['reserve']);
        $name = str_in($in, 'buyer_name', 120, true);
        $phone = phone_ok(str_in($in, 'buyer_phone', 30, true), "phone number for the buyer");
        $price = money_in($in, 'price', true, false);
        if ($c['floor_price'] !== null && $price < (float)$c['floor_price'] && $u['role'] === 'sales') fail('That price is below the lowest price for this car. Ask the owner or a manager to record it.');
        $type = (string)($in['type'] ?? 'cash'); if (!in_array($type, ['cash', 'credit', 'bank'], true)) fail('Choose how the buyer is paying.');
        $now = isset($in['amount']) && $in['amount'] !== '' ? money_in($in, 'amount') : 0.0;
        $method = $now > 0 ? method_in($in) : 'cash';
        $date = date_in($in, 'date', false) ?? today();
        if ($date > today()) fail('The date cannot be in the future.');
        $tiv = 0.0; $tiCar = null;
        if (!$existing && !empty($in['trade_in']) && (float)($in['trade_in']['value'] ?? 0) > 0) {
            $t = $in['trade_in']; $tiv = money_in($t, 'value', true, false);
            $tiCar = insert('cars', ['plate' => plate_in($t), 'model' => str_in($t, 'model', 60, true), 'make' => str_in($t, 'make', 40), 'body' => in_array($t['body'] ?? '', BODIES, true) ? $t['body'] : 'sedan',
                'source' => 'tradein', 'buy_price' => $tiv, 'status' => 'prep', 'in_date' => $date, 'notes' => 'Traded in by ' . $name . '.', 'created_by' => $u['id']]);
        }
        $paidBefore = $existing ? (float)val('SELECT COALESCE(SUM(amount),0) FROM payments WHERE sale_id = ? AND voided_at IS NULL', [$existing['id']]) : 0.0;
        $data = ['buyer_name' => $name, 'buyer_phone' => $phone, 'buyer_id_no' => str_in($in, 'buyer_id_no', 30), 'buyer_kra' => str_in($in, 'buyer_kra', 30),
            'price' => $price, 'type' => $type, 'agent_id' => int_in($in, 'agent_id', false) ?: $u['id'], 'notes' => str_in($in, 'notes', 1000), 'date' => $date];
        if ($reserveOnly) {
            if ($now <= 0) fail('Enter the booking deposit.');
            $data += ['reserved' => 1, 'hold_until' => date('Y-m-d', strtotime($date . ' +' . (int)setting('hold_days', '7') . ' days'))];
        } else {
            $data['reserved'] = 0; $data['hold_until'] = null;
            $upfront = $paidBefore + $now + $tiv;
            if ($type === 'credit') {
                $months = int_in($in, 'months'); if ($months < 1 || $months > 60) fail('Choose the number of months (1 to 60).');
                $rate = isset($in['rate']) && $in['rate'] !== '' ? (float)$in['rate'] : (float)setting('credit_rate', '0');
                if ($rate < 0 || $rate > 20) fail('Check the interest rate (% a month).');
                $minDep = round($price * (float)setting('min_deposit', '0') / 100, -2);
                if ($upfront + 0.5 < $minDep && $u['role'] === 'sales') fail('The deposit is below the minimum of KES ' . number_format($minDep) . '. Ask the owner or a manager.');
                $amount = round($price - $upfront, 2);
                if ($amount <= 0) fail('The buyer has paid in full; record it as a cash sale.');
                $t = credit_terms($amount, $months, $rate);
                $data += ['credit_amount' => $amount, 'credit_months' => $months, 'credit_rate' => $rate, 'credit_interest' => $t['interest'], 'credit_monthly' => $t['monthly'], 'credit_start' => $date, 'logbook' => 'held'];
            } elseif ($type === 'bank') {
                $data['bank'] = str_in($in, 'bank', 60, true);
            } elseif ($upfront + 0.5 < $price) {
                fail('A cash sale needs the full price. Choose "Credit" for instalments, or "Reserve" for a booking deposit.');
            }
        }
        if ($existing) {
            $sid = (int)$existing['id'];
            update('sales', $data, 'id = ?', [$sid]);
        } else {
            $sid = insert('sales', $data + ['car_id' => $c['id'], 'created_by' => $u['id'], 'trade_in_car' => $tiCar, 'trade_in_value' => $tiv ?: null]);
            if ($tiv > 0) insert('payments', ['sale_id' => $sid, 'date' => $date, 'amount' => $tiv, 'method' => 'tradein', 'note' => 'Trade-in car', 'created_by' => $u['id']]);
        }
        if ($now > 0) add_payment(['sale_id' => $sid, 'date' => $date, 'amount' => $now, 'method' => $method, 'reference' => str_in($in, 'reference', 60),
            'note' => $reserveOnly ? 'Booking deposit' : ($type === 'credit' ? 'Deposit' : ($existing ? 'Balance' : 'Payment')), 'created_by' => $u['id']]);
        update('cars', $reserveOnly ? ['status' => 'reserved'] : ['status' => 'sold', 'sold_date' => $date], 'id = ?', [$c['id']]);
        audit($reserveOnly ? 'car_reserved' : 'car_sold', 'sale', $sid, ['car' => $c['plate'], 'price' => $price, 'type' => $type]);
        return ['ok' => true, 'sale_id' => $sid];
    });
}],
'sales.pay' => ['POST', function ($in) {
    $u = require_user();
    $s = load_sale(int_in($in, 'sale_id'));
    $amt = money_in($in, 'amount', true, false);
    $date = date_in($in, 'date', false) ?? today(); if ($date > today()) fail('The date cannot be in the future.');
    $id = add_payment(['sale_id' => $s['id'], 'date' => $date, 'amount' => $amt, 'method' => method_in($in), 'reference' => str_in($in, 'reference', 60),
        'note' => str_in($in, 'note', 200) ?? ($s['type'] === 'credit' ? 'Instalment' : 'Payment'), 'created_by' => $u['id']]);
    $s2 = load_sale((int)$s['id']);
    if ($s2['type'] === 'credit' && $s2['balance'] !== null && $s2['balance'] <= 0 && $s2['logbook'] === 'held') update('sales', ['logbook' => 'pending'], 'id = ?', [$s['id']]);
    audit('payment_add', 'sale', (int)$s['id'], ['payment' => $id, 'amount' => $amt]);
    return ['ok' => true, 'balance' => $s2['balance']];
}],
'sales.edit' => ['POST', function ($in) {
    $u = require_user('manager');
    $s = load_sale(int_in($in, 'id'));
    $data = ['buyer_name' => str_in($in, 'buyer_name', 120), 'buyer_phone' => phone_ok(str_in($in, 'buyer_phone', 30), 'phone number'),
        'buyer_phone2' => phone_ok(str_in($in, 'buyer_phone2', 30), 'second phone number'), 'buyer_id_no' => str_in($in, 'buyer_id_no', 30),
        'buyer_kra' => str_in($in, 'buyer_kra', 30), 'date' => date_in($in, 'date', false), 'notes' => str_in($in, 'notes', 1000),
        'price' => isset($in['price']) && $in['price'] !== '' ? money_in($in, 'price') : null];
    if ($s['type'] === 'credit') {
        $amount = money_in($in, 'credit_amount', true, false); $months = int_in($in, 'months', false); $rate = (float)($in['rate'] ?? 0);
        $t = $months ? credit_terms($amount, $months, $rate) : ['interest' => 0, 'monthly' => null];
        $data += ['credit_amount' => $amount, 'credit_months' => $months, 'credit_rate' => $rate, 'credit_interest' => $t['interest'], 'credit_monthly' => $t['monthly'],
            'credit_start' => date_in($in, 'credit_start', false)];
    }
    tx(function () use ($s, $data, $in, $u) {
        update('sales', $data, 'id = ?', [$s['id']]);
        // "balance today" on a sale loaded from the old sheet: kept as one "paid before the system" line
        if ($s['legacy'] && isset($in['balance']) && $in['balance'] !== '') {
            $bal = money_in($in, 'balance');
            q('UPDATE payments SET voided_at = NOW(), void_reason = "Balance corrected" WHERE sale_id = ? AND method = "before" AND voided_at IS NULL', [$s['id']]);
            $other = (float)val('SELECT COALESCE(SUM(amount),0) FROM payments WHERE sale_id = ? AND voided_at IS NULL', [$s['id']]);
            $s2 = load_sale((int)$s['id']);
            $before = round(($s2['payable'] ?? 0) - $bal - $other, 2);
            if ($before < 0) fail('That balance is more than the amount owed.');
            if ($before > 0) insert('payments', ['sale_id' => $s['id'], 'date' => $s2['date'] ?? today(), 'amount' => $before, 'method' => 'before', 'note' => 'Paid before the system', 'created_by' => $u['id']]);
            update('sales', ['balance_known' => 1], 'id = ?', [$s['id']]);
        }
    });
    audit('sale_edit', 'sale', (int)$s['id']);
    return ['ok' => true];
}],
'sales.logbook' => ['POST', function ($in) {
    require_user();
    $s = load_sale(int_in($in, 'id'));
    $to = (string)($in['to'] ?? '');
    if (!in_array($to, ['pending', 'initiated', 'transferred', 'held'], true)) fail('Invalid step.');
    if ($to === 'transferred' && $s['type'] === 'credit' && ($s['balance'] ?? 0) > 0) fail('The buyer still owes KES ' . number_format((float)$s['balance']) . '. Transfer the logbook when the balance is paid.');
    update('sales', ['logbook' => $to], 'id = ?', [$s['id']]);
    audit('logbook', 'sale', (int)$s['id'], ['to' => $to]);
    return ['ok' => true];
}],
'sales.void' => ['POST', function ($in) {
    require_user('owner');
    $s = load_sale(int_in($in, 'id'));
    $why = str_in($in, 'reason', 200, true);
    tx(function () use ($s, $why) {
        update('sales', ['voided_at' => date('Y-m-d H:i:s'), 'void_reason' => $why], 'id = ?', [$s['id']]);
        q('UPDATE payments SET voided_at = NOW(), void_reason = ? WHERE sale_id = ? AND voided_at IS NULL', ['Sale cancelled: ' . $why, $s['id']]);
        update('cars', ['status' => 'available', 'sold_date' => null], 'id = ?', [$s['car_id']]);
    });
    audit('sale_void', 'sale', (int)$s['id'], ['reason' => $why, 'paid' => $s['paid']]);
    return ['ok' => true];
}],
'payments.void' => ['POST', function ($in) {
    require_user('owner');
    $p = row('SELECT * FROM payments WHERE id = ? AND voided_at IS NULL', [int_in($in, 'id')]);
    if (!$p) fail('Payment not found.', 404);
    $why = str_in($in, 'reason', 200, true);
    update('payments', ['voided_at' => date('Y-m-d H:i:s'), 'void_reason' => $why], 'id = ?', [$p['id']]);
    audit('payment_void', $p['sale_id'] ? 'sale' : 'loan', (int)($p['sale_id'] ?: $p['loan_id']), ['amount' => $p['amount'], 'reason' => $why]);
    return ['ok' => true];
}],

/* ---------- logbook loans ---------- */
'loans.save' => ['POST', function ($in) {
    $u = require_user('manager');
    $id = int_in($in, 'id', false);
    $amount = money_in($in, 'amount', true, false); $months = int_in($in, 'months', false);
    $rate = isset($in['rate']) && $in['rate'] !== '' ? (float)$in['rate'] : 0.0;
    if ($rate < 0 || $rate > 30) fail('Check the interest rate (% a month).');
    $date = date_in($in, 'date', false) ?? today();
    $interest = isset($in['interest']) && $in['interest'] !== '' ? money_in($in, 'interest') : ($months ? round($amount * $rate / 100 * $months, -2) : 0);
    $data = ['date' => $date, 'borrower' => str_in($in, 'borrower', 120, true), 'phone' => phone_ok(str_in($in, 'phone', 30), 'phone number'),
        'phone2' => phone_ok(str_in($in, 'phone2', 30), 'second phone number'), 'id_no' => str_in($in, 'id_no', 30), 'vehicle' => str_in($in, 'vehicle', 80),
        'plate' => plate_in($in), 'amount' => $amount, 'months' => $months, 'rate' => $rate, 'interest' => $interest,
        'due_date' => date_in($in, 'due_date', false) ?? ($months ? add_months($date, $months) : null), 'logbook_held' => !empty($in['logbook_held']) ? 1 : 0,
        'notes' => str_in($in, 'notes', 1000)];
    if ($id) {
        $l = row('SELECT * FROM loans WHERE id = ?', [$id]); if (!$l) fail('Loan not found.', 404);
        tx(function () use ($id, $data, $in, $l, $u) {
            update('loans', $data, 'id = ?', [$id]);
            if ($l['legacy'] && isset($in['balance']) && $in['balance'] !== '') {
                $bal = money_in($in, 'balance');
                q('UPDATE payments SET voided_at = NOW(), void_reason = "Balance corrected" WHERE loan_id = ? AND method = "before" AND voided_at IS NULL', [$id]);
                $other = (float)val('SELECT COALESCE(SUM(amount),0) FROM payments WHERE loan_id = ? AND voided_at IS NULL', [$id]);
                $before = round($data['amount'] + $data['interest'] - $bal - $other, 2);
                if ($before < 0) fail('That balance is more than the amount owed.');
                if ($before > 0) insert('payments', ['loan_id' => $id, 'date' => $data['date'], 'amount' => $before, 'method' => 'before', 'note' => 'Paid before the system', 'created_by' => $u['id']]);
                update('loans', ['balance_known' => 1, 'status' => $bal <= 0 ? 'cleared' : 'active'], 'id = ?', [$id]);
            }
        });
        audit('loan_edit', 'loan', $id);
    } else {
        $id = insert('loans', $data + ['created_by' => $u['id']]);
        audit('loan_add', 'loan', $id, ['amount' => $amount, 'borrower' => $data['borrower']]);
    }
    return ['ok' => true, 'id' => $id];
}],
'loans.pay' => ['POST', function ($in) {
    $u = require_user('manager');
    $l = row('SELECT * FROM loans WHERE id = ?', [int_in($in, 'loan_id')]); if (!$l) fail('Loan not found.', 404);
    if ($l['status'] !== 'active') fail('This loan is closed.');
    $amt = money_in($in, 'amount', true, false);
    $date = date_in($in, 'date', false) ?? today(); if ($date > today()) fail('The date cannot be in the future.');
    $pid = add_payment(['loan_id' => $l['id'], 'date' => $date, 'amount' => $amt, 'method' => method_in($in), 'reference' => str_in($in, 'reference', 60), 'note' => str_in($in, 'note', 200) ?? 'Repayment', 'created_by' => $u['id']]);
    $paid = (float)val('SELECT COALESCE(SUM(amount),0) FROM payments WHERE loan_id = ? AND voided_at IS NULL', [$l['id']]);
    if ($paid + 0.5 >= (float)$l['amount'] + (float)$l['interest']) update('loans', ['status' => 'cleared', 'closed_at' => date('Y-m-d H:i:s')], 'id = ?', [$l['id']]);
    audit('loan_payment', 'loan', (int)$l['id'], ['payment' => $pid, 'amount' => $amt]);
    return ['ok' => true];
}],
'loans.close' => ['POST', function ($in) {
    require_user('owner');
    $l = row('SELECT * FROM loans WHERE id = ?', [int_in($in, 'id')]); if (!$l) fail('Loan not found.', 404);
    $to = (string)($in['to'] ?? '');
    if (!in_array($to, ['active', 'cleared', 'written_off'], true)) fail('Invalid status.');
    update('loans', ['status' => $to, 'closed_at' => $to === 'active' ? null : date('Y-m-d H:i:s')], 'id = ?', [$l['id']]);
    audit('loan_status', 'loan', (int)$l['id'], ['to' => $to, 'reason' => str_in($in, 'reason', 200)]);
    return ['ok' => true];
}],

/* ---------- yard expenses ---------- */
'expenses.add' => ['POST', function ($in) {
    $u = require_user('manager');
    $cat = (string)($in['category'] ?? ''); if (!in_array($cat, EXPENSE_TYPES, true)) fail('Choose the type of expense.');
    $id = insert('expenses', ['date' => date_in($in, 'date', false) ?? today(), 'category' => $cat, 'description' => str_in($in, 'description', 200), 'amount' => money_in($in, 'amount', true, false), 'created_by' => $u['id']]);
    audit('expense_add', 'expense', $id, ['amount' => $in['amount']]);
    return ['ok' => true];
}],
'expenses.delete' => ['POST', function ($in) {
    require_user('manager');
    $id = int_in($in, 'id');
    update('expenses', ['deleted_at' => date('Y-m-d H:i:s')], 'id = ?', [$id]);
    audit('expense_delete', 'expense', $id);
    return ['ok' => true];
}],

/* ---------- staff, settings, activity ---------- */
'users.list' => ['GET', function () { require_user('owner'); return rows('SELECT id, name, email, phone, role, active, last_login, created_at FROM users ORDER BY id'); }],
'users.save' => ['POST', function ($in) {
    $me = require_user('owner');
    $id = int_in($in, 'id', false);
    $role = (string)($in['role'] ?? 'sales'); if (!isset(ROLES[$role])) fail('Choose a role.');
    $email = strtolower((string)str_in($in, 'email', 190, true)); if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Enter a valid email address.');
    if (val('SELECT id FROM users WHERE email = ? AND id <> ?', [$email, (int)$id])) fail('Another account already uses that email.');
    $data = ['name' => str_in($in, 'name', 120, true), 'email' => $email, 'phone' => phone_ok(str_in($in, 'phone', 30), 'phone number'), 'role' => $role, 'active' => !empty($in['active']) || !$id ? 1 : 0];
    if ($id && $id === $me['id'] && ($role !== 'owner' || !$data['active'])) fail('You cannot change your own role or switch off your own account.');
    $pass = (string)($in['password'] ?? '');
    if ($pass !== '') { check_password_strength($pass); $data['password_hash'] = password_hash($pass, PASSWORD_DEFAULT); }
    elseif (!$id) fail('Set a first password for the new account.');
    if ($id) update('users', $data, 'id = ?', [$id]); else $id = insert('users', $data);
    audit($id ? 'user_save' : 'user_add', 'user', $id, ['role' => $role, 'active' => $data['active']]);
    return ['ok' => true];
}],
'settings.save' => ['POST', function ($in) {
    require_user('owner');
    set_setting('business_name', str_in($in, 'business_name', 120, true));
    foreach (['location' => 120, 'phone' => 60, 'pay_details' => 300] as $k => $max) set_setting($k, str_in($in, $k, $max));
    $rate = (float)($in['credit_rate'] ?? 0); if ($rate < 0 || $rate > 20) fail('Check the default interest rate.');
    $dep = (float)($in['min_deposit'] ?? 0); if ($dep < 0 || $dep > 100) fail('Check the minimum deposit.');
    $hold = (int)($in['hold_days'] ?? 7); if ($hold < 1 || $hold > 60) fail('Check the number of days a reservation is held.');
    set_setting('credit_rate', (string)$rate); set_setting('min_deposit', (string)$dep); set_setting('hold_days', (string)$hold);
    audit('settings_update');
    return ['ok' => true];
}],
'audit.list' => ['GET', function ($in) {
    require_user('owner');
    return ['items' => rows('SELECT a.created_at, a.action, a.entity, a.entity_id, a.details, u.name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 300'),
        'seed_issues' => json_decode((string)setting('seed_issues', '[]'), true) ?: []];
}],

];
