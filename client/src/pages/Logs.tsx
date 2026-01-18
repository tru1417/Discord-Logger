import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useLogs } from "@/hooks/use-dashboard";
import { Search, Filter, RefreshCw, Hash } from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function Logs() {
  const [filterType, setFilterType] = useState<string>("");
  const [searchUser, setSearchUser] = useState<string>("");
  
  const { data: logs, isLoading, isRefetching, refetch } = useLogs({
    type: filterType || undefined,
    userId: searchUser || undefined,
    limit: 100,
  });

  const getLogColor = (type: string) => {
    if (type.includes("delete") || type.includes("ban")) return "text-red-400";
    if (type.includes("join") || type.includes("create")) return "text-green-400";
    if (type.includes("update") || type.includes("edit")) return "text-blue-400";
    if (type.includes("warn") || type.includes("automod")) return "text-yellow-400";
    return "text-gray-400";
  };

  return (
    <Layout header={
      <div className="flex justify-between items-center w-full">
        <h2 className="text-xl font-bold text-white">Automation Logs</h2>
        <button 
          onClick={() => refetch()} 
          className={cn(
            "p-2 rounded-full hover:bg-[#40444b] transition-colors text-muted-foreground hover:text-white",
            isRefetching && "animate-spin"
          )}
        >
          <RefreshCw size={20} />
        </button>
      </div>
    }>
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 bg-[#2f3136] p-4 rounded-xl border border-[#202225] shadow-lg">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input 
              type="text" 
              placeholder="Filter by User ID..." 
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
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
              <option value="">All Event Types</option>
              <option value="message_delete">Message Deleted</option>
              <option value="member_join">Member Join</option>
              <option value="member_leave">Member Leave</option>
              <option value="automod">AutoMod</option>
              <option value="error">Errors</option>
            </select>
          </div>
        </div>

        {/* Logs List */}
        <div className="bg-[#2f3136] rounded-xl border border-[#202225] overflow-hidden shadow-lg min-h-[500px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !logs || logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Hash size={48} className="mb-4 opacity-20" />
              <p>No logs found matching your criteria.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#202225]">
              <AnimatePresence initial={false}>
                {logs.map((log) => (
                  <motion.div 
                    key={log.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-4 hover:bg-[#36393f] transition-colors group"
                  >
                    <div className="flex flex-col md:flex-row gap-4 items-start">
                      {/* Timestamp & Type */}
                      <div className="w-full md:w-48 shrink-0 flex md:flex-col gap-2 md:gap-1 items-center md:items-start text-xs font-mono">
                        <span className="text-muted-foreground">
                          {format(new Date(log.timestamp), "MMM dd, HH:mm:ss")}
                        </span>
                        <span className={cn("px-1.5 py-0.5 rounded bg-[#202225] uppercase tracking-wider", getLogColor(log.type))}>
                          {log.type}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-200 leading-relaxed font-mono">
                          {log.content}
                        </div>
                        {log.metadata && (
                          <div className="mt-2 p-2 bg-[#202225] rounded text-xs font-mono text-muted-foreground overflow-x-auto">
                            {JSON.stringify(log.metadata, null, 2)}
                          </div>
                        )}
                      </div>

                      {/* User Info */}
                      {(log.username || log.userId) && (
                        <div className="w-full md:w-48 shrink-0 text-right md:text-left flex flex-row md:flex-col items-center md:items-end justify-between md:justify-start gap-2">
                          <span className="text-sm font-bold text-primary">{log.username || 'Unknown'}</span>
                          <span className="text-xs text-muted-foreground font-mono bg-[#202225] px-1 rounded">
                            ID: {log.userId}
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
