import { useState } from "react";
import { Add, Download, Filter, Search, View, Send } from "@carbon/icons-react";

export function Invoices() {
  const [searchTerm, setSearchTerm] = useState("");

  const invoicesData = [
    { id: "INV-2024-1142", client: "PT Maju Jaya", address: "Jakarta Selatan", items: 15, amount: "Rp 45.500.000", status: "Paid", date: "10 Nov 2024", dueDate: "24 Nov 2024", statusBg: "bg-[#d1fae5]", statusText: "text-[#065f46]" },
    { id: "INV-2024-1141", client: "CV Sejahtera Abadi", address: "Bandung", items: 8, amount: "Rp 28.750.000", status: "Pending", date: "09 Nov 2024", dueDate: "23 Nov 2024", statusBg: "bg-[#fef3c7]", statusText: "text-[#92400e]" },
    { id: "INV-2024-1140", client: "PT Global Indonesia", address: "Surabaya", items: 22, amount: "Rp 67.200.000", status: "Paid", date: "08 Nov 2024", dueDate: "22 Nov 2024", statusBg: "bg-[#d1fae5]", statusText: "text-[#065f46]" },
    { id: "INV-2024-1139", client: "UD Berkah Sejahtera", address: "Medan", items: 5, amount: "Rp 15.400.000", status: "Overdue", date: "05 Nov 2024", dueDate: "19 Nov 2024", statusBg: "bg-[#fee2e2]", statusText: "text-[#991b1b]" },
    { id: "INV-2024-1138", client: "PT Sentosa Jaya", address: "Semarang", items: 12, amount: "Rp 38.900.000", status: "Paid", date: "04 Nov 2024", dueDate: "18 Nov 2024", statusBg: "bg-[#d1fae5]", statusText: "text-[#065f46]" },
    { id: "INV-2024-1137", client: "CV Mitra Usaha", address: "Yogyakarta", items: 18, amount: "Rp 52.300.000", status: "Pending", date: "03 Nov 2024", dueDate: "17 Nov 2024", statusBg: "bg-[#fef3c7]", statusText: "text-[#92400e]" },
  ];

  const summaryStats = [
    { label: "Total Invoice", value: "Rp 248.050.000", color: "text-[#111827]" },
    { label: "Paid", value: "Rp 151.600.000", color: "text-[#059669]" },
    { label: "Pending", value: "Rp 81.050.000", color: "text-[#d97706]" },
    { label: "Overdue", value: "Rp 15.400.000", color: "text-[#dc2626]" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-[#111827]">Invoice</h1>
          <p className="text-[13px] text-[#6b7280] mt-1">Manajemen invoice dan pembayaran</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3.5 py-2 border border-[#d1d5db] rounded-md text-[13px] text-[#374151] hover:bg-[#f9fafb] transition-colors">
            <Download size={16} />
            <span className="hidden sm:inline">Ekspor Excel</span>
          </button>
          <button className="flex items-center gap-2 px-3.5 py-2 bg-[#3b82f6] rounded-md text-[13px] text-white hover:bg-[#2563eb] transition-colors shadow-sm">
            <Add size={16} />
            <span className="hidden sm:inline">Buat Invoice</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryStats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-lg p-4 border border-[#e5e7eb] shadow-sm">
            <div className="text-[12px] text-[#6b7280]">{stat.label}</div>
            <div className={`mt-2 ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-[#e5e7eb] shadow-sm overflow-hidden">
        <div className="p-4 border-b border-[#e5e7eb]">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2.5 bg-[#f9fafb] px-3.5 py-2 rounded-md flex-1 border border-[#e5e7eb]">
              <Search size={17} className="text-[#9ca3af]" />
              <input
                type="text"
                placeholder="Cari invoice, client, atau nomor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent outline-none flex-1 text-[13px] text-[#374151] placeholder:text-[#9ca3af]"
              />
            </div>
            <button className="flex items-center gap-2 px-3.5 py-2 border border-[#d1d5db] rounded-md text-[13px] text-[#374151] hover:bg-[#f9fafb] transition-colors">
              <Filter size={16} />
              Filter
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
                <th className="text-left py-3 px-4 text-[12px] text-[#6b7280]">Invoice ID</th>
                <th className="text-left py-3 px-4 text-[12px] text-[#6b7280]">Client</th>
                <th className="text-left py-3 px-4 text-[12px] text-[#6b7280]">Items</th>
                <th className="text-left py-3 px-4 text-[12px] text-[#6b7280]">Amount</th>
                <th className="text-left py-3 px-4 text-[12px] text-[#6b7280]">Tanggal</th>
                <th className="text-left py-3 px-4 text-[12px] text-[#6b7280]">Jatuh Tempo</th>
                <th className="text-left py-3 px-4 text-[12px] text-[#6b7280]">Status</th>
                <th className="text-left py-3 px-4 text-[12px] text-[#6b7280]">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {invoicesData.map((invoice) => (
                <tr key={invoice.id} className="border-b border-[#f3f4f6] hover:bg-[#fafafa] transition-colors">
                  <td className="py-3 px-4 text-[13px] text-[#111827]">{invoice.id}</td>
                  <td className="py-3 px-4">
                    <div className="text-[13px] text-[#111827]">{invoice.client}</div>
                    <div className="text-[12px] text-[#6b7280]">{invoice.address}</div>
                  </td>
                  <td className="py-3 px-4 text-[13px] text-[#111827]">{invoice.items}</td>
                  <td className="py-3 px-4 text-[13px] text-[#111827]">{invoice.amount}</td>
                  <td className="py-3 px-4 text-[13px] text-[#6b7280]">{invoice.date}</td>
                  <td className="py-3 px-4 text-[13px] text-[#6b7280]">{invoice.dueDate}</td>
                  <td className="py-3 px-4">
                    <span className={`text-[11px] px-2.5 py-1 rounded ${invoice.statusBg} ${invoice.statusText}`}>
                      {invoice.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      <button className="h-7 w-7 flex items-center justify-center hover:bg-[#f3f4f6] rounded transition-colors">
                        <View size={15} className="text-[#6b7280]" />
                      </button>
                      <button className="h-7 w-7 flex items-center justify-center hover:bg-[#f3f4f6] rounded transition-colors">
                        <Send size={15} className="text-[#6b7280]" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-[#e5e7eb] flex items-center justify-between">
          <div className="text-[12px] text-[#6b7280]">Menampilkan 1 sampai 6 dari 6 hasil</div>
          <div className="flex items-center gap-2">
            <select className="text-[12px] border border-[#d1d5db] rounded-md px-2 py-1 bg-white text-[#374151] outline-none">
              <option>10</option>
              <option>25</option>
              <option>50</option>
            </select>
            <span className="text-[12px] text-[#6b7280]">per halaman</span>
          </div>
        </div>
      </div>
    </div>
  );
}
