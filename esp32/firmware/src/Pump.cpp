#include "Pump.h"
#include <Arduino.h>

// O Arduino compila cada arquivo dentro de src/ como uma unidade separada do
// firmware.ino — os #define de config.h (incluído só pelo firmware.ino) NÃO
// apareceriam aqui sem este include explícito, e os #ifndef abaixo cairiam sempre no
// valor padrão, ignorando silenciosamente RELAY_PIN/RELAY_ACTIVE_LOW do usuário.
#if __has_include("../config.h")
#include "../config.h"
#endif

// Relé da bomba d'água é opcional — RELAY_PIN/RELAY_ACTIVE_LOW vêm de config.h, mas
// caem num padrão aqui se um config.h antigo (de antes desse recurso existir) não os
// definir, para não quebrar a build de quem já tinha o firmware configurado.
#ifndef RELAY_PIN
#define RELAY_PIN 26
#endif

// Muitos módulos relé de baixo custo acionam em nível baixo (LOW = ligado, HIGH =
// desligado) — o oposto do que se esperaria. Se ao testar a bomba ligar/desligar ao
// contrário do que a tela do sistema mostra, troque este valor para "false" em
// config.h (não precisa mexer aqui).
#ifndef RELAY_ACTIVE_LOW
#define RELAY_ACTIVE_LOW true
#endif

void pumpSetup() {
  pinMode(RELAY_PIN, OUTPUT);
  pumpSetState(false); // começa desligada até a primeira resposta do servidor
}

void pumpSetState(bool isOn) {
  int activeLevel = RELAY_ACTIVE_LOW ? LOW : HIGH;
  int inactiveLevel = RELAY_ACTIVE_LOW ? HIGH : LOW;
  digitalWrite(RELAY_PIN, isOn ? activeLevel : inactiveLevel);
}
