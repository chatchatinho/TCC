# ESP32 — Firmware

Firmware que lê temperatura e umidade de um sensor DHT11 e, opcionalmente, umidade do
solo de um higrômetro capacitivo, enviando as leituras para a API do sistema web via
HTTP(S), autenticado por dispositivo (seção 16/17 do escopo do TCC). Quando o
dispositivo também tem uma bomba d'água (relé), o firmware aciona esse relé conforme o
estado devolvido pelo servidor a cada leitura — quem decide ligar/desligar (automático
por tempo seco, só notificar, ou manual pelo app) é sempre o backend (`Setting`/`Pump`
no sistema web); o firmware só espelha esse estado no relé, nunca decide sozinho.

## Componentes

- Placa ESP32 (qualquer dev board comum, ex. ESP32-DevKitC / NodeMCU-32S)
- Sensor DHT11 (módulo de 3 pinos com resistor de pull-up embutido, ou o sensor "cru" de
  4 pinos + resistor de 10kΩ entre VCC e DATA)
- Opcional: sensor de umidade do solo capacitivo (saída analógica), para dispositivos
  usados também para irrigação
- Opcional: módulo relé, para acionar uma bomba d'água a partir do mesmo dispositivo

## Fiação

| DHT11 | ESP32   |
|-------|---------|
| VCC   | 3V3     |
| GND   | GND     |
| DATA  | GPIO 4  |

O pino de dados é configurável em `src/Sensor.cpp` (`#define DHT_PIN 4`) caso sua fiação
use outro GPIO.

Sensor de umidade do solo (opcional):

| Sensor | ESP32     |
|--------|-----------|
| VCC    | 3V3       |
| GND    | GND       |
| AOUT   | GPIO 34 (ADC1) |

Habilitado e calibrado em `config.h` (`SOIL_MOISTURE_ENABLED`, `SOIL_MOISTURE_PIN`,
`SOIL_MOISTURE_DRY_RAW`/`SOIL_MOISTURE_WET_RAW` — ver comentários em
`config.example.h`). Use sempre um pino ADC1 (32-39): os pinos ADC2 do ESP32 não
funcionam enquanto o Wi-Fi está ativo.

Relé da bomba d'água (opcional):

| Relé | ESP32   |
|------|---------|
| VCC  | 5V      |
| GND  | GND     |
| IN   | GPIO 26 |

Pino configurável em `config.h` (`RELAY_PIN`). Muitos módulos relé de baixo custo
acionam em nível baixo (LOW = ligado, HIGH = desligado) — o padrão é `RELAY_ACTIVE_LOW
true`; se a bomba ligar/desligar ao contrário do que a tela do sistema mostra, troque
esse valor para `false`.

## Bibliotecas necessárias (Arduino IDE → Ferramentas → Gerenciar Bibliotecas)

- **DHT sensor library** (Adafruit) — e sua dependência **Adafruit Unified Sensor**
  (o gerenciador de bibliotecas do Arduino oferece para instalar junto)
- **ArduinoJson** (Benoit Blanchon), versão 7.x

Além disso, instale o suporte à placa **ESP32 (Espressif Systems)** em
Ferramentas → Placa → Gerenciador de Placas, caso ainda não tenha.

## Configuração

1. Cadastre o dispositivo na tela **Dispositivos** do sistema web (com o usuário já
   logado) e copie o **identificador** (ex. `ESP32-001`) e o **token** exibidos — o token
   só aparece uma vez.
