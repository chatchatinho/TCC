# Frontend

SPA em React (Vite) que consome a API REST do backend. Login/cadastro, dashboard com
polling, gráficos, histórico, configurações, dispositivos e perfil.

## Pré-requisitos

- Node.js 20+
- Backend rodando (ver `../backend/README.md`)

## Configuração

1. Copie `.env.example` para `.env` e ajuste `VITE_API_URL` se o backend não estiver em
   `http://localhost:3000/api`.
2. Instale as dependências:

   ```bash
   npm install
   ```

## Rodando

```bash
npm run dev
```

Abre em `http://localhost:5173`. Certifique-se de que `CORS_ORIGIN` no `.env` do backend
aponta para esta URL (com `http://`, sem barra final).

## Estrutura

```
src/
├── App.jsx                (rotas)
├── main.jsx
├── context/AuthContext.jsx (usuário autenticado, login/logout/registro)
├── services/                (um arquivo por domínio, chamadas à API via axios)
├── components/              (Layout, cards, gráfico, badges, paginação, modais)
├── utils/                   (formatação de data/hora em fuso de São Paulo, status do
│                              dispositivo, períodos de filtro)
└── pages/
    ├── Login.jsx / Register.jsx
    ├── Dashboard.jsx         (cards, gráficos, polling a cada 10s, banner de alertas)
    ├── History.jsx            (tabela paginada + filtros + exportação CSV)
    ├── Settings.jsx            (temperatura/umidade ideal e tolerância)
    ├── Devices.jsx             (CRUD de dispositivos ESP32, exibição do token uma vez)
    └── Profile.jsx
```

## Decisões relevantes

- **Autenticação por cookie httpOnly**: o axios usa `withCredentials: true`; não há token
  manipulado em JavaScript/localStorage (mitiga XSS).
- **Atualização por polling (10s)**, não WebSocket/SSE — decisão registrada em
  `../docs/01-arquitetura-e-decisoes.md`, adequada ao volume de dados de um TCC.
- **Simulação automática sem hardware**: o Dashboard chama `POST /api/measurements/simulate`
  sozinho, a cada 2s, sem botão manual — não precisa fazer nada para ver o fluxo completo
  (leitura → dashboard → histórico → alerta) funcionando sem o ESP32 físico conectado. A
  proporção é 100:5 de leituras normais para leituras fora do limite configurado em
  Configurações. Assim que um ESP32 físico começa a enviar leituras reais para o mesmo
  dispositivo, a simulação automática é completamente desligada (o backend expõe
  `device.lastRealMeasurementAt` para isso).
- **Fuso horário**: toda formatação de data passa por `src/utils/format.js`, que converte
  o timestamp UTC vindo da API para `America/Sao_Paulo` só na hora de exibir.
