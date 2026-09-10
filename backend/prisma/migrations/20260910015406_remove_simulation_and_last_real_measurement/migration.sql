-- Remove a distinção entre leitura real e simulada: o endpoint de simulação foi
-- removido (o sistema passa a aceitar só leituras reais do ESP32), então
-- last_real_measurement_at ficaria sempre idêntico a last_seen_at — coluna vestigial.
ALTER TABLE "devices" DROP COLUMN "last_real_measurement_at";
