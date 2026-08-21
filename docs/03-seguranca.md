# Etapa 7 — Revisão de Segurança

> Revisão de segurança dedicada de todo o código do branch (backend, frontend, firmware),
> feita em duas fases: (1) identificação de vulnerabilidades de alta confiança contra as
> categorias padrão (injeção, autenticação/autorização, criptografia/segredos, exposição
> de dados), (2) filtragem de falsos positivos exigindo confiança ≥8/10 para reportar.

## Resultado

**Nenhuma vulnerabilidade de alta confiança (score ≥8) foi encontrada.**

A revisão examinou especificamente:

- `backend/src/middlewares/auth.js` e `deviceAuth.js` — autenticação de usuário (JWT em
  cookie) e de dispositivo (token com hash bcrypt), sem bypass identificado.
- Todos os `*.service.js` — toda query filtra pelo `userId` autenticado; nenhuma aceita
  `userId` vindo do corpo/query da requisição; acesso a recurso de outro usuário sempre
  retorna 404 (não 403), evitando confirmar a existência do recurso.
- `backend/src/lib/jwt.js` — cookie `httpOnly`/`sameSite`, sem confusão de algoritmo.
- `backend/src/app.js` — Helmet, CORS restrito a `CORS_ORIGIN` com `credentials`.
- Todos os schemas Zod (`*.validation.js`) — allow-lists estritas; nenhum aceita campos
  sensíveis como `email`, `passwordHash` ou `userId` para atualização.
- `serializers.js` — nunca expõe `passwordHash`/`deviceSecretHash` nas respostas.
- Exportação CSV do histórico — sem vetor de injeção de fórmula (só campos numéricos/enum
  são interpolados).
- Frontend — sem `dangerouslySetInnerHTML`/`innerHTML`/`eval`; sessão via cookie, nunca
  token em `localStorage`/JS.
- Todas as queries usam o Prisma Client (parametrizado) — nenhuma SQL crua concatenada.

## Único ponto levantado (e por que não foi reportado como falha)

A primeira passada identificou que `esp32/firmware/firmware.ino` usa
`secureClient.setInsecure()` ao conectar por HTTPS, pulando a validação da cadeia de
certificados — o que, isoladamente, permitiria um ataque man-in-the-middle na mesma rede
Wi-Fi do dispositivo.

Na filtragem, esse ponto foi descartado (confiança 2/10) porque:

1. É uma decisão **documentada explicitamente como trade-off**, não uma falha
   acidental — há comentário no próprio ponto do código (`firmware.ino`) e uma entrada
   dedicada em `esp32/README.md` → Solução de problemas → "HTTPS com `setInsecure()`",
   ambos dizendo textualmente que é aceitável para a demonstração local do TCC mas **não
   deve ser usado em produção real**.
2. O cenário de uso **padrão e documentado** é HTTP simples na rede Wi-Fi local (ver
   `config.example.h`), onde não existe handshake TLS para contornar — HTTPS só entra em
   jogo se o autor do TCC optar manualmente por isso no próprio `config.h`.
3. Ainda assim, para produção real, o firmware precisaria trocar `setInsecure()` por
   `setCACert()` fixando o certificado do servidor — isso já está anotado no código e no
   README como pendência conhecida, não como algo resolvido.

Ou seja: o risco existe **apenas se alguém decidir usar HTTPS em produção sem trocar
`setInsecure()` por `setCACert()`** — um cenário fora do escopo de demonstração do TCC, e
já sinalizado explicitamente no código para quem for evoluir o projeto.

## Checklist de segurança (seção 21 do escopo) — status

| Item | Status |
|---|---|
| Hash seguro de senha (bcrypt) | ✅ |
| Autenticação (JWT em cookie httpOnly) | ✅ |
| Autorização (escopo por usuário em toda query) | ✅ |
| Proteção das rotas privadas (`requireAuth`) | ✅ |
| Validação de entrada (Zod em todos os endpoints) | ✅ |
| Proteção contra SQL Injection (Prisma parametrizado) | ✅ |
| CORS configurado (origem única + credentials) | ✅ |
| Rate limiting em endpoints sensíveis (login/registro/medições) | ✅ |
| Proteção contra força bruta de login | ✅ (rate limit + mensagem genérica) |
| Gerenciamento seguro de tokens (device secret com hash) | ✅ |
| Variáveis de ambiente / nenhum segredo hardcoded | ✅ |
| HTTPS em produção | ⚠️ Documentado como pendência do deploy real; demo local usa HTTP de propósito (decisão da Etapa 1) |
| Validação de dados do ESP32 no backend | ✅ (faixa física plausível, nunca confia no dispositivo) |
