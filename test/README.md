# ThermoSense Lite — versão simplificada do TCC

Versão reduzida do sistema de monitoramento de temperatura e umidade com
ESP32 (branch `claude/esp32-temp-humidity-monitoring-k1kgji` deste
repositório). Mesmo conceito — usuário cadastra dispositivos ESP32, recebe
leituras de temperatura/umidade, vê histórico e alertas quando os valores
saem da faixa configurada — só que com uma pilha de tecnologia bem mais
simples de entender e rodar, útil como material de apoio/estudo ou como
segunda implementação do mesmo TCC.

## O que mudou em relação ao projeto original

| | Original (`/backend`, `/frontend`) | Lite (`/teste`) |
|---|---|---|
| Backend | Node.js + Express + Prisma | **PHP puro** (sem framework), PDO |
| Frontend | React (SPA web) | **Dart / Flutter** (web, Android e iOS com o mesmo código) |
| Banco de dados | PostgreSQL | **MySQL** |
| Autenticação | JWT em cookie httpOnly | Token opaco simples (Bearer), hash salvo no banco |
| Alertas | Ideal + tolerância, min/max opcional, notificações por variável | Direto: mínimo e máximo por variável |
| Extras removidos | Foto de perfil, recuperação de senha por e-mail, tema/aparência, exportação CSV, notificações por dispositivo com contagem de não lidas | *(fora do escopo — o foco é o núcleo do monitoramento)* |
| Extras mantidos | Cadastro/login, dispositivos com token, ingestão de leituras, histórico, motor de alertas (evento, sem spam), simulação sem hardware, firmware ESP32 | ✅ todos |

A ideia foi manter **o mesmo modelo de dados e o mesmo fluxo** (usuário →
dispositivo → leitura → alerta), mas com código que dá para ler de ponta a
ponta em uma tarde, sem ORM, sem build de frontend e sem configuração de
JWT/cookies — bom ponto de partida para quem está aprendendo, mas seguindo
práticas reais (senha com hash, tokens com hash, prepared statements,
isolamento entre usuários).

## Estrutura

```
test/
├── database/schema.sql   Schema do MySQL (tabelas + índices)
├── backend/               API REST em PHP — ver backend/README.md
├── app/                   App Flutter (Dart) — ver app/README.md
└── esp32/                 Firmware do ESP32 — ver esp32/README.md
```

## Como rodar (passo a passo)

### 1. Banco de dados (MySQL)

```bash
mysql -u root -p < database/schema.sql
```

### 2. Backend (PHP)

```bash
cd backend
cp .env.example .env      # ajuste usuário/senha do MySQL se precisar
php -S localhost:8000 -t public public/index.php
```

### 3. App (Flutter)

```bash
cd app
flutter pub get
flutter run -d chrome
```

Cadastre uma conta pelo próprio app, crie um dispositivo e use o botão
**"Simular leitura"** na tela do dispositivo para gerar dados sem precisar
do ESP32 físico (1 a cada 8 leituras simuladas sai da faixa de propósito,
para você ver um alerta sendo criado).

### 4. ESP32 (opcional)

Veja `esp32/README.md` para ligar um ESP32 + DHT11 de verdade e enviar
leituras reais para a mesma API.

## Requisitos

- PHP 8.1+ com extensão `pdo_mysql`
- MySQL 8 (ou MariaDB equivalente)
- Flutter SDK 3.x
- (Opcional) Arduino IDE + placa ESP32 + sensor DHT11
