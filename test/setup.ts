import '@testing-library/jest-dom';

// Ensure relative fetch URLs work in Node test environment (vitest/node uses undici fetch)
// In browser, `fetch('/api/...')` works. In node's fetch, relative URLs cause ERR_INVALID_URL.
// For tests, rewrite relative URLs to use `http://localhost` as base so components can call relative paths without errors.
// Using `any` here OK for tests/shims; otherwise updating types for fetch overloads is verbose
const _origFetch: any = globalThis.fetch;
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
(globalThis as any).fetch = async (input: any, init?: any) => {
	try {
		// if input is a string and starts with '/', treat it as relative and add base
		if (typeof input === 'string' && input.startsWith('/')) {
			const url = new URL(input, 'http://localhost');
			return _origFetch?.(url.toString(), init);
		}
		return _origFetch?.(input, init);
	} catch (e) {
		return _origFetch?.(input as RequestInfo, init);
	}
};
