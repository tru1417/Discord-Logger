import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useCases } from "@/hooks/use-dashboard";
import { Search, Filter, ShieldAlert, Gavel, User } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { CaseBadge } from "@/components/CaseBadge";
import { Case } from "@shared/schema";

export default function Cases() {
  const [filterType, setFilterType] = useState<string>("");
  const [targetId, setTargetId] = useState<string>("");
  
  const { data: cases, isLoading } = useCases({
    type: filterType || undefined,
    targetId: targetId || undefined,
  });

  return (
    <Layout header={<h2 className="text-xl font-bold text-white">Moderation Cases</h2>}>
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 bg-[#2f3136] p-4 rounded-xl border border-[#202225] shadow-lg">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search by Target User ID..." 
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full bg-[#202225] text-white pl-10 pr-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-medium"
            />
          </div>
          <div className="relative w-full md:w-64">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <select 
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full bg-[#202225] text-white pl-10 pr-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-medium appearance-none cursor-pointer"
            >
              <option value="">All Types</option>
              <option value="warn">Warn</option>
              <option value="mute">Mute</option>
              <option value="kick">Kick</option>
              <option value="ban">Ban</option>
            </select>
          </div>
        </div>

        {/* Cases Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !cases || cases.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground bg-[#2f3136] rounded-xl border border-[#202225]">
            <Gavel size={48} className="mb-4 opacity-20" />
            <p>No moderation cases found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {cases.map((modCase: Case) => (
              <motion.div 
                key={modCase.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="bg-[#2f3136] rounded-xl border border-[#202225] overflow-hidden shadow-lg group"
              >
                {/* Header */}
                <div className="p-4 border-b border-[#202225] flex justify-between items-start bg-[#202225]/50">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs font-mono">#{modCase.id}</span>
                    <CaseBadge type={modCase.type} />
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    {format(new Date(modCase.timestamp), "MMM dd, yyyy")}
                  </span>
                </div>

                {/* Content */}
                <div className="p-5 space-y-4">
                  {/* Users */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#202225] flex items-center justify-center text-muted-foreground">
                        <User size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white leading-none mb-1">{modCase.targetName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{modCase.targetId}</p>
                      </div>
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="bg-[#202225] rounded-lg p-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 font-bold">Reason</p>
                    <p className="text-sm text-gray-300 italic">
                      "{modCase.reason || 'No reason provided'}"
                    </p>
                  </div>

                  {/* Moderator Footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#202225]/50">
                    <div className="flex items-center gap-2">
                      <ShieldAlert size={14} className="text-primary" />
                      <span className="text-xs text-muted-foreground">
                        Moderator: <span className="text-primary font-medium">{modCase.moderatorName}</span>
                      </span>
                    </div>
                    {modCase.active && (
                      <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" title="Active Case" />
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
