import { useState } from "react";
import { useLogs } from "@/hooks/use-data";
import { PageHeader } from "@/components/PageHeader";
import { Search, Filter, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function Logs() {
  const [filterType, setFilterType] = useState("all");
  const [searchUser, setSearchUser] = useState("");
  const { data: logs, isLoading, refetch, isRefetching } = useLogs({ type: filterType, userId: searchUser || undefined });

  // Type badge colors
  const getTypeColor = (type: string) => {
    switch(type) {
      case 'message_delete': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
      case 'member_join': return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'automod': return 'text-red-400 bg-red-400/10 border-red-400/20';
      default: return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <PageHeader 
        title="Audit Logs" 
        description="Comprehensive history of all server events and actions."
        action={
          <button 
            onClick={() => refetch()}
            disabled={isRefetching}
            className="discord-button flex items-center gap-2"
          >
            <RefreshCw size={16} className={cn(isRefetching && "animate-spin")} />
            Refresh
          </button>
        }
      />

      {/* Filters */}
      <div className="discord-card mb-6 p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input 
            type="text" 
            placeholder="Search by User ID..." 
            className="discord-input w-full pl-10"
            value={searchUser}
            onChange={(e) => setSearchUser(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          <Filter size={18} className="text-gray-400 mr-2 flex-shrink-0" />
          {['all', 'message_delete', 'member_join', 'automod'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={cn(
                "px-3 py-1.5 rounded text-sm font-medium transition-colors whitespace-nowrap",
                filterType === type 
                  ? "bg-[#5865F2] text-white" 
                  : "bg-[#202225] text-gray-400 hover:bg-[#292b2f] hover:text-gray-200"
              )}
            >
              {type === 'all' ? 'All Events' : type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table */}
      <div className="discord-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#202225] border-b border-[#18191c]">
                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">User</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-1/2">Content / Details</th>
                <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#202225]">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500">
                    <div className="flex justify-center mb-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5865F2]"></div>
                    </div>
                    Loading logs...
                  </td>
                </tr>
              ) : logs?.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500">
                    No logs found matching your criteria.
                  </td>
                </tr>
              ) : (
                logs?.map((log) => (
                  <tr key={log.id} className="hover:bg-[#32353b] transition-colors group">
                    <td className="p-4">
                      <span className={cn("px-2 py-1 rounded text-xs font-bold border uppercase tracking-wide", getTypeColor(log.type))}>
                        {log.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-gray-600 mr-3 flex-shrink-0"></div>
                        <div>
                          <div className="text-sm font-medium text-gray-200 group-hover:text-white">{log.username || 'Unknown'}</div>
                          <div className="text-xs text-gray-500 font-mono">{log.userId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="text-sm text-gray-300 font-mono bg-[#202225] p-2 rounded border border-[#18191c]">
                        {log.content}
                      </p>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div className="mt-1 text-xs text-gray-500">
                          Meta: {JSON.stringify(log.metadata)}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-right text-sm text-gray-500">
                      {format(new Date(log.timestamp), "MMM d, HH:mm:ss")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
