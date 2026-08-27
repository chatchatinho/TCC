# Backend — ThermoSense Lite (PHP + MySQL)

API REST em **PHP puro** (sem framework, só PDO para falar com o MySQL). Todo o
código fica em `src/`, organizado por responsabilidade:

```
backend/
├── public/index.php      Ponto de entrada: recebe toda requisição e roteia
├── src/Database.php      Conexão PDO com o MySQL
├── src/Response.php      Helper para responder em JSON
├── src/Auth.php          Login/token de usuário
├── src/DeviceAuth.php    Autenticação do ESP32 (token do dispositivo)
├── src/AlertEngine.php   Regra que decide quando abrir/fechar um alerta
└── src/controllers/      Um arquivo por recurso (Auth, Device, Measurement, Setting, Alert)
```

## Como rodar

1. Crie o banco (uma vez só):
   ```bash
   mysql -u root -p < ../database/schema.sql
   ```
2. Configure o `.env`:
   ```bash
   cp .env.example .env
   # edite DB_USER / DB_PASS se necessário
   ```
3. Suba o servidor embutido do PHP (não precisa instalar Apache/Nginx):
   ```bash
   php -S localhost:8000 -t public public/index.php
   ```
   A API fica em `http://localhost:8000/api`.

   Prefere Apache/XAMPP? Aponte o document root para `backend/public` — o
   `.htaccess` já está configurado.

## Autenticação

- **Usuário** (app): `Authorization: Bearer <token>`, obtido em `/api/login` ou `/api/register`.
- **Dispositivo** (ESP32): `X-Device-Token: <token>`, obtido ao cadastrar o
  dispositivo em `/api/devices` (mostrado só uma vez).

## Endpoints

```
POST   /api/register                        POST   /api/measurements            (token de dispositivo)
POST   /api/login                            GET    /api/devices/{id}/measurements
GET    /api/me
POST   /api/logout                          GET    /api/settings
                                             PUT    /api/settings
GET    /api/devices
POST   /api/devices                         GET    /api/alerts
GET    /api/devices/{id}                    PATCH  /api/alerts/{id}/resolve
DELETE /api/devices/{id}
POST   /api/devices/{id}/simulate           (gera uma leitura de teste)
```

## Segurança (nível básico, mas real)

- Senhas com `password_hash`/`password_verify` (bcrypt).
- Tokens de sessão e de dispositivo: só o **hash SHA-256** fica salvo no banco.
- Todas as consultas usam **prepared statements** (PDO) — sem concatenar SQL.
- Cada usuário só enxerga os próprios dispositivos/alertas (filtrado por `user_id` em toda query).
