# Guia de Teste com ESP32 Real — Do Zero (Windows)

> Continuação do [`05-guia-teste-iniciante.md`](05-guia-teste-iniciante.md). Este guia
> assume que o **sistema web já está rodando** (backend em `http://localhost:3000` e
> frontend em `http://localhost:5173`, como no guia anterior) e que você tem um ESP32
> físico e um sensor DHT11 em mãos.

## O que você precisa

- Placa ESP32 (qualquer modelo genérico tipo "ESP32-DevKitC" ou "NodeMCU-32S")
- Sensor DHT11 (de preferência o módulo de 3 pinos, com resistor de pull-up já embutido)
- Cabo USB compatível com a sua placa (geralmente Micro-USB ou USB-C)
- 3 fios jumper (macho-fêmea, se o DHT11 for um módulo; macho-macho + protoboard se for
  o sensor "cru" de 4 pinos)

## 1. Ligar o sensor na placa

| DHT11 | ESP32 |
|-------|-------|
| VCC   | 3V3   |
| GND   | GND   |
| DATA  | GPIO 4 |

Se o seu módulo tiver um pino a mais (`NC`, não conectado), pode ignorá-lo.

## 2. Instalar o Arduino IDE

Baixe em **https://www.arduino.cc/en/software** (versão 2.x) → instale com as opções
padrão.

## 3. Adicionar suporte à placa ESP32

Abra o Arduino IDE → **File → Preferences** (ou `Ctrl+,`) → no campo **"Additional
boards manager URLs"**, cole:

```
https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
```

Clique OK. Depois vá em **Tools → Board → Boards Manager**, procure por **"esp32"** e
instale o pacote **"esp32 by Espressif Systems"** (pode demorar alguns minutos).

## 4. Instalar as bibliotecas necessárias

Ainda no Arduino IDE: **Tools → Manage Libraries** (ou `Ctrl+Shift+I`). Procure e
instale, uma de cada vez:

- **DHT sensor library** (por Adafruit) — quando perguntar, aceite instalar também a
  dependência **Adafruit Unified Sensor**.
- **ArduinoJson** (por Benoit Blanchon) — instale a versão **7.x**.

## 5. Cadastrar o dispositivo no sistema web

Com o frontend aberto (`http://localhost:5173`) e você já logado:

1. Vá em **Dispositivos** no menu lateral.
2. No campo "Nome (ex.: Sensor Sala)", digite algo como `Sensor ESP32 Real` → clique
   **Adicionar**.
3. Vai aparecer uma janela com o **identificador** (ex. `ESP32-A1B2C3`) e o **token**.
   **Copie os dois agora** — o token não é mostrado de novo depois.

## 6. Baixar o código do firmware

Se ainda não tiver o projeto no computador, veja o
[`05-guia-teste-iniciante.md`](05-guia-teste-iniciante.md) primeiro. Se já tiver:

```powershell
cd $env:USERPROFILE\Desktop\TCC
git pull
```

No Arduino IDE: **File → Open** → navegue até
`Desktop\TCC\esp32\firmware\firmware.ino` e abra.

## 7. Configurar o `config.h`

Na pasta `esp32\firmware`, copie `config.example.h` para um novo arquivo chamado
`config.h` (pode fazer isso no VS Code: clique com o botão direito em
`config.example.h` → Copy → cole na mesma pasta → renomeie para `config.h`).

Abra `config.h` e preencha:

```cpp
#define WIFI_SSID "nome-da-sua-rede-wifi"
#define WIFI_PASSWORD "senha-da-sua-rede-wifi"
#define API_BASE_URL "http://SEU_IP_LOCAL:3000/api"
#define DEVICE_ID "ESP32-A1B2C3"          // o identificador copiado no passo 5
#define DEVICE_TOKEN "cole-o-token-aqui"  // o token copiado no passo 5
#define READING_INTERVAL_MS 30000
```

**Sobre o `API_BASE_URL`**: como o ESP32 está numa rede Wi-Fi separada do seu PC (não
é `localhost` para ele), você precisa usar o **IP local da sua máquina** na rede, não
`localhost`. Para descobrir esse IP, abra o PowerShell e rode:

