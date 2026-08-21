// <input type="number"> nativo do navegador REJEITA vírgula como separador decimal —
// digitar "6,0" vira "60" silenciosamente, sem nenhum aviso (bug real encontrado em
// teste manual). Como grande parte dos usuários brasileiros digita decimais com
// vírgula por hábito, os campos numéricos do formulário usam texto livre + este parser,
// que aceita tanto "6,0" quanto "6.0".
export function parseDecimal(value) {
  if (typeof value === 'number') return value;
  if (!value) return NaN;
  const normalized = String(value).trim().replace(',', '.');
  return Number(normalized);
}

export function isValidDecimal(value) {
  return Number.isFinite(parseDecimal(value));
}

// Para campos numéricos opcionais: vazio é válido (significa "não definido"),
// qualquer outra coisa precisa ser um decimal válido.
export function isValidOptionalDecimal(value) {
  return value === '' || value == null || isValidDecimal(value);
}
