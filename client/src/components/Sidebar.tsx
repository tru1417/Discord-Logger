import { Link, useLocation } from "wouter";
import { LayoutDashboard, ScrollText, ShieldAlert, Bot, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const [location] = useLocation();

  const links = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/logs", label: "Automation Logs", icon: ScrollText },
    { href: "/cases", label: "Moderation Cases", icon: ShieldAlert },
    { href: "/bot", label: "Bot Settings", icon: Bot },
  ];

  return (
    <div className="w-72 bg-[#2f3136] flex flex-col h-screen border-r border-[#202225] shrink-0">
      {/* Header */}
      <div className="p-6 flex items-center gap-3 border-b border-[#202225]">
        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white shadow-md">
          <Bot size={24} />
        </div>
        <div>
          <h1 className="font-bold text-white leading-tight">ModBot</h1>
          <p className="text-xs text-muted-foreground">Admin Dashboard</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {links.map((link) => {
          const isActive = location === link.href;
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href} className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-200 group font-medium text-sm",
              isActive 
                ? "bg-primary/10 text-primary hover:bg-primary/20" 
                : "text-muted-foreground hover:bg-[#36393f] hover:text-white"
            )}>
              <Icon size={20} className={cn(
                "transition-colors",
                isActive ? "text-primary" : "group-hover:text-white"
              )} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-[#202225]">
        <button className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-md transition-colors">
          <LogOut size={20} />
          Logout
        </button>
      </div>
    </div>
  );
}
