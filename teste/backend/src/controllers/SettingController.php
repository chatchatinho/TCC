<?php

class SettingController
{
    public static function show(): void
    {
        $user = Auth::requireUser();
        $db = Database::getConnection();

        $stmt = $db->prepare(
            'SELECT temp_min, temp_max, humidity_min, humidity_max FROM settings WHERE user_id = ?'
        );
        $stmt->execute([$user['id']]);
        $settings = $stmt->fetch();

        if (!$settings) {
            $db->prepare('INSERT INTO settings (user_id) VALUES (?)')->execute([$user['id']]);
            $stmt->execute([$user['id']]);
            $settings = $stmt->fetch();
        }

        Response::json($settings);
    }

    public static function update(): void
    {
        $user = Auth::requireUser();
        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        $tempMin = (float) ($data['temp_min'] ?? 0);
        $tempMax = (float) ($data['temp_max'] ?? 0);
        $humidityMin = (float) ($data['humidity_min'] ?? 0);
        $humidityMax = (float) ($data['humidity_max'] ?? 0);

        if ($tempMin >= $tempMax || $humidityMin >= $humidityMax) {
            Response::error('O valor mínimo deve ser menor que o máximo.');
        }

        $db = Database::getConnection();
        $stmt = $db->prepare(
            'UPDATE settings SET temp_min = ?, temp_max = ?, humidity_min = ?, humidity_max = ? WHERE user_id = ?'
        );
        $stmt->execute([$tempMin, $tempMax, $humidityMin, $humidityMax, $user['id']]);

        Response::json(['message' => 'Configurações atualizadas.']);
    }
}
