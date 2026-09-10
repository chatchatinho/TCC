#pragma once

// Camada de abstração do relé da bomba d'água — o resto do firmware nunca escreve no
// pino diretamente, só chama pumpSetState() com o que o servidor mandou na resposta de
// cada leitura (ver applyPumpStateFromResponse() em firmware.ino). Fica dentro de src/
// pelo mesmo motivo de Sensor.h: é a única subpasta que o Arduino IDE/arduino-cli
// compila automaticamente junto com o sketch.

void pumpSetup();
void pumpSetState(bool isOn);
