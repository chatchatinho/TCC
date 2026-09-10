#pragma once

// Camada de abstração do sensor (seção 16/32 do escopo do TCC): o resto do firmware
// (Wi-Fi, autenticação, montagem/envio da requisição) nunca inclui a biblioteca do
// sensor diretamente, só este cabeçalho. Trocar o DHT11 por outro sensor no futuro
// (DHT22, SHT31, BME280...) significa reescrever apenas Sensor.cpp — nada mais no
// firmware precisa mudar.
//
// Fica dentro de "src/" (não de um nome qualquer como "sensor/") porque essa é a
// única subpasta que o Arduino IDE/arduino-cli compila automaticamente junto com o
// sketch — arquivos .cpp fora dela ou de fora da raiz do sketch são silenciosamente
// ignorados pelo build padrão do Arduino.

struct SensorReading {
  float temperature; // graus Celsius
  float humidity;    // % de umidade relativa (do ar)
  bool valid;         // false se a leitura do DHT falhou ou veio fora da faixa fisicamente plausível

  // Sensor de umidade do solo é opcional (SOIL_MOISTURE_ENABLED em config.h) e
  // independente do DHT — um dispositivo sem esse sensor simplesmente não envia o
  // campo, em vez de travar/invalidar a leitura inteira por causa dele.
  float soilMoisture;   // % de umidade do solo (0-100), só significativo se hasSoilMoisture
  bool hasSoilMoisture; // false se o sensor de solo estiver desabilitado ou a leitura falhar
};

void sensorSetup();
SensorReading sensorRead();
