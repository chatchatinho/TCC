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
  float humidity;    // % de umidade relativa
  bool valid;         // false se a leitura falhou ou veio fora da faixa fisicamente plausível
};

void sensorSetup();
SensorReading sensorRead();
