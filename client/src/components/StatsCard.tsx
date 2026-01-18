import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: string;
  color?: "blue" | "green" | "red" | "orange";
}

export function StatsCard({ title, value, icon, trend, color = "blue" }: StatsCardProps) {
  const colorMap = {
    blue: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    green: "bg-green-500/10 text-green-500 border-green-500/20",
    red: "bg-red-500/10 text-red-500 border-red-500/20",
    orange: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="discord-card relative overflow-hidden group"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-400 mb-1">{title}</p>
          <h3 className="text-3xl font-extrabold text-white">{value}</h3>
          {trend && (
            <p className="text-xs text-gray-500 mt-2 flex items-center">
              <span className="text-green-400 font-medium mr-1">{trend}</span> vs last week
            </p>
          )}
        </div>
        <div className={cn("p-3 rounded-lg border backdrop-blur-sm transition-transform group-hover:scale-110", colorMap[color])}>
          {icon}
        </div>
      </div>
      
      {/* Decorative gradient blob */}
      <div className={cn(
        "absolute -bottom-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20 pointer-events-none transition-opacity group-hover:opacity-30",
        color === "blue" && "bg-blue-500",
        color === "green" && "bg-green-500",
        color === "red" && "bg-red-500",
        color === "orange" && "bg-orange-500",
      )} />
    </motion.div>
  );
}
