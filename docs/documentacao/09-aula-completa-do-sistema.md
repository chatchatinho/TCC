# Aula completa: como o ThermoSense funciona, do zero ao código

> **Como usar este documento.** Isto não é um script para decorar e recitar — é uma
> aula. A ideia é que você leia com calma, teste o sistema rodando ao lado (veja o
> [`docs/documentacao/05-guia-teste-iniciante.md`](05-guia-teste-iniciante.md) para subir
> o ambiente) e confira, arquivo por arquivo, que o que está escrito aqui bate com o
> código de verdade — porque bate: todo trecho citado abaixo foi copiado direto dos
> arquivos do projeto, não reescrito de memória. Se o professor perguntar qualquer coisa
> sobre "por que você fez assim", a resposta está aqui, explicada, e você pode abrir o
> arquivo correspondente na hora para mostrar. Vale lembrar também que o
> [`docs/documentacao/07-metodologia-tcc.md`](07-metodologia-tcc.md) já documenta,
> honestamente, que uma IA (Claude Code) foi usada como ferramenta de apoio durante o
> desenvolvimento — isso é normal e cada vez mais comum na indústria; o que importa para
> a banca é você entender e conseguir explicar **por que** o sistema foi construído
> assim, o que este documento existe para garantir.

## Sumário

