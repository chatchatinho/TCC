# Etapa 6 — Integração

> Verificação de coerência ponta a ponta: ESP32 (formato de requisição) → API → Banco →
> Dashboard → Histórico → Alertas. As Etapas 2-5 já foram testadas individualmente e de
> ponta a ponta (backend real + Postgres real na Etapa 3, backend + frontend reais com
> Playwright na Etapa 4); esta etapa fecha o círculo confirmando que o **formato exato**
> das requisições que o firmware (Etapa 5) produz é aceito e processado corretamente pela
> API, sem precisar do hardware físico.

## O que foi verificado nesta etapa

Com o backend rodando contra o PostgreSQL local, foi criado um usuário e um dispositivo
via API (mesmo fluxo que a tela "Dispositivos" do frontend usa) e enviadas requisições
`POST /api/measurements` reproduzindo **exatamente** o corpo e os headers que
`esp32/firmware/firmware.ino` monta (`device_id`/`temperature`/`humidity`/`timestamp` em
ISO 8601 UTC, header `X-Device-Key`, `Content-Type: application/json`):

| Cenário | Resultado |
|---|---|
| Leitura válida com `timestamp` presente | `201`, `measured_at` = timestamp enviado |
| Leitura válida **sem** `timestamp` (simula ESP32 sem NTP sincronizado — ver `syncTime()` no firmware) | `201`, `measured_at` cai para o horário de recebimento do servidor, exatamente como documentado no firmware e no risco técnico #1 da Etapa 1 |
| `X-Device-Key` incorreto (simula erro de digitação no `config.h`) | `401 Dispositivo não autorizado`, sem gravar nada — o firmware trata isso e loga sem travar |
| `device_id` de um dispositivo inexistente | `401` com a mesma mensagem genérica (não revela se o identificador existe) |
| Leitura fora do limite configurado | Gera 1 alerta ativo com `limitMin`/`limitMax` corretos (mesma engine testada na Etapa 3) |
| `GET /api/measurements/latest` após as leituras | Reflete a última leitura e `device.lastSeenAt` atualizado — alimenta o status online/offline do dashboard |
| `GET /api/history` após as leituras | As 3 medições aparecem na ordem e com o status (`normal`/`out_of_range`) corretos |

Conclusão: o contrato entre firmware e API está consistente — qualquer ESP32 real que
rode `firmware.ino` com um `config.h` válido vai produzir exatamente esse comportamento
já testado.

## O que ainda não foi (e não pôde ser) testado

- **Compilação real do firmware** num Arduino IDE/arduino-cli — não foi possível instalar
  as ferramentas de build neste ambiente (ver commit da Etapa 5). O código foi revisado
  manualmente contra as APIs reais do ESP32 Arduino Core, mas isso não substitui compilar
  de verdade.
- **Leitura física do DHT11** — sem hardware disponível neste ambiente.
- **Wi-Fi real e reconexão física** (queda de energia do roteador, sinal fraco etc.).

## Checklist para quando o hardware estiver disponível

1. Seguir `esp32/README.md` (fiação, bibliotecas, `config.h`).
2. Compilar e enviar o firmware; abrir o Monitor Serial (115200 baud).
3. Confirmar no log: conexão Wi-Fi ✓, sincronização NTP ✓, leitura do DHT11 ✓, envio
   HTTP com resposta `201` ✓.
4. Abrir o dashboard (`frontend`, logado com o usuário dono do dispositivo) e confirmar
   que a leitura aparece em até ~10s (intervalo de polling) sem precisar recarregar a
   página.
5. Desligar o Wi-Fi do roteador por ~1 minuto e religar — confirmar no Monitor Serial que
   o firmware tenta reconectar sozinho e volta a enviar leituras sem precisar resetar a
   placa.
6. Cobrir o sensor com a mão (ou soprar nele) para forçar temperatura/umidade fora do
   limite configurado — confirmar que o alerta aparece no dashboard e, ao deslogar e
   logar novamente, a notificação "Você possui N alertas desde seu último acesso"
   aparece.

## Fluxo completo demonstrável (seção 49 do escopo)

Com as Etapas 1-6 concluídas, o fluxo de demonstração para a banca está implementado e
verificado de ponta a ponta (via Playwright na Etapa 4, e via requisições no formato do
firmware nesta etapa): cadastro → login → dashboard → gráficos → alterar limites →
gerar leitura fora do limite (real via ESP32, ou simulada via botão no dashboard) →
alerta gerado → logout → login → notificação do alerta → histórico → filtro → dado do
ESP32 refletido no sistema.
