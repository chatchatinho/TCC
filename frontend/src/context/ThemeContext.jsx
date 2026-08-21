import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const STORAGE_KEY_DARK = 'thermosense:darkMode';
const STORAGE_KEY_ACCENT = 'thermosense:accent';
const STORAGE_KEY_FONT_SCALE = 'thermosense:fontScale';
const STORAGE_KEY_REDUCED_MOTION = 'thermosense:reducedMotion';

// Paleta de cada opção de destaque (tons 50/100/500/600/700, mesma escala usada pelo
// Tailwind). Trocar a cor só reescreve estas variáveis CSS em :root — todas as classes
// utilitárias (bg-brand-600, text-brand-700 etc.) já apontam para elas, então a troca
// se propaga pelo app inteiro sem precisar recompilar nada.
const ACCENT_PALETTES = {
  blue: { 50: '#eff6ff', 100: '#dbeafe', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8' },
  emerald: { 50: '#ecfdf5', 100: '#d1fae5', 500: '#10b981', 600: '#059669', 700: '#047857' },
  violet: { 50: '#f5f3ff', 100: '#ede9fe', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9' },
  orange: { 50: '#fff7ed', 100: '#ffedd5', 500: '#f97316', 600: '#ea580c', 700: '#c2410c' },
  rose: { 50: '#fff1f2', 100: '#ffe4e6', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c' },
  cyan: { 50: '#ecfeff', 100: '#cffafe', 500: '#06b6d4', 600: '#0891b2', 700: '#0e7490' },
  amber: { 50: '#fffbeb', 100: '#fef3c7', 500: '#f59e0b', 600: '#d97706', 700: '#b45309' },
  slate: { 50: '#f8fafc', 100: '#f1f5f9', 500: '#64748b', 600: '#475569', 700: '#334155' },
};

// Tamanho da fonte: escala o --app-font-scale (font-size da raiz, ver index.css). Como
// o Tailwind mede a maior parte das coisas em rem, isso escala o app inteiro junto.
const FONT_SCALES = { sm: '93.75%', md: '100%', lg: '112.5%' };

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

function readStoredFontScale() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_FONT_SCALE);
    if (stored && FONT_SCALES[stored]) return stored;
  } catch {
    /* ignora */
  }
  return 'md';
}

function readStoredReducedMotion() {
  try {
    return localStorage.getItem(STORAGE_KEY_REDUCED_MOTION) === 'true';
  } catch {
    return false;
  }
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
  const [fontScale, setFontScaleState] = useState(readStoredFontScale);
  const [reducedMotion, setReducedMotionState] = useState(readStoredReducedMotion);

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

  useEffect(() => {
    document.documentElement.style.setProperty('--app-font-scale', FONT_SCALES[fontScale] ?? FONT_SCALES.md);
    try {
      localStorage.setItem(STORAGE_KEY_FONT_SCALE, fontScale);
    } catch {
      /* ignora */
    }
  }, [fontScale]);

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reducedMotion);
    try {
      localStorage.setItem(STORAGE_KEY_REDUCED_MOTION, String(reducedMotion));
    } catch {
      /* ignora */
    }
  }, [reducedMotion]);

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
  const setFontScale = useCallback((key) => setFontScaleState(FONT_SCALES[key] ? key : 'md'), []);
  const toggleReducedMotion = useCallback(() => setReducedMotionState((prev) => !prev), []);

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
        fontScale,
        setFontScale,
        fontScaleOptions: Object.keys(FONT_SCALES),
        reducedMotion,
        toggleReducedMotion,
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
