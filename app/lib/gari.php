<?php
declare(strict_types=1);

/* Car yard rules: what a sale or loan is owed, what has been paid, and instalments that are behind. */

const BODIES = ['hatch', 'sedan', 'wagon', 'suv', 'pickup', 'van'];
const PAY_METHODS = ['mpesa' => 'M-Pesa', 'bank' => 'Bank transfer', 'cash' => 'Cash', 'cheque' => 'Cheque', 'tradein' => 'Trade-in', 'before' => 'Paid before the system'];
const COST_TYPES = ['Buying commission', 'Service & oil', 'Tyres', 'Body work & paint', 'Detailing', 'Mechanical repair', 'Battery', 'NTSA transfer & inspection', 'Advertising', 'Other'];
const EXPENSE_TYPES = ['Yard rent', 'Salaries', 'Advertising', 'Electricity & water', 'Security', 'Transport', 'Licences & permits', 'Other'];
const MPESA_MAX = 250000;

function add_months(string $date, int $n): string {
    $d = new DateTime($date); $day = (int)$d->format('j');
    $d->modify('first day of this month')->modify("+$n months");
    $last = (int)$d->format('t'); $d->setDate((int)$d->format('Y'), (int)$d->format('n'), min($day, $last));
    return $d->format('Y-m-d');
}

/** Credit terms: flat monthly rate on the amount financed. */
function credit_terms(float $amount, int $months, float $rate): array {
    $interest = round($amount * $rate / 100 * $months, -2);
    $monthly = $months > 0 ? round(($amount + $interest) / $months, -2) : 0;
    return ['interest' => $interest, 'monthly' => $monthly];
}

/** Adds paid, payable, balance and the instalment schedule to a sale row (with its payments). */
function sale_figures(array $s): array {
    $paid = 0.0; foreach ($s['payments'] as $p) $paid += (float)$p['amount'];
    $interest = (float)($s['credit_interest'] ?? 0);
    $payable = $s['price'] !== null ? (float)$s['price'] + ($s['type'] === 'credit' ? $interest : 0)
        : ($s['type'] === 'credit' && $s['credit_amount'] !== null ? (float)$s['credit_amount'] + $interest : null);
    $s['paid'] = round($paid, 2);
    $s['payable'] = $payable;
    $s['balance'] = $payable === null ? null : round(max(0, $payable - $paid), 2);
    $s['sched'] = null;
    if ($s['type'] === 'credit' && !$s['reserved'] && $s['credit_amount'] !== null) {
        $credit = (float)$s['credit_amount'] + $interest;
        $upfront = $s['price'] !== null ? (float)$s['price'] - (float)$s['credit_amount'] : 0;
        $creditPaid = max(0, $paid - $upfront);
        $months = (int)$s['credit_months']; $monthly = (float)$s['credit_monthly'];
        $sched = ['credit' => $credit, 'credit_paid' => round(min($creditPaid, $credit), 2), 'due_count' => 0, 'arrears' => 0, 'next' => null, 'overdue_days' => 0,
                  'done' => $creditPaid + 0.5 >= $credit, 'dues' => []];
        if ($s['credit_start'] && $months > 0 && $monthly > 0) {
            $today = today();
            for ($i = 1; $i <= $months; $i++) $sched['dues'][] = add_months($s['credit_start'], $i);
            $sched['due_count'] = count(array_filter($sched['dues'], fn($d) => $d <= $today));
            $expected = min($credit, $sched['due_count'] * $monthly);
            $sched['arrears'] = round(max(0, $expected - $creditPaid), 2);
            $paidN = (int)floor(($creditPaid + 0.5) / $monthly);
            $sched['next'] = $sched['done'] ? null : ($sched['dues'][$paidN] ?? end($sched['dues']));
            if ($sched['arrears'] > 0 && isset($sched['dues'][$paidN])) $sched['overdue_days'] = max(0, (int)((strtotime($today) - strtotime($sched['dues'][$paidN])) / 86400));
        }
        if (!$s['balance_known']) { $sched['arrears'] = 0; $sched['overdue_days'] = 0; }   // balance from the old sheet not confirmed yet
        $s['sched'] = $sched;
    }
    return $s;
}
function loan_figures(array $l): array {
    $paid = 0.0; foreach ($l['payments'] as $p) $paid += (float)$p['amount'];
    $l['paid'] = round($paid, 2);
    $l['payable'] = round((float)$l['amount'] + (float)$l['interest'], 2);
    $l['balance'] = round(max(0, $l['payable'] - $paid), 2);
    $l['overdue'] = $l['status'] === 'active' && $l['balance'] > 0 && $l['due_date'] && $l['due_date'] < today();
    $l['overdue_days'] = $l['overdue'] ? (int)((strtotime(today()) - strtotime($l['due_date'])) / 86400) : 0;
    return $l;
}

