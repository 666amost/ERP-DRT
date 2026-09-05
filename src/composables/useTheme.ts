import { ref } from 'vue';

type ThemePreference = 'light' | 'dark' | 'system';
const theme = ref<'light' | 'dark'>('light');
const preference = ref<ThemePreference>('light');
const textSize = ref<'standard' | 'large'>('standard');
let initialized = false;

export function useTheme() {
  function apply() {
    if (typeof document === 'undefined') return;
    theme.value = preference.value === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : preference.value;
    document.documentElement.classList.toggle('dark', theme.value === 'dark');
    document.documentElement.classList.toggle('text-large', textSize.value === 'large');
  }
  if (!initialized && typeof window !== 'undefined') {
    initialized = true;
    try {
      const saved = localStorage.getItem('erp-theme');
      if (saved === 'light' || saved === 'dark' || saved === 'system') preference.value = saved;
      textSize.value = localStorage.getItem('erp-text-size') === 'large' ? 'large' : 'standard';
    } catch { /* Storage is optional. */ }
    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', apply);
    apply();
  }
  function set(value: ThemePreference) {
    preference.value = value;
    try { localStorage.setItem('erp-theme', value); } catch { /* Storage is optional. */ }
    apply();
  }
  function setTextSize(value: 'standard' | 'large') {
    textSize.value = value;
    try { localStorage.setItem('erp-text-size', value); } catch { /* Storage is optional. */ }
    apply();
  }
  function toggle() { set(theme.value === 'dark' ? 'light' : 'dark'); }
  return { theme, preference, textSize, toggle, set, setTextSize };
}
export default useTheme;
