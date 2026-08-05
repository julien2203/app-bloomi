<?php
/**
 * Proxy HTML des pages de partage Bloomi (listing / dressing).
 *
 * Sert le HTML des Edge Functions Supabase sous bloomi.ch, avec
 * Content-Type: text/html; charset=utf-8 — sans redirection 302.
 *
 * Usage (via .htaccess) :
 *   /listing/{uuid}  → share-proxy.php?type=listing&id={uuid}
 *   /dressing/{uuid} → share-proxy.php?type=dressing&id={uuid}
 */

declare(strict_types=1);

const BLOOMI_SUPABASE_FUNCTIONS_BASE =
    'https://uzkrxkoussjnlyyykkul.supabase.co/functions/v1';

const BLOOMI_UUID_RE =
    '/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i';

$type = strtolower(trim((string) ($_GET['type'] ?? '')));
$id = trim((string) ($_GET['id'] ?? ''));

$functionMap = [
    'listing' => 'listing-share',
    'dressing' => 'closet-share',
];

if (!isset($functionMap[$type]) || $id === '' || !preg_match(BLOOMI_UUID_RE, $id)) {
    bloomi_share_error(400, 'Requête invalide');
}

$upstream = BLOOMI_SUPABASE_FUNCTIONS_BASE
    . '/'
    . $functionMap[$type]
    . '?id='
    . rawurlencode($id);

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
if ($method !== 'GET' && $method !== 'HEAD') {
    header('Allow: GET, HEAD');
    bloomi_share_error(405, 'Method Not Allowed');
}

$result = bloomi_fetch_upstream($upstream, $method);
if ($result === null) {
    bloomi_share_error(502, 'Impossible de charger la page de partage');
}

[$status, $body, $cacheControl] = $result;

http_response_code($status);
header('Content-Type: text/html; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: ' . ($cacheControl !== '' ? $cacheControl : 'public, max-age=300'));
header('X-Bloomi-Share-Proxy: wordpress-php');

if ($method === 'HEAD') {
    exit;
}

echo $body;
exit;

/**
 * @return array{0:int,1:string,2:string}|null
 */
function bloomi_fetch_upstream(string $url, string $method): ?array
{
    if (!function_exists('curl_init')) {
        return bloomi_fetch_upstream_file($url, $method);
    }

    $ch = curl_init($url);
    if ($ch === false) {
        return null;
    }

    $headers = [];
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 3,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_USERAGENT => 'BloomiShareProxy/1.0',
        CURLOPT_HTTPHEADER => [
            'Accept: text/html',
            'X-Forwarded-Host: bloomi.ch',
            'X-Forwarded-Proto: https',
        ],
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_NOBODY => $method === 'HEAD',
        CURLOPT_HEADERFUNCTION => static function ($curl, string $headerLine) use (&$headers): int {
            $len = strlen($headerLine);
            $parts = explode(':', $headerLine, 2);
            if (count($parts) === 2) {
                $headers[strtolower(trim($parts[0]))] = trim($parts[1]);
            }
            return $len;
        },
    ]);

    $body = curl_exec($ch);
    if ($body === false) {
        curl_close($ch);
        return null;
    }

    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($status < 100) {
        return null;
    }

    $cacheControl = $headers['cache-control'] ?? 'public, max-age=300';
    return [$status, (string) $body, $cacheControl];
}

/**
 * Fallback sans extension curl.
 *
 * @return array{0:int,1:string,2:string}|null
 */
function bloomi_fetch_upstream_file(string $url, string $method): ?array
{
    $context = stream_context_create([
        'http' => [
            'method' => $method === 'HEAD' ? 'HEAD' : 'GET',
            'timeout' => 20,
            'ignore_errors' => true,
            'header' => implode("\r\n", [
                'Accept: text/html',
                'User-Agent: BloomiShareProxy/1.0',
                'X-Forwarded-Host: bloomi.ch',
                'X-Forwarded-Proto: https',
            ]),
        ],
    ]);

    $body = @file_get_contents($url, false, $context);
    if ($body === false && $method !== 'HEAD') {
        return null;
    }

    $status = 502;
    $cacheControl = 'public, max-age=300';
    if (isset($http_response_header) && is_array($http_response_header)) {
        foreach ($http_response_header as $line) {
            if (preg_match('/^HTTP\/\S+\s+(\d+)/', $line, $m)) {
                $status = (int) $m[1];
            } elseif (stripos($line, 'Cache-Control:') === 0) {
                $cacheControl = trim(substr($line, strlen('Cache-Control:')));
            }
        }
    }

    return [$status, (string) $body, $cacheControl];
}

function bloomi_share_error(int $status, string $message): void
{
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: no-store');
    $safe = htmlspecialchars($message, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    echo '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8" />'
        . '<meta name="viewport" content="width=device-width, initial-scale=1" />'
        . '<title>Bloomi</title></head><body><p>'
        . $safe
        . '</p></body></html>';
    exit;
}
