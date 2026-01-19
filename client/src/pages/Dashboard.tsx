import { useStats } from "@/hooks/use-stats";
import { StatsCard } from "@/components/StatsCard";
import { PageHeader } from "@/components/PageHeader";
import { MessageSquare, ShieldAlert, Gavel, Clock, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/Badge";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export default function Dashboard() {
  const { data: stats, isLoading } = useStats();
  const { data: inviteLink } = useQuery({
    queryKey: ["/api/settings/discord_invite_link"],
  });

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-[#b9bbbe]">Loading dashboard...</div>;
  }

  return (
    <motion.div 
      className="p-8 max-w-7xl mx-auto"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <PageHeader 
        title="Server Overview" 
        description="Real-time monitoring and moderation statistics."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <motion.div variants={item}>
          <StatsCard 
            title="Total Logs" 
            value={stats?.totalLogs || 0} 
            icon={MessageSquare} 
            trend="+12%" 
          />
        </motion.div>
        <motion.div variants={item}>
          <StatsCard 
            title="Active Cases" 
            value={stats?.totalCases || 0} 
            icon={Gavel} 
            trend="+5%" 
          />
        </motion.div>
        <motion.div variants={item}>
          <StatsCard 
            title="AutoMod Flags" 
            value={14} 
            icon={ShieldAlert} 
            trend="-2%" 
          />
        </motion.div>
        <motion.div variants={item}>
          <StatsCard 
            title="Uptime" 
            value="99.9%" 
            icon={Clock} 
          />
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <motion.div variants={item} className="lg:col-span-2 space-y-8">
          {inviteLink && (
            <div className="bg-primary/10 border border-primary/20 p-6 rounded-xl flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white mb-1">Server Invite Link</h3>
                <p className="text-sm text-gray-400">Share this link to invite users to your Discord server.</p>
              </div>
              <a 
                href={inviteLink.value} 
                target="_blank" 
                rel="noreferrer"
                className="discord-button flex items-center gap-2"
              >
                <ExternalLink size={18} />
                Join Server
              </a>
            </div>
          )}

          <div className="bg-[#2f3136] rounded-xl border border-[#202225] overflow-hidden">
            <div className="p-6 border-b border-[#202225] flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Recent Activity</h3>
              <span className="text-xs text-[#b9bbbe] uppercase tracking-wider font-medium">Live Feed</span>
            </div>
            <div className="divide-y divide-[#202225]">
              {stats?.recentActivity.map((log) => (
                <div key={log.id} className="p-4 flex items-start gap-4 hover:bg-[#36393f] transition-colors">
                  <div className="w-10 h-10 rounded-full bg-[#202225] flex items-center justify-center shrink-0">
                    <span className="text-primary font-mono font-bold text-xs">{log.username.slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-white">{log.username}</span>
                      <span className="text-xs text-[#72767d]">{format(new Date(log.timestamp), "MMM d, h:mm a")}</span>
                    </div>
                    <p className="text-sm text-[#dcddde] truncate">{log.content}</p>
                    <div className="mt-2">
                      <Badge variant="default" className="text-[10px] uppercase">{log.type}</Badge>
                    </div>
                  </div>
                </div>
              ))}
              {(!stats?.recentActivity || stats.recentActivity.length === 0) && (
                <div className="p-8 text-center text-[#72767d]">No recent activity found.</div>
              )}
            </div>
          </div>
        </motion.div>

        <motion.div variants={item} className="bg-[#2f3136] rounded-xl border border-[#202225] p-6">
          <h3 className="text-lg font-bold text-white mb-4">System Status</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-[#202225] rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-medium text-white">Bot Online</span>
              </div>
              <span className="text-xs text-green-500">Stable</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-[#202225] rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium text-white">Database</span>
              </div>
              <span className="text-xs text-green-500">Connected</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-[#202225] rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium text-white">Gateway</span>
              </div>
              <span className="text-xs text-green-500">14ms</span>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
