import { useState } from "react";
import { Add, Download, Filter, Search } from "@carbon/icons-react";

export function OutgoingGoods() {
  const [searchTerm, setSearchTerm] = useState("");

  const goodsData = [
    { id: "OUT-2024-1245", product: "Elektronik - TV 43 inch", quantity: 50, destination: "Jakarta", warehouse: "Gudang A", date: "12 Nov 2024", status: "Completed", statusBg: "bg-[#d1fae5]", statusText: "text-[#065f46]" },
    { id: "OUT-2024-1244", product: "Furniture - Meja Kantor", quantity: 120, destination: "Bandung", warehouse: "Gudang B", date: "12 Nov 2024", status: "In Progress", statusBg: "bg-[#dbeafe]", statusText: "text-[#1e40af]" },
    { id: "OUT-2024-1243", product: "Textil - Kain Cotton", quantity: 500, destination: "Surabaya", warehouse: "Gudang C", date: "11 Nov 2024", status: "Completed", statusBg: "bg-[#d1fae5]", statusText: "text-[#065f46]" },
    { id: "OUT-2024-1242", product: "Elektronik - Laptop", quantity: 80, destination: "Medan", warehouse: "Gudang A", date: "11 Nov 2024", status: "Pending", statusBg: "bg-[#fef3c7]", statusText: "text-[#92400e]" },
    { id: "OUT-2024-1241", product: "Spare Parts - Komponen A", quantity: 300, destination: "Semarang", warehouse: "Gudang D", date: "10 Nov 2024", status: "Completed", statusBg: "bg-[#d1fae5]", statusText: "text-[#065f46]" },
    { id: "OUT-2024-1240", product: "Elektronik - Smartphone", quantity: 200, destination: "Yogyakarta", warehouse: "Gudang A", date: "10 Nov 2024", status: "In Progress", statusBg: "bg-[#dbeafe]", statusText: "text-[#1e40af]" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-[#111827]">Barang Keluar</h1>
          <p className="text-[13px] text-[#6b7280] mt-1">Manajemen dan monitoring barang keluar</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3.5 py-2 border border-[#d1d5db] rounded-md text-[13px] text-[#374151] hover:bg-[#f9fafb] transition-colors">
            <Download size={16} />
            <span className="hidden sm:inline">Ekspor Excel</span>
          </button>
          <button className="flex items-center gap-2 px-3.5 py-2 bg-[#3b82f6] rounded-md text-[13px] text-white hover:bg-[#2563eb] transition-colors shadow-sm">
            <Add size={16} />
            <span className="hidden sm:inline">Buat</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#e5e7eb] shadow-sm overflow-hidden">
        <div className="p-4 border-b border-[#e5e7eb]">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2.5 bg-[#f9fafb] px-3.5 py-2 rounded-md flex-1 border border-[#e5e7eb]">
              <Search size={17} className="text-[#9ca3af]" />
              <input
                type="text"
                placeholder="Cari produk, ID, atau tujuan..."
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
                <th className="text-left py-3 px-4 text-[12px] text-[#6b7280]">ID</th>
                <th className="text-left py-3 px-4 text-[12px] text-[#6b7280]">Produk</th>
                <th className="text-left py-3 px-4 text-[12px] text-[#6b7280]">Qty</th>
                <th className="text-left py-3 px-4 text-[12px] text-[#6b7280]">Tujuan</th>
                <th className="text-left py-3 px-4 text-[12px] text-[#6b7280]">Gudang</th>
                <th className="text-left py-3 px-4 text-[12px] text-[#6b7280]">Tanggal</th>
                <th className="text-left py-3 px-4 text-[12px] text-[#6b7280]">Status</th>
              </tr>
            </thead>
            <tbody>
              {goodsData.map((item) => (
                <tr key={item.id} className="border-b border-[#f3f4f6] hover:bg-[#fafafa] transition-colors">
                  <td className="py-3 px-4 text-[13px] text-[#111827]">{item.id}</td>
                  <td className="py-3 px-4 text-[13px] text-[#111827]">{item.product}</td>
                  <td className="py-3 px-4 text-[13px] text-[#111827]">{item.quantity}</td>
                  <td className="py-3 px-4 text-[13px] text-[#111827]">{item.destination}</td>
                  <td className="py-3 px-4 text-[13px] text-[#6b7280]">{item.warehouse}</td>
                  <td className="py-3 px-4 text-[13px] text-[#6b7280]">{item.date}</td>
                  <td className="py-3 px-4">
                    <span className={`text-[11px] px-2.5 py-1 rounded ${item.statusBg} ${item.statusText}`}>
                      {item.status}
                    </span>
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
