import { ref, onMounted } from 'vue';

const KEY = 'erp-theme';
const theme = ref<'light' | 'dark'>('light');

function apply(t: 'light' | 'dark') {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  if (!el) return;
  if (t === 'dark') el.classList.add('dark');
  else el.classList.remove('dark');
}

export function useTheme() {
  // Lazily initialize from localStorage on client
  onMounted(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === 'dark' || saved === 'light') theme.value = saved;
    } catch (err) {
      // ignore localStorage errors in private mode
      console.debug('useTheme localStorage read error', err);
    }
    apply(theme.value);
  });

  function toggle() {
    theme.value = theme.value === 'light' ? 'dark' : 'light';
    try { localStorage.setItem(KEY, theme.value); } catch (err) { console.debug('useTheme localStorage write error', err); }
    apply(theme.value);
  }
  function set(t: 'light' | 'dark') {
    theme.value = t;
    try { localStorage.setItem(KEY, t); } catch (err) { console.debug('useTheme localStorage write error', err); }
    apply(t);
  }
  return { theme, toggle, set };
}

export default useTheme;
