import { Layout } from "@/components/Layout";
import { Bot, Save, AlertCircle } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

export default function BotSettings() {
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    // Simulate save
    setTimeout(() => setIsSaving(false), 1000);
  };

  return (
    <Layout header={<h2 className="text-xl font-bold text-white">Bot Settings</h2>}>
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Status Card */}
        <div className="bg-[#2f3136] rounded-xl border border-[#202225] p-6 shadow-lg">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white shadow-lg">
              <Bot size={32} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">ModBot v2.4.0</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-sm text-green-400 font-medium">Online & Operational</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#202225] p-4 rounded-lg">
              <p className="text-xs text-muted-foreground uppercase font-bold">Uptime</p>
              <p className="text-xl text-white font-mono mt-1">4d 12h 32m</p>
            </div>
            <div className="bg-[#202225] p-4 rounded-lg">
              <p className="text-xs text-muted-foreground uppercase font-bold">Ping</p>
              <p className="text-xl text-white font-mono mt-1">24ms</p>
            </div>
          </div>
        </div>

        {/* Configuration */}
        <div className="bg-[#2f3136] rounded-xl border border-[#202225] p-6 shadow-lg space-y-6">
          <h3 className="text-lg font-bold text-white border-b border-[#202225] pb-4">Configuration</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">AutoMod Enabled</p>
                <p className="text-sm text-muted-foreground">Automatically filter spam and bad words</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-[#202225] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">Log Message Deletions</p>
                <p className="text-sm text-muted-foreground">Keep a record of deleted messages</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-[#202225] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
              </label>
            </div>

            <div className="pt-4">
              <label className="block text-sm font-medium text-muted-foreground mb-2">Prefix</label>
              <input 
                type="text" 
                defaultValue="!" 
                className="w-full bg-[#202225] text-white px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-mono border border-[#202225]"
              />
            </div>
          </div>

          <div className="pt-6 border-t border-[#202225] flex justify-end">
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={handleSave}
              disabled={isSaving}
              className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-md font-medium flex items-center gap-2 disabled:opacity-50 transition-colors shadow-lg shadow-primary/20"
            >
              <Save size={18} />
              {isSaving ? "Saving..." : "Save Changes"}
            </motion.button>
          </div>
        </div>

        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex gap-3">
          <AlertCircle className="text-yellow-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-yellow-500 font-bold text-sm">Maintenance Mode</h4>
            <p className="text-yellow-500/80 text-sm mt-1">
              Bot restarts are scheduled for every Sunday at 03:00 UTC.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
