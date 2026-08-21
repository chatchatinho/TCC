# Etapa 1 — Arquitetura e Decisões Técnicas

> Documento de análise técnica do TCC "Sistema Web de Monitoramento de Temperatura e Umidade com ESP32".
> Este é o entregável da **Etapa 1** (arquitetura). Nenhum código de aplicação foi implementado ainda — aguardando aprovação para iniciar a Etapa 2 (banco de dados).

---

## 1. Arquitetura recomendada

Arquitetura em **3 camadas**, clássica e adequada para TCC: cliente web (SPA), API REST central, banco de dados relacional. O ESP32 é apenas mais um cliente HTTP da API — nunca fala diretamente com o banco.

- **Monolito modular** no backend (não microsserviços): um único serviço Node/Express organizado em módulos (`auth`, `users`, `devices`, `measurements`, `alerts`, `settings`). Simples de rodar, depurar e apresentar, mas com separação de responsabilidades interna que permite evoluir para serviços separados no futuro se necessário.
- **SPA React** consumindo a API via REST/JSON, com autenticação baseada em JWT.
- **PostgreSQL** como fonte única da verdade. ESP32 e navegador nunca acessam o banco diretamente — sempre via API.
- **Polling HTTP** do frontend para atualização "quase em tempo real" do dashboard (ver seção 9).

---

