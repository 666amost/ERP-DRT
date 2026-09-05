import { readonly, ref } from 'vue';
const pending = ref(false);
let destination = '';
let timer: ReturnType<typeof setTimeout> | undefined;
export const navigationPending = readonly(pending);
export function beginNavigation(path: string) {
  clearTimeout(timer);
  destination = path;
  timer = setTimeout(() => { pending.value = true; }, 200);
}
export function finishNavigation(path: string) {
  if (path !== destination) return;
  clearTimeout(timer);
  pending.value = false;
  destination = '';
}
