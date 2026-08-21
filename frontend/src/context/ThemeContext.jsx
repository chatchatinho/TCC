import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const STORAGE_KEY_DARK = 'thermosense:darkMode';
const STORAGE_KEY_ACCENT = 'thermosense:accent';

// Paleta de cada opção de destaque (tons 50/100/500/600/700, mesma escala usada pelo
// Tailwind). Trocar a cor só reescreve estas variáveis CSS em :root — todas as classes
// utilitárias (bg-brand-600, text-brand-700 etc.) já apontam para elas, então a troca
// se propaga pelo app inteiro sem precisar recompilar nada.
const ACCENT_PALETTES = {
  blue: { 50: '#eff6ff', 100: '#dbeafe', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8' },
  emerald: { 50: '#ecfdf5', 100: '#d1fae5', 500: '#10b981', 600: '#059669', 700: '#047857' },
  violet: { 50: '#f5f3ff', 100: '#ede9fe', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9' },
  orange: { 50: '#fff7ed', 100: '#ffedd5', 500: '#f97316', 600: '#ea580c', 700: '#c2410c' },
};

const ThemeContext = createContext(null);

function readStoredDarkMode() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_DARK);
    if (stored !== null) return stored === 'true';
  } catch {
    /* localStorage indisponível (ex. modo privado) — cai no padrão do sistema */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

function readStoredAccent() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_ACCENT);
    if (stored && ACCENT_PALETTES[stored]) return stored;
  } catch {
    /* ignora */
  }
  return 'blue';
}

function applyAccent(accent) {
  const palette = ACCENT_PALETTES[accent] ?? ACCENT_PALETTES.blue;
  const root = document.documentElement;
  Object.entries(palette).forEach(([shade, value]) => {
    root.style.setProperty(`--color-brand-${shade}`, value);
  });
}

export function ThemeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(readStoredDarkMode);
  const [accent, setAccentState] = useState(readStoredAccent);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      localStorage.setItem(STORAGE_KEY_DARK, String(darkMode));
    } catch {
      /* ignora falha ao persistir preferência */
    }
  }, [darkMode]);

  useEffect(() => {
    applyAccent(accent);
    try {
      localStorage.setItem(STORAGE_KEY_ACCENT, accent);
    } catch {
      /* ignora falha ao persistir preferência */
    }
  }, [accent]);

  const toggleDarkMode = useCallback(() => setDarkMode((prev) => !prev), []);
  const setAccent = useCallback((key) => setAccentState(ACCENT_PALETTES[key] ? key : 'blue'), []);

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode, accent, setAccent, accentOptions: Object.keys(ACCENT_PALETTES) }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme deve ser usado dentro de <ThemeProvider>.');
  return ctx;
}
