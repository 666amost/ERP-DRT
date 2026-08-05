import { describe, expect, it } from 'vitest';
import { getBearerToken } from '../api/_lib/auth';
import {
  accountIdFromTopic,
  isNewerTrackingPayload,
  parseTrackingPayload
} from '../src/lib/trackingPayload';

const validPayload = {
  schema_version: 1,
  tracking_account_id: 7,
  dbl_id: 562,
  dbl_number: 'DBL A530',
  driver_name: 'BUDI',
  vehicle_plate: 'AB 8073 BB',
  origin: 'Jakarta',
  destination: 'Denpasar-Bali',
  lat: -6.123456,
  lng: 106.123456,
  accuracy_m: 18,
  speed_kph: 42,
  status: 'DEPARTED',
  recorded_at: '2026-08-06T10:30:00Z'
};

describe('driver tracking contract', () => {
  it('accepts the documented payload and keeps DBL driver identity', () => {
    const parsed = parseTrackingPayload(JSON.stringify(validPayload), Date.parse('2026-08-06T10:31:00Z'));
    expect(parsed?.driver_name).toBe('BUDI');
    expect(parsed?.tracking_account_id).toBe(7);
  });

  it('rejects invalid coordinates and future timestamps', () => {
    expect(parseTrackingPayload(JSON.stringify({ ...validPayload, lat: 91 }))).toBeNull();
    expect(parseTrackingPayload(
      JSON.stringify({ ...validPayload, recorded_at: '2026-08-06T11:00:00Z' }),
      Date.parse('2026-08-06T10:30:00Z')
    )).toBeNull();
  });

  it('accepts only a direct numeric account topic and ignores old updates', () => {
    const subscription = 'sumbertrans/tracking/driver/+';
    expect(accountIdFromTopic(subscription, 'sumbertrans/tracking/driver/7')).toBe(7);
    expect(accountIdFromTopic(subscription, 'sumbertrans/tracking/driver/7/foreign')).toBeNull();
    expect(accountIdFromTopic(subscription, 'other/tracking/driver/7')).toBeNull();
    expect(isNewerTrackingPayload('2026-08-06T10:31:00Z', '2026-08-06T10:30:00Z')).toBe(false);
  });

  it('parses bearer UUID without accepting another auth scheme', () => {
    const request = { headers: { authorization: 'Bearer 123e4567-e89b-12d3-a456-426614174000' } } as any;
    expect(getBearerToken(request)).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(getBearerToken({ headers: { authorization: 'Basic abc' } } as any)).toBeNull();
  });
});
