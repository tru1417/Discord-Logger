import { useCases } from "@/hooks/use-cases";
import { PageHeader } from "@/components/PageHeader";
import { format } from "date-fns";
import { Shield, UserX, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { motion } from "framer-motion";

export default function Cases() {
  const { data: cases, isLoading } = useCases();

  const getIcon = (type: string) => {
    switch (type) {
      case 'ban': return <UserX className="w-5 h-5 text-red-500" />;
      case 'kick': return <Shield className="w-5 h-5 text-orange-500" />;
      default: return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader title="Moderation Cases" description="Track warnings, kicks, and bans issued by moderators and AutoMod." />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full text-center text-[#72767d]">Loading cases...</div>
        ) : cases?.map((c, i) => (
          <motion.div 
            key={c.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="bg-[#2f3136] rounded-xl border border-[#202225] overflow-hidden shadow-md hover:border-primary/50 transition-all duration-300"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#202225] rounded-lg">
                    {getIcon(c.type)}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg">Case #{c.id}</h3>
                    <span className="text-xs text-[#72767d] uppercase font-bold tracking-wider">{c.type}</span>
                  </div>
                </div>
                <Badge variant={c.active ? "danger" : "default"}>
                  {c.active ? "Active" : "Resolved"}
                </Badge>
              </div>

              <div className="space-y-4">
                <div className="bg-[#202225] p-3 rounded-md">
                  <span className="text-xs text-[#72767d] uppercase font-bold block mb-1">Target User</span>
                  <div className="flex justify-between items-center">
                    <span className="text-white font-medium">{c.targetName}</span>
                    <span className="text-xs font-mono text-[#72767d]">{c.targetId}</span>
                  </div>
                </div>

                <div className="bg-[#202225] p-3 rounded-md">
                  <span className="text-xs text-[#72767d] uppercase font-bold block mb-1">Reason</span>
                  <p className="text-sm text-[#dcddde]">{c.reason}</p>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-[#202225]">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] text-primary font-bold">
                      {c.moderatorName.charAt(0)}
                    </div>
                    <span className="text-xs text-[#b9bbbe]">Mod: {c.moderatorName}</span>
                  </div>
                  <span className="text-xs text-[#72767d]">
                    {format(new Date(c.timestamp), "MMM d, yyyy")}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
        {cases?.length === 0 && (
          <div className="col-span-full p-12 text-center border-2 border-dashed border-[#2f3136] rounded-xl">
            <h3 className="text-xl font-bold text-[#72767d]">No cases found</h3>
            <p className="text-[#b9bbbe]">Your server is squeaky clean!</p>
          </div>
        )}
      </div>
    </div>
  );
}
