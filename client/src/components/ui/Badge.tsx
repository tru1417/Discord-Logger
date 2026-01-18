import { cn } from "@/lib/utils";

const variants = {
  default: "bg-[#202225] text-white border-transparent",
  primary: "bg-primary/20 text-primary border-primary/20",
  success: "bg-green-500/20 text-green-400 border-green-500/20",
  warning: "bg-yellow-500/20 text-yellow-400 border-yellow-500/20",
  danger: "bg-red-500/20 text-red-400 border-red-500/20",
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variants;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