1. [O que o sistema faz, em uma frase](#1-o-que-o-sistema-faz-em-uma-frase)
2. [Visão geral: as três camadas](#2-visão-geral-as-três-camadas)
3. [Conceitos fundamentais, explicados do zero](#3-conceitos-fundamentais-explicados-do-zero)
4. [O banco de dados, tabela por tabela](#4-o-banco-de-dados-tabela-por-tabela)
5. [Como o backend é organizado](#5-como-o-backend-é-organizado)
6. [Como o frontend é organizado](#6-como-o-frontend-é-organizado)
7. [O firmware do ESP32](#7-o-firmware-do-esp32)
8. [Testes automatizados: o que existe de verdade](#8-testes-automatizados-o-que-existe-de-verdade)
9. [Um fluxo completo, do sensor ao gráfico](#9-um-fluxo-completo-do-sensor-ao-gráfico)
10. [Perguntas prováveis do professor, com respostas](#10-perguntas-prováveis-do-professor-com-respostas)
11. [Glossário rápido](#11-glossário-rápido)

---

## 1. O que o sistema faz, em uma frase

Um ESP32 com um sensor DHT11 mede temperatura e umidade e manda essas leituras, pela
internet, para um sistema web (o ThermoSense); o sistema guarda o histórico num banco de
dados, mostra tudo num dashboard com gráficos, e avisa o usuário quando algum valor sai
da faixa que ele mesmo configurou.

Três "produtos" separados compõem o projeto, e cada um mora numa pasta na raiz do
repositório:

```
TCC/
├── esp32/firmware/   → código C++ que roda DENTRO do ESP32 (hardware)
├── backend/          → API (Node.js/Express) + banco de dados (PostgreSQL via Prisma)
└── frontend/         → site que o usuário vê no navegador (React)
```

Cada pasta tem seu próprio `README.md` com detalhes de instalação — este documento
explica o **funcionamento interno**, não a instalação (isso já está no
[guia 05](05-guia-teste-iniciante.md) e no [complemento 08](08-para-que-serve-cada-coisa.md)).

## 2. Visão geral: as três camadas

```
┌─────────────┐   HTTPS (POST, a cada N segundos)   ┌──────────────────┐
│    ESP32    │ ───────────────────────────────────▶│                  │
│  + DHT11    │   X-Device-Key: <token>              │     BACKEND      │
└─────────────┘   { device_id, temperature, ... }    │  (Express + API) │
                                                       │                  │
┌─────────────┐   HTTPS (GET/POST/PUT/PATCH/DELETE)  │  ┌────────────┐  │
│  NAVEGADOR  │ ───────────────────────────────────▶│  │  Prisma    │  │
│  (React)    │   cookie httpOnly de sessão           │  │  (ORM)     │  │
└─────────────┘◀──────────────────────────────────── │  └─────┬──────┘  │
                   JSON                               └────────┼─────────┘
                                                                ▼
                                                       ┌──────────────────┐
                                                       │   PostgreSQL     │
                                                       └──────────────────┘
```

Por que três coisas separadas, e não tudo junto?

- **O ESP32 não sabe nada sobre banco de dados, sessões de usuário ou HTML.** Ele só
  sabe falar HTTP e mandar um JSON. Isso é proposital: o hardware fica "burro" e
  simples, e toda a inteligência (validar dado, decidir se é uma anomalia, guardar
  histórico) fica no backend — que é fácil de atualizar sem regravar o firmware.
- **O frontend (o que aparece no navegador) nunca fala direto com o banco de dados.**
  Ele só conversa com o backend através da API (endereços como `/api/measurements`).
  Isso significa que, se um dia você trocar PostgreSQL por outro banco, ou reescrever o
  backend em outra linguagem, o frontend nem percebe — desde que a API continue
  respondendo do mesmo jeito.
- **O backend é o único que enxerga o banco de dados.** Toda regra de negócio ("essa
  leitura está fora do limite?", "esse usuário pode ver esse dispositivo?") mora aqui,
  nunca no frontend — porque o frontend roda no computador de quem está usando o site, e
  ninguém confia em código que roda na máquina de outra pessoa (dá para abrir o
  DevTools do navegador e alterar qualquer coisa em JavaScript). O servidor é o único
  lugar onde a "verdade" das regras é garantida.

Essa separação em camadas, cada uma só falando com a vizinha, é o motivo pelo qual dá
para rodar o backend numa porta e o frontend em outra, ou até em máquinas diferentes —
é exatamente esse desenho que permite, por exemplo, colocar o backend num servidor na
nuvem e continuar usando o mesmo ESP32 de casa (assunto que também já foi discutido em
conversa à parte sobre deploy).

## 3. Conceitos fundamentais, explicados do zero

Antes de entrar nos arquivos, vale alinhar um vocabulário — se você já domina algum
desses tópicos, pule para o próximo.

### 3.1 Cliente-servidor e API REST

Pense num restaurante: você (cliente) não entra na cozinha para pegar sua comida —
você pede ao garçom, que leva o pedido à cozinha (servidor) e traz de volta o prato
pronto. Você nunca vê como o prato foi feito, só o resultado.

Na programação, o **cliente** é quem pede (o navegador, o ESP32), e o **servidor** é
quem processa o pedido e responde (o backend). Eles conversam por **HTTP**, o mesmo
protocolo usado para carregar qualquer página da internet. Uma **API REST** é só um
conjunto de "endereços" (chamados *endpoints*) que o servidor expõe, cada um fazendo uma
coisa específica — por exemplo, `POST /api/auth/login` faz login, `GET
/api/measurements/latest` busca a última leitura de cada dispositivo.

### 3.2 Verbos HTTP e códigos de status

Cada requisição HTTP tem um **verbo** que diz a intenção:

| Verbo | Intenção | Exemplo no projeto |
|---|---|---|
| `GET` | Ler algo, sem mudar nada | `GET /api/history` — lista o histórico |
| `POST` | Criar algo novo | `POST /api/devices` — cadastra um dispositivo |
| `PUT` | Substituir/atualizar algo por completo | `PUT /api/settings` — atualiza as configurações |
| `PATCH` | Atualizar uma parte de algo | `PATCH /api/alerts/:id/read` — só marca como lido |
| `DELETE` | Remover algo | `DELETE /api/devices/:id` |

E a resposta sempre vem com um **código de status numérico**, que o cliente usa para
saber o que aconteceu sem precisar "ler" a mensagem:

| Código | Significado | Onde aparece no projeto |
|---|---|---|
| `200` | OK, deu certo | Login bem-sucedido, listar dados |
| `201` | Criado com sucesso | Cadastro de usuário, nova medição |
| `204` | OK, mas sem conteúdo para devolver | Logout, exclusão de dispositivo |
| `400` | O cliente mandou dado inválido | Falha de validação (Zod) |
| `401` | Não autenticado / credenciais erradas | Cookie ausente, senha errada, token de dispositivo errado |
| `404` | Não encontrado | Dispositivo de outro usuário (propositalmente, ver seção 5.6) |
| `409` | Conflito (já existe) | E-mail já cadastrado |
| `429` | Requisições demais | Rate limit estourado |
| `500` | Erro interno do servidor | Bug inesperado |

### 3.3 JSON

É o formato de texto usado para trocar dados estruturados — parecido com um objeto
JavaScript: `{"temperature": 25.4, "humidity": 61.2}`. Tanto o ESP32 quanto o frontend
mandam e recebem JSON do backend.

### 3.4 Banco de dados relacional

O PostgreSQL guarda dados em **tabelas** (parecidas com planilhas: linhas e colunas).
Cada linha tem uma **chave primária** (`id`), um identificador único. Uma tabela pode
**referenciar** outra através de uma **chave estrangeira** — por exemplo, cada linha da
tabela `measurements` (medições) tem uma coluna `device_id` que aponta para uma linha da
tabela `devices`. Isso é uma relação **1 para N** (um dispositivo tem N medições). Já
`User` e `Setting` têm uma relação **1 para 1** (um usuário tem exatamente uma
configuração).

### 3.5 O que é um ORM (e por que o Prisma)

Sem um ORM ("Object-Relational Mapper"), para buscar dados você escreveria SQL cru:

```sql
SELECT * FROM measurements WHERE device_id = '...' ORDER BY measured_at DESC LIMIT 1;
```

Com o Prisma, a mesma consulta vira código JavaScript comum, com autocomplete e
verificação de tipos:

```js
prisma.measurement.findFirst({
  where: { deviceId: device.id },
  orderBy: { measuredAt: 'desc' },
});
```

O Prisma também cuida das **migrations** — arquivos que descrevem, passo a passo, como
o esquema do banco foi mudando ao longo do tempo (criar tabela X, adicionar coluna Y).
Isso é o que o comando `npm run prisma:migrate` aplica.

### 3.6 Autenticação: sessão, cookie e JWT

Depois que você faz login, o servidor precisa "lembrar" quem você é nas próximas
requisições, sem pedir e-mail/senha de novo a cada clique. O projeto resolve isso com um
**JWT** (JSON Web Token) — um texto assinado digitalmente que carrega o ID do usuário
dentro. Ele é assinado com uma chave secreta (`JWT_SECRET`, que só o servidor conhece),
então ninguém consegue forjar um token válido sem saber essa chave.

Esse token fica guardado num **cookie `httpOnly`** — um cookie que o JavaScript do
navegador **não consegue ler** (só o navegador manda ele de volta ao servidor
automaticamente a cada requisição). Isso é uma proteção deliberada contra XSS: mesmo que
algum código malicioso conseguisse rodar na página, ele não conseguiria roubar o token
via `document.cookie`, porque o próprio navegador esconde esse cookie do JavaScript.

### 3.7 Hash de senha (bcrypt)

Uma senha **nunca** é guardada em texto puro no banco — se o banco vazasse, todas as
senhas vazariam também. Em vez disso, se guarda um **hash**: o resultado de uma função
matemática de mão única (você calcula o hash a partir da senha facilmente, mas não dá
para "desfazer" o hash e descobrir a senha original). No login, o servidor não descobre
a senha do usuário — ele recalcula o hash da senha digitada e compara com o hash salvo.
O projeto usa a biblioteca `bcryptjs` para isso, tanto para senha de usuário quanto para
o token secreto de cada dispositivo ESP32 (mais detalhes na seção 5).

### 3.8 React: componentes, estado e hooks

O frontend usa **React**. A ideia central: a tela é dividida em pequenos blocos
reutilizáveis chamados **componentes** (uma função que retorna HTML "disfarçado" —
chamado JSX). Cada componente pode ter **estado** (`state`): dados que, quando mudam,
fazem o React redesenhar automaticamente aquele pedaço da tela.

Dois "hooks" (funções especiais do React) aparecem o tempo todo no projeto:

- **`useState`**: guarda um valor que pode mudar. `const [form, setForm] =
  useState({ email: '', password: '' })` cria uma variável `form` e uma função
  `setForm` para atualizá-la.
- **`useEffect`**: roda um código em resposta a alguma mudança (ou uma vez, quando o
  componente aparece na tela). É usado, por exemplo, para buscar dados da API assim que
  uma página carrega, ou para configurar um `setInterval` que atualiza dados a cada X
  segundos (o Dashboard faz isso).

Além disso, o projeto usa a **Context API** do React (`AuthContext`, `ThemeContext`)
para compartilhar informação entre componentes distantes na árvore sem precisar passá-la
manualmente por dezenas de níveis de props — por exemplo, "quem é o usuário logado"
precisa estar disponível em quase toda página, então vive num contexto global.

### 3.9 Requisições assíncronas (axios + async/await)

Pedir dados a um servidor demora um tempo (a rede não é instantânea). Em JavaScript,
isso é tratado com **Promises** e a sintaxe `async`/`await`, que permite escrever código
assíncrono como se fosse sequencial:

```js
async function handleSubmit(e) {
  e.preventDefault();
  await login(form); // espera a resposta do servidor antes de continuar
  navigate('/dashboard');
}
```

O projeto usa a biblioteca **axios** para fazer essas requisições HTTP no frontend (veja
a seção 6.3).

## 4. O banco de dados, tabela por tabela

O esquema completo vive em `backend/prisma/schema.prisma`. São 5 tabelas e 3 enums
(listas fixas de valores possíveis). Vamos ver cada uma.

### `User` — usuários da plataforma

```prisma
model User {
  id                     String    @id @default(uuid())
  fullName               String    @map("full_name")
  email                  String    @unique
  passwordHash           String    @map("password_hash")
  birthDate              DateTime  @map("birth_date") @db.Date
  avatarData             String?   @map("avatar_data")
  passwordResetTokenHash String?   @map("password_reset_token_hash")
  passwordResetExpiresAt DateTime? @map("password_reset_expires_at") @db.Timestamptz(3)
  lastLoginAt            DateTime? @map("last_login_at") @db.Timestamptz(3)
  createdAt              DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt              DateTime  @updatedAt @map("updated_at") @db.Timestamptz(3)

  devices  Device[]
  settings Setting?
  alerts   Alert[]
}
```

Pontos que valem explicação:

- `@id @default(uuid())`: a chave primária não é um número sequencial (1, 2, 3...), é um
  **UUID** (um identificador aleatório gigante, tipo
  `f47ac10b-58cc-4372-a567-0e02b2c3d479`). Isso evita que alguém adivinhe IDs de outros
  usuários só contando (`/users/1`, `/users/2`...).
  - `@map("full_name")`: o campo se chama `fullName` no código JavaScript, mas
  `full_name` na tabela do PostgreSQL de verdade — é só uma convenção de nomenclatura
  (camelCase no código, snake_case no banco).
  - `avatarData` e `passwordResetTokenHash` são opcionais (o `?` depois do tipo) — nem
  todo usuário tem foto, e o campo de reset de senha só é preenchido quando alguém pede
  "esqueci minha senha".
  - `devices Device[]`, `settings Setting?`, `alerts Alert[]`: essas linhas não criam
  colunas no banco — são só a forma do Prisma expressar "um usuário tem vários
  dispositivos, uma configuração e vários alertas", para que o código possa navegar entre
  eles (`user.devices`, por exemplo).

### `Device` — cada ESP32 cadastrado

```prisma
model Device {
  id                    String    @id @default(uuid())
  deviceIdentifier      String    @unique @map("device_identifier")
  name                  String
  deviceSecretHash      String    @map("device_secret_hash")
  userId                String    @map("user_id")
  active                Boolean   @default(true)
  lastSeenAt            DateTime? @map("last_seen_at") @db.Timestamptz(3)
  lastRealMeasurementAt DateTime? @map("last_real_measurement_at") @db.Timestamptz(3)
  createdAt             DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)

  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  measurements Measurement[]
  alerts       Alert[]
}
```

- `deviceIdentifier` é o "nome público" do dispositivo (ex.: `ESP32-A1B2C3`) — é o que
  vai dentro do JSON que o ESP32 manda. `deviceSecretHash` é o hash do **token secreto**
  (equivalente a uma senha) que autentica o dispositivo — nunca o texto puro.
- `onDelete: Cascade`: se o usuário dono for excluído, o PostgreSQL apaga
  automaticamente todos os seus dispositivos junto (e, por cascata, as medições e
  alertas desses dispositivos também, porque `Measurement` e `Alert` têm o mesmo
  `onDelete: Cascade` apontando para `Device`). É assim que a exclusão de conta (seção
  6.4, página Perfil) limpa tudo sem precisar de código extra apagando tabela por
  tabela.
- `lastSeenAt` vs `lastRealMeasurementAt`: os dois parecem a mesma coisa, mas não são.
  `lastSeenAt` é atualizado por **qualquer** leitura (real ou simulada). Já
  `lastRealMeasurementAt` só é atualizado quando a leitura veio de verdade de um ESP32
  físico (não da simulação automática do dashboard) — é esse segundo campo que o
  frontend usa para saber "este dispositivo tem hardware de verdade mandando dados
  agora, não preciso mais simular para ele" (ver `measurements.service.js` na seção 5.7
  e o Dashboard na seção 6.4).

### `Measurement` — cada leitura de temperatura/umidade

```prisma
model Measurement {
  id          String   @id @default(uuid())
  deviceId    String   @map("device_id")
  temperature Decimal  @db.Decimal(5, 2)
  humidity    Decimal  @db.Decimal(5, 2)
  measuredAt  DateTime @map("measured_at") @db.Timestamptz(3)
  receivedAt  DateTime @default(now()) @map("received_at") @db.Timestamptz(3)

  device Device  @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  alerts Alert[]

  @@index([deviceId, measuredAt(sort: Desc)])
}
```

- `Decimal(5, 2)` é um número com até 5 dígitos totais, 2 depois da vírgula (ex.:
  `999.99`) — mais preciso que `float` para esse tipo de dado, sem os arredondamentos
  estranhos que ponto flutuante binário pode causar.
- `measuredAt` é quando a leitura **aconteceu** de verdade (segundo o relógio do ESP32,
  sincronizado por NTP); `receivedAt` é quando o **servidor recebeu** essa leitura — em
  geral são quase o mesmo instante, mas podem divergir se o ESP32 ficar sem sincronizar
  a hora (ver seção 5.7 e 7.4).
- `@@index([deviceId, measuredAt(sort: Desc)])`: um **índice** é uma estrutura extra que
  o banco mantém para acelerar buscas — sem ele, toda consulta de histórico ("me dá as
  últimas leituras deste dispositivo") teria que examinar a tabela inteira. Como quase
  toda consulta filtra por dispositivo e ordena por data mais recente primeiro, o índice
  foi desenhado exatamente para esse padrão de acesso.

### `Setting` — preferências de limites por usuário

```prisma
model Setting {
  id                   String   @id @default(uuid())
  userId               String   @unique @map("user_id")
  idealTemperature     Decimal  @default(25) @map("ideal_temperature") @db.Decimal(5, 2)
  temperatureTolerance Decimal  @default(2) @map("temperature_tolerance") @db.Decimal(5, 2)
  temperatureMin       Decimal? @map("temperature_min") @db.Decimal(5, 2)
  temperatureMax       Decimal? @map("temperature_max") @db.Decimal(5, 2)
  idealHumidity        Decimal  @default(60) @map("ideal_humidity") @db.Decimal(5, 2)
  humidityTolerance    Decimal  @default(10) @map("humidity_tolerance") @db.Decimal(5, 2)
  humidityMin          Decimal? @map("humidity_min") @db.Decimal(5, 2)
  humidityMax          Decimal? @map("humidity_max") @db.Decimal(5, 2)
  notifyTemperature    Boolean  @default(true) @map("notify_temperature")
  notifyHumidity       Boolean  @default(true) @map("notify_humidity")
  updatedAt            DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

`userId String @unique` é o que faz essa relação ser **1 para 1** (não 1 para N): o
Prisma não deixa existir duas linhas de `Setting` com o mesmo `userId`. A lógica de como
esses campos viram uma faixa mín/máx está em `settings.service.js`, explicada na seção
5.8.

### `Alert` — os eventos de anomalia

```prisma
enum AlertVariable { temperature humidity }
enum AlertDirection { above_max below_min }
enum AlertStatus { active resolved }

model Alert {
  id                      String         @id @default(uuid())
  userId                  String         @map("user_id")
  deviceId                String         @map("device_id")
  variable                AlertVariable
  direction               AlertDirection
  triggeringMeasurementId String?        @map("triggering_measurement_id")
  peakValue               Decimal        @map("peak_value") @db.Decimal(5, 2)
  limitMin                Decimal        @map("limit_min") @db.Decimal(5, 2)
  limitMax                Decimal        @map("limit_max") @db.Decimal(5, 2)
  startedAt               DateTime       @map("started_at") @db.Timestamptz(3)
  endedAt                 DateTime?      @map("ended_at") @db.Timestamptz(3)
  status                  AlertStatus    @default(active)
  readAt                  DateTime?      @map("read_at") @db.Timestamptz(3)
  createdAt               DateTime       @default(now()) @map("created_at") @db.Timestamptz(3)

  @@index([userId, status])
  @@index([deviceId, status])
}
```

Esta é provavelmente a decisão de modelagem mais importante do projeto, e vale entender
bem porque a lógica que a acompanha (seção 5.9) é o "cérebro" das notificações: um
`Alert` não é uma leitura — é um **evento com começo, meio e fim**. Se a temperatura
ficar acima do limite por 20 leituras seguidas, isso gera **um único** registro de
`Alert` (que vai atualizando seu `peakValue` a cada leitura mais extrema), não 20
notificações repetidas. Isso é o oposto de simplesmente "marcar" cada medição individual
como boa/ruim — é gerenciar o **ciclo de vida** de uma anomalia.

## 5. Como o backend é organizado

```
backend/src/
├── app.js               → monta o Express: middlewares + rotas
├── server.js             → só chama app.listen()
├── lib/                  → prisma client, JWT, AppError, serializers, gerador de token
├── middlewares/           → auth de usuário, auth de dispositivo, rate limit, validação, erros
└── modules/
    ├── auth/               → registro, login, logout, esqueci/redefinir senha, /me
    ├── users/               → perfil, troca de senha, exclusão de conta
    ├── devices/             → CRUD de dispositivos + rotação de token
    ├── measurements/        → ingestão do ESP32 + endpoint de simulação
    ├── settings/            → temperatura/umidade ideal e tolerância
    ├── alerts/              → o motor de alertas
    └── history/             → consulta paginada + exportação CSV
```

### 5.1 O pipeline do Express (`app.js`)

Toda requisição HTTP que chega no backend passa por uma fila de funções chamadas
**middlewares**, uma depois da outra, nesta ordem exata:

```js
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
// ... Swagger UI em /api/docs ...

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/devices', devicesRoutes);
app.use('/api/measurements', measurementsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/history', historyRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
```

A ordem importa: `helmet()` (cabeçalhos de segurança) e `cors()` (quem pode chamar a
API) rodam antes de qualquer rota. `express.json()` converte o corpo da requisição de
texto para um objeto JavaScript (`req.body`) — sem ele, `req.body` viria `undefined`.
`cookieParser()` faz o mesmo para os cookies (`req.cookies`). Por último, depois de
**todas** as rotas, vêm `notFoundHandler` (qualquer caminho que não bateu com nenhuma
rota vira 404) e `errorHandler` (qualquer erro lançado em qualquer rota acima cai aqui —
ver seção 5.11). O `morgan` (log de cada requisição no terminal) é desligado durante
`npm test` para não poluir a saída dos testes.

### 5.2 O padrão de três camadas em cada módulo

Repare que cada módulo (`auth`, `devices`, `measurements`...) sempre tem até três
arquivos com papéis bem separados:

- **`*.routes.js`** — só entende HTTP: lê `req.body`/`req.params`, chama o service, e
  devolve `res.json(...)` com o status certo. Não tem regra de negócio.
- **`*.validation.js`** — define, com a biblioteca **Zod**, exatamente que formato os
  dados de entrada precisam ter. Se não bater, a requisição é rejeitada com `400` antes
  mesmo de chegar ao service.
- **`*.service.js`** — a regra de negócio de verdade: fala com o Prisma, decide o que é
  válido, lança erros de negócio (`AppError`).

Por que separar assim, em vez de escrever tudo dentro da rota? Duas razões práticas:
**(1)** cada camada fica fácil de entender sozinha (a rota nunca precisa saber como o
Prisma funciona, o service nunca precisa saber o que é um `req` do Express); **(2)** dá
para testar o service isoladamente, sem precisar simular uma requisição HTTP completa.

### 5.3 As duas autenticações: usuário vs. dispositivo

O sistema tem **dois** jeitos completamente diferentes de provar "quem está falando",
porque são dois tipos de cliente diferentes.

**Usuário** (`middlewares/auth.js`) — baseado no cookie de sessão (JWT), explicado na
seção 3.6:

```js
function requireAuth(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (!token) {
    return next(new AppError(401, 'Não autenticado.'));
  }
  try {
    req.userId = verifySessionToken(token);
    next();
  } catch (err) {
    next(new AppError(401, 'Sessão inválida ou expirada.'));
  }
}
```

Note o comentário-chave (e a regra de segurança mais importante do projeto): **nunca**
se confia num `userId` que viesse do corpo ou da URL da requisição — o único jeito de
saber quem é o usuário é decodificando o token que o próprio servidor assinou. Isso
impede que alguém simplesmente mande `{"userId": "outro-id-qualquer"}` e finja ser outra
pessoa.

**Dispositivo/ESP32** (`middlewares/deviceAuth.js`) — baseado em `device_id` +
token no header:

```js
async function requireDeviceAuth(req, res, next) {
  const deviceIdentifier = req.body?.device_id;
  const deviceKey = req.header('X-Device-Key');

  if (!deviceIdentifier || !deviceKey) {
    return next(new AppError(401, 'Credenciais de dispositivo ausentes.'));
  }

  const device = await prisma.device.findUnique({ where: { deviceIdentifier } });
  if (!device || !device.active) {
    return next(new AppError(401, 'Dispositivo não autorizado.'));
  }

  const isValid = await bcrypt.compare(deviceKey, device.deviceSecretHash);
  if (!isValid) {
    return next(new AppError(401, 'Dispositivo não autorizado.'));
  }

  req.device = device;
  next();
}
```

O ESP32 não faz login nem guarda cookie — ele simplesmente manda o token em texto puro
num header dedicado (`X-Device-Key`), a cada requisição, e o servidor compara (via
`bcrypt.compare`, nunca comparando texto puro contra texto puro) com o hash salvo. O
`device_identifier` sozinho nunca é suficiente — é só o "usuário", o token é a "senha".

### 5.4 Módulo `auth`: registro, login, recuperação de senha

`auth.service.js` concentra a lógica. Alguns pontos que valem a pena saber explicar:

- **Mensagem de erro genérica no login.** Tanto "e-mail não existe" quanto "senha
  errada" retornam exatamente a mesma mensagem (`INVALID_CREDENTIALS_MESSAGE = 'E-mail
  ou senha inválidos.'`). Se fossem mensagens diferentes, alguém poderia descobrir quais
  e-mails estão cadastrados no sistema só tentando logins e reparando na resposta —
  isso se chama **enumeração de contas**, e a rota de "esqueci minha senha" tem a mesma
  proteção (sempre responde a mesma mensagem de sucesso, exista ou não o e-mail).
- **Hash do token de redefinição de senha usa SHA-256, não bcrypt** — e isso é uma
  escolha deliberada, não um descuido:

  ```js
  function hashResetToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
  ```

  O comentário no código explica por quê: para redefinir a senha, o sistema precisa
  **encontrar** o usuário dono daquele token com uma busca direta no banco (`WHERE
  token_hash = ...`). Bcrypt gera um hash diferente toda vez (por causa do "salt"
  aleatório), então não daria para comparar direto numa consulta SQL — seria preciso
  carregar todo mundo do banco e comparar um por um. SHA-256 é determinístico (mesmo
  texto sempre gera o mesmo hash), o que permite a busca direta, e isso continua seguro
  aqui porque o token em si já nasce com 256 bits de aleatoriedade
  (`crypto.randomBytes(32)`) — o mesmo princípio usado por tokens de acesso de GitHub ou
  reset de senha do Django, como o comentário do código observa.
- **Falha de e-mail nunca vira erro HTTP:**

  ```js
  try {
    await mailer.sendPasswordResetEmail(user.email, resetUrl);
  } catch (err) {
    console.error('[auth] Falha ao enviar e-mail de redefinição de senha:', err.message);
  }
  ```

  Se o envio de e-mail falhasse e isso virasse um erro 500 visível, um atacante
  conseguiria diferenciar "e-mail existe mas o SMTP falhou" (500) de "e-mail não existe"
  (200 imediato) — um canal lateral que vazaria quais contas existem. Por isso o erro só
  é registrado no log do servidor, e a resposta ao usuário é sempre a mesma.
- Sem SMTP configurado (`.env` sem credenciais de e-mail), o sistema roda em **modo
  simulação de e-mail**: o link de redefinição é impresso no console do backend em vez
  de enviado de verdade — o suficiente para demonstrar o fluxo na apresentação sem
  depender de internet/credenciais reais (ver `backend/src/lib/mailer.js`).

### 5.5 Módulo `users`: perfil, senha, exclusão de conta

Duas rotas merecem destaque por reforçarem um princípio de segurança repetido no
projeto — **uma sessão válida sozinha não deveria bastar para ações sensíveis**:

```js
router.put('/me/password', validateBody(changePasswordSchema), async (req, res, next) => {
  await authService.changePassword(req.userId, req.body.currentPassword, req.body.newPassword);
  res.status(204).end();
});

router.delete('/me', validateBody(deleteAccountSchema), async (req, res, next) => {
  await authService.deleteAccount(req.userId, req.body.password);
  clearSessionCookie(res);
  res.status(204).end();
});
```

Tanto trocar a senha quanto excluir a conta **exigem a senha atual no corpo da
requisição**, mesmo que o usuário já esteja autenticado pelo cookie. A ideia: se alguém
roubasse a sessão de outra pessoa (por exemplo, um computador compartilhado que ficou
logado), ainda não conseguiria sequestrar a conta permanentemente sem saber a senha.

A exclusão em si é uma única chamada, `prisma.user.delete({ where: { id: userId } })` —
o resto (dispositivos, medições, alertas, configurações) desaparece sozinho por causa do
`onDelete: Cascade` do schema (seção 4).

### 5.6 Módulo `devices`: cadastro de ESP32s

Um padrão que se repete em `devices.service.js`, e vale entender bem porque aparece de
novo em `history.service.js`:

```js
async function findOwned(userId, deviceId) {
  const device = await prisma.device.findFirst({ where: { id: deviceId, userId } });
  if (!device) throw new AppError(404, 'Dispositivo não encontrado.');
  return device;
}
```

Se o dispositivo existe mas pertence a **outro** usuário, a resposta ainda é `404` (não
encontrado) — nunca `403` (proibido). A diferença é sutil mas importante: um `403`
confirmaria "esse ID existe, você só não pode vê-lo", o que já é uma informação vazada.
Devolver sempre `404` faz um ID de outra pessoa parecer indistinguível de um ID que
nunca existiu.

O token do dispositivo (`generateDeviceSecret()`, 24 bytes aleatórios em hexadecimal) só
é exibido em texto puro **uma vez**, na resposta da criação (ou da rotação) — depois
disso, só o hash fica salvo, e não tem como recuperá-lo (só gerar um novo com
"Regenerar token").

### 5.7 Módulo `measurements`: a porta de entrada dos dados

Este módulo tem **duas rotas de entrada bem diferentes** para o mesmo tipo de dado — e
a distinção entre elas é o que permite o sistema ser demonstrado sem hardware físico:

```js
// Usado pelo ESP32 de verdade — autenticado por device_id + X-Device-Key
router.post('/', measurementsLimiter, requireDeviceAuth, validateBody(createMeasurementSchema),
  async (req, res, next) => {
    const measurement = await measurementsService.create(req.device, req.body, { source: 'real' });
    ...
  });

// Endpoint de simulação — autenticado como USUÁRIO normal, só em dispositivos próprios
router.post('/simulate', requireAuth, validateBody(simulateMeasurementSchema),
  async (req, res, next) => {
    const device = await devicesService.findOwned(req.userId, req.body.deviceId);
    const measurement = await measurementsService.create(device, req.body, { source: 'simulated' });
    ...
  });
```

Ambas terminam chamando a mesma função `measurementsService.create`, só que com um
parâmetro `source` diferente — e é esse parâmetro que decide se `lastRealMeasurementAt`
é atualizado ou não (seção 4). Assim, uma leitura simulada nunca finge ser uma leitura
real.

Dentro de `measurements.service.js`, a função `resolveMeasuredAt` trata um problema
físico real do hardware:

```js
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000; // 5 minutos de tolerância
const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000; // 1 ano

function resolveMeasuredAt(timestamp) {
  if (!timestamp) return new Date();
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return new Date();
  const now = Date.now();
  if (parsed.getTime() > now + MAX_CLOCK_SKEW_MS) return new Date();
  if (parsed.getTime() < now - MAX_AGE_MS) return new Date();
  return parsed;
}
```

Um ESP32 recém-ligado, antes de sincronizar a hora via NTP (seção 7.4), teria o relógio
zerado (próximo de 1970). Em vez de rejeitar a leitura por causa disso, o backend usa o
horário do **próprio servidor** como substituto quando o timestamp enviado é ausente,
inválido, ou implausível — a leitura não se perde, só o "quando exatamente aconteceu"
fica com uma precisão um pouco menor.

Depois de gravar a medição, `create()` sempre busca as configurações do usuário, calcula
os limites (seção 5.8) e chama o motor de alertas (seção 5.9) — toda leitura, real ou
simulada, passa por essa mesma verificação.

### 5.8 Módulo `settings`: cálculo da faixa aceitável

```js
function computeThresholds(settings) {
  const temperature = {
    min: settings.temperatureMin != null
      ? Number(settings.temperatureMin)
      : Number(settings.idealTemperature) - Number(settings.temperatureTolerance),
    max: settings.temperatureMax != null
      ? Number(settings.temperatureMax)
      : Number(settings.idealTemperature) + Number(settings.temperatureTolerance),
  };
  const humidity = {
    min: settings.humidityMin != null
      ? Number(settings.humidityMin)
      : Math.max(0, Number(settings.idealHumidity) - Number(settings.humidityTolerance)),
    max: settings.humidityMax != null
      ? Number(settings.humidityMax)
      : Math.min(100, Number(settings.idealHumidity) + Number(settings.humidityTolerance)),
  };
  return { temperature, humidity };
}
```

A regra: por padrão, a faixa aceitável é `ideal ± tolerância` (ex.: ideal 25°C,
tolerância 2°C → faixa de 23°C a 27°C). Mas se o usuário definir uma **taxa mínima ou
máxima explícita** em Configurações, ela substitui aquele lado específico do cálculo —
permite uma faixa assimétrica (ex.: "não me importo se esfriar, só me avise se passar de
28°C"). A umidade, quando calculada automaticamente, é sempre limitada entre 0 e 100
(`Math.max`/`Math.min`) porque uma porcentagem fora dessa faixa não existe fisicamente.

Essa mesma função roda **duas vezes**, em dois lugares diferentes, com o mesmo
resultado: uma vez no backend (para decidir se dispara alerta) e uma cópia equivalente
em `frontend/src/pages/Settings.jsx` (só para mostrar uma prévia da faixa ao usuário
antes mesmo de salvar) — a fonte da verdade continua sendo sempre o backend; a cópia no
frontend é só uma conveniência visual.

### 5.9 O motor de alertas, em detalhe

Esta é a parte mais sofisticada do backend, em `alerts.service.js`. A função
`evaluateMeasurement` roda depois de **toda** medição gravada (seção 5.7) e decide o que
fazer com cada uma das duas variáveis (temperatura, umidade) separadamente:

```js
async function evaluateMeasurement(measurement, device, thresholds, notifyFlags = { temperature: true, humidity: true }) {
  for (const variable of VARIABLES) {
    const value = Number(measurement[variable]);
    const { min, max } = thresholds[variable];
    const isOutOfRange = value < min || value > max;

    const activeAlert = await prisma.alert.findFirst({
      where: { deviceId: device.id, variable, status: 'active' },
    });

    if (isOutOfRange) {
      if (!notifyFlags[variable] && !activeAlert) {
        continue; // notificação desligada e nada em andamento: ignora
      }

      const direction = value < min ? 'below_min' : 'above_max';

      if (!activeAlert) {
        await prisma.alert.create({ data: { /* ... abre um novo evento ... */ status: 'active' } });
        continue;
      }

      // já existe um alerta em andamento: só atualiza o pico, se este valor for mais extremo
      const currentPeak = Number(activeAlert.peakValue);
      const isMoreExtreme = activeAlert.direction === 'above_max' ? value > currentPeak : value < currentPeak;
      if (isMoreExtreme) {
        await prisma.alert.update({ where: { id: activeAlert.id }, data: { peakValue: value } });
      }
      continue;
    }

    // voltou ao normal: se havia um alerta ativo, encerra
    if (activeAlert) {
      await prisma.alert.update({ where: { id: activeAlert.id }, data: { status: 'resolved', endedAt: measurement.measuredAt } });
    }
  }
}
```

Vamos seguir um exemplo numérico completo, porque é o jeito mais fácil de "sentir" a
lógica. Suponha o limite de temperatura configurado como 23–27°C, e chegam 5 leituras
seguidas:

| Leitura | Temperatura | O que acontece |
|---|---|---|
| 1 | 25°C | dentro da faixa — nada acontece |
| 2 | 28°C | fora da faixa, **não havia** alerta ativo → **abre** um novo `Alert` (`status: active`, `peakValue: 28`) |
| 3 | 29.5°C | fora da faixa, **já havia** alerta ativo, e 29.5 é mais extremo que 28 → **atualiza** `peakValue` para 29.5 (não cria um segundo alerta!) |
| 4 | 28.2°C | fora da faixa, alerta ativo, mas 28.2 é **menos** extremo que o pico atual (29.5) → não muda nada |
| 5 | 26°C | voltou para dentro da faixa, havia alerta ativo → **encerra** o alerta (`status: resolved`, `endedAt` = agora) |

Resultado final: **um único registro** de `Alert`, com `peakValue = 29.5`, `startedAt` na
leitura 2 e `endedAt` na leitura 5 — e não cinco notificações separadas. É essa
modelagem como **evento com início e fim**, em vez de "marcar cada leitura ruim
individualmente", que evita o spam de notificação (seção 45 do escopo original do
projeto).

O parâmetro `notifyFlags` (vindo de `Setting.notifyTemperature`/`notifyHumidity`, editável
em Configurações) só entra em ação **na hora de abrir um alerta novo** — repare na
condição `!notifyFlags[variable] && !activeAlert`. Se o usuário desligar notificação de
umidade, mas já havia um alerta de umidade em andamento antes de desligar, esse alerta
**continua** sendo fechado normalmente quando a leitura voltar ao normal — ele nunca
fica "preso" aberto para sempre. Só a abertura de alertas **novos** para aquela variável
é pulada. O status "fora do limite" continua aparecendo no dashboard e histórico mesmo
com a notificação desligada — só o alerta (a notificação) que não é gerado.

### 5.10 Módulo `history`: filtros dinâmicos e exportação

`buildWhere()` em `history.service.js` monta a cláusula `WHERE` do Prisma como uma
**lista de condições combinadas com E** (`AND: conditions`), em vez de ir remendando um
único objeto — o comentário no código explica que a abordagem anterior tinha um bug real
(um filtro podia sobrescrever outro). Cada filtro (período, faixa de temperatura, faixa
de umidade, situação por variável) vira uma condição independente adicionada à lista, o
que evita esse tipo de conflito.

A exportação (`GET /api/history/export`) reaproveita a mesma função de filtros, mas
limita a `MAX_EXPORT_ROWS = 5000` linhas e monta o CSV manualmente (não usa nenhuma
biblioteca externa para isso, porque o formato é simples o bastante: um cabeçalho fixo +
uma linha por medição, campos separados por vírgula).

### 5.11 Tratamento de erros centralizado

Toda rota do projeto delega erros para o Express com `next(err)`, e eles convergem para
um único lugar, `errorHandler.js`:

```js
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message, details: err.details });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Corpo da requisição não é um JSON válido.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
}
```

`AppError` (`lib/AppError.js`) é uma classe simples que carrega um `statusCode` junto da
mensagem — é o jeito do código "esperar" um erro de negócio (senha errada, dispositivo
não encontrado) e escolher o status HTTP certo. Qualquer erro que **não** seja um
`AppError` (um bug de verdade, não previsto) vira um `500` genérico — o detalhe completo
só aparece no log do servidor, nunca na resposta ao cliente, para não vazar informação
interna (como caminho de arquivo ou stack trace) para quem está usando a API.

### 5.12 Camadas extras de segurança

- **`helmet()`**: adiciona automaticamente vários cabeçalhos HTTP recomendados contra
  ataques comuns (ex.: impedir que o site seja carregado dentro de um `<iframe>` de
  outro domínio).
- **CORS com `credentials: true`**: só a origem definida em `CORS_ORIGIN` (o endereço do
  frontend) pode fazer requisições que enviam cookies — isso impede que um site qualquer
  na internet finja ser o frontend e reaproveite a sessão de alguém.
- **Rate limiting** (`middlewares/rateLimit.js`, biblioteca `express-rate-limit`): login
  e registro são limitados a 10 tentativas a cada 15 minutos por IP (contra força bruta
  de senha); o envio de medições é limitado a 30 por minuto (contra um dispositivo
  "descontrolado" ou uma credencial vazada inundando a API). Esses limitadores ficam
  **desligados** durante `npm test` (`NODE_ENV=test`), porque os arquivos de teste rodam
  em série no mesmo processo Node e um contador compartilhado entre eles causaria falhas
  dependendo da ordem de execução — o mecanismo em si continua testado à parte, em
  `tests/security/rateLimit.test.js`, com uma instância isolada do limitador.
- **Validação com Zod em toda entrada**: nenhum dado do corpo ou da query chega ao
  service sem passar por um schema Zod primeiro (`middlewares/validate.js`) — por
  exemplo, `createMeasurementSchema` rejeita uma temperatura fisicamente impossível
  (fora de -40°C a 80°C) antes mesmo de tentar gravar no banco.

## 6. Como o frontend é organizado

```
frontend/src/
├── App.jsx                  → todas as rotas da aplicação
├── context/                  → AuthContext (usuário logado) e ThemeContext (aparência)
├── services/                  → um arquivo por domínio, chamadas à API via axios
├── components/                → Layout, cards, gráfico, badges, paginação, modais
├── utils/                      → formatação de data/hora, status do dispositivo, períodos
└── pages/                      → uma página por rota
```

### 6.1 Roteamento (`App.jsx`)

```jsx
<ThemeProvider>
  <BrowserRouter>
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/devices" element={<ProtectedRoute><Devices /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  </BrowserRouter>
</ThemeProvider>
```

Repare na ordem de aninhamento: `ThemeProvider` envolve tudo (o tema não depende de
login), `AuthProvider` fica dentro do `BrowserRouter` (porque usa `useNavigate`/hooks de
rota internamente em outras telas). Toda página "de dentro" do sistema é envolvida por
`<ProtectedRoute>`:

```jsx
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div>Carregando…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
```

Nada sofisticado: enquanto o `AuthContext` ainda não confirmou se existe uma sessão
válida (`loading`), mostra um carregando; se confirmou que não há usuário, redireciona
para o login; senão, mostra a página normalmente.

### 6.2 Contextos globais

`AuthContext.jsx` centraliza tudo relacionado a "quem está logado":

```jsx
useEffect(() => {
  authService.getCurrentUser().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
}, []);
```

Assim que o app carrega (array de dependências vazio `[]` = só roda uma vez), ele
pergunta ao backend "quem sou eu?" (`GET /api/auth/me`, que só funciona se o cookie de
sessão for válido). Se der erro (sem cookie, ou expirado), `user` fica `null` e o
`ProtectedRoute` manda para o login. As funções `login`, `register` e `logout` só
chamam o serviço correspondente e atualizam esse `user` compartilhado.

`ThemeContext.jsx` é mais elaborado do que parece à primeira vista — ele guarda 4
preferências independentes (modo escuro, cor de destaque, tamanho de fonte, redução de
movimento), todas persistidas no `localStorage` do navegador (por isso sobrevivem a
recarregar a página, mas são específicas daquele navegador/computador). O detalhe mais
interessante é o modo escuro:

```js
function readExplicitDarkPreference() {
  const stored = localStorage.getItem(STORAGE_KEY_DARK);
  if (stored === 'true') return true;
  if (stored === 'false') return false;
  return null; // usuário nunca escolheu manualmente
}
// ...
const darkMode = explicitPreference ?? systemPrefersDark;
```

Enquanto o usuário nunca mexeu manualmente no interruptor, `explicitPreference` é `null`
e o tema **segue automaticamente** o sistema operacional (`prefers-color-scheme`, e um
`useEffect` com `mediaQuery.addEventListener('change', ...)` reage em tempo real se o
usuário trocar o tema do Windows/macOS enquanto o site está aberto). No momento em que a
pessoa clica no interruptor em Configurações, essa escolha vira fixa e persistida — até
ela clicar em "voltar a seguir o sistema".

A cor de destaque funciona reescrevendo variáveis CSS (`--color-brand-500`, etc.)
diretamente no elemento raiz do documento — como todas as classes do Tailwind (`bg-brand-600`)
já apontam para essas variáveis, trocar a cor não precisa recompilar nada, só
muda o valor da variável em tempo real.

### 6.3 A camada de serviços e o axios

```js
// services/api.js
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});
```

`withCredentials: true` é o que faz o navegador **enviar o cookie httpOnly** junto de
cada requisição para a API (sem isso, mesmo estando logado, o cookie não seria mandado
por padrão numa requisição entre origens diferentes como `localhost:5173` →
`localhost:3000`). Cada arquivo em `services/` (`auth.js`, `devices.js`, `history.js`...)
só empacota chamadas a essa instância `api`, uma função por endpoint — as páginas nunca
chamam `axios` diretamente, sempre por um desses serviços.

### 6.4 Página por página

**Login / Register** (`Login.jsx`, `Register.jsx`): formulário controlado (cada `input`
tem seu `value` amarrado ao estado e um `onChange` que atualiza esse estado), submissão
via `async/await`, e um padrão repetido em quase toda tela do projeto para mostrar erro
vindo da API:

```js
setError(err.response?.data?.error || 'Não foi possível entrar. Tente novamente.');
```

Como o backend sempre responde erros no formato `{ error: "mensagem" }` (seção 5.11),
o frontend consegue mostrar a mensagem exata que veio do servidor, com uma mensagem
genérica como último recurso caso a requisição falhe por outro motivo (ex.: servidor
fora do ar).

**Dashboard** (`Dashboard.jsx`) é a página mais complexa do projeto — vale entender a
fundo porque reúne várias ideias importantes:

- Busca a última leitura de cada dispositivo a cada 10 segundos
  (`POLL_INTERVAL_MS = 10_000`, via `setInterval` dentro de `useEffect`) — essa é a
  forma de "atualização em tempo real" escolhida no projeto: **polling**, não WebSocket.
  Repetir uma pergunta a cada poucos segundos é mais simples de implementar e depurar do
  que manter uma conexão aberta, e para o volume de dados de um TCC a diferença de
  eficiência é irrelevante.
- **A simulação automática**, o mecanismo que permite demonstrar o sistema inteiro sem
  nenhum ESP32 físico ligado:

  ```js
  const AUTO_SIM_INTERVAL_MS = 2_000;
  const OUT_OF_RANGE_PROBABILITY = 5 / 105; // proporção 100:5 pedida no escopo
  const REAL_HARDWARE_GRACE_MS = 60_000;
  ```

  A cada 2 segundos, para cada dispositivo do usuário que **não** tenha recebido uma
  leitura real do ESP32 físico nos últimos 60 segundos (`lastRealMeasurementAt`, seção
  4), o Dashboard gera um valor aleatório dentro da faixa configurada
  (`buildSimulatedReading`) e manda para `POST /api/measurements/simulate`. Em ~4,8% das
  vezes (5/105), o valor é empurrado propositalmente para fora da faixa
  (`pushOutOfRange`), nunca as duas variáveis ao mesmo tempo, para deixar claro no
  dashboard qual delas "disparou" o alerta. Um detalhe técnico sutil: a lista de
  dispositivos usada dentro do `setInterval` vem de uma **ref**
  (`latestRef.current`), não diretamente do estado `latest` — isso evita que o
  intervalo precise ser destruído e recriado toda vez que uma nova leitura chega (o que
  aconteceria se a função do `setInterval` "capturasse" o estado antigo via closure).
- O seletor de dispositivo (quando há mais de um) e o resumo compacto dos outros
  dispositivos no canto da tela usam a mesma lista de "últimas leituras", só filtrada de
  formas diferentes.

**History** (`History.jsx`): os campos numéricos de filtro (temperatura/umidade
mín/máx) usam **debounce** de 400ms (`DebouncedField`) — o valor digitado aparece na
tela instantaneamente, mas a busca à API só dispara 400ms depois que a pessoa parou de
digitar, para não recarregar a tabela a cada tecla pressionada enquanto ainda se está
digitando um número de dois ou três dígitos. Os campos de data
(`<input type="datetime-local">`) trabalham em horário **local do navegador**, e são
convertidos para UTC/ISO (`new Date(...).toISOString()`) só na hora de montar a
requisição — o servidor nunca precisa adivinhar em que fuso horário um filtro foi
digitado.

**Settings** (`Settings.jsx`): recalcula a mesma fórmula de faixa aceitável do backend
(seção 5.8) só para mostrar uma prévia ("Faixa aceitável: 23.0°C a 27.0°C") antes mesmo
de salvar — mas quem decide de verdade, quando o formulário é enviado, continua sendo o
backend (o frontend nunca é a fonte de verdade, só uma conveniência visual, como
reforçado na seção 2).

**Devices** (`Devices.jsx`): ao criar ou regenerar um token, o segredo aparece uma única
vez num modal (`SecretRevealModal`) — depois de fechado, não tem como reabrir (o próprio
backend só devolve o texto puro naquela resposta específica, nunca de novo, seção 5.6).

**Notifications** (`Notifications.jsx`): agrupa os alertas por dispositivo em abas.
O detalhe de design mais específico dessa tela: marcar como lida **não** acontece
simplesmente por visitar a página — só quando o usuário **expande** aquela notificação
específica para ver os detalhes (`handleToggle` chama `markAlertRead` só na abertura, e
só se ainda não tiver `readAt`). Isso evita que a bolinha de "não lida" suma sozinha só
porque a pessoa passou o mouse na tela sem realmente ler nada.

**Profile** (`Profile.jsx`): dividida em aba "Dados" (nome, foto de perfil — convertida
para uma *data URL* base64 no próprio navegador via `FileReader`, limitada a 500KB antes
mesmo de tentar enviar; e um botão que agrega perfil + dispositivos + configurações +
notificações num único arquivo `.json` para download, sem precisar de nenhum endpoint
novo no backend) e aba "Segurança" (troca de senha, e exclusão de conta que exige senha
**e** uma caixa de confirmação explícita antes de habilitar o botão vermelho — dificulta
um clique acidental numa ação irreversível).

### 6.5 Fuso horário

Toda data é guardada e trafega em **UTC** (padrão internacional, sem fuso). A conversão
para o horário de Brasília só acontece na hora de **mostrar** algo na tela, em um único
lugar (`utils/format.js`):

```js
const TIME_ZONE = 'America/Sao_Paulo';
export function formatDateTime(value) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: TIME_ZONE, /* ... */ }).format(new Date(value));
}
```

Centralizar essa conversão evita o erro clássico de fuso horário: se cada tela
convertesse a data do seu próprio jeito, seria fácil alguma esquecer e mostrar a hora
errada.

## 7. O firmware do ESP32

`esp32/firmware/firmware.ino` é o único arquivo que roda dentro do microcontrolador
(mais o par `src/Sensor.h`/`Sensor.cpp`). Diferente do backend/frontend, não existe
"framework" aqui — é C++ quase puro, rodando direto no hardware.

### 7.1 `setup()` e `loop()`

Todo programa Arduino/ESP32 tem essas duas funções obrigatórias: `setup()` roda **uma
vez** ao ligar; `loop()` roda **repetidamente**, para sempre, enquanto o dispositivo
estiver ligado.

```cpp
void setup() {
  Serial.begin(115200);
  sensorSetup();
  if (connectWifi()) {
    syncTime();
  }
}

void loop() {
  reconnectWifiIfNeeded();

  unsigned long now = millis();
  if (now - lastReadingAt < READING_INTERVAL_MS) return;
  lastReadingAt = now;

  if (WiFi.status() != WL_CONNECTED) return;

  SensorReading reading = sensorRead();
  if (!reading.valid) return;

  sendMeasurement(reading);
}
```

Repare que `loop()` **não usa `delay()`** para esperar entre leituras — em vez disso,
compara `millis()` (tempo desde que o ESP32 ligou) com a última leitura feita. Essa
técnica ("temporização não bloqueante") é importante porque, se o código usasse
`delay(30000)` para esperar 30 segundos, o ESP32 ficaria **completamente travado**
durante esse tempo, incapaz de, por exemplo, notar que o Wi-Fi caiu. Com `millis()`, o
`loop()` continua rodando rapidinho o tempo todo, só "pulando" o envio até a hora certa
chegar.

### 7.2 A abstração do sensor

```cpp
// Sensor.h
struct SensorReading {
  float temperature;
  float humidity;
  bool valid;
};
void sensorSetup();
SensorReading sensorRead();
```

O resto do firmware (Wi-Fi, autenticação, montagem do JSON) nunca inclui a biblioteca do
DHT11 diretamente — só esse cabeçalho genérico. Trocar o sensor por outro modelo no
futuro (DHT22, SHT31, BME280...) significaria reescrever só `Sensor.cpp`; nada mais no
firmware precisaria mudar. O comentário no próprio arquivo explica também por que ele
vive dentro de uma pasta chamada exatamente `src/`: é a única subpasta que o Arduino
IDE/`arduino-cli` compila automaticamente junto com o sketch principal — um arquivo
`.cpp` solto em qualquer outro nome de pasta seria silenciosamente ignorado.

Dentro de `Sensor.cpp`, a leitura é validada duas vezes: primeiro se é um número
(`dht.readTemperature()`/`readHumidity()` retornam `NAN` quando a leitura falha — timeout
na linha de dados, checksum errado), depois se está numa faixa fisicamente plausível
(-10°C a 60°C, 0% a 100% — uma margem folgada em torno da faixa nominal do DHT11, só
para descartar leituras claramente erradas; a validação mais rigorosa acontece de novo,
de forma independente, no backend).

### 7.3 Wi-Fi: conectar e reconectar sem travar

```cpp
void reconnectWifiIfNeeded() {
  if (WiFi.status() == WL_CONNECTED) return;
  unsigned long now = millis();
  if (now - lastWifiRetryAt < WIFI_RETRY_INTERVAL_MS) return;
  lastWifiRetryAt = now;
  connectWifi();
}
```

Chamada em toda iteração do `loop()`, essa função não faz nada na maior parte do tempo
(se já está conectado). Se cair, tenta reconectar a cada 5 segundos — sem travar o resto
do programa esperando, pelo mesmo princípio da seção 7.1.

### 7.4 Por que sincronizar hora via NTP

```cpp
void syncTime() {
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  // espera até 10s o relógio deixar de estar "zerado" (próximo de 1970)
}
```

Sem isso, o relógio interno do ESP32 começaria contando a partir de 1º de janeiro de
1970 (a "época" padrão de sistemas Unix) — toda medição pareceria ter acontecido há mais
de 50 anos. Por isso o firmware sincroniza a hora certa (em UTC) via **NTP** (Network
Time Protocol) assim que conecta ao Wi-Fi. Se, por algum motivo, a sincronização
falhar, `currentIsoTimestamp()` retorna uma string vazia e o campo `timestamp`
simplesmente não é incluído no JSON enviado — e é exatamente esse caso que o
`resolveMeasuredAt` do backend (seção 5.7) sabe tratar, usando a hora do servidor como
substituto em vez de rejeitar a leitura.

### 7.5 Montando e enviando a requisição

```cpp
void sendMeasurement(const SensorReading &reading) {
  JsonDocument doc;
  doc["device_id"] = DEVICE_ID;
  doc["temperature"] = reading.temperature;
  doc["humidity"] = reading.humidity;
  // timestamp incluído só se a hora estiver sincronizada

  String payload;
  serializeJson(doc, payload);

  HTTPClient http;
  WiFiClientSecure secureClient;
  if (isApiUsingHttps()) {
    secureClient.setInsecure();
    http.begin(secureClient, String(API_BASE_URL) + "/measurements");
  } else {
    http.begin(plainClient, String(API_BASE_URL) + "/measurements");
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_TOKEN);
  int statusCode = http.POST(payload);
  http.end();
}
```

Dois pontos que valem destaque:

- O firmware **já suporta HTTPS** (`WiFiClientSecure`) — decidir se `API_BASE_URL`
  começa com `http://` ou `https://` é o suficiente, sem precisar reescrever nenhuma
  outra linha do firmware. É por isso que apontar o ESP32 para um servidor de verdade na
  internet (em vez de um IP local) não exige mudança de código, só de configuração.
- `secureClient.setInsecure()` faz o ESP32 **pular a validação da cadeia de
  certificados** do servidor HTTPS. Isso é aceitável para a demonstração local de um
  TCC, mas é explicitamente **não recomendado em produção real** — lá, o certificado do
  servidor deveria ser conferido de verdade (`setCACert`, fixando o certificado
  esperado), porque sem essa checagem um atacante na mesma rede poderia, em teoria, se
  passar pelo servidor. O comentário no próprio código já deixa esse limite documentado
  — é o tipo de "risco técnico assumido conscientemente" que vale mencionar se o
  professor perguntar sobre segurança do firmware.
- Os códigos de resposta (`201` sucesso, `400`/`401`/`429` erro) só são impressos no
  `Serial` — nunca travam o firmware; a próxima leitura, no próximo ciclo do `loop()`,
  acontece normalmente de qualquer forma.

## 8. Testes automatizados: o que existe de verdade

Vale ser preciso aqui, porque é fácil, numa conversa com o professor, superestimar o que
existe. O que roda de verdade neste projeto:

- **Backend: Jest + Supertest**, comando `npm test` (dentro de `backend/`). Os arquivos
  vivem em `backend/tests/`:

  | Arquivo | O que cobre |
  |---|---|
  | `auth.test.js` | cadastro (válido, e-mail duplicado/inválido, senha fraca, nascimento no futuro), login (certo/errado, mensagem genérica) |
  | `authorization.test.js` | isolamento entre usuários — usuário A nunca acessa dado de B (sempre 404, seção 5.6) |
  | `measurements.test.js` | ingestão válida, token incorreto, dispositivo inexistente/desativado, dado fisicamente implausível |
  | `alerts.test.js` | motor de alertas (seção 5.9): dentro do limite, acima, abaixo, várias leituras seguidas fora do limite gerando **um único** evento com pico atualizado, fechamento ao normalizar, reabertura como evento novo |
  | `settings.test.js` | cálculo dos limites, valores incoerentes rejeitados |
  | `history.test.js` | filtros por status/período, paginação sem sobreposição, exportação CSV |
  | `passwordManagement.test.js` | troca de senha, esqueci/redefinir senha |
  | `security/rateLimit.test.js` | o rate limiter em si, isolado (os limitadores reais ficam desligados durante os outros testes, seção 5.12) |

  Esses testes sobem uma instância real do Express (via Supertest) contra um banco
  PostgreSQL **separado** do de desenvolvimento (`tcc_test`), então testam o
  comportamento real da API, não uma simulação.

- **Frontend: não existe uma suíte automatizada.** As telas foram verificadas
  manualmente durante o desenvolvimento (navegando de verdade pelo site: cadastro,
  login, geração de alertas via simulação, filtros de histórico, etc.), mas não há
  arquivos de teste automatizado de interface no repositório — nem Playwright, nem
  Cypress, nem Testing Library. Se o professor perguntar "e o frontend, como foi
  testado?", a resposta honesta é: manualmente, ponta a ponta, e a garantia automatizada
  do projeto está concentrada na API (que é onde as regras de negócio realmente vivem —
  seção 2).

## 9. Um fluxo completo, do sensor ao gráfico

Juntando tudo: veja o caminho de **uma única leitura**, do momento em que o DHT11 mede o
ambiente até aparecer no gráfico do usuário.

1. **ESP32, `loop()`**: o temporizador não bloqueante (seção 7.1) decide que já passou
   `READING_INTERVAL_MS` desde a última leitura.
2. **`sensorRead()`** (`Sensor.cpp`): lê o DHT11, confere se o valor é numérico e
   fisicamente plausível. Digamos: 29.5°C, 60% de umidade.
3. **`sendMeasurement()`**: monta `{"device_id": "ESP32-A1B2C3", "temperature": 29.5,
   "humidity": 60, "timestamp": "2026-08-27T14:32:00Z"}` e envia `POST
   /measurements` com o header `X-Device-Key`.
4. **`measurementsLimiter` → `requireDeviceAuth` → `validateBody`** (seções 5.3, 5.12):
   confere limite de requisições, autentica o dispositivo via bcrypt, valida o formato
   do JSON.
5. **`measurementsService.create()`** (seção 5.7): resolve o `measuredAt`, grava a
   medição no banco (`prisma.measurement.create`), atualiza `lastSeenAt` **e**
   `lastRealMeasurementAt` do dispositivo (porque `source: 'real'`).
6. **`settingsService.computeThresholds()`** (seção 5.8): calcula que o limite de
   temperatura desse usuário é, digamos, 23–27°C.
7. **`alertsService.evaluateMeasurement()`** (seção 5.9): 29.5°C está acima de 27°C.
   Se não havia alerta ativo de temperatura para esse dispositivo, **cria um novo**
   `Alert` (`status: active`, `peakValue: 29.5`, `direction: above_max`).
8. Backend responde `201` ao ESP32, que só imprime no `Serial` e segue para a próxima
   leitura.
9. **No navegador**, o Dashboard (aberto pelo usuário) está fazendo `GET
   /api/measurements/latest` a cada 10 segundos (seção 6.4). Na próxima rodada desse
   polling, a resposta já inclui essa nova medição, com `temperatureStatus:
   "out_of_range"` (calculado por `settingsService.evaluateReadingStatus`).
10. O card de temperatura no Dashboard fica vermelho/em alerta (via `MetricCard`); o
    gráfico de linha (`LineChart`) ganha mais um ponto.
11. **`AlertsBanner`** (seção 6.4), que consulta `GET /api/alerts/summary` a cada
    render, mostra "Você possui 1 notificação desde seu último acesso".
12. O usuário clica, vai para **Notifications**, expande aquela notificação — só aí
    `PATCH /api/alerts/:id/read` é chamado, marcando `readAt`.
13. Depois, na tela **History**, essa mesma medição aparece na tabela paginada, com a
    situação "Fora do limite" na coluna de temperatura — e pode ser filtrada,
    ordenada ou exportada em CSV.

Esse é o mesmo caminho, ponta a ponta, tanto para uma leitura real do ESP32 quanto para
uma leitura da simulação automática do Dashboard — a única diferença real é o passo 3
(quem inicia a chamada) e o parâmetro `source` no passo 5.

## 10. Perguntas prováveis do professor, com respostas

**"Por que a sessão fica num cookie e não simplesmente no `localStorage`?"**
Porque JavaScript consegue ler `localStorage` livremente — se existisse alguma falha de
XSS na aplicação (um jeito de injetar script malicioso na página), o token de sessão
poderia ser roubado. Um cookie `httpOnly` é invisível para JavaScript; só o próprio
navegador consegue lê-lo e reenviá-lo ao servidor (seção 3.6, `lib/jwt.js`).

**"Por que o dispositivo ESP32 não usa o mesmo sistema de login do usuário?"**
Porque são identidades diferentes: um usuário faz login interativamente (digita
e-mail/senha, recebe um cookie que expira); um ESP32 não tem como "digitar" nada nem
gerenciar um cookie com validade — ele guarda um token fixo, de longa duração, e manda
esse token em todo request num header dedicado (`X-Device-Key`), nunca misturado com
autenticação de usuário (seção 5.3).

**"Como o sistema evita mandar uma notificação a cada segundo enquanto a temperatura
estiver alta?"**
Porque um alerta é modelado como um **evento com início e fim** (tabela `Alert`), não
uma linha por leitura. Enquanto o valor continuar fora da faixa, o sistema só atualiza o
`peakValue` do mesmo registro; um novo evento só é criado depois que o anterior se
resolveu (seção 5.9, com o exemplo numérico).

**"O que acontece se o ESP32 perder Wi-Fi no meio da operação?"**
`reconnectWifiIfNeeded()` tenta reconectar a cada 5 segundos, de forma não bloqueante —
o firmware nunca trava esperando; ele só pula o envio de leituras enquanto não há
conexão, e retoma sozinho assim que a rede volta (seção 7.3).

**"Por que existe um endpoint de simulação, isso não é 'enganar' o sistema?"**
Não — ele existe para permitir demonstrar o fluxo completo (leitura → dashboard →
histórico → alerta) sem depender do hardware físico estar ligado e por perto no momento
da apresentação. Ele exige autenticação de **usuário** normal (não o token de
dispositivo) e só aceita gravar em dispositivos que já pertencem àquele usuário — e
qualquer leitura simulada nunca atualiza `lastRealMeasurementAt`, então nunca finge ser
uma leitura de hardware real (seção 5.7).

**"O sistema funcionaria com o ESP32 em outra rede, tipo de casa, enquanto o servidor
está em outro lugar?"**
Sim, sem mudar nenhuma linha do firmware: o ESP32 só precisa de acesso à internet e do
endereço público do backend em `API_BASE_URL` — o firmware já suporta HTTPS
(`WiFiClientSecure`). A única ressalva de segurança documentada é que o firmware usa
`setInsecure()` (pula a checagem do certificado do servidor), aceitável para uma
demonstração de TCC, mas que num sistema de produção real deveria ser substituído por
uma validação de certificado de verdade (seção 7.5).

**"Por que o histórico usa paginação em vez de carregar tudo de uma vez?"**
Porque, com meses de leituras acumuladas (uma a cada poucos segundos), carregar tudo de
uma vez seria lento e desperdiçaria memória tanto no servidor quanto no navegador. A
consulta já vem com `skip`/`take` do Prisma, apoiada no índice
`[deviceId, measuredAt]` do banco (seção 4).

**"O que acontece com os dados quando um usuário exclui a conta?"**
Tudo relacionado a ele — dispositivos, medições, alertas, configurações — é apagado em
cascata pelo próprio PostgreSQL (`onDelete: Cascade` no schema), disparado por uma única
chamada `prisma.user.delete()`. A exclusão exige confirmar a senha atual, mesmo com uma
sessão já autenticada (seção 5.5).

**"Por que o Dashboard atualiza sozinho a cada 10 segundos em vez de usar WebSocket?"**
Foi uma escolha consciente de simplicidade: *polling* (perguntar de novo periodicamente)
é mais simples de implementar, testar e depurar do que manter uma conexão persistente
aberta, e para o volume de dados e a escala de um projeto de TCC a diferença de
eficiência entre as duas abordagens é irrelevante na prática (seção 6.4).

## 11. Glossário rápido

| Termo | Definição curta |
|---|---|
| **API** | Conjunto de endereços que um sistema expõe para outros sistemas conversarem com ele |
| **Endpoint** | Um endereço específico da API (ex.: `POST /api/auth/login`) |
| **JWT** | Token assinado digitalmente que carrega uma informação (aqui, o ID do usuário) |
| **Cookie httpOnly** | Cookie que o JavaScript da página não consegue ler, só o navegador |
| **Hash** | Resultado de uma função matemática de mão única — não dá para "desfazer" |
| **ORM** | Camada que traduz código (aqui, JavaScript) em comandos SQL — aqui, o Prisma |
| **Migration** | Um passo registrado de mudança no esquema do banco de dados |
| **Middleware** | Função que roda no meio do caminho de uma requisição HTTP, antes da rota final |
| **Rate limiting** | Limitar quantas requisições um mesmo cliente pode fazer num intervalo de tempo |
| **Polling** | Perguntar a mesma coisa repetidamente, em intervalos, em vez de manter uma conexão aberta |
| **Estado (state)** | Dado que, ao mudar, faz a interface do React redesenhar automaticamente |
| **Hook** | Função especial do React (`useState`, `useEffect`, hooks customizados) |
| **Debounce** | Atrasar uma ação até que o usuário pare de gerar eventos (ex.: parar de digitar) |
| **UUID** | Identificador único gigante e praticamente impossível de adivinhar |
| **NTP** | Protocolo usado para sincronizar o relógio de um dispositivo pela internet |
