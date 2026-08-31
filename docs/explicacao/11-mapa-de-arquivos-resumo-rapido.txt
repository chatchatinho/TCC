# Mapa de arquivos — resumo rápido (5 minutos)

> Versão condensada do
> [`docs/documentacao/10-cada-pasta-e-arquivo-explicado.md`](10-cada-pasta-e-arquivo-explicado.md).
> Aqui cada arquivo tem só uma linha — o suficiente para lembrar "o que é isso" na hora
> da apresentação. Para o porquê de cada decisão, use o
> [`09-aula-completa-do-sistema.md`](09-aula-completa-do-sistema.md); para o parágrafo
> completo de cada arquivo, use o [`10`](10-cada-pasta-e-arquivo-explicado.md).

```
TCC/
├── esp32/       → firmware que roda no ESP32 (mede e envia os dados)
├── backend/     → API + banco de dados (recebe, guarda, decide os alertas)
├── frontend/    → site que o usuário vê (React)
└── docs/        → toda a documentação
```

## Raiz

| Arquivo | O que é |
|---|---|
| `README.md` | Porta de entrada: o que o sistema faz, tecnologias, como instalar |
| `docker-compose.yml` | Sobe banco + backend + frontend juntos com um comando |
| `.gitignore` | O que o Git ignora no projeto todo (ex. `node_modules`) |

## `esp32/` — firmware

| Arquivo | O que é |
|---|---|
| `README.md` | Fiação do DHT11, bibliotecas Arduino, passo a passo de configuração |
| `firmware/firmware.ino` | O programa principal: conecta Wi-Fi, sincroniza hora, lê e envia os dados |
| `firmware/config.example.h` | Modelo de config (Wi-Fi, URL da API, token) — copiar para `config.h` |
| `firmware/src/Sensor.h` | Interface genérica do sensor (`sensorSetup`, `sensorRead`) |
| `firmware/src/Sensor.cpp` | Implementação específica do DHT11 (pino, faixa válida de leitura) |

## `backend/` — API e banco

**Raiz do backend**

| Arquivo | O que é |
|---|---|
| `package.json` | Dependências (Express, Prisma, bcrypt, JWT, Zod...) e scripts npm |
| `Dockerfile` / `.dockerignore` | Receita da imagem Docker do backend |
| `.env` / `.env.example` | Variáveis reais / modelo (banco, JWT_SECRET, CORS, SMTP) |
| `.env.test` / `.env.test.example` | Mesmo, mas para os testes (banco separado) |
| `jest.config.js` | Configuração da suíte de testes (roda em série, 1 worker) |
| `README.md` | Como instalar, rodar e testar o backend isoladamente |
| `docs/openapi.yaml` | Especificação de toda a API (alimenta o Swagger em `/api/docs`) |

**`prisma/`**

| Arquivo | O que é |
|---|---|
| `schema.prisma` | As 5 tabelas do banco (User, Device, Measurement, Setting, Alert) |
| `seed.js` | Popula o banco com usuário/dispositivo/histórico de demonstração |
| `migrations/` | Histórico de mudanças no banco, uma pasta por alteração, em ordem |

**`src/` — raiz**

| Arquivo | O que é |
|---|---|
| `app.js` | Monta o Express: middlewares, rotas, tratamento de erro |
| `server.js` | Só liga o servidor na porta configurada |

**`src/lib/`**

| Arquivo | O que é |
|---|---|
| `prisma.js` | Instância única do Prisma Client |
| `jwt.js` | Assina/valida o token de sessão e o cookie |
| `AppError.js` | Classe de erro com status HTTP embutido |
| `serializers.js` | Escolhe quais campos de User/Device podem sair numa resposta (nunca senhas/tokens) |
| `deviceSecret.js` | Gera o token aleatório de cada dispositivo |
| `mailer.js` | Envia e-mail de redefinição de senha (ou simula no console, sem SMTP) |

**`src/middlewares/`**

| Arquivo | O que é |
|---|---|
| `auth.js` | Exige login de usuário (cookie/JWT) |
| `deviceAuth.js` | Exige autenticação de dispositivo (device_id + token) |
| `errorHandler.js` | Converte qualquer erro numa resposta HTTP padronizada |
| `rateLimit.js` | Limita tentativas de login e envio de medições |
| `validate.js` | Valida corpo/query da requisição contra um schema Zod |

**`src/modules/`** — cada um com `*.routes.js` (HTTP) + `*.service.js` (regra de negócio) + `*.validation.js` (Zod)

| Módulo | Faz o quê |
|---|---|
| `auth/` | Cadastro, login, logout, esqueci/redefinir senha |
| `users/` | Perfil, troca de senha, exclusão de conta |
| `devices/` | CRUD de dispositivos ESP32 + rotação de token |
| `measurements/` | Recebe leituras do ESP32 e da simulação, calcula `measuredAt` |
| `settings/` | Limites ideais/tolerância, calcula a faixa aceitável |
| `alerts/` | O motor de alertas: abre/atualiza/fecha eventos de anomalia |
| `history/` | Consulta paginada com filtros + exportação CSV |

**`tests/`**