2. Copie `firmware/config.example.h` para `firmware/config.h` e preencha:

   ```cpp
   #define WIFI_SSID "sua-rede"
   #define WIFI_PASSWORD "sua-senha"
   #define API_BASE_URL "http://192.168.0.10:3000/api"  // IP da máquina rodando o backend
   #define DEVICE_ID "ESP32-001"
   #define DEVICE_TOKEN "token-copiado-da-tela-de-dispositivos"
   ```

   Se este dispositivo tiver o sensor de umidade do solo, ajuste também
   `SOIL_MOISTURE_ENABLED` para `true` e calibre `SOIL_MOISTURE_DRY_RAW`/
   `SOIL_MOISTURE_WET_RAW` (comentários em `config.example.h` explicam como). Sem o
   sensor, deixe `SOIL_MOISTURE_ENABLED` em `false` — o dispositivo continua funcionando
   normalmente, só não aparece com dado de umidade do solo no sistema.

   Se este dispositivo também tiver o relé da bomba, ajuste `RELAY_PIN` conforme sua
   fiação (o pino em si funciona independente de ter ou não o sensor de solo — o
   relé só é realmente útil, claro, quando os dois estão presentes). Depois de subir o
   firmware, teste ligando a bomba manualmente pela tela **Configurações > Bomba
   d'água** do sistema web: se ela ligar/desligar ao contrário do esperado, troque
   `RELAY_ACTIVE_LOW` para `false`.

   `config.h` está no `.gitignore` — nunca é commitado, pois contém credenciais reais.

3. Abra `firmware/firmware.ino` no Arduino IDE, selecione a placa/porta corretas e envie
   (upload).
4. Abra o Monitor Serial (115200 baud) para acompanhar os logs de conexão Wi-Fi,
   sincronização de hora e envio das leituras.

## Estrutura

```
esp32/firmware/
├── firmware.ino          (sketch principal: Wi-Fi, NTP, loop de leitura/envio, HTTP)
├── config.example.h       (placeholders — copie para config.h)
├── config.h                (git-ignored — suas credenciais reais)
└── src/
    ├── Sensor.h             (interface: sensorSetup(), sensorRead())
    ├── Sensor.cpp            (implementação específica do DHT11 + sensor de solo)
    ├── Pump.h                (interface: pumpSetup(), pumpSetState())
    └── Pump.cpp               (implementação do relé da bomba d'água)
```

`src/` é a única subpasta que o Arduino IDE/arduino-cli compila automaticamente junto
com o sketch — por isso as camadas de abstração do sensor e da bomba ficam lá, e não
numa pasta com outro nome.

## Testando sem o hardware conectado

Se o ESP32 não estiver disponível no momento (ex. para ensaiar a apresentação), não
precisa fazer nada: o Dashboard já gera leituras simuladas sozinho, automaticamente, a
cada 2 segundos (`POST /api/measurements/simulate` — ver `../backend/README.md`), com
uma pequena proporção saindo do limite configurado para demonstrar os alertas. Assim que
o firmware real começar a enviar leituras de verdade, a simulação automática é desligada.

## Solução de problemas

- **Erro de compilação "DHT.h: No such file or directory"**: a biblioteca "DHT sensor
  library" (Adafruit) não foi instalada — veja a seção Bibliotecas acima.
- **`#error "config.h não encontrado"`**: copie `config.example.h` para `config.h` (passo
  2 da Configuração).
- **Wi-Fi não conecta**: confira `WIFI_SSID`/`WIFI_PASSWORD` em `config.h`; o ESP32 só
  suporta redes 2.4GHz (não 5GHz).
- **API retorna 401 no log serial**: `DEVICE_ID` ou `DEVICE_TOKEN` incorretos, ou o
  dispositivo foi desativado/removido na tela Dispositivos — gere um novo token por lá
  (botão "Regenerar token") e atualize `config.h`.
- **API retorna 400**: leitura fisicamente implausível chegou à API (não deveria
  acontecer, já que o firmware descarta leituras inválidas antes de enviar) — confira a
  fiação do sensor.
- **A bomba liga/desliga ao contrário do que a tela do sistema mostra**: seu módulo relé
  é do tipo oposto ao esperado — troque `RELAY_ACTIVE_LOW` em `config.h` (de `true` para
  `false`, ou vice-versa).
- **A bomba não reage ao ligar/desligar manualmente pela tela**: o relé só é atualizado a
  cada leitura enviada (a cada `READING_INTERVAL_MS`) — espere um ciclo, ou confira no
  Monitor Serial se a linha `Bomba: LIGADA/desligada` está aparecendo a cada leitura.
- **HTTPS com `setInsecure()`**: ao usar `API_BASE_URL` com `https://`, o firmware pula a
  validação do certificado do servidor para simplificar a demonstração local. Isso é
  aceitável para o TCC, mas **não deve ser usado em produção real** — lá, o certificado
  deveria ser fixado (`setCACert`) em vez de ignorado.
