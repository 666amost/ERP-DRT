import { isNewerTrackingPayload, type TrackingPayload } from './trackingPayload';
type PreviousTrip = { id: number; recorded_at: string | null };
/** Retained messages may update a known active trip, but cannot create a historical trip. */
export function trackingAction(previous: PreviousTrip | undefined, payload: TrackingPayload, retained: boolean, latest: string | null, now = Date.now()): 'ignore' | 'remove' | 'update' | 'remember' {
  if (!isNewerTrackingPayload(latest || previous?.recorded_at || null, payload.recorded_at)) return 'ignore';
  const sameTrip = previous?.id === payload.dbl_id;
  if (payload.status === 'COMPLETED') {
    if (sameTrip) return 'remove';
    return previous ? 'ignore' : 'remember';
  }
  if (!sameTrip && (retained || now - Date.parse(payload.recorded_at) > 15 * 60 * 1000)) return 'ignore';
  return 'update';
}
