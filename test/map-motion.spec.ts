import { describe, expect, it } from 'vitest';
import { bearingBetween, interpolatePoint, shortestRotation } from '../src/lib/mapMotion';

describe('tracking marker motion', () => {
  it('calculates cardinal bearings for a north-facing truck icon', () => {
    expect(bearingBetween({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(0);
    expect(bearingBetween({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(90);
    expect(bearingBetween({ lat: 0, lng: 0 }, { lat: -1, lng: 0 })).toBeCloseTo(180);
  });

  it('turns through the shortest angle across north', () => {
    expect(shortestRotation(350, 10)).toBe(20);
    expect(shortestRotation(10, 350)).toBe(-20);
  });

  it('interpolates coordinates and clamps progress', () => {
    expect(interpolatePoint({ lat: -6, lng: 106 }, { lat: -7, lng: 108 }, 0.5))
      .toEqual({ lat: -6.5, lng: 107 });
    expect(interpolatePoint({ lat: -6, lng: 106 }, { lat: -7, lng: 108 }, 2))
      .toEqual({ lat: -7, lng: 108 });
  });
});
