import { PageHeader } from "@/components/PageHeader";
import { Save, RefreshCw, Link as LinkIcon, Loader2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useState, useEffect } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function BotSettings() {
  const { toast } = useToast();
  const [inviteLink, setInviteLink] = useState("");

  const { data: inviteSetting, isLoading } = useQuery({
    queryKey: ["/api/settings/discord_invite_link"],
  });

  useEffect(() => {
    if (inviteSetting) {
      setInviteLink(inviteSetting.value);
    }
  }, [inviteSetting]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/settings", {
        key: "discord_invite_link",
        value: inviteLink,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/discord_invite_link"] });
      toast({
        title: "Settings Saved",
        description: "Your Discord invite link has been updated.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message || "Failed to save settings.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <PageHeader 
        title="Bot Settings" 
        description="Configure bot behavior, permissions, and status."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Status Configuration */}
        <div className="discord-card p-6 space-y-6">
          <h3 className="text-xl font-bold text-white border-b border-[#202225] pb-4">General Configuration</h3>
          
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2">
              <LinkIcon size={14} />
              Discord Invite Link
            </label>
            <input 
              type="text" 
              value={inviteLink}
              onChange={(e) => setInviteLink(e.target.value)}
              placeholder="https://discord.gg/..." 
              className="discord-input w-full" 
            />
            <p className="text-xs text-gray-500">The link shown on the dashboard for users to join your server.</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase">Bot Nickname</label>
            <input type="text" defaultValue="AutoMod Bot" className="discord-input w-full" />
          </div>
          
          <div className="pt-4">
            <button 
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="discord-button w-full flex justify-center items-center gap-2 disabled:opacity-50"
            >
              {saveMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Save Changes
            </button>
          </div>
        </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase">Status Message</label>
            <div className="flex gap-2">
              <select className="discord-input w-32">
                <option>Playing</option>
                <option>Watching</option>
                <option>Listening to</option>
              </select>
              <input type="text" defaultValue="Keeping the server safe" className="discord-input flex-1" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase">Log Channel ID</label>
            <input type="text" defaultValue="123456789012345678" className="discord-input w-full font-mono text-sm" />
            <p className="text-xs text-gray-500">Channel where logs will be posted in Discord.</p>
          </div>
          
          <div className="pt-4">
            <button className="discord-button w-full flex justify-center items-center gap-2">
              <Save size={18} />
              Save Changes
            </button>
          </div>
        </div>

        {/* Feature Toggles */}
        <div className="discord-card p-6 space-y-6">
          <h3 className="text-xl font-bold text-white border-b border-[#202225] pb-4">Feature Toggles</h3>
          
          {[
            { label: "Auto-Moderation", desc: "Automatically enforce defined rules", active: true },
            { label: "Welcome Messages", desc: "Greet new members when they join", active: true },
            { label: "Logging", desc: "Record server events to database", active: true },
            { label: "Leveling System", desc: "Track user activity and grant XP", active: false },
          ].map((feature, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 rounded bg-[#202225] border border-[#18191c]">
              <div>
                <div className="font-bold text-gray-200">{feature.label}</div>
                <div className="text-xs text-gray-500">{feature.desc}</div>
              </div>
              <div className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${feature.active ? 'bg-green-500' : 'bg-gray-600'}`}>
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${feature.active ? 'translate-x-6' : 'translate-x-0'}`}></div>
              </div>
            </div>
          ))}

          <div className="mt-8 pt-6 border-t border-[#202225]">
             <h4 className="font-bold text-red-400 mb-2">Danger Zone</h4>
             <button className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 px-4 py-2 rounded w-full flex items-center justify-center gap-2 transition-colors">
               <RefreshCw size={18} />
               Restart Bot Process
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
