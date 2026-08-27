# Cada pasta e cada arquivo do projeto, explicados

> Este documento é o complemento de referência do
> [`docs/documentacao/09-aula-completa-do-sistema.md`](09-aula-completa-do-sistema.md).
> Lá, a explicação segue por **conceito** (como a autenticação funciona, como o motor de
> alertas decide abrir/fechar um evento, como o Dashboard simula leituras) — aqui, a
> explicação segue a **árvore de pastas**: todo arquivo do repositório, um por um, na
> ordem em que aparece no projeto. Use este documento para responder "o que tem dentro
> desse arquivo?" e o [`09`](09-aula-completa-do-sistema.md) para responder "por que o
> sistema faz isso?". Onde um arquivo já foi explicado em profundidade no `09`, este
> documento aponta a seção em vez de repetir o texto inteiro.

## Visão geral da árvore

```
TCC/
├── docker-compose.yml
├── README.md
├── .gitignore
├── esp32/
│   ├── README.md
│   └── firmware/
│       ├── firmware.ino
│       ├── config.example.h
│       └── src/
│           ├── Sensor.h
│           └── Sensor.cpp
├── backend/
│   ├── package.json / package-lock.json
│   ├── Dockerfile / .dockerignore
│   ├── .env / .env.example / .env.test / .env.test.example
│   ├── jest.config.js
│   ├── README.md
│   ├── docs/openapi.yaml
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.js
│   │   └── migrations/
│   ├── src/
│   │   ├── app.js / server.js
│   │   ├── lib/
│   │   ├── middlewares/
│   │   └── modules/
│   │       ├── auth/ users/ devices/ measurements/ settings/ alerts/ history/
│   └── tests/
├── frontend/
│   ├── package.json / package-lock.json
│   ├── Dockerfile / .dockerignore / .gitignore
│   ├── .env / .env.example
│   ├── .oxlintrc.json / vite.config.js / index.html
│   ├── README.md
│   ├── public/
│   └── src/
│       ├── main.jsx / App.jsx / index.css
│       ├── context/ components/ pages/ services/ utils/
└── docs/
    ├── documentacao/ (01 a 10 — a documentação do projeto)
    └── Teste simples/ (anotações pessoais de teste)
```

## 1. Raiz do repositório

- **`README.md`** — a porta de entrada do projeto: o que o sistema faz, lista de
  funcionalidades, tabela de tecnologias, requisitos, e duas formas de instalação
  (Docker ou manual). Também lista todos os documentos de `docs/documentacao/`.
- **`docker-compose.yml`** — descreve os três "serviços" que o comando
  `docker compose up --build` sobe de uma vez: `db` (PostgreSQL 16, com um
  `healthcheck` que espera o banco aceitar conexões antes de liberar o backend),
  `backend` (constrói a imagem a partir de `backend/Dockerfile`, com variáveis de
  ambiente de demonstração fixas no próprio arquivo) e `frontend` (constrói a partir de
  `frontend/Dockerfile`, recebendo `VITE_API_URL` como *build arg*). A porta do banco
  não é exposta ao host de propósito — só o backend, dentro da rede interna do Docker,
  precisa alcançá-la.
- **`.gitignore`** (raiz) — arquivos/pastas que o Git nunca deve rastrear no projeto
  inteiro (ex.: `node_modules/`); cada subprojeto (`backend/`, `frontend/`) ainda tem
  o seu próprio `.gitignore` mais específico.

## 2. `esp32/` — o firmware do microcontrolador

- **`esp32/README.md`** — guia de montagem e configuração do hardware: tabela de
  fiação do DHT11 ao ESP32 (`VCC→3V3`, `GND→GND`, `DATA→GPIO 4`), lista de bibliotecas
  Arduino necessárias (`DHT sensor library`, `Adafruit Unified Sensor`, `ArduinoJson`
  7.x), passo a passo de configuração (`config.example.h` → `config.h`), e uma seção de
  solução de problemas comuns (erro de compilação, Wi-Fi que não conecta, API
  retornando 401/400).