function car_name(array $c): string { return trim(($c['year'] ? $c['year'] . ' ' : '') . ($c['make'] ? $c['make'] . ' ' : '') . $c['model']); }

function payments_for(string $col, array $ids): array {
    $by = [];
    if (!$ids) return $by;
    $in = implode(',', array_map('intval', $ids));
    foreach (rows("SELECT id, sale_id, loan_id, date, amount, method, reference, note, created_by FROM payments WHERE voided_at IS NULL AND $col IN ($in) ORDER BY date, id") as $p) {
        $p['amount'] = (float)$p['amount']; $by[(int)$p[$col]][] = $p;
    }
    return $by;
}
function load_sale(int $id): array {
    $s = row('SELECT * FROM sales WHERE id = ? AND voided_at IS NULL', [$id]);
    if (!$s) fail('Sale not found.', 404);
    $s['payments'] = payments_for('sale_id', [$id])[$id] ?? [];
    return sale_figures(cast_sale($s));
}
function cast_sale(array $s): array {
    foreach (['price', 'credit_amount', 'credit_rate', 'credit_interest', 'credit_monthly', 'trade_in_value'] as $k) $s[$k] = $s[$k] === null ? null : (float)$s[$k];
    foreach (['id', 'car_id', 'agent_id', 'trade_in_car', 'credit_months'] as $k) $s[$k] = $s[$k] === null ? null : (int)$s[$k];
    $s['reserved'] = (bool)$s['reserved']; $s['legacy'] = (bool)$s['legacy']; $s['balance_known'] = (bool)$s['balance_known'];
    return $s;
}