| Arquivo | Cobre |
|---|---|
| `auth.test.js` | Cadastro e login |
| `authorization.test.js` | Isolamento entre usuários (A nunca vê dado de B) |
| `measurements.test.js` | Ingestão de leituras |
| `alerts.test.js` | Motor de alertas |
| `settings.test.js` | Cálculo de limites |
| `history.test.js` | Filtros, paginação, exportação |
| `passwordManagement.test.js` | Troca/recuperação de senha |
| `security/rateLimit.test.js` | O limitador de requisições, isolado |
| `helpers/db.js` / `helpers/authClient.js` | Limpa o banco entre testes / cria usuário logado de teste |

## `frontend/` — site

**Raiz do frontend**

| Arquivo | O que é |
|---|---|
| `package.json` | React, Router, axios, Chart.js, Tailwind, Vite |
| `Dockerfile` / `.dockerignore` / `.gitignore` | Build Docker e o que ignorar |
| `.env` / `.env.example` | `VITE_API_URL` (endereço do backend) |
| `.oxlintrc.json` | Regras do linter |
| `vite.config.js` | Configuração do bundler/servidor de desenvolvimento |
| `index.html` | Único HTML — o React desenha tudo dentro dele |
| `README.md` | Como instalar e rodar o frontend isoladamente |
| `public/` | Favicon e ícones |

**`src/` — raiz**

| Arquivo | O que é |
|---|---|
| `main.jsx` | Ponto de entrada: desenha `<App />` na página |
| `App.jsx` | Todas as rotas + provedores de contexto |
| `index.css` | CSS global, variáveis de tema (cor/fonte/modo escuro) |

**`src/context/`**

| Arquivo | O que é |
|---|---|
| `AuthContext.jsx` | Quem está logado; login/registro/logout |
| `ThemeContext.jsx` | Modo escuro, cor, tamanho de fonte, redução de movimento |

**`src/components/`**

| Arquivo | O que é |
|---|---|
| `Layout.jsx` | Menu lateral + moldura de toda página logada |
| `ProtectedRoute.jsx` | Bloqueia página se não estiver logado |
| `AlertsBanner.jsx` | Aviso de notificações não lidas no Dashboard |
| `MetricCard.jsx` | Cartão de indicador (temperatura, umidade, status) |
| `LineChart.jsx` | Gráfico de linha (Chart.js) |
| `StatusBadge.jsx` | Selo "Normal"/"Fora do limite" |
| `NotificationBadge.jsx` | Bolinha vermelha com contagem |
| `Pagination.jsx` | Botões Anterior/Próxima do Histórico |
| `SecretRevealModal.jsx` | Modal que mostra o token do dispositivo uma única vez |

**`src/pages/`**

| Página | O que é |
|---|---|
| `Login.jsx` / `Register.jsx` | Entrar / criar conta |
| `ForgotPassword.jsx` / `ResetPassword.jsx` | Fluxo de recuperação de senha |
| `Dashboard.jsx` | Cartões, gráficos, simulação automática de leituras |
| `History.jsx` | Tabela paginada com filtros e exportação CSV |
| `Settings.jsx` | Limites ideais/tolerância + aparência |
| `Devices.jsx` | CRUD de dispositivos |
| `Notifications.jsx` | Alertas agrupados por dispositivo |
| `Profile.jsx` | Dados pessoais, senha, exclusão de conta |

**`src/services/`** (cada um só chama a API via axios)

| Arquivo | Endpoints |
|---|---|
| `api.js` | Instância do axios (`withCredentials: true`) |
| `auth.js` | `/auth/*` |
| `users.js` | `/users/me*` |
| `devices.js` | `/devices*` |
| `measurements.js` | `/measurements/latest`, `/measurements/simulate` |
| `settings.js` | `/settings` |
| `alerts.js` | `/alerts*` |
| `history.js` | `/history`, `/history/export` |

**`src/utils/`**

| Arquivo | O que é |
|---|---|
| `format.js` | Converte data UTC → horário de Brasília, formata números |
| `number.js` | Aceita vírgula ou ponto como decimal nos formulários |
| `periods.js` | Atalhos de período (6h, hoje, 7d, 30d) |
| `deviceStatus.js` | Classifica dispositivo em online/atenção/offline |
| `alertLabels.js` | Traduz `temperature`/`above_max` etc. para texto |

## `docs/`

| Documento | Conteúdo em uma linha |
|---|---|
| `01-arquitetura-e-decisoes.md` | Arquitetura, stack e por quê |
| `02-integracao.md` | Verificação de integração ponta a ponta |
| `03-seguranca.md` | Revisão de segurança |
| `04-documentacao-tecnica.md` | Documentação técnica completa, com diagramas |
| `05-guia-teste-iniciante.md` | Instalar tudo do zero (Windows) |
| `06-guia-teste-arduino-real.md` | Testar com ESP32 físico |
| `07-metodologia-tcc.md` | Texto de apoio para o TCC |
| `08-para-que-serve-cada-coisa.md` | Por que cada ferramenta/comando existe |
| `09-aula-completa-do-sistema.md` | Aula funcional completa (conceitos + código) |
| `10-cada-pasta-e-arquivo-explicado.md` | Versão longa deste mapa |
| `11-mapa-de-arquivos-resumo-rapido.md` | Este documento |
