export type TrackingPayload = {
  schema_version: 1;
  tracking_account_id: number;
  dbl_id: number;
  dbl_number: string;
  driver_name: string | null;
  vehicle_plate: string | null;
  origin: string | null;
  destination: string | null;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  speed_kph: number | null;
  status: 'DEPARTED' | 'COMPLETED';
  recorded_at: string;
};

export function parseTrackingPayload(raw: string, now = Date.now()): TrackingPayload | null {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const status = data.status;
    const recordedAt = String(data.recorded_at || '');
    const recordedMillis = Date.parse(recordedAt);
    const lat = Number(data.lat);
    const lng = Number(data.lng);
    if (Number(data.schema_version) !== 1) return null;
    if (!Number.isInteger(Number(data.tracking_account_id)) || Number(data.tracking_account_id) <= 0) return null;
    if (!Number.isInteger(Number(data.dbl_id)) || Number(data.dbl_id) <= 0) return null;
    if (!String(data.dbl_number || '').trim()) return null;
    if (status !== 'DEPARTED' && status !== 'COMPLETED') return null;
    if (!Number.isFinite(recordedMillis) || recordedMillis > now + 5 * 60 * 1000) return null;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return {
      schema_version: 1,
      tracking_account_id: Number(data.tracking_account_id),
      dbl_id: Number(data.dbl_id),
      dbl_number: String(data.dbl_number).trim(),
      driver_name: data.driver_name == null ? null : String(data.driver_name),
      vehicle_plate: data.vehicle_plate == null ? null : String(data.vehicle_plate),
      origin: data.origin == null ? null : String(data.origin),
      destination: data.destination == null ? null : String(data.destination),
      lat,
      lng,
      accuracy_m: Number.isFinite(Number(data.accuracy_m)) ? Number(data.accuracy_m) : null,
      speed_kph: Number.isFinite(Number(data.speed_kph)) ? Number(data.speed_kph) : null,
      status,
      recorded_at: recordedAt
    };
  } catch {
    return null;
  }
}

export function accountIdFromTopic(subscription: string, topic: string): number | null {
  if (!subscription.endsWith('/+')) return null;
  const prefix = subscription.slice(0, -1);
  if (!topic.startsWith(prefix)) return null;
  const suffix = topic.slice(prefix.length);
  if (!/^\d+$/.test(suffix)) return null;
  const accountId = Number(suffix);
  return Number.isSafeInteger(accountId) && accountId > 0 ? accountId : null;
}

export function isNewerTrackingPayload(previousRecordedAt: string | null, incomingRecordedAt: string): boolean {
  if (!previousRecordedAt) return true;
  return Date.parse(incomingRecordedAt) > Date.parse(previousRecordedAt);
}