- **`esp32/firmware/firmware.ino`** — o sketch principal, com todo o fluxo de
  `setup()`/`loop()`, conexão e reconexão de Wi-Fi, sincronização de hora via NTP, e
  montagem/envio do JSON de cada leitura por HTTP(S). Explicado função por função na
  [seção 7 do documento 09](09-aula-completa-do-sistema.md#7-o-firmware-do-esp32).
- **`esp32/firmware/config.example.h`** — modelo de configuração com placeholders
  (`SUA_REDE_WIFI`, `COLE_AQUI_O_TOKEN_GERADO_PELO_SISTEMA`, etc.). Deve ser copiado
  para `config.h` (que fica de fora do Git, no `.gitignore`, por conter credenciais
  reais) e preenchido com os dados verdadeiros: SSID/senha do Wi-Fi, URL da API,
  identificador e token do dispositivo, e `READING_INTERVAL_MS` (intervalo entre
  leituras — 5000ms por padrão).
- **`esp32/firmware/src/Sensor.h`** — a interface da abstração do sensor: declara o
  `struct SensorReading { temperature, humidity, valid }` e as duas funções que o
  restante do firmware chama (`sensorSetup()`, `sensorRead()`), sem nunca mencionar o
  DHT11 diretamente.
- **`esp32/firmware/src/Sensor.cpp`** — a implementação de fato, específica do DHT11:
  define o pino de dados (`DHT_PIN 4`) e a faixa fisicamente plausível de leitura
  (-10°C a 60°C, 0% a 100% UR — uma margem folgada em torno da faixa nominal do
  sensor). `sensorRead()` descarta a leitura (`valid = false`) se o sensor retornar
  `NAN` (falha de leitura) ou um valor fora dessa faixa. Trocar de sensor no futuro
  significaria reescrever só este arquivo.

## 3. `backend/` — a API e o banco de dados

### 3.1 Arquivos na raiz de `backend/`

- **`package.json`** — nome do pacote (`tcc-backend`), os scripts npm (`dev`, `start`,
  `test`, `prisma:migrate`, `prisma:studio`, `db:seed`, ...) e as dependências:
  `express`, `@prisma/client`, `bcryptjs`, `jsonwebtoken`, `zod`, `helmet`, `cors`,
  `cookie-parser`, `express-rate-limit`, `nodemailer`, `swagger-ui-express`, `yaml`,
  `dotenv`; e como dependências de desenvolvimento, `jest`, `supertest`, `nodemon` e o
  próprio `prisma` (CLI).
- **`package-lock.json`** — gerado automaticamente pelo `npm install`; trava a versão
  exata de cada dependência (inclusive as indiretas) para que `npm ci` instale
  exatamente o mesmo conjunto em qualquer máquina. Não é editado manualmente.
- **`Dockerfile`** — receita para construir a imagem Docker do backend: instala as
  dependências (`npm ci`), gera o Prisma Client (`npx prisma generate`), e o comando
  de inicialização do container aplica as migrations pendentes (`prisma migrate
  deploy`, seguro de rodar toda vez que o container sobe) antes de iniciar o servidor.
- **`.dockerignore`** — arquivos que o Docker não deve copiar para dentro da imagem ao
  construí-la (ex.: `node_modules` local, `.env` com segredos reais).
- **`.env`** — as variáveis de ambiente reais usadas em desenvolvimento local
  (`DATABASE_URL`, `JWT_SECRET`, etc.) — contém segredos, por isso nunca é commitado
  (está no `.gitignore`).
- **`.env.example`** — o modelo público desse arquivo, com todos os nomes de variável
  documentados por comentário e valores de exemplo (`CHANGE_ME`). É o que qualquer
  pessoa clonando o repositório copia para `.env` e preenche. Documenta também o "modo
  simulação" de e-mail: deixando `SMTP_HOST` em branco, nenhum e-mail é enviado de
  verdade — o link de redefinição de senha só é impresso no console.
- **`.env.test`** / **`.env.test.example`** — o mesmo conceito, mas para a suíte de
  testes automatizados: aponta para um banco **separado** (`tcc_test`, não `tcc_dev`),
  porque os testes fazem `TRUNCATE` nas tabelas entre casos (ver `tests/helpers/db.js`
  abaixo) e isso apagaria dados de desenvolvimento se apontasse para o banco errado.
- **`jest.config.js`** — configuração do Jest: roda em ambiente Node (não navegador),
  carrega `tests/jest.setup.js` antes de tudo, só considera arquivos
  `tests/**/*.test.js`, usa **um único worker** (`maxWorkers: 1`) porque todos os
  arquivos de teste compartilham o mesmo banco de dados e precisam rodar em série
  (é o que a flag `--runInBand` do script `test` também garante), e define um timeout
  de 15 segundos por teste.
- **`README.md`** — documentação de uso do backend isoladamente: pré-requisitos,
  configuração do PostgreSQL, como rodar migrations/seed/testes, estrutura de pastas
  de `src/`, explicação da autenticação (usuário vs. dispositivo) e exemplo de fluxo
  completo via `curl`.
- **`docs/openapi.yaml`** — a especificação **OpenAPI 3.0** de toda a API: todo
  endpoint (`/auth/register`, `/measurements`, `/history/export`, etc.), o formato do
  corpo esperado, os esquemas de segurança (`sessionCookie` via cookie, `deviceKey` via
  header) e os possíveis códigos de resposta. É esse arquivo que alimenta a interface
  interativa do Swagger UI, servida pelo próprio backend em `/api/docs` (ver `app.js`
  abaixo) — abrir essa URL com o backend rodando mostra a mesma informação de forma
  navegável, com botão de "testar" cada rota.

### 3.2 `backend/prisma/` — o esquema do banco de dados

- **`schema.prisma`** — o arquivo mais importante do banco: define as 5 tabelas
  (`User`, `Device`, `Measurement`, `Setting`, `Alert`) e os 3 enums
  (`AlertVariable`, `AlertDirection`, `AlertStatus`), campo por campo, com seus tipos,
  valores padrão e relações. Explicado tabela por tabela na
  [seção 4 do documento 09](09-aula-completa-do-sistema.md#4-o-banco-de-dados-tabela-por-tabela).
- **`seed.js`** — script (`npm run db:seed`) que **apaga tudo** (`alert.deleteMany()`,
  `measurement.deleteMany()`, `setting.deleteMany()`, `device.deleteMany()`,
  `user.deleteMany()`, nessa ordem, respeitando as dependências entre tabelas) e recria
  um cenário de demonstração: um usuário de teste (`teste@tcc.local` /
  `Senha@Teste123`), um dispositivo (`ESP32-001`) com um token gerado na hora
  (impresso no console, nunca salvo em texto puro), 3 horas de histórico simulado (uma
  leitura a cada 5 minutos, com uma janela de ~20 minutos de temperatura fora do
  limite no meio) e um alerta já resolvido correspondente a essa janela, marcado como
  não lido — para já aparecer a notificação "você possui alertas desde seu último
  acesso" assim que alguém logar com esse usuário de teste.
- **`migrations/`** — o histórico, passo a passo, de como o esquema do banco evoluiu.
  Cada subpasta é uma migration com um arquivo `migration.sql` (SQL puro, gerado pelo
  Prisma) e é numerada por data/hora de criação — nunca editada depois de aplicada,
  só uma nova migration é criada em cima. As cinco existentes, em ordem:

  | Migration | O que mudou |
  |---|---|
  | `20260821133723_init` | Cria as tabelas iniciais (`users`, `devices`, `measurements`, `settings`, `alerts`) e os três enums de alerta |
  | `20260821184000_add_avatar_and_password_reset` | Adiciona `avatar_data`, `password_reset_token_hash` e `password_reset_expires_at` em `users` |
  | `20260821204801_add_last_real_measurement_at` | Adiciona `last_real_measurement_at` em `devices` (distinção leitura real vs. simulada) |
  | `20260821214853_add_optional_min_max_thresholds` | Adiciona `temperature_min/max` e `humidity_min/max` opcionais em `settings` |
  | `20260821234820_add_last_login_and_notify_flags` | Adiciona `last_login_at` em `users` e `notify_temperature`/`notify_humidity` em `settings` |

  - **`migration_lock.toml`** — arquivo pequeno e automático que só registra qual banco
  de dados está sendo usado (`provider = "postgresql"`) — o comentário no próprio
  arquivo avisa para nunca editá-lo manualmente.

### 3.3 `backend/src/` — o código da API

- **`app.js`** — monta a aplicação Express inteira: a ordem dos middlewares
  (`helmet`, `cors`, `express.json`, `cookieParser`, `morgan`), a rota de saúde
  (`/api/health`), a montagem da documentação interativa (`/api/docs`, a partir do
  `openapi.yaml` acima), o registro de todas as rotas de cada módulo sob `/api/...`, e
  por último os dois handlers de erro. Detalhado na
  [seção 5.1 do documento 09](09-aula-completa-do-sistema.md#51-o-pipeline-do-express-appjs).
- **`server.js`** — o ponto de entrada de verdade: só importa `app.js` e chama
  `app.listen(API_PORT)`. É separado de `app.js` de propósito — os testes automatizados
  importam `app.js` diretamente (via Supertest) sem precisar abrir uma porta de rede de
  verdade.

#### `backend/src/lib/` — utilitários compartilhados por toda a aplicação

- **`prisma.js`** — cria e exporta **uma única instância** do Prisma Client
  (`new PrismaClient()`), compartilhada por toda a aplicação — evita abrir uma conexão
  nova com o banco a cada arquivo que precisa consultar dados.
- **`jwt.js`** — tudo relacionado ao token de sessão do usuário: `signSessionToken`
  (assina um JWT com o ID do usuário, válido por 7 dias), `verifySessionToken`
  (decodifica e valida), `setSessionCookie`/`clearSessionCookie` (grava/remove o
  cookie `session`, `httpOnly`, `sameSite=lax`, `secure` só em produção). Ver
  [seção 3.6 e 5.3 do documento 09](09-aula-completa-do-sistema.md#36-autenticação-sessão-cookie-e-jwt).
- **`AppError.js`** — uma classe de erro customizada (`extends Error`) que carrega um
  `statusCode` HTTP junto da mensagem — é assim que o código sinaliza "isso é um erro
  esperado de negócio" (senha errada, 404, conflito) em vez de deixar virar um `500`
  genérico. Ver [seção 5.11](09-aula-completa-do-sistema.md#511-tratamento-de-erros-centralizado).
- **`serializers.js`** — duas funções, `serializeUser` e `serializeDevice`, que
  escolhem manualmente quais campos de cada modelo do Prisma podem sair numa resposta
  HTTP. É aqui que `passwordHash` e `deviceSecretHash` são deliberadamente **excluídos**
  de qualquer resposta da API — nunca por acidente, sempre por uma lista explícita do
  que é permitido mostrar.
- **`deviceSecret.js`** — uma função, `generateDeviceSecret()`, que gera o token de
  autenticação de um dispositivo: 24 bytes aleatórios criptograficamente seguros
  (`crypto.randomBytes`), convertidos para uma string hexadecimal de 48 caracteres.
- **`mailer.js`** — envia o e-mail de redefinição de senha via `nodemailer`. Se
  `SMTP_HOST` não estiver configurado no `.env`, entra em **modo simulação**: em vez de
  tentar enviar de verdade, só imprime no console o destinatário e o link de
  redefinição — o que permite testar/demonstrar o fluxo de "esqueci minha senha" sem
  precisar de uma conta de e-mail real configurada.

#### `backend/src/middlewares/` — funções que rodam antes das rotas

- **`auth.js`** — `requireAuth`, o middleware que protege toda rota de usuário
  autenticado: lê o cookie de sessão, valida o JWT, e só então deixa a requisição
  continuar (com `req.userId` preenchido). Ver
  [seção 5.3](09-aula-completa-do-sistema.md#53-as-duas-autenticações-usuário-vs-dispositivo).
- **`deviceAuth.js`** — `requireDeviceAuth`, o equivalente para o ESP32: lê
  `device_id` do corpo e o token do header `X-Device-Key`, busca o dispositivo no
  banco, e compara o token recebido com o hash salvo via `bcrypt.compare`. Também
  explicado na seção 5.3.
- **`errorHandler.js`** — `notFoundHandler` (qualquer rota inexistente vira 404) e
  `errorHandler` (o coletor final de erros — converte `AppError` no status/mensagem
  certos, trata especificamente um JSON malformado no corpo da requisição, e qualquer
  outro erro vira `500` genérico sem vazar detalhes internos). Ver seção 5.11.
- **`rateLimit.js`** — define dois limitadores com `express-rate-limit`:
  `authLimiter` (10 tentativas a cada 15 minutos, usado em login/registro/recuperação
  de senha, contra força bruta) e `measurementsLimiter` (30 por minuto, usado na
  ingestão de medições, contra um dispositivo ou credencial vazada inundando a API).
  Ambos ficam desligados durante `NODE_ENV=test` — ver seção 5.12 do documento 09.
- **`validate.js`** — `validateBody`/`validateQuery`: recebem um schema Zod e
  devolvem um middleware que valida `req.body`/`req.query` contra ele, rejeitando com
  `400` (e a lista de campos com problema) antes mesmo de chegar ao service.

#### `backend/src/modules/` — um módulo por área de funcionalidade

Cada módulo segue o mesmo padrão de três arquivos (rota → validação → regra de
negócio), explicado em geral na
[seção 5.2 do documento 09](09-aula-completa-do-sistema.md#52-o-padrão-de-três-camadas-em-cada-módulo).
Abaixo, o que cada arquivo específico contém:

**`auth/`** (cadastro, login, sessão, recuperação de senha)
- `auth.routes.js` — define `POST /register`, `/login`, `/logout`,
  `/forgot-password`, `/reset-password` e `GET /me`.
- `auth.service.js` — a lógica de cada uma dessas ações: hash de senha com bcrypt,
  geração/validação do token de redefinição (hash SHA-256, não bcrypt — motivo
  explicado na [seção 5.4](09-aula-completa-do-sistema.md#54-módulo-auth-registro-login-recuperação-de-senha)),
  mensagens de erro genéricas para não vazar quais e-mails existem, e as funções
  `changePassword`/`deleteAccount` (reaproveitadas pelo módulo `users`).
- `auth.validation.js` — os schemas Zod de cadastro/login/recuperação, incluindo a
  política de senha compartilhada (`passwordSchema`: mínimo 8 caracteres, pelo menos
  uma letra e um número) e a validação de data de nascimento plausível.

**`users/`** (perfil, senha, exclusão de conta)
- `users.routes.js` — `GET`/`PUT /me` (perfil), `PUT /me/password` (troca de senha,
  exige a senha atual), `DELETE /me` (exclusão de conta, exige a senha).
- `users.validation.js` — `updateProfileSchema` (nome e/ou foto — a foto é validada
  como uma *data URL* base64 de até ~700KB, no formato PNG/JPEG/WEBP/GIF),
  `changePasswordSchema`, `deleteAccountSchema`. Não existe `users.service.js`
  separado — a lógica mora direto nas rotas (chamando `prisma` e reaproveitando
  `authService.changePassword`/`deleteAccount`), por ser simples o bastante.

**`devices/`** (CRUD de ESP32s)
- `devices.routes.js` — `GET`/`POST /devices`, `PUT`/`DELETE /devices/:id`,
  `POST /devices/:id/rotate-secret`.
- `devices.service.js` — geração do identificador público (`ESP32-XXXXXX`, se não
  informado), geração e hash do token, e `findOwned()` — a função que garante (com
  `404`, nunca `403`) que um usuário só acessa dispositivos que são dele. Ver
  [seção 5.6](09-aula-completa-do-sistema.md#56-módulo-devices-cadastro-de-esp32s).
- `devices.validation.js` — nome (2 a 100 caracteres) e um identificador opcional
  customizado (letras, números, `-`/`_`, 3 a 50 caracteres) na criação.

**`measurements/`** (ingestão de leituras)
- `measurements.routes.js` — `POST /measurements` (autenticação de dispositivo, para
  o ESP32 real), `GET /measurements/latest` (última leitura de cada dispositivo do
  usuário), `POST /measurements/simulate` (autenticação de usuário, para a simulação).
  Ver [seção 5.7](09-aula-completa-do-sistema.md#57-módulo-measurements-a-porta-de-entrada-dos-dados).
- `measurements.service.js` — `create()` (grava a medição, atualiza
  `lastSeenAt`/`lastRealMeasurementAt`, dispara a avaliação de alertas),
  `resolveMeasuredAt()` (trata timestamp ausente/implausível vindo do ESP32),
  `latestByUser()`.
- `measurements.validation.js` — faixa fisicamente plausível para a leitura bruta
  (-40°C a 80°C, 0% a 100% — mais ampla que a faixa nominal do DHT11 de propósito, só
  rejeitando o fisicamente impossível).

**`settings/`** (limites de temperatura/umidade)
- `settings.routes.js` — `GET`/`PUT /settings`.
- `settings.service.js` — `getOrCreate()` (cria configuração padrão se o usuário
  ainda não tiver uma), `update()`, `computeThresholds()` (a fórmula ideal±tolerância
  com override opcional, [seção 5.8](09-aula-completa-do-sistema.md#58-módulo-settings-cálculo-da-faixa-aceitável)),
  `evaluateReadingStatus()` (classifica uma leitura como `normal`/`out_of_range` por
  variável).
- `settings.validation.js` — faixas plausíveis para cada campo e duas regras cruzadas
  (`refine`): a taxa mínima precisa ser menor que a máxima, tanto para temperatura
  quanto para umidade.

**`alerts/`** (o motor de notificações)
- `alerts.routes.js` — `GET /alerts` (lista paginada), `GET /alerts/summary`
  (contagem de não lidas), `PATCH /alerts/:id/read`.
- `alerts.service.js` — o arquivo mais importante deste módulo:
  `evaluateMeasurement()` (decide abrir/atualizar/fechar um alerta a cada leitura),
  `list()`, `summary()`, `markRead()`. Explicado com um exemplo numérico completo na
  [seção 5.9](09-aula-completa-do-sistema.md#59-o-motor-de-alertas-em-detalhe).
- `alerts.validation.js` — só o schema da listagem (`status`, `page`, `pageSize`).

**`history/`** (consulta e exportação)
- `history.routes.js` — `GET /history` (paginado) e `GET /history/export` (CSV,
  monta o cabeçalho e as linhas manualmente e devolve como arquivo para download).
- `history.service.js` — `buildWhere()` (monta os filtros como uma lista de condições
  combinadas com E, ver [seção 5.10](09-aula-completa-do-sistema.md#510-módulo-history-filtros-dinâmicos-e-exportação)),
  `list()`, `listForExport()` (limitado a 5000 linhas), `annotateStatus()`.
- `history.validation.js` — todos os filtros aceitos na query string (dispositivo,
  período, faixas de valor, situação por variável, ordenação, paginação).

### 3.4 `backend/tests/` — a suíte automatizada

Cada arquivo aqui é descrito, um por um, na
[seção 8 do documento 09](09-aula-completa-do-sistema.md#8-testes-automatizados-o-que-existe-de-verdade).
Resumo rápido de cada um:

- **`auth.test.js`** — cadastro e login (casos válidos e inválidos).
- **`authorization.test.js`** — isolamento entre usuários (A nunca acessa dado de B).
- **`measurements.test.js`** — ingestão de leituras via autenticação de dispositivo.
- **`alerts.test.js`** — o motor de alertas (abertura, atualização de pico,
  fechamento, reabertura).
- **`settings.test.js`** — cálculo de limites e validação de valores incoerentes.
- **`history.test.js`** — filtros, paginação e exportação CSV.
- **`passwordManagement.test.js`** — troca de senha logada e fluxo completo de
  "esqueci minha senha".
- **`security/rateLimit.test.js`** — testa o mecanismo de rate limiting isoladamente,
  com uma instância própria do limitador (os limitadores reais da aplicação ficam
  desligados durante os outros testes).
- **`helpers/db.js`** — `resetDb()`, chamada antes de cada teste (`beforeEach`): faz
  `TRUNCATE ... CASCADE` em todas as tabelas para começar cada caso com o banco vazio;
  `closeDb()`, chamada ao final (`afterAll`) para encerrar a conexão do Prisma.
- **`helpers/authClient.js`** — `registerAndLogin()`, um atalho usado por quase todo
  arquivo de teste: cria um agente Supertest (que mantém o cookie de sessão entre
  requisições) já com um usuário cadastrado e logado, com um e-mail único gerado por
  um contador — evita repetir o boilerplate de cadastro em cada caso de teste.
- **`jest.setup.js`** — carrega `.env.test` antes de qualquer outro módulo do projeto
  ser importado, garantindo que os testes nunca acidentalmente se conectem ao banco de
  desenvolvimento.

## 4. `frontend/` — a interface web

### 4.1 Arquivos na raiz de `frontend/`

- **`package.json`** — scripts (`dev`, `build`, `lint`, `preview`) e dependências:
  `react`/`react-dom` (v19), `react-router-dom` (v7, roteamento), `axios` (chamadas
  HTTP), `chart.js`/`react-chartjs-2` (gráficos). Como dependências de
  desenvolvimento: `vite` (v8, o *bundler*/servidor de desenvolvimento),
  `@vitejs/plugin-react`, `tailwindcss`/`@tailwindcss/vite` (v4), `oxlint` (linter) e
  os tipos TypeScript de React (usados só para autocomplete no editor, o projeto em si
  é JavaScript puro).
- **`package-lock.json`** — mesmo papel do equivalente no backend: trava as versões
  exatas instaladas.
- **`Dockerfile`** — instala dependências, recebe `VITE_API_URL` como *build arg*
  (variáveis `VITE_*` são embutidas no código já no momento do `build`, não podem ser
  trocadas depois em tempo de execução — daí precisar ser um *build arg* do Docker, não
  uma variável de ambiente normal do container), roda `npm run build` e serve o
  resultado com `vite preview`.
- **`.dockerignore`** / **`.gitignore`** (específico do frontend) — excluem
  `node_modules/`, a pasta `dist/` de build, e o `.env` real, respectivamente do
  contexto do Docker e do controle de versão.
- **`.env`** — `VITE_API_URL` real usado localmente (ex.:
  `http://localhost:3000/api`).
- **`.env.example`** — o modelo desse arquivo.
- **`.oxlintrc.json`** — configuração do linter `oxlint`: habilita os plugins de
  regras para React, com a regra "hooks só podem ser chamados no topo de um
  componente" (`react/rules-of-hooks`) como erro — é o tipo de engano fácil de cometer
  sem perceber (chamar `useState` dentro de um `if`, por exemplo) e essa regra pega na
  hora.
- **`vite.config.js`** — configuração do Vite: registra os plugins do React e do
  Tailwind, e liga `host: true` tanto no servidor de desenvolvimento quanto no preview
  (necessário para o site ficar acessível de fora do container Docker, não só de
  `localhost` dentro dele).
- **`index.html`** — o único arquivo HTML "de verdade" do projeto (React é uma
  *single-page application*): define o título da aba, o favicon, e uma única
  `<div id="root">` onde o React vai desenhar tudo — o `<script type="module"
  src="/src/main.jsx">` é o que inicia a aplicação.
- **`README.md`** — documentação de uso do frontend isoladamente: configuração,
  como rodar, estrutura de pastas, e as decisões relevantes (autenticação por cookie,
  polling em vez de WebSocket, simulação automática, fuso horário).
- **`public/favicon.svg`** — o ícone exibido na aba do navegador.
- **`public/icons.svg`** — um arquivo com ícones SVG reunidos (a maior parte da
  interface, porém, usa emojis simples como ícone — ver `Layout.jsx` abaixo — este
  arquivo fica disponível para uso pontual).

### 4.2 `frontend/src/` — arquivos na raiz do código

- **`main.jsx`** — o ponto de entrada de verdade do React: importa o CSS global
  (`index.css`) e manda o componente `<App />` ser desenhado dentro da `<div
  id="root">` do `index.html`, envolvido por `<StrictMode>` (um modo de
  desenvolvimento do React que ajuda a detectar efeitos colaterais escritos de forma
  incorreta, executando alguns deles duas vezes de propósito só em desenvolvimento).
- **`App.jsx`** — define todas as rotas da aplicação e a ordem dos provedores de
  contexto (`ThemeProvider` → `BrowserRouter` → `AuthProvider`). Detalhado na
  [seção 6.1 do documento 09](09-aula-completa-do-sistema.md#61-roteamento-appjsx).
- **`index.css`** — o CSS global: importa o Tailwind, redefine o critério do modo
  escuro para depender de uma classe (`.dark`) em vez de só a preferência do sistema
  operacional (necessário para o interruptor manual em Configurações funcionar),
  declara as variáveis de cor de destaque (`--color-brand-*`, reescritas em tempo de
  execução pelo `ThemeContext`), a variável de escala de fonte (`--app-font-scale`), e
  a classe `.reduce-motion` que zera todas as transições/animações da interface.

### 4.3 `frontend/src/context/` — estado global compartilhado

- **`AuthContext.jsx`** — `AuthProvider`/`useAuth()`: guarda quem é o usuário logado,
  expõe `login`/`register`/`logout`, e confirma a sessão (`GET /auth/me`) assim que o
  app carrega. Ver [seção 6.2](09-aula-completa-do-sistema.md#62-contextos-globais).
- **`ThemeContext.jsx`** — `ThemeProvider`/`useTheme()`: modo escuro (seguindo o
  sistema até o usuário escolher manualmente), cor de destaque (8 opções), tamanho de
  fonte (3 opções) e redução de movimento — tudo persistido em `localStorage`. Também
  detalhado na seção 6.2.

### 4.4 `frontend/src/components/` — peças reutilizáveis de interface

- **`Layout.jsx`** — a "moldura" comum a toda página logada: barra lateral de
  navegação (com os 6 itens de menu e seus ícones em emoji), cabeçalho mobile, avatar
  e botão de sair, e a bolinha de contagem de notificações não lidas (atualizada por
  polling a cada 10s). Ver [seção 6.2](09-aula-completa-do-sistema.md#62-contextos-globais)
  para o contexto de autenticação que ele consome.
- **`ProtectedRoute.jsx`** — envolve qualquer página que exige login: mostra
  "Carregando…" enquanto `AuthContext` ainda não confirmou a sessão, redireciona para
  `/login` se não houver usuário, ou mostra a página normalmente.
- **`AlertsBanner.jsx`** — a faixa amarela "Você possui N notificações desde seu
  último acesso" que aparece no topo do Dashboard quando há alertas não lidos; some
  sozinha quando `unreadCount` é zero.
- **`MetricCard.jsx`** — o cartão genérico usado nos 4 indicadores do topo do
  Dashboard (temperatura, umidade, status do dispositivo, última leitura): rótulo,
  valor grande, unidade opcional, selo de status opcional e legenda opcional.
- **`LineChart.jsx`** — encapsula a biblioteca Chart.js (via `react-chartjs-2`) num
  componente de gráfico de linha simples: eixo X por rótulos de hora já formatados
  (não uma escala de tempo real, para não precisar de um *adapter* extra), cores de
  grade/eixo adaptadas ao tema claro/escuro atual (o Chart.js não lê classes
  Tailwind sozinho).
- **`StatusBadge.jsx`** — o selo colorido "Normal" (verde) / "Fora do limite"
  (vermelho), usado em Dashboard, Histórico e nos cartões de métrica.
- **`NotificationBadge.jsx`** — a bolinha vermelha pequena com um número (ou "99+"),
  usada no menu lateral e no resumo de outros dispositivos do Dashboard; não desenha
  nada quando a contagem é zero.
- **`Pagination.jsx`** — controles "Anterior"/"Próxima" com o texto "Página X de Y —
  Z registros", usado na tabela de Histórico; calcula o total de páginas a partir de
  `total`/`pageSize` e desabilita os botões nos extremos.
- **`SecretRevealModal.jsx`** — o modal que mostra o token de um dispositivo (recém-
  criado ou recém-regenerado) em texto puro, com um botão de copiar
  (`navigator.clipboard`) e um aviso de que ele não pode ser mostrado de novo depois.

### 4.5 `frontend/src/pages/` — uma página por rota

- **`Login.jsx`** — formulário de e-mail/senha, link para "esqueci minha senha" e
  para cadastro.
- **`Register.jsx`** — formulário de cadastro (nome, e-mail, senha, confirmação de
  senha, data de nascimento), com verificação client-side de que as duas senhas
  digitadas coincidem antes mesmo de chamar a API.
- **`ForgotPassword.jsx`** — pede o e-mail e mostra sempre a mesma mensagem de
  sucesso (exista ou não a conta), consistente com a proteção contra enumeração de
  contas do backend (seção 5.4 do documento 09).
- **`ResetPassword.jsx`** — lê o `token` da URL (`useSearchParams`), pede a nova
  senha duas vezes, e redireciona para o login 2,5 segundos após o sucesso.
- **`Dashboard.jsx`** — a página mais complexa do frontend: cartões de métrica,
  gráficos de linha com seletor de período, seletor de dispositivo, resumo dos outros
  dispositivos, e a simulação automática de leituras a cada 2 segundos. Detalhada por
  completo na [seção 6.4 do documento 09](09-aula-completa-do-sistema.md#64-página-por-página).
- **`History.jsx`** — tabela paginada e ordenável, painel de filtros colapsável
  (período, dispositivo, faixas de valor com *debounce*, situação por variável) e
  exportação CSV.
- **`Settings.jsx`** — duas abas: "Valores" (ideal/tolerância obrigatórios por
  variável, taxa mín/máx opcional, prévia da faixa calculada, interruptor de
  notificação por variável) e "Aparência" (tema, cor de destaque, tamanho de fonte,
  redução de movimento).
- **`Devices.jsx`** — lista de dispositivos com status (online/atenção/offline),
  ações de ativar/desativar, regenerar token e remover, e formulário de cadastro.
- **`Notifications.jsx`** — alertas agrupados por dispositivo em abas, marcando como
  lido só quando a notificação específica é expandida (não ao simplesmente visitar a
  tela).
- **`Profile.jsx`** — duas abas: "Dados" (nome, foto de perfil, dados somente
  leitura, exportação de todos os dados em JSON) e "Segurança" (data do último login,
  troca de senha, exclusão de conta com confirmação).

### 4.6 `frontend/src/services/` — a camada que fala com a API

Todos seguem o mesmo padrão: importam a instância `axios` de `api.js` e expõem uma
função por endpoint, sem nenhuma lógica de interface misturada.

- **`api.js`** — cria a instância do axios com `baseURL: import.meta.env.VITE_API_URL`
  e `withCredentials: true` (o que faz o cookie de sessão ser enviado em toda
  requisição). Ver [seção 6.3](09-aula-completa-do-sistema.md#63-a-camada-de-serviços-e-o-axios).
- **`auth.js`** — `register`, `login`, `logout`, `getCurrentUser`, `forgotPassword`,
  `resetPassword`.
- **`users.js`** — `updateProfile`, `changePassword`, `deleteAccount`.
- **`devices.js`** — `listDevices`, `createDevice`, `updateDevice`, `deleteDevice`,
  `rotateDeviceSecret`.
- **`measurements.js`** — `getLatest`, `simulateMeasurement`.
- **`settings.js`** — `getSettings`, `updateSettings`.
- **`alerts.js`** — `listAlerts`, `getAlertsSummary`, `markAlertRead`.
- **`history.js`** — `getHistory`, e `buildExportUrl` (monta a URL de exportação CSV
  para ser aberta diretamente pelo navegador via `window.open`, em vez de baixada via
  axios — assim o cookie de sessão é enviado normalmente pelo próprio navegador, sem
  precisar manipular um *blob* manualmente).

### 4.7 `frontend/src/utils/` — funções auxiliares puras

- **`format.js`** — `formatDateTime`/`formatDate`/`formatTime` (convertem UTC para
  `America/Sao_Paulo` só na hora de exibir, via `Intl.DateTimeFormat`),
  `formatNumber` (arredondamento para exibição) e `formatRelative` ("há 2 minutos",
  usado nos status de dispositivo). Ver [seção 6.5](09-aula-completa-do-sistema.md#65-fuso-horário).
- **`number.js`** — `parseDecimal`/`isValidDecimal`/`isValidOptionalDecimal`: aceitam
  tanto vírgula quanto ponto como separador decimal nos formulários (o
  `<input type="number">` nativo do navegador rejeita vírgula silenciosamente — um bug
  real encontrado durante o desenvolvimento, corrigido usando campos de texto livre
  com este parser em vez do tipo numérico nativo).
- **`periods.js`** — `PERIOD_OPTIONS` (os atalhos "Últimas 6 horas", "Hoje", "Últimos
  7/30 dias", "Personalizado") e `computeRange()`, que converte cada atalho num par de
  datas — usado tanto no Dashboard quanto no Histórico.
- **`deviceStatus.js`** — `getDeviceStatus()`: classifica um dispositivo como
  online (🟢, comunicou nos últimos 5 minutos), "sem comunicação recente" (🟡, até 30
  minutos) ou offline (🔴, mais que isso, ou nunca comunicou).
- **`alertLabels.js`** — só dois dicionários de tradução: `VARIABLE_LABEL`
  (`temperature`→"Temperatura", `humidity`→"Umidade") e `DIRECTION_LABEL`
  (`above_max`→"acima do limite", `below_min`→"abaixo do limite"), usados na tela de
  Notificações.

## 5. `docs/` — a documentação do projeto

- **`docs/documentacao/01-arquitetura-e-decisoes.md`** — arquitetura geral, stack
  escolhida e por quê, modelo de dados e riscos técnicos assumidos.
- **`docs/documentacao/02-integracao.md`** — registro da verificação de integração
  ponta a ponta feita durante o desenvolvimento (ESP32 → API → banco → dashboard →
  histórico → alertas).
- **`docs/documentacao/03-seguranca.md`** — revisão de segurança do sistema.
- **`docs/documentacao/04-documentacao-tecnica.md`** — documentação técnica
  consolidada, com diagramas.
- **`docs/documentacao/05-guia-teste-iniciante.md`** — instalação passo a passo do
  zero, para quem nunca configurou um ambiente de desenvolvimento (Windows).
- **`docs/documentacao/06-guia-teste-arduino-real.md`** — como testar com um ESP32
  físico de verdade + sensor DHT11.
- **`docs/documentacao/07-metodologia-tcc.md`** — texto de apoio para a redação do
  TCC (introdução, objetivos, metodologia, modelo conceitual, referências).
- **`docs/documentacao/08-para-que-serve-cada-coisa.md`** — complemento do guia 05:
  para que serve cada ferramenta/comando/arquivo de configuração (o "porquê", não o
  "como" — ex.: por que existe um `.env`, o que o PostgreSQL faz).
- **`docs/documentacao/09-aula-completa-do-sistema.md`** — a aula conceitual de como
  o sistema **funciona**: arquitetura, conceitos do zero, banco de dados, backend,
  frontend, firmware, testes, um fluxo completo e perguntas prováveis da banca.
- **`docs/documentacao/10-cada-pasta-e-arquivo-explicado.md`** — este documento: o
  mapa de referência de **onde** cada coisa está e o que cada arquivo contém.
- **`docs/Teste simples/Tutorial ESP.md`** e **`Tutorial escola.md`** — anotações
  pessoais de teste/estudo, fora do padrão numerado da pasta `documentacao/`.
