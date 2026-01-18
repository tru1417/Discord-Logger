import { useLogs } from "@/hooks/use-logs";
import { PageHeader } from "@/components/PageHeader";
import { format } from "date-fns";
import { Search } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { motion } from "framer-motion";

export default function Logs() {
  const [search, setSearch] = useState("");
  const { data: logs, isLoading } = useLogs();

  const filteredLogs = logs?.filter(log => 
    log.content.toLowerCase().includes(search.toLowerCase()) || 
    log.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader title="Audit Logs" description="Complete history of server events and actions.">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#72767d]" />
          <input 
            type="text" 
            placeholder="Search logs..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-[#202225] border border-[#202225] text-white pl-10 pr-4 py-2 rounded-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-64 transition-all"
          />
        </div>
      </PageHeader>

      <div className="bg-[#2f3136] rounded-xl border border-[#202225] overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#202225] border-b border-[#18191c]">
                <th className="px-6 py-4 text-xs font-bold text-[#b9bbbe] uppercase tracking-wider">Timestamp</th>
                <th className="px-6 py-4 text-xs font-bold text-[#b9bbbe] uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-xs font-bold text-[#b9bbbe] uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-xs font-bold text-[#b9bbbe] uppercase tracking-wider">Content</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#202225]">
              {isLoading ? (
                <tr><td colSpan={4} className="p-8 text-center text-[#72767d]">Loading logs...</td></tr>
              ) : filteredLogs?.map((log, i) => (
                <motion.tr 
                  key={log.id} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="hover:bg-[#36393f] transition-colors"
                >
                  <td className="px-6 py-4 text-sm text-[#72767d] font-mono whitespace-nowrap">
                    {format(new Date(log.timestamp), "MMM d, HH:mm:ss")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant={
                      log.type.includes("delete") ? "warning" :
                      log.type.includes("ban") ? "danger" :
                      "primary"
                    }>
                      {log.type.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-sm text-white font-medium whitespace-nowrap">
                    {log.username}
                    <span className="text-xs text-[#72767d] ml-2 block font-mono">{log.userId}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-[#dcddde] max-w-md truncate" title={log.content}>
                    {log.content}
                  </td>
                </motion.tr>
              ))}
              {filteredLogs?.length === 0 && (
                <tr><td colSpan={4} className="p-8 text-center text-[#72767d]">No logs found matching your search.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
