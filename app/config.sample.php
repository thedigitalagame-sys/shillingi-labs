<?php
// Copy this file to config.php and fill in the values from cPanel.
return [
    'db' => [
        'host' => 'localhost',
        'name' => 'cpaneluser_gari',      // MySQL database created in cPanel
        'user' => 'cpaneluser_gari',      // MySQL user with ALL PRIVILEGES on that database
        'pass' => 'CHANGE-ME',
    ],
    // Public address of the system, no trailing slash.
    'app_url' => 'https://driveline.shilingilabs.co.ke',
    // One-time key for setup.php (creates the first owner account). Use 20+ random characters.
    'setup_key' => 'CHANGE-ME-TO-A-LONG-RANDOM-STRING',
    'timezone' => 'Africa/Nairobi',
    'debug' => false,
];
