/*
  Firmware do ESP32 para o ThermoSense Lite.
  Lê temperatura e umidade do sensor DHT11 e envia para a API PHP a cada 10 segundos.

  Antes de gravar:
  1. No app, cadastre um dispositivo (botão "+" na tela inicial) e copie o
     token gerado — ele só é mostrado uma vez.
  2. Preencha as constantes abaixo com sua rede Wi-Fi, o endereço da API e o token.
  3. No Arduino IDE, instale as bibliotecas "DHT sensor library" (Adafruit) e "ArduinoJson".

  Ligação do sensor DHT11: VCC -> 3V3, GND -> GND, DATA -> GPIO 4.
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

const char *WIFI_SSID = "SUA_REDE_WIFI";
const char *WIFI_PASSWORD = "SUA_SENHA_WIFI";

// Endereço do backend PHP, incluindo a rota de medições.
// Ex.: "http://192.168.0.10:8000/api/measurements"
const char *API_URL = "http://SEU_SERVIDOR:8000/api/measurements";
const char *DEVICE_TOKEN = "COLE_AQUI_O_TOKEN_DO_DISPOSITIVO";

#define DHT_PIN 4
#define DHT_TYPE DHT11

DHT dht(DHT_PIN, DHT_TYPE);

const unsigned long READ_INTERVAL_MS = 10000;
unsigned long lastReadAt = 0;

void connectWifi() {
  Serial.print("Conectando ao Wi-Fi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println(" conectado!");
}

void sendMeasurement(float temperature, float humidity) {
  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
  }

  HTTPClient http;
  http.begin(API_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Token", DEVICE_TOKEN);

  JsonDocument doc;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  String body;
  serializeJson(doc, body);

  int statusCode = http.POST(body);
  Serial.printf("Envio -> status HTTP %d\n", statusCode);
  http.end();
}

void setup() {
  Serial.begin(115200);
  dht.begin();
  connectWifi();
}

void loop() {
  if (millis() - lastReadAt >= READ_INTERVAL_MS) {
    lastReadAt = millis();

    float humidity = dht.readHumidity();
    float temperature = dht.readTemperature();

    if (isnan(humidity) || isnan(temperature)) {
      Serial.println("Falha ao ler o sensor DHT11.");
      return;
    }

    Serial.printf("Temp: %.1f C | Umidade: %.1f %%\n", temperature, humidity);
    sendMeasurement(temperature, humidity);
  }
}
