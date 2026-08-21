#pragma once

// Copie este arquivo para "config.h" (mesma pasta) e preencha com os valores reais.
// config.h NUNCA deve ser commitado — está no .gitignore porque contém credenciais
// (senha do Wi-Fi e token do dispositivo). Nenhuma credencial real fica neste exemplo.

#define WIFI_SSID "SUA_REDE_WIFI"
#define WIFI_PASSWORD "SUA_SENHA_WIFI"

// URL base da API (sem barra final). Para testes locais, use o IP da máquina que roda
// o backend na mesma rede Wi-Fi do ESP32, ex.: "http://192.168.0.10:3000/api".
// Em produção, prefira HTTPS: "https://seu-dominio.com/api".
#define API_BASE_URL "http://192.168.0.10:3000/api"

// Identificador público do dispositivo — o mesmo cadastrado na tela "Dispositivos"
// do sistema web (ex.: "ESP32-001").
#define DEVICE_ID "ESP32-001"

// Token de API do dispositivo, exibido em texto puro UMA VEZ no momento do cadastro
// (ou da regeneração) na tela "Dispositivos". Se perdido, gere um novo por lá.
#define DEVICE_TOKEN "COLE_AQUI_O_TOKEN_GERADO_PELO_SISTEMA"

// Intervalo entre leituras/envios, em milissegundos. O DHT11 suporta leituras a partir
// de ~1s de intervalo; 5s dá uma margem de segurança confortável mantendo o dashboard
// bem responsivo. Aumente esse valor se quiser economizar tráfego de rede.
#define READING_INTERVAL_MS 5000
