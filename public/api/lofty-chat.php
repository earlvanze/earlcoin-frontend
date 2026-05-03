<?php
// Server-side bridge from the frontend chat box to LoftyAssist MCP.
// Set LOFTYASSIST_MCP_TOKEN in Hostinger/PHP environment when auth is required.
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$messages = $input['messages'] ?? [];
$agent = $input['agent'] ?? 'lofty-assist-intel';

if (!is_array($messages) || count($messages) === 0) {
    http_response_code(400);
    echo json_encode(['error' => 'messages are required']);
    exit;
}

$promptParts = [];
foreach ($messages as $message) {
    $role = preg_replace('/[^a-z_\-]/i', '', (string)($message['role'] ?? 'user'));
    $content = trim((string)($message['content'] ?? ''));
    if ($content !== '') {
        $promptParts[] = strtoupper($role) . ': ' . $content;
    }
}
$prompt = trim(implode("\n\n", $promptParts));

if ($prompt === '') {
    http_response_code(400);
    echo json_encode(['error' => 'prompt is empty']);
    exit;
}

$token = getenv('LOFTYASSIST_MCP_TOKEN') ?: getenv('LOFTYASSIST_API_KEY') ?: getenv('MCP_AUTH_TOKEN') ?: '';
if ($token === '') {
    http_response_code(503);
    echo json_encode([
        'error' => 'LoftyAssist MCP token is not configured on the server',
        'hint' => 'Set LOFTYASSIST_API_KEY or LOFTYASSIST_MCP_TOKEN in the hosting environment, then redeploy or reload PHP.',
    ]);
    exit;
}

function mcp_request($method, $params, $token, $id) {
    $payload = json_encode([
        'jsonrpc' => '2.0',
        'id' => $id,
        'method' => $method,
        'params' => $params,
    ]);

    $headers = [
        'Accept: application/json, text/event-stream',
        'Content-Type: application/json',
        'Authorization: Bearer ' . $token,
        'User-Agent: EarlCoin-LoftyAdvisor/1.0',
    ];

    $ch = curl_init('https://www.loftyassist.com/mcp');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 45,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => $headers,
    ]);

    $body = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE) ?: 502;
    $error = curl_error($ch);
    curl_close($ch);

    if ($body === false || $status >= 400) {
        throw new Exception($error ?: ('MCP HTTP ' . $status . ': ' . substr((string)$body, 0, 300)));
    }

    // Some MCP streamable HTTP servers answer as SSE. Extract the first JSON data frame.
    if (strpos((string)$body, 'data:') !== false) {
        foreach (preg_split('/\r?\n/', (string)$body) as $line) {
            if (str_starts_with($line, 'data:')) {
                $candidate = trim(substr($line, 5));
                if ($candidate !== '' && $candidate !== '[DONE]') {
                    $body = $candidate;
                    break;
                }
            }
        }
    }

    $decoded = json_decode((string)$body, true);
    if (!is_array($decoded)) {
        throw new Exception('MCP returned non-JSON response: ' . substr((string)$body, 0, 300));
    }
    if (isset($decoded['error'])) {
        $msg = is_array($decoded['error']) ? ($decoded['error']['message'] ?? json_encode($decoded['error'])) : (string)$decoded['error'];
        throw new Exception($msg);
    }
    return $decoded['result'] ?? $decoded;
}

function result_text($result) {
    if (is_string($result)) return $result;
    if (isset($result['content']) && is_array($result['content'])) {
        $parts = [];
        foreach ($result['content'] as $part) {
            if (isset($part['text'])) $parts[] = $part['text'];
            elseif (is_string($part)) $parts[] = $part;
        }
        if ($parts) return implode("\n", $parts);
    }
    if (isset($result['answer'])) return (string)$result['answer'];
    if (isset($result['text'])) return (string)$result['text'];
    return json_encode($result, JSON_PRETTY_PRINT);
}

try {
    // Initialize if the MCP server expects a lifecycle handshake. Ignore failures,
    // because some deployments expose a direct tool-call gateway only.
    try {
        mcp_request('initialize', [
            'protocolVersion' => '2024-11-05',
            'capabilities' => new stdClass(),
            'clientInfo' => ['name' => 'EarlCoin Lofty Advisor', 'version' => '1.0.0'],
        ], $token, 1);
    } catch (Exception $ignored) {}

    $toolNames = [
        $agent,
        'lofty_assist_intel',
        'lofty-assist-intel',
        'chat',
        'ask',
    ];

    $lastError = null;
    foreach (array_unique($toolNames) as $toolName) {
        try {
            $result = mcp_request('tools/call', [
                'name' => $toolName,
                'arguments' => [
                    'prompt' => $prompt,
                    'question' => $prompt,
                    'messages' => $messages,
                ],
            ], $token, 10);

            echo json_encode([
                'answer' => result_text($result),
                'tool' => $toolName,
            ]);
            exit;
        } catch (Exception $e) {
            $lastError = $e->getMessage();
        }
    }

    throw new Exception($lastError ?: 'No compatible LoftyAssist MCP tool found');
} catch (Exception $e) {
    http_response_code(502);
    echo json_encode(['error' => $e->getMessage()]);
}
