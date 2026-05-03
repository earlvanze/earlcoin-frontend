<?php
// CORS proxy for Lofty APIs used by the EarlCoin frontend.
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Max-Age: 3600');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$source = $_GET['source'] ?? 'assist';
$targets = [
    'assist' => 'https://www.loftyassist.com/api/properties',
    'marketplace' => 'https://api.lofty.ai/prod/properties/v2/marketplace',
    'lp' => 'https://lp.lofty.ai/prod/liquidity/v1/marketplace',
];

if (!array_key_exists($source, $targets)) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid source']);
    exit;
}

$headers = [
    'Accept: application/json',
    'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

$ch = curl_init($targets[$source]);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_HTTPHEADER => $headers,
]);

$data = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE) ?: 502;
$error = curl_error($ch);
curl_close($ch);

if ($data === false || $status >= 400) {
    http_response_code(502);
    echo json_encode([
        'error' => 'upstream fetch failed',
        'source' => $source,
        'status' => $status,
        'message' => $error ?: substr((string)$data, 0, 200),
    ]);
    exit;
}

echo $data;
