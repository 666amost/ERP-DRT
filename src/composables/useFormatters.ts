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
    const wibDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const year = wibDate.getFullYear();
    const month = String(wibDate.getMonth() + 1).padStart(2, '0');
    const day = String(wibDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
