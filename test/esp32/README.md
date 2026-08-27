# Firmware ESP32 — ThermoSense Lite

Versão simplificada do firmware original: lê o sensor DHT11 e envia a leitura
para a API PHP a cada 10 segundos, autenticado pelo token do dispositivo.

## Material necessário

- Placa ESP32
- Sensor DHT11
- 3 fios (VCC, GND, DATA)

## Ligação

| DHT11 | ESP32 |
|---|---|
| VCC | 3V3 |
| GND | GND |
| DATA | GPIO 4 |

## Passo a passo

1. No app (tela inicial), toque no botão **+** para cadastrar um dispositivo
   e copie o token exibido — ele só aparece uma vez.
2. Abra `firmware.ino` na Arduino IDE.
3. Em **Ferramentas > Gerenciar Bibliotecas**, instale:
   - `DHT sensor library` (Adafruit)
   - `ArduinoJson`
4. Edite as constantes no topo do arquivo:
   - `WIFI_SSID` / `WIFI_PASSWORD`: sua rede Wi-Fi (precisa ser 2,4GHz)
   - `API_URL`: endereço do backend PHP, ex. `http://192.168.0.10:8000/api/measurements`
   - `DEVICE_TOKEN`: o token copiado no passo 1
5. Selecione a placa "ESP32 Dev Module" e a porta correta, depois envie o código.
6. Abra o Monitor Serial (115200 baud) para acompanhar os envios.

## Sem o hardware em mãos?

Não tem problema: o app tem um botão **"Simular leitura"** na tela de cada
dispositivo, que gera uma leitura aleatória e passa pelo mesmo fluxo de
alertas — dá para testar o sistema inteiro sem o ESP32 físico.
