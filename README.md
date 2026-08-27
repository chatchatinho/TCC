# ThermoSense — Sistema Web de Monitoramento de Temperatura e Umidade com ESP32

Trabalho de Conclusão de Curso: sistema web para monitoramento de temperatura e umidade
usando um ESP32 conectado à internet via Wi-Fi. Usuários se cadastram, fazem login e
acompanham as leituras dos seus dispositivos em um dashboard com gráficos, histórico e
alertas automáticos quando os valores saem da faixa configurada.

Documentação completa em [`docs/`](docs/):

- [`docs/documentacao/01-arquitetura-e-decisoes.md`](docs/documentacao/01-arquitetura-e-decisoes.md) — arquitetura, stack, modelo de dados, decisões
- [`docs/documentacao/02-integracao.md`](docs/documentacao/02-integracao.md) — verificação de integração ponta a ponta
- [`docs/documentacao/03-seguranca.md`](docs/documentacao/03-seguranca.md) — revisão de segurança
- [`docs/documentacao/04-documentacao-tecnica.md`](docs/documentacao/04-documentacao-tecnica.md) — documentação técnica completa (com diagramas)
- [`docs/documentacao/05-guia-teste-iniciante.md`](docs/documentacao/05-guia-teste-iniciante.md) — instalação passo a passo para quem nunca configurou um ambiente de desenvolvimento (Windows, do zero)
- [`docs/documentacao/08-para-que-serve-cada-coisa.md`](docs/documentacao/08-para-que-serve-cada-coisa.md) — complemento do guia acima: para que serve cada ferramenta, comando e arquivo (o "porquê", não o "como")
- [`docs/documentacao/06-guia-teste-arduino-real.md`](docs/documentacao/06-guia-teste-arduino-real.md) — testando com um ESP32 físico + sensor DHT11 (fiação, Arduino IDE, firmware)
- [`docs/documentacao/07-metodologia-tcc.md`](docs/documentacao/07-metodologia-tcc.md) — texto de apoio para o TCC (introdução, objetivos, metodologia)
- [`docs/documentacao/09-aula-completa-do-sistema.md`](docs/documentacao/09-aula-completa-do-sistema.md) — aula completa de como o sistema funciona por dentro (arquitetura, banco de dados, backend, frontend, firmware, testes), para estudo antes da apresentação

## Funcionalidades

- Cadastro e login de usuários (senha com hash bcrypt, sessão via JWT em cookie `httpOnly`)
- Perfil dividido em "Dados" (nome, foto, e-mail/data de nascimento somente leitura,
  botão para baixar uma cópia de todos os seus dados em JSON) e "Segurança" (data do
  último login, troca de senha exigindo a senha atual, exclusão de conta com
  confirmação por senha — some em cascata com dispositivos, histórico, alertas e
  configurações)
- Recuperação de senha por e-mail ("esqueci minha senha" com token de reset expirando em
  1h). Sem SMTP configurado, roda em **modo simulação**: nenhum e-mail é enviado de
  verdade, o link de redefinição é impresso no console do backend — suficiente para
  demonstrar o fluxo completo sem depender de credenciais nem de acesso à internet.
- Foto de perfil opcional
- Modo escuro que segue automaticamente o tema do sistema operacional até o usuário
  escolher manualmente em Configurações (com opção de voltar a seguir o sistema); 8
  cores de destaque, 3 tamanhos de fonte e opção de reduzir animações/transições
- Dashboard com temperatura/umidade atuais, status do dispositivo (online/sem
  comunicação/offline), gráficos de linha com filtro de período, seletor de dispositivo
  (quando há mais de um) e um resumo compacto dos demais dispositivos no canto
- Configurações divididas em "Valores" (ideal e tolerância obrigatórios por variável,
  mais uma taxa mínima/máxima opcional que substitui o cálculo automático quando
  definida, botão de restaurar padrões, e um interruptor por variável para desligar
  notificações daquele tipo de anomalia sem deixar de exibir o status no
  dashboard/histórico) e "Aparência" (tema, cor de destaque, fonte, movimento)
- Detecção automática de leituras fora do limite, com alertas modelados como eventos
  (evita notificação repetida para várias leituras seguidas fora da faixa)
- Tela dedicada de notificações (menu "Notificações"), separadas por dispositivo em
  abas — cada aba mostra uma bolinha vermelha com a contagem de notificações não vistas
  daquele dispositivo, e o menu lateral mostra o total geral. As notificações ficam
  registradas permanentemente (não somem); só a bolinha de "não vista" desaparece, e
  isso só acontece quando o usuário expande aquela notificação específica para ver os
  detalhes — abrir a tela ou trocar de aba não marca nada como lido sozinho
- Histórico com ordenação (data, temperatura ou umidade, crescente/decrescente), painel
  de filtros colapsável com atalhos de período (mesmos presets do Dashboard) e campos
  numéricos com pequeno atraso antes de buscar (evita recarregar a cada dígito
  digitado), agrupados por dispositivo/período, temperatura e umidade (faixa de valores
  e situação separadas), e exportação CSV