## 2. Stack tecnológica recomendada

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + Vite, React Router, Axios, Chart.js (via `react-chartjs-2`), CSS com Tailwind CSS |
| Backend | Node.js 20 LTS + Express.js (JavaScript, sem TypeScript — ver decisão pendente #1) |
| ORM / Migrations | Prisma ORM |
| Banco de dados | PostgreSQL 16 |
| Autenticação | JWT (access token) em cookie `httpOnly` + `bcrypt` para hash de senha |
| Autenticação do ESP32 | API key/token específico do dispositivo, verificado por header, com valor armazenado com hash no banco |
| Documentação da API | OpenAPI/Swagger via `swagger-jsdoc` + `swagger-ui-express` |
| Rate limiting | `express-rate-limit` |
| Testes backend | Jest + Supertest |
| Testes frontend | Vitest + React Testing Library (básico) |
| Containerização | Docker + docker-compose (postgres + backend + frontend) — opcional para quem quiser rodar sem instalar nada localmente |
| Firmware | Arduino framework para ESP32 (C++), `WiFi.h`, `HTTPClient.h`, `ArduinoJson`, biblioteca de sensor (ex.: `DHT sensor library`) |

---

## 3. Justificativa das escolhas

- **React + Vite**: build rápido, ecossistema maduro, fácil de justificar/apresentar em banca, boa curva de aprendizado. Vite evita a complexidade de configuração do Webpack/CRA.
- **Chart.js**: leve, responsivo por padrão (importante para o requisito de mobile), API simples para gráficos de linha com filtro de período — exatamente o que os requisitos pedem, sem exagero de uma lib mais pesada (D3, Recharts com muitas dependências).
- **Node.js + Express**: linguagem única em todo o stack web (JS/TS), grande volume de documentação, fácil de rodar localmente sem infraestrutura extra, adequado ao escopo de TCC.
- **JavaScript puro (sem TypeScript) no backend**: reduz uma camada de complexidade de build/tooling. É uma escolha consciente para manter o projeto "viável para TCC" (seção 40). Tipagem pode ser adicionada depois sem quebrar nada — ver decisão pendente #1, pois há um argumento razoável para o lado oposto.
- **Prisma ORM**: gera migrations automaticamente a partir de um schema declarativo, protege nativamente contra SQL Injection (queries parametrizadas), gera client tipado, e produz um diagrama do schema fácil de exportar para a documentação do TCC. Alternativa seria Knex ou Sequelize — Prisma tem a melhor relação simplicidade/poder para este caso.
- **PostgreSQL**: gratuito, robusto, com excelente suporte a tipos de data/hora com timezone (`timestamptz`), essencial para o requisito de UTC + fuso de São Paulo (seção 27). Superior ao MySQL neste ponto específico.
- **JWT em cookie `httpOnly` (não `localStorage`)**: evita exposição do token a XSS, mantém o modelo "sessão" que o usuário pede na seção 6, e é simples de implementar com `cookie-parser` + middleware de autenticação.
- **API key de dispositivo com hash no banco**: a seção 17 exige que a segurança do ESP32 não dependa só do `device_id` público. Um `device_secret` (equivalente a uma senha do dispositivo) é gerado no cadastro, mostrado **uma única vez** ao usuário, e armazenado com hash (`bcrypt`) — mesmo padrão de segurança usado para senha de usuário. Isso é uma melhoria deliberada em relação ao campo `authentication_key/token` sugerido cruamente no prompt.
- **Polling em vez de WebSocket/SSE**: para o volume de dados de um TCC (poucos dispositivos, leituras a cada alguns segundos/minutos), polling a cada 10s é suficiente, muito mais simples de implementar/depurar/apresentar, e evita gerenciar conexões persistentes. Fica documentado como decisão consciente (seção 24 permite explicitamente essa escolha). SSE fica como caminho de evolução natural (mesma infraestrutura HTTP, sem exigir biblioteca nova).
- **Docker Compose opcional, não obrigatório**: o README vai documentar os dois caminhos (instalação manual com Postgres local, e `docker-compose up`), priorizando que o avaliador consiga rodar o projeto do jeito que preferir.

---

## 4. Diagrama textual da arquitetura

```
┌────────────────────┐
│   Sensor (DHT22/    │
│   DHT11/equivalente)│
└─────────┬───────────┘
          │ leitura digital (GPIO)
          ▼
┌──────────────────────────┐
│         ESP32             │
│  - Conecta ao Wi-Fi       │
│  - Lê sensor              │
│  - Valida leitura         │
│  - Monta JSON             │
│  - Envia HTTPS + API Key  │
└─────────┬─────────────────┘
          │ POST /api/measurements   (HTTPS, header X-Device-Key)
          ▼
┌──────────────────────────────────────────────┐
│                Backend (Node/Express)          │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ │
│  │   auth     │ │  devices   │ │measurements│ │
│  └────────────┘ └────────────┘ └────────────┘ │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ │
│  │  settings  │ │  alerts    │ │  history   │ │
│  └────────────┘ └────────────┘ └────────────┘ │
│  Middlewares: auth JWT, rate limit, validação  │
└─────────┬──────────────────────────┬───────────┘
          │ Prisma (queries          │ JSON/REST
          │ parametrizadas)          │ (JWT em cookie httpOnly)
          ▼                          ▼
┌───────────────────┐      ┌──────────────────────┐
│   PostgreSQL       │      │   Frontend React SPA   │
│ users, devices,     │      │  Login / Cadastro      │
│ measurements,       │      │  Dashboard (polling)   │
│ settings, alerts    │      │  Histórico + filtros   │
└───────────────────┘      │  Configurações          │
                             │  Dispositivos           │
                             │  Perfil                 │
                             └──────────┬───────────────┘
                                        │ HTTPS
                                        ▼
                                    Navegador do usuário
```

---

## 5. Modelo de banco de dados

Modelo relacional normalizado (3FN). Todas as tabelas têm `id` (UUID, chave primária), `created_at`; timestamps sempre em `timestamptz` (UTC), convertidos para `America/Sao_Paulo` apenas na exibição (frontend/formatador), nunca armazenados já convertidos.

### `users`
| coluna | tipo | observações |
|---|---|---|
| id | uuid PK | |
| full_name | text NOT NULL | |
| email | citext UNIQUE NOT NULL | índice único |
| password_hash | text NOT NULL | bcrypt |
| birth_date | date NOT NULL | validado no backend (não pode ser futura nem > 120 anos) |
| created_at / updated_at | timestamptz | |

### `devices`
| coluna | tipo | observações |
|---|---|---|
| id | uuid PK | |
| device_identifier | text UNIQUE NOT NULL | ex. `ESP32-001`, público |
| name | text NOT NULL | apelido definido pelo usuário |
| device_secret_hash | text NOT NULL | hash (bcrypt) do token do dispositivo — nunca armazenado em texto puro |
| user_id | uuid FK → users.id NOT NULL | dono do dispositivo |
| active | boolean DEFAULT true | permite desativar sem apagar histórico |
| last_seen_at | timestamptz NULL | atualizado a cada medição recebida — usado para status online/offline (seção 29) |
| created_at | timestamptz | |

*Decisão de modelagem*: um usuário pode ter **vários** dispositivos (FK `user_id` em `devices`, sem unicidade composta), atendendo ao pedido da seção 18 de já deixar isso preparado, sem adicionar complexidade agora (a tela inicial pode simplesmente listar todos os dispositivos do usuário).

### `measurements`
| coluna | tipo | observações |
|---|---|---|
| id | uuid PK | |
| device_id | uuid FK → devices.id NOT NULL | |
| temperature | numeric(5,2) NOT NULL | validado (ex. -40 a 80 °C, faixa típica DHT22) |
| humidity | numeric(5,2) NOT NULL | validado 0–100 |
| measured_at | timestamptz NOT NULL | horário informado pelo ESP32 (ou gerado no servidor se ausente) |
| received_at | timestamptz NOT NULL DEFAULT now() | horário de chegada no servidor |

Índice composto **`(device_id, measured_at DESC)`** — essencial para consultas de histórico/gráfico, que sempre filtram por dispositivo e ordenam/filtram por tempo.

### `settings`
| coluna | tipo | observações |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users.id UNIQUE NOT NULL | 1 configuração por usuário (poderia evoluir para por-dispositivo no futuro) |
| ideal_temperature | numeric(5,2) NOT NULL DEFAULT 25 | |
| temperature_tolerance | numeric(5,2) NOT NULL DEFAULT 2 | |
| ideal_humidity | numeric(5,2) NOT NULL DEFAULT 60 | |
| humidity_tolerance | numeric(5,2) NOT NULL DEFAULT 10 | |
| updated_at | timestamptz | |

Min/max são **calculados em tempo de leitura** (`ideal ± tolerância`), não persistidos — evita inconsistência se o usuário alterar a configuração.

### `alerts` (modelado como **eventos**, não como 1 linha por leitura fora do limite — ver seção 9)
| coluna | tipo | observações |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users.id NOT NULL | |
| device_id | uuid FK → devices.id NOT NULL | |
| variable | enum('temperature','humidity') | |
| direction | enum('above_max','below_min') | |
| triggering_measurement_id | uuid FK → measurements.id | leitura que abriu o evento |
| peak_value | numeric(5,2) | pior valor observado durante o evento |
| limit_min | numeric(5,2) NOT NULL | limite vigente no momento (congelado, não recalculado se settings mudar depois) |
| limit_max | numeric(5,2) NOT NULL | |
| started_at | timestamptz NOT NULL | |
| ended_at | timestamptz NULL | nulo enquanto o evento está ativo |
| status | enum('active','resolved') NOT NULL DEFAULT 'active' | |
| read_at | timestamptz NULL | quando o usuário visualizou o alerta |

Índices: `(user_id, status)` (para contagem de "alertas não lidos"/ativos), `(device_id, status)`.

---

## 6. Principais endpoints

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

GET    /api/users/me
PUT    /api/users/me

GET    /api/settings
PUT    /api/settings

GET    /api/devices
POST   /api/devices              → cria dispositivo, retorna device_secret em texto puro UMA VEZ
PUT    /api/devices/:id
DELETE /api/devices/:id
POST   /api/devices/:id/rotate-secret

POST   /api/measurements          → usado pelo ESP32 (autenticado por header X-Device-Key)
GET    /api/measurements/latest   → última leitura por dispositivo (dashboard)

GET    /api/history               → paginado, filtros: device_id, data_inicio, data_fim, status
GET    /api/history/export        → CSV

GET    /api/alerts                → filtro ?status=active|resolved
GET    /api/alerts/summary        → contagem de alertas não lidos desde o último acesso
PATCH  /api/alerts/:id/read
```

Todos protegidos por JWT (exceto `/auth/register`, `/auth/login` e `POST /measurements`, que usa autenticação de dispositivo).

---

## 7. Fluxo de autenticação

1. **Cadastro**: frontend envia nome, e-mail, senha, data de nascimento → backend valida tudo (e-mail único via constraint + verificação prévia, senha com política mínima, data plausível) → grava `password_hash` com `bcrypt` → cria também um registro `settings` padrão para o usuário.
2. **Login**: backend busca usuário por e-mail, compara hash com `bcrypt.compare`. Falha em qualquer uma das duas etapas retorna a mesma mensagem genérica ("credenciais inválidas"), sem indicar qual campo errou.
3. Sucesso → gera JWT (payload mínimo: `user_id`), grava em cookie `httpOnly`, `secure` (em produção), `sameSite=strict`.
4. Middleware `requireAuth` em todas as rotas privadas: lê o cookie, valida o JWT, injeta `req.userId`; toda query subsequente é filtrada por esse `userId` (nunca confia em `userId` vindo do corpo da requisição) — garante isolamento entre usuários (seção 7/21).
5. **Logout**: limpa o cookie.

---

## 8. Fluxo ESP32 → API → banco

1. ESP32 liga, conecta ao Wi-Fi (`WIFI_SSID`/`WIFI_PASSWORD` configuráveis, não hardcoded em texto final de produção — apenas placeholders no firmware de exemplo).
2. Lê o sensor; se leitura inválida (NaN, fora de faixa física), descarta e tenta novamente no próximo ciclo — não envia dado inválido.
3. Monta JSON `{ device_id, temperature, humidity, measured_at }` e faz `POST /api/measurements` via HTTPS, com header `X-Device-Key: <token>`.
4. Backend: middleware `requireDeviceAuth` busca o dispositivo pelo `device_id`, compara o token recebido com `device_secret_hash` (bcrypt), verifica `active = true`. Se inválido → 401, nada é gravado.
5. Backend valida fisicamente os valores (faixa plausível), grava em `measurements`, atualiza `devices.last_seen_at`.
6. Backend roda a **lógica de alertas** (seção 9) contra a leitura recém-gravada.
7. Retorna 201 com confirmação simples ao ESP32.
8. ESP32 trata a resposta (sucesso/erro) e aguarda o intervalo configurável até a próxima leitura; se Wi-Fi cair, entra em rotina de reconexão antes da próxima tentativa.

---

## 9. Fluxo de alertas (evita spam — seção 42)

A cada nova medição gravada, o backend calcula se ela está dentro do intervalo `[ideal - tolerância, ideal + tolerância]` da variável (usando os `settings` do usuário no momento):

- **Dentro do limite** e existe alerta `active` para aquele `device_id` + `variable` → fecha o alerta: `ended_at = measured_at`, `status = 'resolved'`.
- **Fora do limite** e **não existe** alerta `active` para aquele `device_id` + `variable` → cria um novo alerta (`started_at = measured_at`, `status='active'`).
- **Fora do limite** e **já existe** alerta `active` → apenas atualiza `peak_value` se a nova leitura for mais extrema; não cria linha nova.

Isso produz **um evento por ocorrência real**, com duração calculável (`ended_at - started_at`), em vez de um alerta por leitura. Ao logar novamente, o frontend chama `GET /api/alerts/summary` e mostra "Você possui N alertas desde seu último acesso" (definido como alertas com `read_at IS NULL`, sejam eles já resolvidos ou ainda ativos); ao abrir a lista, `PATCH /api/alerts/:id/read` marca como lido.

---

## 10. Estrutura inicial de pastas

```
TCC/
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── devices/
│   │   │   ├── measurements/
│   │   │   ├── settings/
│   │   │   └── alerts/
│   │   ├── middlewares/         (auth, deviceAuth, rateLimit, errorHandler)
│   │   ├── lib/                 (prisma client, jwt, bcrypt helpers)
│   │   ├── app.js
│   │   └── server.js
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.js
│   ├── tests/
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/                (Login, Register, Dashboard, History, Settings, Devices, Profile)
│   │   ├── components/
│   │   ├── services/             (api client axios)
│   │   ├── context/               (auth context)
│   │   └── App.jsx
│   ├── .env.example
│   └── package.json
├── esp32/
│   └── firmware/
│       ├── firmware.ino
│       ├── config.example.h
│       └── sensor/                (camada de abstração do sensor)
├── database/
│   └── (documentação adicional do schema/ER, se preciso além do prisma)
├── docs/
│   ├── 01-arquitetura-e-decisoes.md   (este arquivo)
│   └── (demais documentos técnicos das próximas etapas)
├── docker-compose.yml
└── README.md
```

---

## 11. Riscos técnicos

1. **Relógio do ESP32 (`measured_at`)**: sem RTC/NTP configurado, o ESP32 pode não saber a hora real. Mitigação: sincronizar via NTP no boot (`configTime`); como fallback, o backend usa `received_at` (gerado no servidor) quando `measured_at` vier ausente/implausível.
2. **Fuso horário**: erro clássico é misturar horário local e UTC. Mitigação: banco sempre em `timestamptz`/UTC; conversão só na camada de apresentação (frontend usa `Intl.DateTimeFormat` com timezone `America/Sao_Paulo`).
3. **Disponibilidade do hardware para a apresentação**: se o ESP32 falhar no dia da banca, é preciso um plano B. Mitigação: endpoint/script de simulação de medições (seção 34), já previsto desde a Etapa 3.
4. **Volume de dados nos gráficos**: sem paginação/agregação, um período de 30 dias pode trazer dezenas de milhares de pontos. Mitigação: endpoint de histórico com paginação server-side e, se necessário, agregação (ex. média por minuto/hora) para períodos longos.
5. **Segurança do token do dispositivo**: se vazar, alguém pode injetar leituras falsas. Mitigação: hash do token no banco (nunca reversível), endpoint `rotate-secret`, rate limiting agressivo em `POST /measurements`.
6. **CORS/cookies em produção**: cookie `httpOnly` + `sameSite` exige que frontend e backend compartilhem domínio ou configuração CORS cuidadosa com `credentials: true`. Precisa ser definido cedo (ver decisão pendente #4).

---

## 12. Decisões aprovadas (21/08/2026)

1. **TypeScript vs JavaScript** → **JavaScript puro** em todo o stack (backend e frontend). Sem passo de compilação extra; tipagem pode ser adicionada depois se necessário.
2. **Sensor físico** → ainda **não definido** pelo autor do TCC. Decisão: o firmware é escrito com **DHT22 como sensor de referência/placeholder** (mais preciso, faixa de leitura maior, biblioteca `DHT sensor library` bem documentada), mas **toda a leitura do sensor fica isolada atrás de uma camada de abstração** (`esp32/firmware/sensor/`, uma função `readSensor()` que retorna `{ temperature, humidity, valid }`). Trocar para DHT11, SHT31, BME280 etc. exigirá alterar apenas essa camada, sem tocar em Wi-Fi, autenticação ou envio HTTP. As faixas de validação no backend serão as fisicamente plausíveis para termo-higrômetros comuns (ex. -40°C a 80°C, 0-100% UR) para não rejeitar um sensor diferente do DHT22 por engano.
3. **Ambiente de demonstração** → **tudo local**: backend, PostgreSQL e frontend rodando na máquina do autor, ESP32 na mesma rede Wi-Fi (`API_URL` apontando para o IP local da máquina, ex. `https://192.168.x.x:PORT` ou HTTP em ambiente local de desenvolvimento). Sem dependência de deploy externo/internet no dia da banca. `.env.example` e README vão documentar esse cenário como padrão; deploy em nuvem fica como possibilidade futura mencionada na documentação, não implementada agora.
4. **Múltiplos dispositivos por usuário** → o **banco de dados continua modelado para suportar vários** (FK simples em `devices.user_id`, sem unicidade), mas o **frontend e o fluxo de demonstração assumem um único dispositivo ativo por usuário**: a tela de "Dispositivos" nasce simples (ver/editar/regenerar token de 1 dispositivo, com opção de cadastrar novo se o usuário quiser mais — sem necessidade de seletor complexo de "dispositivo atual" no dashboard). Isso reduz telas e estados para construir/testar agora, sem fechar a porta para expansão futura.

Com essas decisões fechadas, a próxima etapa (Etapa 2 — Banco de Dados: schema Prisma, migrations, índices, seed) pode começar.
