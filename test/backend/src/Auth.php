<?php

/**
 * Autenticação de USUÁRIOS (o app Flutter).
 *
 * Modelo simples de "token opaco": no login geramos uma string aleatória,
 * devolvemos ela para o cliente e guardamos só o HASH no banco (o token em
 * texto puro nunca fica salvo, só o cliente sabe ele). O app manda esse
 * token no header "Authorization: Bearer <token>" em toda requisição.
 */
class Auth
{
    private const TOKEN_TTL_DAYS = 7;

    public static function generateToken(int $userId): string
    {
        $token = bin2hex(random_bytes(32));
        $tokenHash = hash('sha256', $token);
        $expiresAt = date('Y-m-d H:i:s', strtotime('+' . self::TOKEN_TTL_DAYS . ' days'));

        $db = Database::getConnection();
        $stmt = $db->prepare(
            'INSERT INTO auth_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
        );
        $stmt->execute([$userId, $tokenHash, $expiresAt]);

        return $token;
    }

    public static function currentUser(): ?array
    {
        $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (!preg_match('/Bearer\s+(\S+)/', $header, $matches)) {
            return null;
        }

        $tokenHash = hash('sha256', $matches[1]);

        $db = Database::getConnection();
        $stmt = $db->prepare(
            'SELECT u.* FROM auth_tokens t
             JOIN users u ON u.id = t.user_id
             WHERE t.token_hash = ? AND t.expires_at > NOW()'
        );
        $stmt->execute([$tokenHash]);
        $user = $stmt->fetch();

        return $user ?: null;
    }

    public static function requireUser(): array
    {
        $user = self::currentUser();
        if (!$user) {
            Response::error('Não autenticado. Faça login novamente.', 401);
        }
        return $user;
    }

    public static function revokeCurrentToken(): void
    {
        $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (!preg_match('/Bearer\s+(\S+)/', $header, $matches)) {
            return;
        }
        $tokenHash = hash('sha256', $matches[1]);
        $db = Database::getConnection();
        $db->prepare('DELETE FROM auth_tokens WHERE token_hash = ?')->execute([$tokenHash]);
    }
}
