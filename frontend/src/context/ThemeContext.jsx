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

// `null` = o usuário nunca escolheu um modo manualmente em Configurações — o tema
// segue o sistema operacional automaticamente. Uma vez escolhido, vira `true`/`false`
// fixo (persistido), até o usuário clicar em "Seguir o sistema novamente".
function readExplicitDarkPreference() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_DARK);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
  } catch {
    /* localStorage indisponível (ex. modo privado) */
  }
  return null;
}

function getSystemPrefersDark() {
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
  const [explicitPreference, setExplicitPreference] = useState(readExplicitDarkPreference);
  const [systemPrefersDark, setSystemPrefersDark] = useState(getSystemPrefersDark);
  const [accent, setAccentState] = useState(readStoredAccent);

  // Acompanha o tema do sistema operacional em tempo real (ex.: troca automática dia/
  // noite do Windows/macOS) — só importa enquanto o usuário não tiver escolhido um modo
  // manualmente; a partir daí a escolha explícita manda, e essa mudança é ignorada.
  useEffect(() => {
    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mediaQuery) return undefined;
    const handleChange = (e) => setSystemPrefersDark(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const darkMode = explicitPreference ?? systemPrefersDark;
  const followsSystem = explicitPreference === null;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    applyAccent(accent);
    try {
      localStorage.setItem(STORAGE_KEY_ACCENT, accent);
    } catch {
      /* ignora falha ao persistir preferência */
    }
  }, [accent]);

  const toggleDarkMode = useCallback(() => {
    setExplicitPreference((prevExplicit) => {
      const next = !(prevExplicit ?? getSystemPrefersDark());
      try {
        localStorage.setItem(STORAGE_KEY_DARK, String(next));
      } catch {
        /* ignora falha ao persistir preferência */
      }
      return next;
    });
  }, []);

  // Descarta a escolha manual e volta a seguir o tema do sistema operacional.
  const followSystemTheme = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY_DARK);
    } catch {
      /* ignora */
    }
    setExplicitPreference(null);
  }, []);

  const setAccent = useCallback((key) => setAccentState(ACCENT_PALETTES[key] ? key : 'blue'), []);

  return (
    <ThemeContext.Provider
      value={{
        darkMode,
        toggleDarkMode,
        followsSystem,
        followSystemTheme,
        accent,
        setAccent,
        accentOptions: Object.keys(ACCENT_PALETTES),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme deve ser usado dentro de <ThemeProvider>.');
  return ctx;
}