- Gerenciamento de dispositivos ESP32 (token de API com hash, nunca em texto puro)
- Simulação automática de leituras (a cada 2s, proporção 100:5 normal:fora do limite),
  para todos os dispositivos "virtuais" do usuário mesmo em segundo plano (não só o
  selecionado no Dashboard) — demonstra o sistema completo sem o hardware físico, e se
  desliga sozinha, dispositivo por dispositivo, assim que um
  ESP32 real começa a enviar leituras de verdade
- Firmware ESP32 (DHT11) pronto para uso, com Wi-Fi, NTP, reconexão e autenticação

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 (Vite), Tailwind CSS, Chart.js, React Router, Axios |
| Backend | Node.js + Express (JavaScript), Prisma ORM, Zod, JWT, bcryptjs |
| Banco de dados | PostgreSQL 16 |
| Firmware | ESP32 (Arduino), DHT11, ArduinoJson, HTTPClient |
| Testes | Jest + Supertest (backend) |

Justificativas detalhadas em [`docs/documentacao/01-arquitetura-e-decisoes.md`](docs/documentacao/01-arquitetura-e-decisoes.md).

## Requisitos

- Node.js 20+
- PostgreSQL 16 (local ou em container)
- Para o firmware: Arduino IDE, placa ESP32 e sensor DHT11 (opcional — o sistema web
  funciona sozinho via simulação, ver abaixo)

## Instalação e execução

Duas formas de rodar o projeto: com Docker (um único pré-requisito) ou instalando
Node.js e PostgreSQL manualmente. Escolha uma.

### Opção A — Docker (recomendado se você não quer instalar Node.js/PostgreSQL)

