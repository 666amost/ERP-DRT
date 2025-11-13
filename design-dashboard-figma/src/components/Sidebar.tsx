import { Dashboard, DeliveryTruck, DocumentMultiple_01, Receipt, Catalog } from "@carbon/icons-react";

interface SidebarProps {
  currentPage: string;
  setCurrentPage: (page: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export function Sidebar({ currentPage, setCurrentPage, sidebarOpen, setSidebarOpen }: SidebarProps) {
  const menuItems = [
    { id: "dashboard", label: "Dasbor", icon: Dashboard },
    { id: "outgoing", label: "Barang Keluar", icon: Catalog },
    { id: "tracking", label: "Pelacakan", icon: DeliveryTruck },
    { id: "invoices", label: "Invoice", icon: Receipt },
    { id: "delivery", label: "Surat Jalan", icon: DocumentMultiple_01 },
  ];

  const handleMenuClick = (pageId: string) => {
    setCurrentPage(pageId);
    setSidebarOpen(false);
  };

  return (
    <aside
      className={`${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      } fixed lg:relative lg:translate-x-0 z-30 w-64 bg-white border-r border-[#e5e7eb] transition-transform duration-200 h-full flex flex-col`}
    >
      <div className="h-16 px-5 flex items-center border-b border-[#e5e7eb]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-gradient-to-br from-[#3b82f6] to-[#2563eb] rounded-md flex items-center justify-center shadow-sm">
            <span className="text-[11px] text-white tracking-tight">EP</span>
          </div>
          <div>
            <div className="text-[13px] text-[#111827] tracking-tight">Enterprise ERP</div>
            <div className="text-[11px] text-[#6b7280] -mt-0.5">Operations</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 pt-5 pb-3 space-y-0.5 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => handleMenuClick(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition-all duration-150 ${
                isActive
                  ? "bg-[#eff6ff] text-[#1e40af]"
                  : "text-[#4b5563] hover:bg-[#f9fafb]"
              }`}
            >
              <Icon size={18} className={isActive ? "text-[#3b82f6]" : "text-[#9ca3af]"} />
              <span className="text-[13px]">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-[#e5e7eb]">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-[#f9fafb] transition-colors cursor-pointer">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#7c3aed] flex items-center justify-center shadow-sm">
            <span className="text-[11px] text-white">AD</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] text-[#111827] truncate">Admin User</div>
            <div className="text-[11px] text-[#6b7280] truncate -mt-0.5">admin@company.com</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
