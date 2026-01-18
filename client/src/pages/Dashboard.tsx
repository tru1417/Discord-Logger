import { useStats } from "@/hooks/use-dashboard";
import { Layout } from "@/components/Layout";
import { StatsCard } from "@/components/StatsCard";
import { ShieldAlert, ScrollText, Users, Activity, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { CaseBadge } from "@/components/CaseBadge";
import { Log } from "@shared/schema";

export default function Dashboard() {
  const { data: stats, isLoading, error } = useStats();

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
    return (
      <Layout>
        <div className="flex h-[80vh] items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (error || !stats) {
    return (
      <Layout>
        <div className="text-center text-red-400 p-8 bg-red-500/5 rounded-xl border border-red-500/20">
          Failed to load dashboard statistics.
        </div>
      </Layout>
    );
  }

  return (
    <Layout header={<h2 className="text-xl font-bold text-white">Overview</h2>}>
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-8"
      >
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div variants={item}>
            <StatsCard 
              title="Total Logs" 
              value={stats.totalLogs.toLocaleString()} 
              icon={ScrollText}
              color="primary"
            />
          </motion.div>
          <motion.div variants={item}>
            <StatsCard 
              title="Total Cases" 
              value={stats.totalCases.toLocaleString()} 
              icon={ShieldAlert} 
              color="destructive"
            />
          </motion.div>
          <motion.div variants={item}>
            <StatsCard 
              title="Active Members" 
              value="1,240" 
              icon={Users} 
              color="success"
              trend="+12%"
              trendUp={true}
            />
          </motion.div>
          <motion.div variants={item}>
            <StatsCard 
              title="Server Activity" 
              value="High" 
              icon={Activity} 
              color="warning"
            />
          </motion.div>
        </div>

        {/* Recent Activity Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Logs - Takes up 2/3 */}
          <motion.div variants={item} className="lg:col-span-2 bg-[#2f3136] rounded-xl border border-[#202225] overflow-hidden shadow-lg">
            <div className="p-6 border-b border-[#202225] flex justify-between items-center">
              <h3 className="font-bold text-white flex items-center gap-2">
                <ScrollText className="w-5 h-5 text-primary" />
                Recent Logs
              </h3>
              <Link href="/logs" className="text-xs text-primary hover:underline flex items-center gap-1">
                View All <ExternalLink size={12} />
              </Link>
            </div>
            <div className="divide-y divide-[#202225]">
              {stats.recentActivity.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No recent activity</div>
              ) : (
                stats.recentActivity.map((log: Log) => (
                  <div key={log.id} className="p-4 hover:bg-[#36393f] transition-colors flex items-start gap-4">
                    <div className="w-2 h-2 mt-2 rounded-full shrink-0" 
                      style={{ 
                        backgroundColor: log.type === 'error' ? '#ED4245' : 
                                       log.type === 'automod' ? '#FEE75C' : '#5865F2' 
                      }} 
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-[#202225] text-muted-foreground">
                          {log.type}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300 truncate font-medium">{log.content}</p>
                      {log.username && (
                        <p className="text-xs text-muted-foreground mt-1">User: <span className="text-primary">{log.username}</span></p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>

          {/* Quick Actions / Info - Takes up 1/3 */}
          <motion.div variants={item} className="bg-[#2f3136] rounded-xl border border-[#202225] p-6 shadow-lg">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-400" />
              Latest Actions
            </h3>
            <div className="space-y-4">
              {/* Mock data for recent moderation actions since the stats API aggregates logs */}
              <div className="bg-[#36393f] p-3 rounded-lg border border-[#202225]">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm font-bold text-white">Spamming in #general</span>
                  <CaseBadge type="warn" />
                </div>
                <div className="text-xs text-muted-foreground">
                  Mod: <span className="text-primary">AdminBot</span>
                </div>
              </div>

              <div className="bg-[#36393f] p-3 rounded-lg border border-[#202225]">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm font-bold text-white">Inappropriate content</span>
                  <CaseBadge type="ban" />
                </div>
                <div className="text-xs text-muted-foreground">
                  Mod: <span className="text-primary">Moderator1</span>
                </div>
              </div>
              
              <Link href="/cases" className="block w-full text-center py-2 mt-4 text-sm bg-[#36393f] hover:bg-[#40444b] text-white rounded-md transition-colors border border-[#202225]">
                View All Cases
              </Link>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </Layout>
  );
}
