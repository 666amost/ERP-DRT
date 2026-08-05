export type MapPoint = {
  lat: number;
  lng: number;
};

const toRadians = (degrees: number): number => degrees * Math.PI / 180;
const toDegrees = (radians: number): number => radians * 180 / Math.PI;

export function bearingBetween(from: MapPoint, to: MapPoint): number {
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const longitudeDelta = toRadians(to.lng - from.lng);
  const y = Math.sin(longitudeDelta) * Math.cos(toLat);
  const x = Math.cos(fromLat) * Math.sin(toLat)
    - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(longitudeDelta);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

export function shortestRotation(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

export function interpolatePoint(from: MapPoint, to: MapPoint, progress: number): MapPoint {
  const amount = Math.min(1, Math.max(0, progress));
  return {
    lat: from.lat + (to.lat - from.lat) * amount,
    lng: from.lng + (to.lng - from.lng) * amount
  };
}
