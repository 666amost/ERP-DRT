import { readonly, ref } from 'vue';
const pending = ref(false);
let count = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
export const requestPending = readonly(pending);
export function startRequest() {
  if (count++ === 0) timer = setTimeout(() => { pending.value = true; }, 200);
}
export function finishRequest() {
  count = Math.max(0, count - 1);
  if (count === 0) {
    clearTimeout(timer);
    pending.value = false;
  }
}
