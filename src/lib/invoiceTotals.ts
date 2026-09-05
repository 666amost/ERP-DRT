/** Shared by the editor and print view; amounts follow the existing invoice formula. */
export function invoiceTotals(subtotal: number, discount: number, pphPercent: number) {
  const discountedSubtotal = Math.max(0, subtotal - (discount || 0));
  const pph = discountedSubtotal * (pphPercent / 100);
  return { subtotal, discount: subtotal - discountedSubtotal, discountedSubtotal, pph, total: Math.max(0, discountedSubtotal - pph) };
}
