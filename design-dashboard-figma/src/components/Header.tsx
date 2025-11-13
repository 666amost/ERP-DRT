import { Menu, Notification, Search } from "@carbon/icons-react";

interface HeaderProps {
  setSidebarOpen: (open: boolean) => void;
}

export function Header({ setSidebarOpen }: HeaderProps) {
  return (
    <header className="h-16 bg-white border-b border-[#e5e7eb] px-5 md:px-7 flex items-center justify-between">
      <div className="flex items-center gap-4 flex-1">
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden p-1.5 hover:bg-[#f3f4f6] rounded-md transition-colors"
        >
          <Menu size={20} className="text-[#374151]" />
        </button>

        <div className="hidden md:flex items-center gap-2.5 bg-[#f9fafb] px-3.5 py-2 rounded-md flex-1 max-w-md border border-[#e5e7eb]">
          <Search size={17} className="text-[#9ca3af]" />
          <input
            type="text"
            placeholder="Cari invoice, surat jalan, tracking..."
            className="bg-transparent outline-none flex-1 text-[13px] text-[#374151] placeholder:text-[#9ca3af]"
          />
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button className="relative p-2 hover:bg-[#f3f4f6] rounded-md transition-colors">
          <Notification size={19} className="text-[#374151]" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-[#ef4444] rounded-full border-2 border-white"></span>
        </button>
      </div>
    </header>
  );
}
