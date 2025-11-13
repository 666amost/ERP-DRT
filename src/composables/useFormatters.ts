export function useFormatters() {
  function formatRupiah(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('id-ID', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  }

  function formatDateLong(iso: string): string {
    return new Date(iso).toLocaleDateString('id-ID', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric' 
    });
  }

  return {
    formatRupiah,
    formatDate,
    formatDateLong
  };
}
