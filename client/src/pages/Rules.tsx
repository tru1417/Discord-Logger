import { useState } from "react";
import { useRules, useCreateRule, useDeleteRule } from "@/hooks/use-data";
import { PageHeader } from "@/components/PageHeader";
import { Plus, Trash2, ShieldAlert, AlertTriangle, Ban, UserX } from "lucide-react";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
  DialogFooter, DialogDescription 
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { insertRuleSchema } from "@shared/routes";

// Form Schema
const formSchema = insertRuleSchema.extend({
  severity: z.enum(["warn", "kick", "ban"]),
});

type FormValues = z.infer<typeof formSchema>;

export default function Rules() {
  const { data: rules, isLoading } = useRules();
  const createRule = useCreateRule();
  const deleteRule = useDeleteRule();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      content: "",
      severity: "warn",
      enabled: true,
    },
  });

  const onSubmit = (data: FormValues) => {
    createRule.mutate(data, {
      onSuccess: () => {
        setIsDialogOpen(false);
        form.reset();
      }
    });
  };

  const getSeverityBadge = (severity: string) => {
    switch(severity) {
      case 'ban': 
        return <span className="flex items-center text-red-400 bg-red-400/10 px-2 py-0.5 rounded text-xs font-bold uppercase border border-red-400/20"><Ban size={12} className="mr-1"/> Ban</span>;
      case 'kick': 
        return <span className="flex items-center text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded text-xs font-bold uppercase border border-orange-400/20"><UserX size={12} className="mr-1"/> Kick</span>;
      default: 
        return <span className="flex items-center text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded text-xs font-bold uppercase border border-yellow-400/20"><AlertTriangle size={12} className="mr-1"/> Warn</span>;
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <PageHeader 
        title="Rules & AutoMod" 
        description="Define automated actions and community guidelines."
        action={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <button className="discord-button flex items-center gap-2">
                <Plus size={18} />
                Add Rule
              </button>
            </DialogTrigger>
            <DialogContent className="bg-[#36393f] border-[#202225] text-gray-100 sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="text-white">Add New AutoMod Rule</DialogTitle>
                <DialogDescription className="text-gray-400">
                  Define a rule that the bot will automatically enforce.
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Rule Content / Trigger</label>
                  <textarea 
                    {...form.register("content")}
                    className="discord-input w-full h-24 resize-none"
                    placeholder="e.g. No hate speech allowed..."
                  />
                  {form.formState.errors.content && (
                    <p className="text-red-400 text-xs">{form.formState.errors.content.message}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Action Severity</label>
                  <select 
                    {...form.register("severity")}
                    className="discord-input w-full"
                  >
                    <option value="warn">Warn User</option>
                    <option value="kick">Kick User</option>
                    <option value="ban">Ban User</option>
                  </select>
                </div>
                
                <DialogFooter className="mt-6">
                  <button 
                    type="submit" 
                    disabled={createRule.isPending}
                    className="discord-button w-full flex justify-center items-center"
                  >
                    {createRule.isPending ? "Creating..." : "Create Rule"}
                  </button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          <div className="p-12 text-center text-gray-500">Loading rules...</div>
        ) : rules?.length === 0 ? (
          <div className="discord-card flex flex-col items-center justify-center p-12 border-dashed border-gray-700">
            <ShieldAlert size={48} className="text-gray-600 mb-4" />
            <h3 className="text-xl font-bold text-gray-400">No Rules Defined</h3>
            <p className="text-gray-500 mt-2">Create your first rule to start automated moderation.</p>
          </div>
        ) : (
          rules?.map((rule) => (
            <div 
              key={rule.id} 
              className="discord-card flex flex-col md:flex-row md:items-center justify-between group hover:border-[#5865F2]/50 transition-colors"
            >
              <div className="flex-1 mb-4 md:mb-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-gray-500 font-mono text-xs">#{rule.id}</span>
                  {getSeverityBadge(rule.severity)}
                  {!rule.enabled && (
                    <span className="text-xs bg-gray-600/20 text-gray-500 px-2 py-0.5 rounded">Disabled</span>
                  )}
                </div>
                <p className="text-gray-200 font-medium text-lg">{rule.content}</p>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="h-8 w-px bg-[#202225] hidden md:block mx-2"></div>
                <button 
                  onClick={() => deleteRule.mutate(rule.id)}
                  disabled={deleteRule.isPending}
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-500 p-2 rounded transition-colors group-hover:scale-105"
                  title="Delete Rule"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
