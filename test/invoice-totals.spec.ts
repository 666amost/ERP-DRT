import { describe, it, expect } from 'vitest';
import { invoiceTotals } from '../src/lib/invoiceTotals';
describe('invoice totals for form and print', () => {
  it('deducts the invoice discount before PPh', () => {
    expect(invoiceTotals(100000, 10000, 2)).toEqual({ subtotal: 100000, discount: 10000, discountedSubtotal: 90000, pph: 1800, total: 88200 });
  });
  it('keeps an undiscounted invoice unchanged', () => {
    expect(invoiceTotals(100000, 0, 2).total).toBe(98000);
  });
  it('preserves a zero total instead of falling back to the original amount', () => {
    expect(invoiceTotals(100000, 100000, 2).total).toBe(0);
    expect(invoiceTotals(100000, 120000, 2).pph).toBe(0);
  });
});
