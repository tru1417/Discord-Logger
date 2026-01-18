import { useStats } from "@/hooks/use-data";
import { StatsCard } from "@/components/StatsCard";
import { PageHeader } from "@/components/PageHeader";
import { Shield, ScrollText, AlertTriangle, Activity } from "lucide-react";
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer 
} from 'recharts';
import { format } from "date-fns";

export default function Dashboard() {
  const { data: stats, isLoading } = useStats();

  const chartData = [
    { name: 'Mon', logs: 40, cases: 24 },
    { name: 'Tue', logs: 30, cases: 13 },
    { name: 'Wed', logs: 20, cases: 58 },
    { name: 'Thu', logs: 27, cases: 39 },
    { name: 'Fri', logs: 18, cases: 48 },
    { name: 'Sat', logs: 23, cases: 38 },
    { name: 'Sun', logs: 34, cases: 43 },
  ];

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5865F2]"></div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <PageHeader 
        title="Dashboard Overview" 
        description="Real-time server activity and moderation statistics."
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard 
          title="Total Logs" 
          value={stats?.totalLogs || 0} 
          icon={<ScrollText size={24} />}
          color="blue"
          trend="+12%"
        />
        <StatsCard 
          title="Active Cases" 
          value={stats?.totalCases || 0} 
          icon={<Shield size={24} />}
          color="red"
          trend="+5%"
        />
        <StatsCard 
          title="AutoMod Flags" 
          value="12" 
          icon={<AlertTriangle size={24} />}
          color="orange"
          trend="-2%"
        />
        <StatsCard 
          title="Server Health" 
          value="98%" 
          icon={<Activity size={24} />}
          color="green"
        />
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Activity Chart */}
        <div className="lg:col-span-2 discord-card p-6">
          <h3 className="text-lg font-bold text-white mb-6">Activity Volume</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorLogs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5865F2" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#5865F2" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorCases" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ed4245" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ed4245" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="name" 
                  stroke="#72767d" 
                  axisLine={false}
                  tickLine={false}
                  dy={10}
                />
                <YAxis 
                  stroke="#72767d" 
                  axisLine={false}
                  tickLine={false}
                  dx={-10}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#202225', border: 'none', borderRadius: '8px' }}
                  itemStyle={{ color: '#dcddde' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="logs" 
                  stroke="#5865F2" 
                  fillOpacity={1} 
                  fill="url(#colorLogs)" 
                  strokeWidth={2}
                />
                <Area 
                  type="monotone" 
                  dataKey="cases" 
                  stroke="#ed4245" 
                  fillOpacity={1} 
                  fill="url(#colorCases)" 
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="discord-card p-0 overflow-hidden flex flex-col h-[400px] lg:h-auto">
          <div className="p-4 border-b border-[#202225] bg-[#2f3136]">
            <h3 className="text-lg font-bold text-white">Recent Logs</h3>
          </div>
          <div className="overflow-y-auto flex-1 p-2 space-y-2 custom-scrollbar">
            {stats?.recentActivity.map((log) => (
              <div key={log.id} className="p-3 rounded bg-[#202225]/50 hover:bg-[#202225] border border-transparent hover:border-[#18191c] transition-all group">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs font-bold text-[#5865F2] uppercase tracking-wide bg-[#5865F2]/10 px-1.5 py-0.5 rounded">
                    {log.type.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {format(new Date(log.timestamp), "HH:mm")}
                  </span>
                </div>
                <p className="text-sm text-gray-300 line-clamp-2 group-hover:text-white transition-colors">
                  {log.content}
                </p>
                <div className="mt-2 flex items-center text-xs text-gray-500">
                  <div className="w-4 h-4 rounded-full bg-gray-600 mr-2"></div>
                  {log.username}
                </div>
              </div>
            ))}
            {(!stats?.recentActivity || stats.recentActivity.length === 0) && (
              <div className="text-center py-8 text-gray-500">
                No recent activity found.
              </div>
            )}
          </div>
          <div className="p-3 border-t border-[#202225] bg-[#292b2f] text-center">
            <a href="/logs" className="text-xs text-[#5865F2] hover:underline font-medium cursor-pointer">
              View All Activity
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
