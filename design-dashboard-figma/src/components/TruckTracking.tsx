import { Location, Renew, Checkmark, Time } from "@carbon/icons-react";

export function TruckTracking() {
  const trackingData = [
    {
      id: "TRK-001",
      driver: "Ahmad Sutanto",
      phone: "+62 812-3456-7890",
      vehicle: "B 1234 XYZ - Hino Ranger",
      route: "Jakarta - Surabaya",
      currentLocation: "Tol Semarang KM 412",
      progress: 65,
      status: "Dalam Perjalanan",
      statusBg: "bg-[#dbeafe]",
      statusText: "text-[#1e40af]",
      estimatedArrival: "13 Nov 2024, 14:00",
      cargo: "Elektronik - 50 unit TV 43 inch",
      milestones: [
        { location: "Jakarta (Gudang)", time: "12 Nov, 06:00", status: "completed" },
        { location: "Cirebon", time: "12 Nov, 10:30", status: "completed" },
        { location: "Semarang", time: "12 Nov, 15:45", status: "current" },
        { location: "Surabaya (Tujuan)", time: "13 Nov, 14:00", status: "pending" },
      ],
    },
    {
      id: "TRK-002",
      driver: "Budi Santoso",
      phone: "+62 813-4567-8901",
      vehicle: "D 5678 ABC - Mitsubishi Fuso",
      route: "Bandung - Semarang",
      currentLocation: "Tol Cipali KM 156",
      progress: 42,
      status: "Dalam Perjalanan",
      statusBg: "bg-[#dbeafe]",
      statusText: "text-[#1e40af]",
      estimatedArrival: "13 Nov 2024, 18:00",
      cargo: "Furniture - 120 unit Meja Kantor",
      milestones: [
        { location: "Bandung (Gudang)", time: "12 Nov, 08:00", status: "completed" },
        { location: "Cirebon", time: "12 Nov, 13:20", status: "current" },
        { location: "Tegal", time: "13 Nov, 10:00", status: "pending" },
        { location: "Semarang (Tujuan)", time: "13 Nov, 18:00", status: "pending" },
      ],
    },
    {
      id: "TRK-003",
      driver: "Candra Wijaya",
      phone: "+62 814-5678-9012",
      vehicle: "B 9012 DEF - Isuzu Giga",
      route: "Jakarta - Medan",
      currentLocation: "Gudang Jakarta - Loading",
      progress: 15,
      status: "Loading",
      statusBg: "bg-[#fef3c7]",
      statusText: "text-[#92400e]",
      estimatedArrival: "15 Nov 2024, 16:00",
      cargo: "Elektronik - 200 unit Smartphone",
      milestones: [
        { location: "Jakarta (Gudang)", time: "12 Nov, 14:00", status: "current" },
        { location: "Pekanbaru", time: "14 Nov, 08:00", status: "pending" },
        { location: "Medan (Tujuan)", time: "15 Nov, 16:00", status: "pending" },
      ],
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[#111827]">Tracking Pengiriman</h1>
        <p className="text-[13px] text-[#6b7280] mt-1">Monitor real-time posisi dan status pengiriman truck</p>
      </div>

      <div className="space-y-4">
        {trackingData.map((tracking) => (
          <div key={tracking.id} className="bg-white rounded-lg border border-[#e5e7eb] shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[#e5e7eb]">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-[#111827] text-[15px]">{tracking.id}</h3>
                    <span className={`text-[11px] px-2.5 py-1 rounded ${tracking.statusBg} ${tracking.statusText}`}>
                      {tracking.status}
                    </span>
                  </div>
                  <div className="text-[13px] text-[#6b7280] mt-2">{tracking.route}</div>
                </div>
                <div className="text-left lg:text-right">
                  <div className="text-[13px] text-[#111827]">{tracking.driver}</div>
                  <div className="text-[12px] text-[#6b7280] mt-0.5">{tracking.phone}</div>
                  <div className="text-[12px] text-[#6b7280]">{tracking.vehicle}</div>
                </div>
              </div>
            </div>
            <div className="p-5">
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[13px] text-[#6b7280]">Progress Pengiriman</div>
                  <div className="text-[13px] text-[#111827]">{tracking.progress}%</div>
                </div>
                <div className="w-full bg-[#f3f4f6] rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-[#3b82f6] h-2 transition-all duration-300"
                    style={{ width: `${tracking.progress}%` }}
                  ></div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="flex items-start gap-3 p-3.5 bg-[#f9fafb] rounded-lg border border-[#e5e7eb]">
                  <Location size={19} className="text-[#3b82f6] mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-[12px] text-[#6b7280]">Lokasi Saat Ini</div>
                    <div className="text-[13px] text-[#111827] mt-1">{tracking.currentLocation}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3.5 bg-[#f9fafb] rounded-lg border border-[#e5e7eb]">
                  <Time size={19} className="text-[#059669] mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-[12px] text-[#6b7280]">Estimasi Tiba</div>
                    <div className="text-[13px] text-[#111827] mt-1">{tracking.estimatedArrival}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3.5 bg-[#f9fafb] rounded-lg border border-[#e5e7eb]">
                  <Renew size={19} className="text-[#7c3aed] mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-[12px] text-[#6b7280]">Muatan</div>
                    <div className="text-[13px] text-[#111827] mt-1">{tracking.cargo}</div>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[13px] text-[#111827] mb-4">Timeline Perjalanan</div>
                <div className="relative">
                  {tracking.milestones.map((milestone, index) => (
                    <div key={index} className="flex gap-4 pb-6 last:pb-0">
                      <div className="relative flex flex-col items-center">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            milestone.status === "completed"
                              ? "bg-[#d1fae5]"
                              : milestone.status === "current"
                              ? "bg-[#dbeafe]"
                              : "bg-[#f3f4f6]"
                          }`}
                        >
                          {milestone.status === "completed" ? (
                            <Checkmark size={15} className="text-[#065f46]" />
                          ) : milestone.status === "current" ? (
                            <Location size={15} className="text-[#1e40af]" />
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-[#9ca3af]"></div>
                          )}
                        </div>
                        {index < tracking.milestones.length - 1 && (
                          <div className={`w-0.5 h-full ${milestone.status === "completed" ? "bg-[#86efac]" : "bg-[#e5e7eb]"}`}></div>
                        )}
                      </div>
                      <div className="flex-1 pb-2">
                        <div className={`text-[13px] ${milestone.status === "pending" ? "text-[#6b7280]" : "text-[#111827]"}`}>
                          {milestone.location}
                        </div>
                        <div className="text-[12px] text-[#9ca3af] mt-0.5">{milestone.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
