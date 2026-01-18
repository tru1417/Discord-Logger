import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  ScrollText, 
  Gavel, 
  Settings, 
  ShieldAlert, 
  Bot 
} from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const [location] = useLocation();

  const navItems = [
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Audit Logs", href: "/logs", icon: ScrollText },
    { label: "Moderation Cases", href: "/cases", icon: Gavel },
    { label: "Rules & AutoMod", href: "/rules", icon: ShieldAlert },
    { label: "Bot Settings", href: "/bot", icon: Bot },
  ];

  return (
    <div className="w-72 bg-[#202225] flex flex-col h-screen fixed left-0 top-0 border-r border-[#18191c]">
      {/* Server Header */}
      <div className="h-16 flex items-center px-4 border-b border-[#18191c] hover:bg-[#2f3136] transition-colors cursor-pointer group">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold mr-3 shadow-lg group-hover:shadow-indigo-500/20 transition-all">
          DS
        </div>
        <div>
          <h2 className="font-bold text-gray-100 group-hover:text-white transition-colors">Discord Server</h2>
          <div className="flex items-center text-xs text-green-400">
            <span className="w-2 h-2 rounded-full bg-green-400 mr-1.5 animate-pulse"></span>
            Online
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        <div className="px-2 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Management
        </div>
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center px-3 py-2.5 rounded-md text-gray-400 hover:text-gray-100 hover:bg-[#34373c] transition-all cursor-pointer group",
                  isActive && "bg-[#393c43] text-white"
                )}
              >
                <item.icon 
                  size={20} 
                  className={cn(
                    "mr-3 transition-colors",
                    isActive ? "text-[#5865F2]" : "text-gray-400 group-hover:text-gray-300"
                  )} 
                />
                <span className="font-medium">{item.label}</span>
                {isActive && (
                  <div className="ml-auto w-1 h-4 rounded-l-full bg-white opacity-10"></div>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* User Footer */}
      <div className="p-3 bg-[#18191c]">
        <div className="flex items-center p-2 rounded hover:bg-[#2f3136] transition-colors cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-gray-600 mr-3 flex items-center justify-center">
            <Settings size={16} className="text-gray-300" />
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="text-sm font-medium text-white truncate">Administrator</div>
            <div className="text-xs text-gray-400 truncate">#0000</div>
          </div>
        </div>
      </div>
    </div>
  );
}
