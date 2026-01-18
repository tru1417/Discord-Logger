import { cn } from "@/lib/utils";

type CaseType = "warn" | "kick" | "ban" | "mute" | "unban" | string;

export function CaseBadge({ type }: { type: CaseType }) {
  const normalizedType = type.toLowerCase();
  
  let styles = "bg-gray-500/10 text-gray-400 border-gray-500/20";
  
  switch (normalizedType) {
    case "warn":
      styles = "bg-[#FEE75C]/10 text-[#FEE75C] border-[#FEE75C]/20";
      break;
    case "kick":
    case "mute":
      styles = "bg-orange-500/10 text-orange-500 border-orange-500/20";
      break;
    case "ban":
      styles = "bg-[#ED4245]/10 text-[#ED4245] border-[#ED4245]/20";
      break;
    case "unban":
      styles = "bg-[#57F287]/10 text-[#57F287] border-[#57F287]/20";
      break;
  }

  return (
    <span className={cn(
      "px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider border",
      styles
    )}>
      {type}
    </span>
  );
}
