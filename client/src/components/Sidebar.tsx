import { Link, useLocation } from "wouter";
import { LayoutDashboard, FileText, Gavel, Shield, UserCog, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: FileText, label: "Audit Logs", href: "/logs" },
  { icon: Gavel, label: "Moderation Cases", href: "/cases" },
  { icon: Shield, label: "AutoMod Rules", href: "/rules" },
  { icon: UserCog, label: "Roles & Perms", href: "/roles" },
  { icon: Bot, label: "Settings", href: "/settings" },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="w-64 bg-[#2f3136] flex flex-col h-screen fixed left-0 top-0 border-r border-[#202225]">
      <div className="p-6 flex items-center gap-3">
        <Bot className="w-8 h-8 text-primary" />
        <h1 className="text-xl font-bold font-display tracking-tight text-white">ModBot</h1>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map((item) => (
          <Link key={item.href} href={item.href}>
            <div
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 cursor-pointer group",
                location === item.href
                  ? "bg-[#393c43] text-white"
                  : "text-[#b9bbbe] hover:bg-[#393c43] hover:text-[#dcddde]"
              )}
            >
              <item.icon
                className={cn(
                  "w-5 h-5 transition-colors",
                  location === item.href ? "text-primary" : "group-hover:text-primary"
                )}
              />
              <span className="font-medium">{item.label}</span>
            </div>
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-[#202225]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
            A
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-white">Admin User</span>
            <span className="text-xs text-[#b9bbbe]">Online</span>
          </div>
        </div>
      </div>
    </div>
  );
}
