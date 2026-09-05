import { afterEach, expect, it, vi } from 'vitest';
import http from '../src/lib/http';
import { requestPending } from '../src/composables/useRequestActivity';
afterEach(() => vi.useRealTimers());
it('replaces the top bar with delayed feedback until concurrent requests finish, including errors', async () => {
  vi.useFakeTimers();
  let resolveFirst!: () => void;
  let rejectSecond!: () => void;
  const first = http.get('/mock-one', { adapter: config => new Promise(resolve => {
    resolveFirst = () => resolve({ data: {}, status: 200, statusText: 'OK', headers: {}, config });
  }) });
  const second = http.get('/mock-two', { adapter: () => new Promise((_resolve, reject) => {
    rejectSecond = () => reject(new Error('mock failure'));
  }) }).catch(() => undefined);
  await vi.advanceTimersByTimeAsync(100);
  expect(requestPending.value).toBe(false);
  await vi.advanceTimersByTimeAsync(100);
  expect(requestPending.value).toBe(true);
  resolveFirst();
  await first;
  expect(requestPending.value).toBe(true);
  rejectSecond();
  await second;
  expect(requestPending.value).toBe(false);
  expect(document.querySelector('#nprogress')).toBeNull();
});
it('does not flash feedback for a fast request', async () => {
  vi.useFakeTimers();
  await http.get('/mock-fast', { adapter: async config => ({ data: {}, status: 200, statusText: 'OK', headers: {}, config }) });
  await vi.advanceTimersByTimeAsync(500);
  expect(requestPending.value).toBe(false);
});
