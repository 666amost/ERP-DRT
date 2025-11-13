import { useState } from "react";
import { Add, Download, Filter, Search, View, Printer } from "@carbon/icons-react";

export function DeliveryNotes() {
  const [searchTerm, setSearchTerm] = useState("");

  const deliveryNotesData = [
    { 
      id: "SJ-2024-1578", 
      invoice: "INV-2024-1142",
      client: "PT Maju Jaya", 
      address: "Jl. Sudirman No. 45, Jakarta Selatan",
      driver: "Ahmad Sutanto",
      vehicle: "B 1234 XYZ",
      items: [
        { name: "TV 43 inch", quantity: 50, unit: "Unit" },
        { name: "Speaker Bluetooth", quantity: 100, unit: "Unit" }
      ],
      date: "10 Nov 2024",
      deliveryDate: "12 Nov 2024",
      status: "Delivered",
      statusBg: "bg-[#d1fae5]",
      statusText: "text-[#065f46]"
    },
    { 
      id: "SJ-2024-1577", 
      invoice: "INV-2024-1141",
      client: "CV Sejahtera Abadi", 
      address: "Jl. Asia Afrika No. 128, Bandung",
      driver: "Budi Santoso",
      vehicle: "D 5678 ABC",
      items: [
        { name: "Meja Kantor", quantity: 120, unit: "Unit" }
      ],
      date: "09 Nov 2024",
      deliveryDate: "13 Nov 2024",
      status: "In Transit",
      statusBg: "bg-[#dbeafe]",
      statusText: "text-[#1e40af]"
    },
    { 
      id: "SJ-2024-1576", 
      invoice: "INV-2024-1140",
      client: "PT Global Indonesia", 
      address: "Jl. Basuki Rahmat No. 89, Surabaya",
      driver: "Eko Prasetyo",
      vehicle: "L 9012 DEF",
      items: [
        { name: "Kain Cotton Premium", quantity: 500, unit: "Roll" },
        { name: "Kain Polyester", quantity: 300, unit: "Roll" }
      ],
      date: "08 Nov 2024",
      deliveryDate: "11 Nov 2024",
      status: "Delivered",
      statusBg: "bg-[#d1fae5]",
      statusText: "text-[#065f46]"
    },
    { 
      id: "SJ-2024-1575", 
      invoice: "INV-2024-1139",
      client: "UD Berkah Sejahtera", 
      address: "Jl. Gatot Subroto No. 234, Medan",
      driver: "Fajar Hidayat",
      vehicle: "BK 3456 GHI",
      items: [
        { name: "Komponen Elektronik A", quantity: 300, unit: "Pcs" }
      ],
      date: "05 Nov 2024",
      deliveryDate: "09 Nov 2024",
      status: "Delivered",
      statusBg: "bg-[#d1fae5]",
      statusText: "text-[#065f46]"
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-[#111827]">Surat Jalan</h1>
          <p className="text-[13px] text-[#6b7280] mt-1">Manajemen surat jalan pengiriman</p>
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

      <div className="bg-white rounded-lg border border-[#e5e7eb] shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2.5 bg-[#f9fafb] px-3.5 py-2 rounded-md flex-1 border border-[#e5e7eb]">
            <Search size={17} className="text-[#9ca3af]" />
            <input
              type="text"
              placeholder="Cari surat jalan, client, atau invoice..."
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

      <div className="space-y-4">
        {deliveryNotesData.map((note) => (
          <div key={note.id} className="bg-white rounded-lg border border-[#e5e7eb] shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[#e5e7eb]">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-[#111827] text-[15px]">{note.id}</h3>
                    <span className="text-[11px] text-[#6b7280] px-2.5 py-1 bg-[#f3f4f6] rounded">
                      Ref: {note.invoice}
                    </span>
                    <span className={`text-[11px] px-2.5 py-1 rounded ${note.statusBg} ${note.statusText}`}>
                      {note.status}
                    </span>
                  </div>
                  <div className="text-[13px] text-[#111827] mt-2">{note.client}</div>
                  <div className="text-[12px] text-[#6b7280] mt-0.5">{note.address}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-2 px-3 py-1.5 border border-[#d1d5db] rounded-md text-[12px] text-[#374151] hover:bg-[#f9fafb] transition-colors">
                    <View size={15} />
                    <span className="hidden sm:inline">Lihat</span>
                  </button>
                  <button className="flex items-center gap-2 px-3 py-1.5 border border-[#d1d5db] rounded-md text-[12px] text-[#374151] hover:bg-[#f9fafb] transition-colors">
                    <Printer size={15} />
                    <span className="hidden sm:inline">Cetak</span>
                  </button>
                </div>
              </div>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <div className="text-[12px] text-[#6b7280]">Tanggal Surat Jalan</div>
                  <div className="text-[13px] text-[#111827] mt-1">{note.date}</div>
                </div>
                <div>
                  <div className="text-[12px] text-[#6b7280]">Tanggal Pengiriman</div>
                  <div className="text-[13px] text-[#111827] mt-1">{note.deliveryDate}</div>
                </div>
                <div>
                  <div className="text-[12px] text-[#6b7280]">Pengemudi</div>
                  <div className="text-[13px] text-[#111827] mt-1">{note.driver}</div>
                </div>
                <div>
                  <div className="text-[12px] text-[#6b7280]">Kendaraan</div>
                  <div className="text-[13px] text-[#111827] mt-1">{note.vehicle}</div>
                </div>
              </div>

              <div className="border border-[#e5e7eb] rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-[#f9fafb]">
                    <tr>
                      <th className="text-left py-2 px-4 text-[12px] text-[#6b7280]">Item</th>
                      <th className="text-left py-2 px-4 text-[12px] text-[#6b7280]">Quantity</th>
                      <th className="text-left py-2 px-4 text-[12px] text-[#6b7280]">Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {note.items.map((item, index) => (
                      <tr key={index} className="border-t border-[#e5e7eb]">
                        <td className="py-2 px-4 text-[13px] text-[#111827]">{item.name}</td>
                        <td className="py-2 px-4 text-[13px] text-[#111827]">{item.quantity}</td>
                        <td className="py-2 px-4 text-[13px] text-[#6b7280]">{item.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
