import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  className?: string;
  color?: "primary" | "success" | "warning" | "destructive";
}

export function StatsCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  trendUp,
  className,
  color = "primary" 
}: StatsCardProps) {
  
  const colors = {
    primary: "bg-primary/10 text-primary",
    success: "bg-[#57F287]/10 text-[#57F287]",
    warning: "bg-[#FEE75C]/10 text-[#FEE75C]",
    destructive: "bg-[#ED4245]/10 text-[#ED4245]",
  };

  return (
    <div className={cn(
      "bg-[#2f3136] rounded-xl p-6 shadow-lg border border-[#202225] hover:border-primary/50 transition-colors duration-300",
      className
    )}>
      <div className="flex justify-between items-start mb-4">
        <div className={cn("p-3 rounded-lg", colors[color])}>
          <Icon size={24} />
        </div>
        {trend && (
          <span className={cn(
            "text-xs font-medium px-2 py-1 rounded-full",
            trendUp ? "text-[#57F287] bg-[#57F287]/10" : "text-[#ED4245] bg-[#ED4245]/10"
          )}>
            {trend}
          </span>
        )}
      </div>
      <div>
        <h3 className="text-muted-foreground font-medium text-sm uppercase tracking-wide">{title}</h3>
        <p className="text-3xl font-bold text-white mt-1">{value}</p>
      </div>
    </div>
  );
}
