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
      year: 'numeric',
      timeZone: 'Asia/Jakarta'
    });
  }

  function formatDateLong(iso: string): string {
    return new Date(iso).toLocaleDateString('id-ID', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric',
      timeZone: 'Asia/Jakarta'
    });
  }

  function toWIBDateString(date: Date = new Date()): string {
    return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  }

  function toWIBMidnight(dateStr: string): Date {
    const parts = dateStr.split('-').map(Number);
    const year = parts[0] || 0;
    const month = parts[1] || 1;
    const day = parts[2] || 1;
    const wibDate = new Date(year, month - 1, day, 0, 0, 0);
    return wibDate;
  }

  return {
    formatRupiah,
    formatDate,
    formatDateLong,
    toWIBDateString,
    toWIBMidnight
  };
}
