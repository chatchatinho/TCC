<?php

class MeasurementController
{
    // Chamado pelo ESP32 (autenticado com o token do dispositivo).
    public static function store(): void
    {
        $device = DeviceAuth::requireDevice();
        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        if (!isset($data['temperature']) || !isset($data['humidity'])) {
            Response::error('Envie temperature e humidity.');
        }

        $measurement = self::ingest(
            (int) $device['id'],
            (float) $data['temperature'],
            (float) $data['humidity']
        );

        Response::json($measurement, 201);
    }

    // Regra compartilhada entre leituras reais (ESP32) e simuladas (botão no app).
    public static function ingest(int $deviceId, float $temperature, float $humidity): array
    {
        $db = Database::getConnection();

        $stmt = $db->prepare(
            'INSERT INTO measurements (device_id, temperature, humidity, measured_at) VALUES (?, ?, ?, NOW())'
        );
        $stmt->execute([$deviceId, $temperature, $humidity]);
        $measurementId = (int) $db->lastInsertId();

        $db->prepare('UPDATE devices SET last_seen_at = NOW() WHERE id = ?')->execute([$deviceId]);

        AlertEngine::evaluate($deviceId, $temperature, $humidity);

        return [
            'id' => $measurementId,
            'device_id' => $deviceId,
            'temperature' => $temperature,
            'humidity' => $humidity,
            'measured_at' => date('Y-m-d H:i:s'),
        ];
    }

    public static function history(int $deviceId): void
    {
        DeviceController::findOwnedDevice($deviceId);

        $limit = isset($_GET['limit']) ? min((int) $_GET['limit'], 500) : 100;

        $db = Database::getConnection();
        $stmt = $db->prepare(
            'SELECT id, temperature, humidity, measured_at
             FROM measurements
             WHERE device_id = ?
             ORDER BY measured_at DESC
             LIMIT ?'
        );
        $stmt->bindValue(1, $deviceId, PDO::PARAM_INT);
        $stmt->bindValue(2, $limit, PDO::PARAM_INT);
        $stmt->execute();

        Response::json($stmt->fetchAll());
    }
}
