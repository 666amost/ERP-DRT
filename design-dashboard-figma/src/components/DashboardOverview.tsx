import { DeliveryTruck, Receipt, DocumentMultiple_01, Catalog, ArrowUp, ArrowDown } from "@carbon/icons-react";

export function DashboardOverview() {
  const stats = [
    {
      title: "Barang Keluar Hari Ini",
      value: "234",
      change: "+12.5%",
      trend: "up",
      icon: Catalog,
      bgColor: "bg-[#dbeafe]",
      iconColor: "text-[#1e40af]",
    },
    {
      title: "Pengiriman Aktif",
      value: "48",
      change: "+8.2%",
      trend: "up",
      icon: DeliveryTruck,
      bgColor: "bg-[#d1fae5]",
      iconColor: "text-[#065f46]",
    },
    {
      title: "Invoice Pending",
      value: "127",
      change: "-3.1%",
      trend: "down",
      icon: Receipt,
      bgColor: "bg-[#fef3c7]",
      iconColor: "text-[#92400e]",
    },
    {
      title: "Surat Jalan",
      value: "189",
      change: "+15.8%",
      trend: "up",
      icon: DocumentMultiple_01,
      bgColor: "bg-[#e9d5ff]",
      iconColor: "text-[#6b21a8]",
    },
  ];

  const recentDeliveries = [
    { id: "TRK-001", driver: "Ahmad Sutanto", route: "Jakarta - Surabaya", status: "Dalam Perjalanan", progress: 65, statusBg: "bg-[#dbeafe]", statusText: "text-[#1e40af]" },
    { id: "TRK-002", driver: "Budi Santoso", route: "Bandung - Semarang", status: "Dalam Perjalanan", progress: 42, statusBg: "bg-[#dbeafe]", statusText: "text-[#1e40af]" },
    { id: "TRK-003", driver: "Candra Wijaya", route: "Jakarta - Medan", status: "Loading", progress: 15, statusBg: "bg-[#fef3c7]", statusText: "text-[#92400e]" },
    { id: "TRK-004", driver: "Dedi Kurniawan", route: "Surabaya - Bali", status: "Selesai", progress: 100, statusBg: "bg-[#d1fae5]", statusText: "text-[#065f46]" },
  ];

  const recentInvoices = [
    { id: "INV-2024-1142", client: "PT Maju Jaya", amount: "Rp 45.500.000", status: "Paid", date: "10 Nov 2024", statusBg: "bg-[#d1fae5]", statusText: "text-[#065f46]" },
    { id: "INV-2024-1141", client: "CV Sejahtera", amount: "Rp 28.750.000", status: "Pending", date: "09 Nov 2024", statusBg: "bg-[#fef3c7]", statusText: "text-[#92400e]" },
    { id: "INV-2024-1140", client: "PT Global Indo", amount: "Rp 67.200.000", status: "Paid", date: "08 Nov 2024", statusBg: "bg-[#d1fae5]", statusText: "text-[#065f46]" },
    { id: "INV-2024-1139", client: "UD Berkah", amount: "Rp 15.400.000", status: "Overdue", date: "05 Nov 2024", statusBg: "bg-[#fee2e2]", statusText: "text-[#991b1b]" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[#111827]">Dashboard</h1>
        <p className="text-[13px] text-[#6b7280] mt-1">Monitoring operasi dan statistik harian</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const TrendIcon = stat.trend === "up" ? ArrowUp : ArrowDown;
          
          return (
            <div key={stat.title} className="bg-white rounded-lg p-5 border border-[#e5e7eb] shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="text-[13px] text-[#6b7280]">{stat.title}</div>
                  <div className="mt-2.5 text-[#111827]">{stat.value}</div>
                  <div className="flex items-center gap-1.5 mt-2.5">
                    <TrendIcon size={13} className={stat.trend === "up" ? "text-[#059669]" : "text-[#dc2626]"} />
                    <span className={`text-[12px] ${stat.trend === "up" ? "text-[#059669]" : "text-[#dc2626]"}`}>
                      {stat.change}
                    </span>
                    <span className="text-[12px] text-[#9ca3af]">vs bulan lalu</span>
                  </div>
                </div>
                <div className={`p-2.5 rounded-lg ${stat.bgColor}`}>
                  <Icon size={19} className={stat.iconColor} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-lg border border-[#e5e7eb] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#e5e7eb]">
            <h3 className="text-[#111827] text-[15px]">Tracking Pengiriman Terkini</h3>
          </div>
          <div className="p-5">
            <div className="space-y-4">
              {recentDeliveries.map((delivery, idx) => (
                <div key={delivery.id} className={`pb-4 ${idx !== recentDeliveries.length - 1 ? 'border-b border-[#f3f4f6]' : ''}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-[13px] text-[#111827]">{delivery.id}</div>
                      <div className="text-[12px] text-[#6b7280] mt-0.5">{delivery.driver}</div>
                    </div>
                    <span className={`text-[11px] px-2.5 py-1 rounded ${delivery.statusBg} ${delivery.statusText}`}>
                      {delivery.status}
                    </span>
                  </div>
                  <div className="text-[12px] text-[#6b7280] mb-2.5">{delivery.route}</div>
                  <div className="w-full bg-[#f3f4f6] rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-[#3b82f6] h-1.5 transition-all duration-300"
                      style={{ width: `${delivery.progress}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-[#e5e7eb] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#e5e7eb]">
            <h3 className="text-[#111827] text-[15px]">Invoice Terbaru</h3>
          </div>
          <div className="p-5">
            <div className="space-y-4">
              {recentInvoices.map((invoice, idx) => (
                <div key={invoice.id} className={`flex items-center justify-between pb-4 ${idx !== recentInvoices.length - 1 ? 'border-b border-[#f3f4f6]' : ''}`}>
                  <div className="flex-1">
                    <div className="text-[13px] text-[#111827]">{invoice.id}</div>
                    <div className="text-[12px] text-[#6b7280] mt-0.5">{invoice.client}</div>
                    <div className="text-[11px] text-[#9ca3af] mt-0.5">{invoice.date}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[13px] text-[#111827]">{invoice.amount}</div>
                    <span className={`text-[11px] px-2.5 py-1 rounded inline-block mt-1 ${invoice.statusBg} ${invoice.statusText}`}>
                      {invoice.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