```powershell
ipconfig
```

Procure por **"Endereço IPv4"** na seção do seu adaptador Wi-Fi (algo como
`192.168.0.15` ou `192.168.1.42`). Use esse valor, por exemplo:
`http://192.168.0.15:3000/api`.

> O ESP32 precisa estar conectado à **mesma rede Wi-Fi** do computador que está
> rodando o backend, e o ESP32 só suporta redes de **2.4GHz** (não 5GHz).

## 8. Selecionar a placa e a porta

Conecte o ESP32 no computador via USB.

- **Tools → Board → esp32 →** selecione o modelo da sua placa (se não souber qual é,
  **"ESP32 Dev Module"** funciona para a maioria das placas genéricas).
- **Tools → Port →** selecione a porta COM que apareceu quando você conectou o cabo
  (ex. `COM3`). Se nenhuma porta aparecer, veja o troubleshooting abaixo.

## 9. Enviar o firmware para a placa

Clique no botão de **seta (→)** no canto superior esquerdo do Arduino IDE (Upload).
Espere compilar e enviar — a primeira vez demora mais.

Se aparecer `Connecting...` travado, alguns modelos de ESP32 pedem para você **segurar
o botão "BOOT"** na placa física durante o início do upload, soltando quando começar a
mostrar pontinhos de progresso.

## 10. Acompanhar pelo Monitor Serial

Depois do upload terminar: **Tools → Serial Monitor** (ou `Ctrl+Shift+M`). No canto
inferior direito da janela que abre, confira se a velocidade está em **115200 baud**.

Você deve ver algo como:

```
Conectando ao Wi-Fi "sua-rede"...
Wi-Fi conectado. IP: 192.168.0.50
Sincronizando hora via NTP...
Hora sincronizada.
Enviando leitura: {"device_id":"ESP32-A1B2C3","temperature":24.5,"humidity":58,...}
Leitura registrada com sucesso (201): {...}
```

## 11. Confirmar no sistema web

Volte para `http://localhost:5173`, vá em **Dashboard** — a leitura do sensor real
deve aparecer no card de Temperatura/Umidade em até 30 segundos (o intervalo
configurado no `config.h`), e o status do dispositivo deve virar **🟢 Online**.

## 12. Testar um alerta de verdade

Segure o sensor DHT11 na mão, ou sopre nele, por alguns minutos, para forçar a
temperatura/umidade a saírem do limite configurado em **Configurações**. Observe o
alerta aparecer no Dashboard.

## Problemas comuns

| Sintoma | Causa provável / solução |
|---|---|
| Nenhuma porta COM aparece em Tools → Port | Falta o driver USB-serial do chip da placa (comumente CH340 ou CP2102). Procure "driver CH340" ou "driver CP2102" para o seu sistema e instale. |
| Upload trava em "Connecting..." | Segure o botão físico **BOOT** na placa durante o início do upload. |
| `DHT.h: No such file or directory` ao compilar | A biblioteca "DHT sensor library" não foi instalada (passo 4). |
| `#error "config.h não encontrado"` | Falta criar o `config.h` (passo 7) — só copiar `config.example.h` e renomear não é suficiente se ele ficar em outra pasta; confirme que está em `esp32/firmware/config.h`. |
| Log mostra "Falha ao conectar ao Wi-Fi" | Confira `WIFI_SSID`/`WIFI_PASSWORD`; lembre que só funciona em rede 2.4GHz. |
| Log mostra "API retornou erro (401)" | `DEVICE_ID` ou `DEVICE_TOKEN` errados, ou dispositivo removido/desativado — gere um novo token na tela Dispositivos e atualize o `config.h`. |
| Log mostra "Falha na requisição HTTP" | Confira se `API_BASE_URL` está com o IP local correto (passo 7) e se o backend (`npm run dev`) ainda está rodando no seu PC. |
| Dashboard não atualiza mesmo com o log mostrando sucesso (201) | Confirme que você está logado com o **mesmo usuário** que cadastrou esse dispositivo. |
