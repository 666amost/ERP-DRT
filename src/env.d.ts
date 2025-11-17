declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.jpeg' {
  const src: string;
  export default src;
}

declare module '*.svg' {
  const src: string;
  export default src;
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  export default component;
}

// Minimal typing for JsBarcode (library doesn't ship types).
// This keeps TypeScript happy while we use the library in the client.
declare module 'jsbarcode' {
  // eslint-disable-next-line no-unused-vars
  function JsBarcode(_el: Element | string, _text: string, _options?: Record<string, unknown>): void;
  export default JsBarcode;
}
