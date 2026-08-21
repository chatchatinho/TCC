# Backend

API REST (Node.js + Express) e camada de banco de dados (Prisma sobre PostgreSQL) do TCC.

## Pré-requisitos

- Node.js 20+
- PostgreSQL 16 rodando localmente

## Configuração

1. Crie um banco e um usuário no PostgreSQL, por exemplo:

   ```sql
   CREATE USER tcc_dev WITH PASSWORD 'sua_senha' CREATEDB;
   CREATE DATABASE tcc_dev OWNER tcc_dev;
   ```

   O `CREATEDB` é necessário porque o Prisma cria um "shadow database" temporário durante
   `prisma migrate dev` para detectar divergências de schema.

2. Copie `.env.example` para `.env` e preencha `DATABASE_URL` com as credenciais acima.

3. Instale as dependências:

   ```bash
   npm install
   ```

## Rodando as migrations

```bash
npm run prisma:migrate
```

Cria/atualiza as tabelas `users`, `devices`, `measurements`, `settings` e `alerts` conforme
`prisma/schema.prisma`. O modelo completo e as decisões de modelagem estão documentados em
`../docs/01-arquitetura-e-decisoes.md`.

## Populando dados de demonstração

```bash
npm run db:seed
```

Cria:

- 1 usuário de teste (`teste@tcc.local` / `Senha@Teste123`) — **apenas para ambiente local de
  desenvolvimento**, nunca use em produção;
- 1 dispositivo de teste (`ESP32-001`) com um token de API gerado na hora (impresso no console,
  não é reexibido depois — se perder, rode o seed de novo);
- 3 horas de medições simuladas (uma a cada 5 minutos), incluindo uma janela de ~20 minutos com
  temperatura fora do limite configurado;
- 1 alerta correspondente a essa janela (já resolvido, mas ainda não lido), para demonstrar a
  notificação "você possui alertas desde seu último acesso" já na Etapa 4.

## Explorando o banco visualmente

```bash
npm run prisma:studio
```

Abre uma interface web (Prisma Studio) para navegar pelos dados.

## Rodando a API

```bash
npm run dev    # com reload automático (nodemon)
# ou
npm start
```

A API sobe em `http://localhost:3000` (porta configurável via `API_PORT`). Documentação
interativa (Swagger UI) disponível em `http://localhost:3000/api/docs` — gerada a partir de
`docs/openapi.yaml`.

### Estrutura

```
src/
├── app.js               (montagem do Express: middlewares + rotas)
├── server.js             (ponto de entrada, sobe o servidor HTTP)
├── lib/                  (prisma client, JWT, AppError, serializers)
├── middlewares/           (auth de usuário, auth de dispositivo, rate limit, validação, erros)
└── modules/
    ├── auth/               (registro, login, logout, /me)
    ├── users/               (perfil)
    ├── devices/             (CRUD de dispositivos ESP32 + rotação de token)
    ├── measurements/        (ingestão do ESP32 + endpoint de simulação)
    ├── settings/            (temperatura/umidade ideal e tolerância)
    ├── alerts/              (ciclo de vida de alertas, evita spam de notificações)
    └── history/             (consulta paginada + exportação CSV)
```

### Autenticação

- **Usuário**: JWT assinado (`JWT_SECRET`) em cookie `httpOnly`, `sameSite=lax`, `secure` apenas
  em produção. Todas as rotas privadas usam o middleware `requireAuth`, que nunca confia em um
  `userId` vindo do corpo/query da requisição.
- **Dispositivo (ESP32)**: `POST /api/measurements` exige `device_id` no corpo (identificador
  público) e o token em texto puro no header `X-Device-Key`. O servidor compara esse token com o
  hash (`bcryptjs`) salvo em `devices.device_secret_hash` — o token nunca é armazenado em texto
  puro, igual a uma senha de usuário.

### Testando sem o ESP32 físico

`POST /api/measurements/simulate` (autenticado como usuário, não como dispositivo) permite
injetar uma leitura em qualquer dispositivo do próprio usuário — útil para demonstrar o fluxo
completo (medição → dashboard → histórico → alerta) mesmo sem hardware conectado.

### Exemplo de fluxo via curl

```bash
# Cadastro (grava o cookie de sessão em cookies.txt)
curl -c cookies.txt -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Maria Silva","email":"maria@example.com","password":"Senha123","birthDate":"1995-05-20"}'

# Criar um dispositivo (guarde o deviceSecret retornado - só aparece uma vez)
curl -b cookies.txt -X POST http://localhost:3000/api/devices \
  -H "Content-Type: application/json" -d '{"name":"Sensor Sala"}'

# Enviar uma medição como se fosse o ESP32
curl -X POST http://localhost:3000/api/measurements \
  -H "Content-Type: application/json" -H "X-Device-Key: <deviceSecret>" \
  -d '{"device_id":"<deviceIdentifier>","temperature":25.4,"humidity":61.2}'
```
