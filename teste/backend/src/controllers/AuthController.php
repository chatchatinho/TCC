<?php

class AuthController
{
    public static function register(): void
    {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        $name = trim($data['name'] ?? '');
        $email = strtolower(trim($data['email'] ?? ''));
        $password = $data['password'] ?? '';

        if ($name === '' || $email === '' || $password === '') {
            Response::error('Preencha nome, e-mail e senha.');
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::error('E-mail inválido.');
        }
        if (strlen($password) < 6) {
            Response::error('A senha deve ter pelo menos 6 caracteres.');
        }

        $db = Database::getConnection();

        $stmt = $db->prepare('SELECT id FROM users WHERE email = ?');
        $stmt->execute([$email]);
        if ($stmt->fetch()) {
            Response::error('Este e-mail já está cadastrado.', 409);
        }

        $passwordHash = password_hash($password, PASSWORD_DEFAULT);

        $stmt = $db->prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)');
        $stmt->execute([$name, $email, $passwordHash]);
        $userId = (int) $db->lastInsertId();

        // Cria a configuração de alerta padrão para o novo usuário.
        $db->prepare('INSERT INTO settings (user_id) VALUES (?)')->execute([$userId]);

        $token = Auth::generateToken($userId);

        Response::json([
            'token' => $token,
            'user' => ['id' => $userId, 'name' => $name, 'email' => $email],
        ], 201);
    }

    public static function login(): void
    {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $email = strtolower(trim($data['email'] ?? ''));
        $password = $data['password'] ?? '';

        $db = Database::getConnection();
        $stmt = $db->prepare('SELECT * FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            Response::error('E-mail ou senha incorretos.', 401);
        }

        $token = Auth::generateToken((int) $user['id']);

        Response::json([
            'token' => $token,
            'user' => ['id' => $user['id'], 'name' => $user['name'], 'email' => $user['email']],
        ]);
    }

    public static function me(): void
    {
        $user = Auth::requireUser();
        Response::json([
            'id' => $user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
        ]);
    }

    public static function logout(): void
    {
        Auth::requireUser();
        Auth::revokeCurrentToken();
        Response::json(['message' => 'Sessão encerrada.']);
    }
}
