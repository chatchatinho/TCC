<?php

class AlertController
{
    public static function index(): void
    {
        $user = Auth::requireUser();
        $db = Database::getConnection();

        $stmt = $db->prepare(
            'SELECT a.id, a.variable, a.direction, a.value, a.limit_value, a.status, a.created_at, a.resolved_at,
                    d.name AS device_name
             FROM alerts a
             JOIN devices d ON d.id = a.device_id
             WHERE a.user_id = ?
             ORDER BY a.created_at DESC
             LIMIT 100'
        );
        $stmt->execute([$user['id']]);

        Response::json($stmt->fetchAll());
    }

    public static function resolve(int $id): void
    {
        $user = Auth::requireUser();
        $db = Database::getConnection();

        $stmt = $db->prepare('SELECT id FROM alerts WHERE id = ? AND user_id = ?');
        $stmt->execute([$id, $user['id']]);
        if (!$stmt->fetch()) {
            Response::error('Alerta não encontrado.', 404);
        }

        $db->prepare("UPDATE alerts SET status = 'resolved', resolved_at = NOW() WHERE id = ?")
            ->execute([$id]);

        Response::json(['message' => 'Alerta marcado como resolvido.']);
    }
}
