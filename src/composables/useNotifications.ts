import { ref } from 'vue';
interface Notice { id: number; message: string; kind: 'success' | 'error' }
export const notices = ref<Notice[]>([]);
let nextId = 0;
const timers = new Map<number, ReturnType<typeof setTimeout>>();
export function pauseNotice(id: number) {
  clearTimeout(timers.get(id));
  timers.delete(id);
}
export function dismissNotice(id: number) {
  pauseNotice(id);
  notices.value = notices.value.filter(notice => notice.id !== id);
}
export function resumeNotice(id: number) {
  pauseNotice(id);
  if (notices.value.find(notice => notice.id === id)?.kind === 'success') {
    timers.set(id, setTimeout(() => dismissNotice(id), 6000));
  }
}
function show(message: string, kind: Notice['kind']) {
  const id = ++nextId;
  notices.value.push({ id, message, kind });
  resumeNotice(id);
  return id;
}
export const notify = {
  success: (message: string) => show(message, 'success'),
  error: (message: string) => show(message, 'error')
};
