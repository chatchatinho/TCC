<?php

class DeviceController
{
    // Se um dispositivo não manda leitura há mais que isso, consideramos "offline".
    private const ONLINE_THRESHOLD_SECONDS = 120;

    public static function index(): void
    {
        $user = Auth::requireUser();
        $db = Database::getConnection();

        $stmt = $db->prepare(
            'SELECT d.id, d.name, d.last_seen_at, d.created_at,
                    m.temperature, m.humidity, m.measured_at
             FROM devices d
             LEFT JOIN measurements m ON m.id = (
                 SELECT id FROM measurements
                 WHERE device_id = d.id
                 ORDER BY measured_at DESC LIMIT 1
             )
             WHERE d.user_id = ?
             ORDER BY d.created_at ASC'
        );
        $stmt->execute([$user['id']]);
        $devices = $stmt->fetchAll();

        foreach ($devices as &$device) {
            $device['status'] = self::status($device['last_seen_at']);
        }

        Response::json($devices);
    }

    public static function show(int $id): void
    {
        $device = self::findOwnedDevice($id);
        $device['status'] = self::status($device['last_seen_at']);
        Response::json($device);
    }

    public static function store(): void
    {
        $user = Auth::requireUser();
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $name = trim($data['name'] ?? '');

        if ($name === '') {
            Response::error('Informe um nome para o dispositivo.');
        }

        $token = bin2hex(random_bytes(16));
        $tokenHash = hash('sha256', $token);

        $db = Database::getConnection();
        $stmt = $db->prepare(
            'INSERT INTO devices (user_id, name, device_token_hash) VALUES (?, ?, ?)'
        );
        $stmt->execute([$user['id'], $name, $tokenHash]);

        Response::json([
            'id' => (int) $db->lastInsertId(),
            'name' => $name,
            // Só é exibido aqui, uma vez: o app precisa mostrar isso ao usuário
            // para ele configurar no firmware do ESP32.
            'device_token' => $token,
        ], 201);
    }

    public static function destroy(int $id): void
    {
        self::findOwnedDevice($id);
        $db = Database::getConnection();
        $db->prepare('DELETE FROM devices WHERE id = ?')->execute([$id]);
        Response::json(['message' => 'Dispositivo removido.']);
    }

    // Gera uma leitura aleatória, útil para testar o app sem o ESP32 físico.
    public static function simulate(int $id): void
    {
        self::findOwnedDevice($id);

        $temperature = round(mt_rand(150, 350) / 10, 1);
        $humidity = round(mt_rand(300, 900) / 10, 1);

        // 1 em cada 8 leituras simuladas sai da faixa de propósito, para
        // demonstrar o funcionamento dos alertas.
        if (mt_rand(1, 8) === 1) {
            $temperature = mt_rand(0, 1) ? 42.0 : 2.0;
        }

        $measurement = MeasurementController::ingest($id, $temperature, $humidity);
        Response::json($measurement, 201);
    }

    public static function findOwnedDevice(int $id): array
    {
        $user = Auth::requireUser();
        $db = Database::getConnection();
        $stmt = $db->prepare('SELECT * FROM devices WHERE id = ? AND user_id = ?');
        $stmt->execute([$id, $user['id']]);
        $device = $stmt->fetch();

        if (!$device) {
            Response::error('Dispositivo não encontrado.', 404);
        }

        return $device;
    }

    private static function status(?string $lastSeenAt): string
    {
        if ($lastSeenAt === null) {
            return 'sem_dados';
        }
        $seconds = time() - strtotime($lastSeenAt);
        return $seconds <= self::ONLINE_THRESHOLD_SECONDS ? 'online' : 'offline';
    }
}
