import { describe, it, expect } from 'vitest';
import { trackingAction } from '../src/lib/activeTracking';
import type { TrackingPayload } from '../src/lib/trackingPayload';
const now = Date.parse('2026-09-06T10:00:00Z');
const payload: TrackingPayload = { schema_version: 1, tracking_account_id: 7, dbl_id: 10, dbl_number: 'DBL TEST', driver_name: null, vehicle_plate: null, origin: null, destination: null, lat: -6, lng: 106, accuracy_m: 5, speed_kph: 0, status: 'DEPARTED', recorded_at: '2026-09-06T09:59:00Z' };
describe('active tracking MQTT reconciliation', () => {
  it('never inserts a retained completed trip from history', () => {
    expect(trackingAction(undefined, { ...payload, status: 'COMPLETED', recorded_at: '2026-08-06T00:00:00Z' }, true, null, now)).toBe('remember');
  });
  it('removes a matching completed trip immediately', () => {
    expect(trackingAction({ id: 10, recorded_at: null }, { ...payload, status: 'COMPLETED' }, true, null, now)).toBe('remove');
  });
  it('does not remove a newer trip when the same driver has an old completion', () => {
    expect(trackingAction({ id: 11, recorded_at: null }, { ...payload, status: 'COMPLETED' }, true, null, now)).toBe('ignore');
  });
  it('ignores retained unknown departures and old non-retained departures', () => {
    expect(trackingAction(undefined, payload, true, null, now)).toBe('ignore');
    expect(trackingAction(undefined, { ...payload, recorded_at: '2026-08-06T00:00:00Z' }, false, null, now)).toBe('ignore');
  });
  it('accepts retained positions for trips confirmed active by the API', () => {
    expect(trackingAction({ id: 10, recorded_at: null }, payload, true, null, now)).toBe('update');
  });
  it('allows a fresh new live departure without refetching the database', () => {
    expect(trackingAction(undefined, payload, false, null, now)).toBe('update');
  });
  it('keeps an older departure from resurrecting a completed trip', () => {
    expect(trackingAction(undefined, payload, false, '2026-09-06T10:00:00Z', now)).toBe('ignore');
  });
});