Pré-requisito único: [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
docker compose up --build
```

Isso sobe o PostgreSQL, o backend (aplicando as migrations automaticamente) e o
frontend já compilado. Acesse **http://localhost:5173** no navegador.

Os dados do banco persistem entre reinícios (volume Docker), mas o `docker-compose.yml`
**não** roda o seed automaticamente (rodar o seed toda vez apagaria dados que você
tiver criado). Para popular com dados de demonstração na primeira vez:

```bash
docker compose exec backend npm run db:seed
```

Para parar: `docker compose down` (os dados continuam salvos). Para apagar tudo,
incluindo o banco: `docker compose down -v`.

> As credenciais usadas pelo `docker-compose.yml` (senha do banco, `JWT_SECRET`) são
> valores fixos de demonstração local — adequados para rodar na sua máquina, nunca para
> um ambiente exposto à internet.

### Opção B — Manual (Node.js + PostgreSQL instalados)

#### 1. Banco de dados

```bash
sudo -u postgres psql -c "CREATE USER tcc_dev WITH PASSWORD 'sua_senha' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE tcc_dev OWNER tcc_dev;"
```

(`CREATEDB` é necessário porque o Prisma cria um banco temporário durante
`prisma migrate dev` para detectar divergências de schema.)

#### 2. Backend

```bash
cd backend
cp .env.example .env        # preencha DATABASE_URL, JWT_SECRET, CORS_ORIGIN
npm install
npm run prisma:migrate      # cria as tabelas
npm run db:seed             # opcional: usuário + dispositivo + histórico de demonstração
npm run dev                 # sobe em http://localhost:3000
```

Detalhes em [`backend/README.md`](backend/README.md).

#### 3. Frontend

```bash
cd frontend
cp .env.example .env        # VITE_API_URL deve apontar para o backend
npm install
npm run dev                 # abre em http://localhost:5173
```

Detalhes em [`frontend/README.md`](frontend/README.md).

### ESP32 (opcional — funciona com as duas opções acima)

```bash
cd esp32/firmware
cp config.example.h config.h   # preencha Wi-Fi, API_BASE_URL, device_id e token
```

Cadastre o dispositivo na tela "Dispositivos" do sistema web primeiro, para obter o
`device_id` e o token. Depois abra `firmware.ino` no Arduino IDE e envie para a placa.
Fiação, bibliotecas e troubleshooting em [`esp32/README.md`](esp32/README.md).

**Sem o hardware em mãos?** Não precisa fazer nada: leituras simuladas são geradas
automaticamente, a cada 2 segundos, para todos os dispositivos cadastrados (mesmo os que não
estão selecionados no Dashboard no momento), com proporção 100:5 de leituras normais para
leituras fora do limite — cobre a demonstração completa (dashboard, gráficos, alertas,
histórico) sem precisar do ESP32 físico. Assim que um ESP32 físico real começar a enviar
leituras de verdade para um desses dispositivos, a simulação automática dele é
completamente desligada (os demais continuam simulando normalmente).

## Variáveis de ambiente

| Variável | Onde | Descrição |
|---|---|---|
| `DATABASE_URL` | `backend/.env` | String de conexão do PostgreSQL |
| `API_PORT` | `backend/.env` | Porta da API (padrão 3000) |
| `JWT_SECRET` | `backend/.env` | Segredo para assinar os JWTs de sessão — gere um valor aleatório longo |
| `CORS_ORIGIN` | `backend/.env` | URL do frontend autorizada a fazer requisições com cookies |
| `FRONTEND_URL` | `backend/.env` | URL usada para montar o link de redefinição de senha |
| `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM` | `backend/.env` | Opcionais — deixe em branco para "esqueci minha senha" rodar em modo simulação (link só no console) |
| `VITE_API_URL` | `frontend/.env` | URL base da API que o frontend consome |

Nenhum valor real fica commitado — apenas os arquivos `.env.example` correspondentes.

## Usuário de teste (dados de demonstração)

Após rodar `npm run db:seed` no backend:

- **E-mail**: `teste@tcc.local`
- **Senha**: `Senha@Teste123`
- Já vem com 1 dispositivo (`ESP32-001`) e ~3h de histórico simulado, incluindo um
  alerta de temperatura (não lido, para demonstrar a notificação ao logar).

Válido **apenas em ambiente local de desenvolvimento** — nunca reutilize essas
credenciais em um ambiente exposto publicamente.

## Endpoints principais

```
POST   /api/auth/register          POST   /api/devices
POST   /api/auth/login             PUT    /api/devices/:id
POST   /api/auth/logout            DELETE /api/devices/:id
GET    /api/auth/me                POST   /api/devices/:id/rotate-secret

GET    /api/users/me               POST   /api/measurements        (autenticação de dispositivo)
PUT    /api/users/me               GET    /api/measurements/latest
PUT    /api/users/me/password       POST   /api/measurements/simulate
DELETE /api/users/me
                                    GET    /api/history
GET    /api/settings                GET    /api/history/export
PUT    /api/settings
                                    GET    /api/alerts
GET    /api/devices                 GET    /api/alerts/summary
                                     PATCH  /api/alerts/:id/read
```

Documentação interativa (Swagger UI) em `http://localhost:3000/api/docs` com o backend
rodando. Lista completa e exemplos em [`docs/documentacao/04-documentacao-tecnica.md`](docs/documentacao/04-documentacao-tecnica.md).

## Testes automatizados

```bash
cd backend
sudo -u postgres psql -c "CREATE DATABASE tcc_test OWNER tcc_dev;"
cp .env.test.example .env.test
DATABASE_URL="postgresql://tcc_dev:sua_senha@localhost:5432/tcc_test" npx prisma migrate deploy
npm test
```

54 testes cobrindo cadastro, login, isolamento entre usuários, ingestão de medições,
motor de alertas (incluindo a lógica anti-spam), configurações e histórico. Detalhes em
[`backend/README.md`](backend/README.md).

## Troubleshooting

| Sintoma | Causa provável |
|---|---|
| `ECONNREFUSED` ao rodar `prisma migrate` | PostgreSQL não está rodando, ou `DATABASE_URL` incorreta |
| `permission denied to create database` na migration | Usuário do banco sem `CREATEDB` — rode `ALTER USER tcc_dev CREATEDB;` |
| Frontend não consegue logar (erro de rede/CORS) | `VITE_API_URL` errado, ou `CORS_ORIGIN` no backend não bate com a URL do frontend |
| Sessão não persiste entre requisições | Cookies bloqueados — confira `withCredentials`/CORS `credentials: true` e se front e back estão em `http://localhost` (não misturar `127.0.0.1` com `localhost`) |
| ESP32 não conecta ao Wi-Fi | Placa só suporta redes 2.4GHz; confira `WIFI_SSID`/`WIFI_PASSWORD` em `config.h` |
| API retorna 401 para o ESP32 | `DEVICE_TOKEN`/`DEVICE_ID` incorretos, ou dispositivo desativado — regenere o token na tela Dispositivos |
| API retorna 429 em testes manuais repetidos | Rate limiting ativo (10 tentativas de login/registro por 15 min) — aguarde ou reinicie o backend em desenvolvimento |
| `docker compose up` falha ao baixar as imagens | Sem conexão com a internet, ou Docker Desktop não está aberto/rodando |
| Porta 3000 ou 5173 já em uso (Docker ou manual) | Outro processo já está usando a porta — feche-o, ou troque o mapeamento em `docker-compose.yml` (ex. `"3001:3000"`) |

## Estrutura do repositório

```
TCC/
├── backend/              API REST (Node/Express + Prisma/PostgreSQL) — ver backend/README.md
├── frontend/              SPA React — ver frontend/README.md
├── esp32/                 Firmware do ESP32 — ver esp32/README.md
├── docs/                  Documentação técnica do TCC (arquitetura, integração, segurança)
└── docker-compose.yml     Sobe banco + backend + frontend com um comando (ver Instalação acima)
```
