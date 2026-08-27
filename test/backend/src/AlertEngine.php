<?php

/**
 * Motor de alertas: roda a cada leitura nova e decide se deve abrir ou
 * fechar um alerta para temperatura/umidade.
 *
 * Igual ao TCC original, um alerta é um "evento" (começa quando o valor sai
 * da faixa, termina quando volta ao normal) — assim leituras seguidas fora
 * da faixa não geram um alerta novo a cada vez, só o primeiro.
 */
class AlertEngine
{
    public static function evaluate(int $deviceId, float $temperature, float $humidity): void
    {
        $db = Database::getConnection();

        $stmt = $db->prepare(
            'SELECT s.* FROM settings s
             JOIN devices d ON d.user_id = s.user_id
             WHERE d.id = ?'
        );
        $stmt->execute([$deviceId]);
        $settings = $stmt->fetch();

        if (!$settings) {
            return;
        }

        self::check(
            $deviceId,
            (int) $settings['user_id'],
            'temperature',
            $temperature,
            (float) $settings['temp_min'],
            (float) $settings['temp_max']
        );

        self::check(
            $deviceId,
            (int) $settings['user_id'],
            'humidity',
            $humidity,
            (float) $settings['humidity_min'],
            (float) $settings['humidity_max']
        );
    }

    private static function check(int $deviceId, int $userId, string $variable, float $value, float $min, float $max): void
    {
        $db = Database::getConnection();
        $outOfRange = $value < $min || $value > $max;

        $stmt = $db->prepare(
            "SELECT id FROM alerts WHERE device_id = ? AND variable = ? AND status = 'active'"
        );
        $stmt->execute([$deviceId, $variable]);
        $activeAlert = $stmt->fetch();

        if ($outOfRange && !$activeAlert) {
            $direction = $value > $max ? 'acima' : 'abaixo';
            $limit = $direction === 'acima' ? $max : $min;

            $db->prepare(
                "INSERT INTO alerts (user_id, device_id, variable, direction, value, limit_value, status)
                 VALUES (?, ?, ?, ?, ?, ?, 'active')"
            )->execute([$userId, $deviceId, $variable, $direction, $value, $limit]);
        } elseif (!$outOfRange && $activeAlert) {
            $db->prepare(
                "UPDATE alerts SET status = 'resolved', resolved_at = NOW() WHERE id = ?"
            )->execute([$activeAlert['id']]);
        }
    }
}
