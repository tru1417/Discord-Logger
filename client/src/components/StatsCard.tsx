import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  className?: string;
}

export function StatsCard({ title, value, icon: Icon, trend, className }: StatsCardProps) {
  return (
    <div className={cn(
      "bg-[#2f3136] p-6 rounded-xl border border-[#202225] shadow-lg",
      "hover:border-primary/50 transition-colors duration-300",
      className
    )}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[#b9bbbe] uppercase tracking-wider">{title}</p>
          <h3 className="text-3xl font-bold text-white mt-2">{value}</h3>
        </div>
        <div className="p-3 bg-[#36393f] rounded-lg text-primary">
          <Icon className="w-6 h-6" />
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center text-sm">
          <span className="text-[#3BA55C] font-medium">{trend}</span>
          <span className="text-[#72767d] ml-2">vs last week</span>
        </div>
      )}
    </div>
  );
}
