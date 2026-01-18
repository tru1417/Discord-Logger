import { useCases } from "@/hooks/use-data";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Gavel, AlertCircle, Ban, UserX } from "lucide-react";
import { useState } from "react";

export default function Cases() {
  const [filter, setFilter] = useState("all");
  const { data: cases, isLoading } = useCases({ type: filter === "all" ? undefined : filter });

  const getCaseIcon = (type: string) => {
    switch(type) {
      case 'ban': return <Ban className="text-red-500" />;
      case 'kick': return <UserX className="text-orange-500" />;
      case 'warn': return <AlertCircle className="text-yellow-500" />;
      default: return <Gavel className="text-blue-500" />;
    }
  };

  const getBorderColor = (type: string) => {
    switch(type) {
      case 'ban': return 'border-l-red-500';
      case 'kick': return 'border-l-orange-500';
      case 'warn': return 'border-l-yellow-500';
      default: return 'border-l-blue-500';
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <PageHeader 
        title="Moderation Cases" 
        description="Active and past disciplinary actions taken against users."
      />

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {['all', 'warn', 'kick', 'ban'].map(type => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wide transition-all",
              filter === type 
                ? "bg-[#5865F2] text-white shadow-lg shadow-[#5865F2]/20" 
                : "bg-[#2f3136] text-gray-400 hover:bg-[#36393f] hover:text-gray-200"
            )}
          >
            {type}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-48 bg-[#2f3136] rounded-lg animate-pulse"></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cases?.map((c) => (
            <div 
              key={c.id} 
              className={cn(
                "discord-card group hover:-translate-y-1 transition-transform border-l-4",
                getBorderColor(c.type)
              )}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#202225] rounded-full border border-[#18191c]">
                    {getCaseIcon(c.type)}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg capitalize">{c.type}</h3>
                    <span className="text-xs text-gray-500 font-mono">Case #{c.id}</span>
                  </div>
                </div>
                <div className="text-xs text-gray-500 bg-[#202225] px-2 py-1 rounded">
                  {format(new Date(c.timestamp), "MMM d, yyyy")}
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-[#202225] p-3 rounded border border-[#18191c]/50">
                  <span className="text-xs font-bold text-gray-500 uppercase block mb-1">Target User</span>
                  <div className="flex items-center">
                    <div className="w-5 h-5 bg-gray-600 rounded-full mr-2"></div>
                    <span className="text-gray-200 font-medium">{c.targetName}</span>
                  </div>
                </div>

                <div className="bg-[#202225] p-3 rounded border border-[#18191c]/50">
                  <span className="text-xs font-bold text-gray-500 uppercase block mb-1">Reason</span>
                  <p className="text-sm text-gray-300 italic">"{c.reason || 'No reason provided'}"</p>
                </div>

                <div className="pt-2 flex items-center justify-between text-xs text-gray-500 border-t border-[#202225]">
                  <span>Moderator: <span className="text-gray-400">{c.moderatorName}</span></span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded uppercase font-bold text-[10px]",
                    c.active ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"
                  )}>
                    {c.active ? 'Active' : 'Resolved'}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {cases?.length === 0 && (
            <div className="col-span-full py-12 text-center text-gray-500 bg-[#2f3136] rounded-lg border border-dashed border-gray-700">
              <Gavel size={48} className="mx-auto mb-4 opacity-20" />
              <h3 className="text-lg font-medium text-gray-400">No cases found</h3>
              <p>Everything looks quiet on the moderation front.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
