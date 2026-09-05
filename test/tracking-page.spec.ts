import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRouter, createMemoryHistory } from 'vue-router';
import Pelacakan from '../src/pages/Pelacakan.vue';
// eslint-disable-next-line no-unused-vars -- Names in callback type signatures are not runtime variables.
type Callback = (...args: any[]) => void;
const mocks = vi.hoisted(() => ({ handlers: {} as Record<string, Callback>, connect: vi.fn(), remove: vi.fn() }));
vi.mock('mqtt', () => ({ default: { connect: mocks.connect } }));
vi.mock('leaflet', () => ({ default: {
  map: () => ({ setView() { return this; }, remove: mocks.remove, invalidateSize: vi.fn() }),
  tileLayer: () => ({ addTo: vi.fn() })
} }));
describe('tracking page retained messages', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.handlers = {};
    vi.stubEnv('VITE_MQTT_WSS_URL', 'wss://example.test'); vi.stubEnv('VITE_MQTT_USERNAME', 'test'); vi.stubEnv('VITE_MQTT_PASSWORD', 'test');
    vi.stubEnv('VITE_MQTT_TOPIC', 'sumbertrans/tracking/driver/+');
    mocks.connect.mockReturnValue({ on: (name: string, cb: Callback) => { mocks.handlers[name] = cb; }, end: vi.fn(), subscribe: vi.fn() });
  });
  async function render() {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: Pelacakan }] });
    await router.push('/');
    return mount(Pelacakan, { global: { plugins: [router] } });
  }
  it('never flashes a historical completed trip from MQTT in the active list', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ items: [] }) })); vi.stubGlobal('fetch', fetchMock);
    const wrapper = await render(); await flushPromises();
    const raw = JSON.stringify({ schema_version: 1, tracking_account_id: 7, dbl_id: 10, dbl_number: 'OLD TEST9', status: 'COMPLETED', recorded_at: '2026-08-06T00:00:00Z', lat: -6, lng: 106 });
    mocks.handlers.message!('sumbertrans/tracking/driver/7', { toString: () => raw }, { retain: true });
    await flushPromises();
    expect(wrapper.text()).not.toContain('OLD TEST9');
    expect(wrapper.text()).toContain('Belum ada DBL aktif');
    expect(fetchMock).toHaveBeenCalledOnce();
    wrapper.unmount();
  });
  it('does not start an MQTT connection after navigating away while loading', async () => {
    let complete = (value: unknown) => { void value; };
    vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { complete = resolve; })));
    const wrapper = await render(); await flushPromises(); wrapper.unmount();
    complete({ ok: true, json: async () => ({ items: [] }) }); await flushPromises();
    expect(mocks.connect).not.toHaveBeenCalled();
  });
});