/** Everything the app shows, in one go. A yard has a few hundred cars at most. */
function app_state(array $u): array {
    $mgr = sees_costs($u);
    $cars = rows('SELECT * FROM cars WHERE deleted_at IS NULL ORDER BY COALESCE(in_date, DATE(created_at)) DESC, id DESC');
    $photos = []; foreach (rows('SELECT id, car_id, file, thumb FROM car_photos ORDER BY car_id, sort, id') as $p) $photos[(int)$p['car_id']][] = ['id' => (int)$p['id'], 'url' => 'uploads/' . $p['file'], 'thumb' => 'uploads/' . $p['thumb']];
    $costs = [];
    if ($mgr) foreach (rows('SELECT id, car_id, date, category, description, amount FROM car_costs WHERE deleted_at IS NULL ORDER BY date, id') as $c) { $c['amount'] = (float)$c['amount']; $costs[(int)$c['car_id']][] = $c; }
    $outCars = [];
    foreach ($cars as $c) {
        $id = (int)$c['id'];
        $o = ['id' => $id, 'plate' => $c['plate'], 'make' => $c['make'], 'model' => $c['model'], 'body' => $c['body'], 'year' => $c['year'] === null ? null : (int)$c['year'],
            'mileage' => $c['mileage'] === null ? null : (int)$c['mileage'], 'cc' => $c['cc'] === null ? null : (int)$c['cc'], 'fuel' => $c['fuel'], 'gearbox' => $c['gearbox'],
            'color' => $c['color'], 'chassis' => $c['chassis'], 'source' => $c['source'], 'ask' => $c['ask_price'] === null ? null : (float)$c['ask_price'],
            'floor' => $c['floor_price'] === null ? null : (float)$c['floor_price'], 'status' => $c['status'], 'in_date' => $c['in_date'], 'sold_date' => $c['sold_date'],
            'featured' => (bool)$c['featured'], 'inspection' => json_decode((string)$c['inspection'], true) ?: new stdClass(), 'logbook' => $c['logbook'], 'notes' => $c['notes'],
            'photos' => $photos[$id] ?? []];
        if ($mgr) { $o['buy'] = $c['buy_price'] === null ? null : (float)$c['buy_price']; $o['costs'] = $costs[$id] ?? []; }
        $outCars[] = $o;
    }
    $sales = array_map('cast_sale', rows('SELECT * FROM sales WHERE voided_at IS NULL ORDER BY COALESCE(date, DATE(created_at)) DESC, id DESC'));
    $pay = payments_for('sale_id', array_column($sales, 'id'));
    foreach ($sales as &$s) { $s['payments'] = $pay[$s['id']] ?? []; $s = sale_figures($s); }
    unset($s);
    $out = ['me' => $u, 'today' => today(), 'cars' => $outCars, 'sales' => $sales,
        'users' => array_map(fn($x) => ['id' => (int)$x['id'], 'name' => $x['name'], 'role' => $x['role'], 'active' => (bool)$x['active']], rows('SELECT id, name, role, active FROM users ORDER BY name')),
        'settings' => public_settings(), 'cost_types' => COST_TYPES, 'expense_types' => EXPENSE_TYPES, 'pay_methods' => PAY_METHODS, 'sees_costs' => $mgr];
    if ($mgr) {
        $loans = rows('SELECT * FROM loans ORDER BY status = "active" DESC, COALESCE(date, DATE(created_at)) DESC, id DESC');
        $lp = payments_for('loan_id', array_column($loans, 'id'));
        $out['loans'] = array_map(function ($l) use ($lp) {
            foreach (['amount', 'rate', 'interest'] as $k) $l[$k] = $l[$k] === null ? null : (float)$l[$k];
            $l['id'] = (int)$l['id']; $l['months'] = $l['months'] === null ? null : (int)$l['months'];
            $l['balance_known'] = (bool)$l['balance_known']; $l['legacy'] = (bool)$l['legacy']; $l['logbook_held'] = (bool)$l['logbook_held'];
            $l['payments'] = $lp[$l['id']] ?? []; return loan_figures($l);
        }, $loans);
        $out['expenses'] = array_map(fn($e) => ['id' => (int)$e['id'], 'date' => $e['date'], 'category' => $e['category'], 'description' => $e['description'], 'amount' => (float)$e['amount']],
            rows('SELECT * FROM expenses WHERE deleted_at IS NULL ORDER BY date DESC, id DESC'));
    }
    return $out;
}
function public_settings(): array {
    return ['business_name' => setting('business_name', 'Car yard'), 'location' => setting('location', ''), 'phone' => setting('phone', ''),
        'pay_details' => setting('pay_details', ''), 'credit_rate' => (float)setting('credit_rate', '0'), 'min_deposit' => (float)setting('min_deposit', '50'),
        'hold_days' => (int)setting('hold_days', '7')];
}

