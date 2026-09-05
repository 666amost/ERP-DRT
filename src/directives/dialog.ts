import type { ObjectDirective } from 'vue';
// EventListener is a DOM type, not a runtime global.
/* eslint-disable no-undef */
type DialogState = { element: HTMLElement; close: () => void; previous: HTMLElement | null; keydown: EventListener };
/* eslint-enable no-undef */
const stack: DialogState[] = [];
let previousOverflow = '';
const selector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex="0"]';
function focusables(element: HTMLElement) {
  return Array.from(element.querySelectorAll<HTMLElement>(selector)).filter(item => item.getClientRects().length > 0);
}
export const vDialog: ObjectDirective<HTMLElement, () => void> = {
  mounted(element, binding) {
    if (!stack.length) { previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
    element.setAttribute('role', 'dialog');
    element.setAttribute('aria-modal', 'true');
    element.tabIndex = -1;
    const state: DialogState = { element, close: binding.value, previous: document.activeElement as HTMLElement | null, keydown: () => {} };
    state.keydown = event => {
      if (stack.at(-1) !== state) return;
      if ((event as KeyboardEvent).key === 'Escape') { event.preventDefault(); event.stopPropagation(); state.close(); }
      if ((event as KeyboardEvent).key === 'Tab') {
        const controls = focusables(element);
        const first = controls[0] || element;
        const last = controls.at(-1) || element;
        if ((event as KeyboardEvent).shiftKey && (document.activeElement === first || !controls.includes(document.activeElement as HTMLElement))) { event.preventDefault(); last.focus(); }
        else if (!(event as KeyboardEvent).shiftKey && (document.activeElement === last || !controls.includes(document.activeElement as HTMLElement))) { event.preventDefault(); first.focus(); }
      }
    };
    stack.push(state);
    document.addEventListener('keydown', state.keydown, true);
    queueMicrotask(() => { if (element.isConnected) (focusables(element)[0] || element).focus(); });
  },
  updated(element, binding) { const state = stack.find(item => item.element === element); if (state) state.close = binding.value; },
  unmounted(element) {
    const index = stack.findIndex(item => item.element === element);
    if (index < 0) return;
    const state = stack[index]!;
    const wasTop = index === stack.length - 1;
    stack.splice(index, 1);
    document.removeEventListener('keydown', state.keydown, true);
    if (!stack.length) document.body.style.overflow = previousOverflow;
    if (wasTop && state.previous?.isConnected) state.previous.focus();
  }
};
