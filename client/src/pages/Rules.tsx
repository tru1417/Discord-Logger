import { useRules, useCreateRule, useDeleteRule } from "@/hooks/use-rules";
import { PageHeader } from "@/components/PageHeader";
import { Plus, Trash2, AlertOctagon } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { motion, AnimatePresence } from "framer-motion";

export default function Rules() {
  const { data: rules, isLoading } = useRules();
  const createRule = useCreateRule();
  const deleteRule = useDeleteRule();

  const [isAdding, setIsAdding] = useState(false);
  const [content, setContent] = useState("");
  const [severity, setSeverity] = useState("warn");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createRule.mutate({ content, severity });
    setIsAdding(false);
    setContent("");
    setSeverity("warn");
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader title="AutoMod Rules" description="AI-powered moderation rules. The bot analyzes messages against these rules.">
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-md font-medium flex items-center gap-2 transition-colors shadow-lg shadow-primary/20"
        >
          <Plus className="w-4 h-4" />
          Add Rule
        </button>
      </PageHeader>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-8 overflow-hidden"
          >
            <form onSubmit={handleSubmit} className="bg-[#2f3136] p-6 rounded-xl border border-[#202225] shadow-lg">
              <h3 className="text-white font-bold mb-4">New Rule Definition</h3>
              <div className="grid gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#b9bbbe] uppercase tracking-wider mb-2">Rule Content</label>
                  <textarea 
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="e.g., Do not share phishing links or suspicious URLs."
                    className="w-full bg-[#202225] border border-[#202225] text-white p-3 rounded-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary h-24 resize-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#b9bbbe] uppercase tracking-wider mb-2">Severity Action</label>
                  <select 
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    className="w-full bg-[#202225] border border-[#202225] text-white p-3 rounded-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  >
                    <option value="warn">Warn User</option>
                    <option value="kick">Kick User</option>
                    <option value="ban">Ban User</option>
                  </select>
                </div>
                <div className="flex justify-end gap-3 mt-2">
                  <button 
                    type="button" 
                    onClick={() => setIsAdding(false)}
                    className="px-4 py-2 text-[#b9bbbe] hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={createRule.isPending}
                    className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-md font-medium transition-colors"
                  >
                    {createRule.isPending ? "Creating..." : "Save Rule"}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center text-[#72767d]">Loading rules...</div>
        ) : rules?.map((rule, i) => (
          <motion.div 
            key={rule.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-[#2f3136] p-6 rounded-xl border border-[#202225] flex items-center justify-between group hover:border-primary/30 transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="mt-1">
                <AlertOctagon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-white font-medium text-lg mb-1">{rule.content}</p>
                <div className="flex gap-2">
                  <Badge variant={rule.severity === 'ban' ? 'danger' : rule.severity === 'kick' ? 'warning' : 'primary'}>
                    Action: {rule.severity.toUpperCase()}
                  </Badge>
                  <span className="text-xs text-[#72767d] self-center">Created {new Date(rule.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => deleteRule.mutate(rule.id)}
              className="p-2 text-[#72767d] hover:text-red-500 hover:bg-red-500/10 rounded-full transition-all opacity-0 group-hover:opacity-100"
              title="Delete Rule"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </motion.div>
        ))}
        {rules?.length === 0 && !isAdding && (
          <div className="text-center py-12 text-[#72767d] bg-[#2f3136] rounded-xl border border-dashed border-[#202225]">
            No rules defined yet. Add one to start moderating!
          </div>
        )}
      </div>
    </div>
  );
}
