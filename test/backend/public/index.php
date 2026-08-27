<?php

declare(strict_types=1);

require __DIR__ . '/../src/Database.php';
require __DIR__ . '/../src/Response.php';
require __DIR__ . '/../src/Auth.php';
require __DIR__ . '/../src/DeviceAuth.php';
require __DIR__ . '/../src/AlertEngine.php';
require __DIR__ . '/../src/controllers/AuthController.php';
require __DIR__ . '/../src/controllers/DeviceController.php';
require __DIR__ . '/../src/controllers/MeasurementController.php';
require __DIR__ . '/../src/controllers/SettingController.php';
require __DIR__ . '/../src/controllers/AlertController.php';

// Permite que o app Flutter (rodando em outra origem/porta) acesse a API.
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Device-Token');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Roteador simples: casa método + caminho e chama o controller correspondente.
// Cada rota chama Response::json()/Response::error() no final, que já encerra
// a requisição — por isso não precisamos tratar o "retorno" do match.
try {
    match (true) {
        $method === 'POST' && $path === '/api/register' => AuthController::register(),
        $method === 'POST' && $path === '/api/login' => AuthController::login(),
        $method === 'GET' && $path === '/api/me' => AuthController::me(),
        $method === 'POST' && $path === '/api/logout' => AuthController::logout(),

        $method === 'GET' && $path === '/api/devices' => DeviceController::index(),
        $method === 'POST' && $path === '/api/devices' => DeviceController::store(),
        $method === 'GET' && preg_match('#^/api/devices/(\d+)$#', $path, $m) === 1
            => DeviceController::show((int) $m[1]),
        $method === 'DELETE' && preg_match('#^/api/devices/(\d+)$#', $path, $m) === 1
            => DeviceController::destroy((int) $m[1]),
        $method === 'POST' && preg_match('#^/api/devices/(\d+)/simulate$#', $path, $m) === 1
            => DeviceController::simulate((int) $m[1]),
        $method === 'GET' && preg_match('#^/api/devices/(\d+)/measurements$#', $path, $m) === 1
            => MeasurementController::history((int) $m[1]),

        $method === 'POST' && $path === '/api/measurements' => MeasurementController::store(),

        $method === 'GET' && $path === '/api/settings' => SettingController::show(),
        $method === 'PUT' && $path === '/api/settings' => SettingController::update(),

        $method === 'GET' && $path === '/api/alerts' => AlertController::index(),
        $method === 'PATCH' && preg_match('#^/api/alerts/(\d+)/resolve$#', $path, $m) === 1
            => AlertController::resolve((int) $m[1]),

        default => Response::error('Rota não encontrada.', 404),
    };
} catch (Throwable $e) {
    Response::error('Erro interno no servidor: ' . $e->getMessage(), 500);
}