/* ---------- loading the client's spreadsheet at setup ---------- */
function load_seed(array $seed, string $seedDir, int $ownerId): array {
    return tx(function () use ($seed, $seedDir, $ownerId) {
        $byPlate = []; $n = ['cars' => 0, 'stock' => 0, 'photos' => 0, 'sales' => 0, 'loans' => 0];
        foreach ($seed['cars'] as $c) {
            $insp = array_filter($c['check'] ?? [], fn($v) => $v !== null && $v !== '');
            $noModel = trim((string)$c['model']) === '';   // e.g. "Subaru" on the sheet: keep it as the name, not "Subaru Subaru"
            $id = insert('cars', ['plate' => $c['plate'] ?: null, 'make' => $noModel ? null : ($c['make'] ?: null), 'model' => $noModel ? ($c['sheet_name'] ?: $c['make'] ?: 'Car') : $c['model'],
                'body' => in_array($c['body'], BODIES, true) ? $c['body'] : 'sedan', 'fuel' => $c['fuel'], 'color' => $c['color'] ?? null,
                'ask_price' => $c['ask'], 'floor_price' => null, 'status' => $c['status'], 'in_date' => $c['in_date'], 'inspection' => $insp ? json_encode($insp) : null,
                'logbook' => $c['logbook'] ?? null, 'notes' => 'Loaded from the Car Details sheet' . ($c['sheet_name'] && $c['sheet_name'] !== $c['model'] ? ' (written there as "' . $c['sheet_name'] . '")' : '') . '.',
                'created_by' => $ownerId]);
            $byPlate[$c['plate']] = ['id' => $id, 'c' => $c];
            $n['cars']++; if ($c['status'] !== 'sold') $n['stock']++;
            foreach ($c['photos'] ?? [] as $rel) {
                $f = $seedDir . '/photos/' . $rel;
                if (is_file($f)) { save_car_photo($id, $f); $n['photos']++; }
            }
        }
        $credit = [];
        foreach ($seed['credit_sales'] as $s) $credit[$s['plate']] = $s;
        // a sale for every sold car: with the buyer and credit balance where the sheet has them
        foreach ($byPlate as $plate => ['id' => $carId, 'c' => $c]) {
            if ($c['status'] !== 'sold') continue;
            $s = $credit[$plate] ?? null;
            $isCredit = $s && $s['amount'] !== null;
            $sid = insert('sales', ['car_id' => $carId, 'date' => $s['date'] ?? null, 'buyer_name' => $s['name'] ?? null, 'buyer_phone' => $s['phone'] ?? null,
                'buyer_phone2' => $s['phone2'] ?? null, 'price' => null, 'type' => $isCredit ? 'credit' : 'cash', 'credit_amount' => $isCredit ? $s['amount'] : null,
                'credit_months' => $isCredit ? $s['months'] : null, 'credit_rate' => $isCredit ? 0 : null, 'credit_interest' => $isCredit ? 0 : null,
                'credit_monthly' => $isCredit && $s['months'] ? round($s['amount'] / $s['months'], -2) : null, 'credit_start' => $isCredit ? ($s['date'] ?? null) : null,
                'balance_known' => $isCredit ? ($s['balance_known'] ? 1 : 0) : 1,
                'logbook' => ($c['transferred'] ?? false) ? 'transferred' : ($isCredit ? 'held' : 'pending'), 'legacy' => 1, 'created_by' => $ownerId,
                'notes' => $s ? 'From the Loan Details sheet.' : 'Sold before the system; price and buyer were not on the sheet.']);
            if ($isCredit && $s['balance_known'] && $s['amount'] > $s['balance'])
                insert('payments', ['sale_id' => $sid, 'date' => $s['date'] ?? today(), 'amount' => $s['amount'] - $s['balance'], 'method' => 'before', 'note' => 'Paid before the system (from the sheet)', 'created_by' => $ownerId]);
            if ($s) update('cars', ['sold_date' => $s['date'] ?? null], 'id = ?', [$carId]);
            $n['sales']++;
        }
        foreach ($seed['loans'] as $l) {
            $due = ($l['date'] && $l['months']) ? add_months($l['date'], (int)$l['months']) : null;
            $lid = insert('loans', ['date' => $l['date'], 'borrower' => $l['name'] ?: 'Unknown', 'phone' => $l['phone'], 'phone2' => $l['phone2'], 'vehicle' => $l['vehicle'] ?: null,
                'plate' => $l['plate'] ?: null, 'amount' => (float)$l['amount'], 'months' => $l['months'], 'rate' => 0, 'interest' => 0, 'due_date' => $due,
                'balance_known' => $l['balance_known'] ? 1 : 0, 'status' => ($l['balance_known'] && (float)$l['balance'] <= 0) ? 'cleared' : 'active',
                'notes' => trim('From the Loan Details sheet. ' . ($l['notes'] ?? '')), 'legacy' => 1, 'created_by' => $ownerId]);
            if ($l['balance_known'] && $l['amount'] > $l['balance'])
                insert('payments', ['loan_id' => $lid, 'date' => $l['date'] ?? today(), 'amount' => $l['amount'] - $l['balance'], 'method' => 'before', 'note' => 'Paid before the system (from the sheet)', 'created_by' => $ownerId]);
            $n['loans']++;
        }
        set_setting('seed_issues', json_encode($seed['issues'] ?? []));
        audit('seed_loaded', null, null, $n);
        return $n;
    });
}
