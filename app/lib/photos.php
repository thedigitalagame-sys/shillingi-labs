<?php
declare(strict_types=1);

/*
 * Car photos: re-encoded as JPEG (this strips location data and anything that is not pixels),
 * at most 1600 px, plus a 480 px thumbnail. Stored under public/uploads/cars/ with random names.
 */
const PHOTO_MAX = 1600;
const PHOTO_THUMB = 480;
const PHOTO_MAX_BYTES = 12 * 1024 * 1024;

function uploads_dir(): string { return PUBLIC_DIR . '/uploads/cars'; }

/** Saves an image file as a photo of the car. Returns the new photo row id. */
function save_car_photo(int $carId, string $tmpPath): int {
    if (!function_exists('imagecreatefromstring')) fail('The server cannot process images (the PHP GD extension is off). Ask your host to enable it.');
    $bin = file_get_contents($tmpPath);
    if ($bin === false || strlen($bin) < 100) fail('That photo could not be read.');
    if (strlen($bin) > PHOTO_MAX_BYTES) fail('That photo is too large (over 12 MB).');
    $info = @getimagesizefromstring($bin);
    if (!$info || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)) fail('Photos must be JPEG, PNG or WebP images.');
    if ($info[0] * $info[1] > 40000000) fail('That photo has too many pixels. Please send a smaller copy.');
    $src = @imagecreatefromstring($bin);
    if (!$src) fail('That photo could not be read.');
    if ($info[2] === IMAGETYPE_JPEG && function_exists('exif_read_data')) {           // phones store the rotation separately
        $exif = @exif_read_data($tmpPath);
        $o = (int)($exif['Orientation'] ?? 1);
        if ($o === 3) $src = imagerotate($src, 180, 0); elseif ($o === 6) $src = imagerotate($src, -90, 0); elseif ($o === 8) $src = imagerotate($src, 90, 0);
    }
    $dir = uploads_dir() . '/' . date('Y/m');
    if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) fail('Could not create the photo folder on the server.');
    $base = date('Y/m') . '/c' . $carId . '-' . bin2hex(random_bytes(6));
    $full = resize_save($src, PHOTO_MAX, uploads_dir() . "/$base.jpg", 82);
    $thumb = resize_save($src, PHOTO_THUMB, uploads_dir() . "/{$base}_t.jpg", 74);
    imagedestroy($src);
    $sort = (int)val('SELECT COALESCE(MAX(sort), 0) + 1 FROM car_photos WHERE car_id = ?', [$carId]);
    return insert('car_photos', ['car_id' => $carId, 'file' => "cars/$base.jpg", 'thumb' => "cars/{$base}_t.jpg", 'sort' => $sort]);
}
function resize_save($src, int $max, string $path, int $q): bool {
    $w = imagesx($src); $h = imagesy($src);
    $s = min(1, $max / max($w, $h));
    $dst = $src;
    if ($s < 1) {
        $dst = imagecreatetruecolor(max(1, (int)round($w * $s)), max(1, (int)round($h * $s)));
        imagecopyresampled($dst, $src, 0, 0, 0, 0, imagesx($dst), imagesy($dst), $w, $h);
    }
    $ok = imagejpeg($dst, $path, $q);
    if ($dst !== $src) imagedestroy($dst);
    if (!$ok) fail('Could not save the photo on the server.');
    return true;
}
function delete_photo_files(array $p): void {
    foreach (['file', 'thumb'] as $k) { $f = PUBLIC_DIR . '/uploads/' . $p[$k]; if (is_file($f)) @unlink($f); }
}
