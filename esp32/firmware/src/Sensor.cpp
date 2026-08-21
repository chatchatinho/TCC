#include "Sensor.h"
#include <DHT.h>

// DHT11 conectado ao pino de dados abaixo, com resistor de pull-up de 10kΩ entre VCC
// e o pino de dados (conforme datasheet do DHT11). Ajuste DHT_PIN conforme a fiação.
#define DHT_PIN 4
#define DHT_TYPE DHT11

// Faixa nominal de operação do DHT11 (datasheet): 0-50°C, 20-90% UR. Damos uma margem
// além disso antes de descartar a leitura aqui — o objetivo é só filtrar valores
// claramente inválidos (sensor desconectado, ruído na linha de dados), não replicar
// a faixa de precisão nominal. A validação física mais ampla e definitiva acontece no
// backend (seção 26 do escopo), que não conhece o sensor específico usado.
#define TEMP_MIN -10.0f
#define TEMP_MAX 60.0f
#define HUMIDITY_MIN 0.0f
#define HUMIDITY_MAX 100.0f

static DHT dht(DHT_PIN, DHT_TYPE);

void sensorSetup() {
  dht.begin();
}

SensorReading sensorRead() {
  SensorReading reading;
  reading.temperature = dht.readTemperature();
  reading.humidity = dht.readHumidity();

  // dht.read*() retorna NAN quando a leitura falha (timeout na linha de dados,
  // checksum inválido etc.) — isso é o principal caso de descarte no dia a dia.
  bool isNumeric = !isnan(reading.temperature) && !isnan(reading.humidity);
  bool isPlausible = isNumeric
    && reading.temperature >= TEMP_MIN && reading.temperature <= TEMP_MAX
    && reading.humidity >= HUMIDITY_MIN && reading.humidity <= HUMIDITY_MAX;

  reading.valid = isPlausible;
  return reading;
}
