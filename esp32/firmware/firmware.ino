// Firmware do ESP32 — envia leituras de temperatura/umidade (DHT11) para a API do
// sistema de monitoramento. Ver ../README.md para fiação, bibliotecas e como configurar.
//
// Fluxo (seção 16 do escopo do TCC): conecta ao Wi-Fi -> sincroniza hora via NTP ->
// a cada READING_INTERVAL_MS: lê o sensor -> valida -> monta JSON -> envia via
// HTTP(S) autenticado -> trata a resposta -> se o Wi-Fi cair, reconecta antes da
// próxima tentativa.

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <time.h>

#include "src/Sensor.h"

#if __has_include("config.h")
#include "config.h"
#else
#error "config.h não encontrado. Copie config.example.h para config.h e preencha com seus dados (veja esp32/README.md)."
#endif

// Tempo máximo de espera por uma conexão Wi-Fi antes de desistir da tentativa atual.
#define WIFI_CONNECT_TIMEOUT_MS 15000
// Intervalo entre tentativas de reconexão quando o Wi-Fi está fora do ar.
#define WIFI_RETRY_INTERVAL_MS 5000

static unsigned long lastReadingAt = 0;
static unsigned long lastWifiRetryAt = 0;

bool isApiUsingHttps() {
  return String(API_BASE_URL).startsWith("https://");
}

// Tenta conectar ao Wi-Fi uma vez, aguardando até WIFI_CONNECT_TIMEOUT_MS. Não bloqueia
// indefinidamente: se não conectar a tempo, o loop() principal tenta de novo mais tarde
// (ver reconnectWifiIfNeeded), sem travar a leitura/envio de medições.
bool connectWifi() {
  Serial.printf("Conectando ao Wi-Fi \"%s\"...\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startedAt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startedAt < WIFI_CONNECT_TIMEOUT_MS) {
    delay(300);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("Wi-Fi conectado. IP: %s\n", WiFi.localIP().toString().c_str());
    return true;
  }

  Serial.println("Falha ao conectar ao Wi-Fi.");
  return false;
}

// Chamado a cada iteração do loop(): garante que, se a conexão cair, o firmware tente
// se reconectar periodicamente em vez de travar ou parar de enviar dados (seção 16/25).
void reconnectWifiIfNeeded() {
  if (WiFi.status() == WL_CONNECTED) return;

  unsigned long now = millis();
  if (now - lastWifiRetryAt < WIFI_RETRY_INTERVAL_MS) return;
  lastWifiRetryAt = now;

  Serial.println("Wi-Fi desconectado. Tentando reconectar...");
  connectWifi();
}

// Sincroniza o relógio via NTP em UTC. Sem isso, measured_at ficaria com a hora
// "de fábrica" do ESP32 (próxima de 1970) — o backend detecta isso como implausível
// e usa o horário de recebimento como fallback (ver docs/01-arquitetura-e-decisoes.md,
// riscos técnicos #1), mas sincronizar aqui é preferível sempre que possível.
void syncTime() {
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");

  Serial.print("Sincronizando hora via NTP");
  time_t now = time(nullptr);
  unsigned long startedAt = millis();
  // Antes da sincronização, time() retorna um valor próximo de 1970 (epoch 0).
  while (now < 8 * 3600 * 2 && millis() - startedAt < 10000) {
    delay(300);
    Serial.print(".");
    now = time(nullptr);
  }
  Serial.println();

  if (now >= 8 * 3600 * 2) {
    Serial.println("Hora sincronizada.");
  } else {
    Serial.println("Não foi possível sincronizar a hora agora; measured_at será omitido nesta leitura.");
  }
}

// Retorna o horário atual em ISO 8601 UTC (ex.: "2026-08-21T08:15:00Z"), ou uma string
// vazia se o relógio ainda não estiver sincronizado — nesse caso o campo "timestamp"
// é omitido do JSON e o backend usa o horário de recebimento como measured_at.
String currentIsoTimestamp() {
  time_t now = time(nullptr);
  if (now < 8 * 3600 * 2) return "";

  struct tm timeinfo;
  gmtime_r(&now, &timeinfo);

  char buffer[25];
  strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  return String(buffer);
}

// Monta e envia o JSON da leitura para POST /api/measurements, autenticado por
// device_id (no corpo) + token no header X-Device-Key (seção 17 do escopo — o
// device_id sozinho nunca é suficiente).
void sendMeasurement(const SensorReading &reading) {
  JsonDocument doc;
  doc["device_id"] = DEVICE_ID;
  doc["temperature"] = reading.temperature;
  doc["humidity"] = reading.humidity;

  String timestamp = currentIsoTimestamp();
  if (timestamp.length() > 0) {
    doc["timestamp"] = timestamp;
  }

  String payload;
  serializeJson(doc, payload);

  HTTPClient http;
  WiFiClientSecure secureClient;
  WiFiClient plainClient;
  bool began;

  if (isApiUsingHttps()) {
    // setInsecure() pula a validação da cadeia de certificados — aceitável para a
    // demonstração local do TCC, mas NÃO deve ser usado em produção: lá, o certificado
    // do servidor deveria ser fixado (setCACert) em vez de ignorado.
    secureClient.setInsecure();
    began = http.begin(secureClient, String(API_BASE_URL) + "/measurements");
  } else {
    began = http.begin(plainClient, String(API_BASE_URL) + "/measurements");
  }

  if (!began) {
    Serial.println("Falha ao preparar a requisição HTTP.");
    return;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_TOKEN);

  Serial.printf("Enviando leitura: %s\n", payload.c_str());
  int statusCode = http.POST(payload);

  if (statusCode > 0) {
    String response = http.getString();
    if (statusCode == 201) {
      Serial.printf("Leitura registrada com sucesso (%d): %s\n", statusCode, response.c_str());
    } else {
      // 400 (dados inválidos), 401 (token/dispositivo não autorizado) e 429 (rate
      // limit) chegam aqui — registrados, mas não travam o firmware (seção 25).
      Serial.printf("API retornou erro (%d): %s\n", statusCode, response.c_str());
    }
  } else {
    Serial.printf("Falha na requisição HTTP: %s\n", http.errorToString(statusCode).c_str());
  }

  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(500);

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

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Sem Wi-Fi — leitura adiada para o próximo ciclo.");
    return;
  }

  SensorReading reading = sensorRead();
  if (!reading.valid) {
    Serial.println("Leitura do sensor inválida — descartada, não será enviada.");
    return;
  }

  sendMeasurement(reading);
}
