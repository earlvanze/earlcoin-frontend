<?php
// CORS proxy for LoftyAssist API
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Max-Age: 3600');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$url = 'https://www.loftyassist.com/api/properties';
$ctx = stream_context_create([
    'http' => [
        'timeout' => 30,
        'user_agent' => 'EARLCoin/1.0',
    ],
]);

$data = @file_get_contents($url);

if ($data === false) {
    http_response_code(502);
    echo json_encode(['error' => 'upstream fetch failed']);
    exit;
}

echo $data;