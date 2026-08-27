<?php

/**
 * Autenticação de DISPOSITIVOS (o ESP32, ou o botão "simular leitura").
 *
 * Cada dispositivo tem seu próprio token (gerado ao cadastrar o dispositivo
 * no app), enviado no header "X-Device-Token". É um token separado do de
 * usuário porque quem envia é o firmware, não uma pessoa logada.
 */
class DeviceAuth
{
    public static function requireDevice(): array
    {
        $token = $_SERVER['HTTP_X_DEVICE_TOKEN'] ?? '';
        if ($token === '') {
            Response::error('Token do dispositivo ausente.', 401);
        }

        $tokenHash = hash('sha256', $token);

        $db = Database::getConnection();
        $stmt = $db->prepare('SELECT * FROM devices WHERE device_token_hash = ?');
        $stmt->execute([$tokenHash]);
        $device = $stmt->fetch();

        if (!$device) {
            Response::error('Token do dispositivo inválido.', 401);
        }

        return $device;
    }
}
