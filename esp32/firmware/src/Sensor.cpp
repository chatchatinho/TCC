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

// Sensor de umidade do solo (higrômetro capacitivo, saída analógica) é opcional —
// SOIL_MOISTURE_ENABLED/SOIL_MOISTURE_PIN vêm de config.h, mas caem num padrão
// "desabilitado" aqui se um config.h antigo (de antes desse recurso existir) não os
// definir, para não quebrar a build de quem já tinha o firmware configurado.
#ifndef SOIL_MOISTURE_ENABLED
#define SOIL_MOISTURE_ENABLED false
#endif
#ifndef SOIL_MOISTURE_PIN
#define SOIL_MOISTURE_PIN 34
#endif

// Leitura bruta do ADC (0-4095 no ESP32) em solo completamente seco (ao ar) e
// totalmente encharcado — sensores capacitivos leem um valor MAIOR quanto mais seco
// o solo está, o oposto do que a % de umidade deveria mostrar, daí a inversão no
// mapeamento abaixo. Esses dois valores variam por sensor/fiação: calibre o seu
// lendo SOIL_MOISTURE_PIN nas duas condições e ajuste as constantes aqui.
#ifndef SOIL_MOISTURE_DRY_RAW
#define SOIL_MOISTURE_DRY_RAW 3000
#endif
#ifndef SOIL_MOISTURE_WET_RAW
#define SOIL_MOISTURE_WET_RAW 1200
#endif

static DHT dht(DHT_PIN, DHT_TYPE);

void sensorSetup() {
  dht.begin();
  if (SOIL_MOISTURE_ENABLED) {
    pinMode(SOIL_MOISTURE_PIN, INPUT);
  }
}

// Converte a leitura bruta do ADC em % de umidade do solo (0-100), usando a
// calibração seco/molhado acima. constrain() evita que ruído fora da faixa calibrada
// vire um valor fisicamente absurdo (negativo ou acima de 100%).
static float readSoilMoisturePercent() {
  int raw = analogRead(SOIL_MOISTURE_PIN);
  float percent = map(raw, SOIL_MOISTURE_DRY_RAW, SOIL_MOISTURE_WET_RAW, 0, 100);
  return constrain(percent, 0.0f, 100.0f);
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

  reading.hasSoilMoisture = SOIL_MOISTURE_ENABLED;
  reading.soilMoisture = SOIL_MOISTURE_ENABLED ? readSoilMoisturePercent() : 0.0f;

  return reading;
}
