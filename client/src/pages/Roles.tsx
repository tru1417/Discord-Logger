import { useRoles, useCreateRole, useDeleteRole } from "@/hooks/use-roles";
import { PageHeader } from "@/components/PageHeader";
import { Plus, Trash2, Shield, Settings } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { motion, AnimatePresence } from "framer-motion";

export default function Roles() {
  const { data: roles, isLoading } = useRoles();
  const createRole = useCreateRole();
  const deleteRole = useDeleteRole();

  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    roleId: "",
    roleName: "",
    isAutoRole: false,
    rank: 0,
    permissions: "{}",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      createRole.mutate({
        ...formData,
        permissions: JSON.parse(formData.permissions),
      });
      setIsAdding(false);
      setFormData({ roleId: "", roleName: "", isAutoRole: false, rank: 0, permissions: "{}" });
    } catch (err) {
      alert("Invalid JSON permissions format");
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader title="Roles & Permissions" description="Manage auto-roles and rank-based permissions hierarchy.">
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-md font-medium flex items-center gap-2 transition-colors shadow-lg shadow-primary/20"
        >
          <Plus className="w-4 h-4" />
          Add Role Config
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
              <h3 className="text-white font-bold mb-4">Configure New Role</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#b9bbbe] uppercase tracking-wider mb-2">Role Name</label>
                  <input 
                    type="text"
                    value={formData.roleName}
                    onChange={(e) => setFormData({...formData, roleName: e.target.value})}
                    className="w-full bg-[#202225] border border-[#202225] text-white p-3 rounded-md focus:outline-none focus:border-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#b9bbbe] uppercase tracking-wider mb-2">Discord Role ID</label>
                  <input 
                    type="text"
                    value={formData.roleId}
                    onChange={(e) => setFormData({...formData, roleId: e.target.value})}
                    className="w-full bg-[#202225] border border-[#202225] text-white p-3 rounded-md focus:outline-none focus:border-primary font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#b9bbbe] uppercase tracking-wider mb-2">Rank (Higher = More Power)</label>
                  <input 
                    type="number"
                    value={formData.rank}
                    onChange={(e) => setFormData({...formData, rank: parseInt(e.target.value)})}
                    className="w-full bg-[#202225] border border-[#202225] text-white p-3 rounded-md focus:outline-none focus:border-primary"
                    required
                  />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <input 
                    type="checkbox"
                    checked={formData.isAutoRole}
                    onChange={(e) => setFormData({...formData, isAutoRole: e.target.checked})}
                    className="w-5 h-5 bg-[#202225] border border-[#202225] rounded focus:ring-primary text-primary"
                    id="autorole"
                  />
                  <label htmlFor="autorole" className="text-white font-medium cursor-pointer">Auto-Assign on Join?</label>
                </div>
                <div className="col-span-full">
                  <label className="block text-xs font-bold text-[#b9bbbe] uppercase tracking-wider mb-2">Permissions (JSON)</label>
                  <textarea 
                    value={formData.permissions}
                    onChange={(e) => setFormData({...formData, permissions: e.target.value})}
                    className="w-full bg-[#202225] border border-[#202225] text-white p-3 rounded-md focus:outline-none focus:border-primary h-24 font-mono text-sm"
                    placeholder='{"canKick": true, "canBan": false}'
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2 text-[#b9bbbe] hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={createRole.isPending}
                  className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-md font-medium transition-colors"
                >
                  {createRole.isPending ? "Saving..." : "Save Role Config"}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full text-center text-[#72767d]">Loading roles...</div>
        ) : roles?.map((role, i) => (
          <motion.div 
            key={role.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="bg-[#2f3136] rounded-xl border border-[#202225] overflow-hidden group hover:border-primary/50 transition-all"
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#202225] rounded-lg text-primary">
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg">{role.roleName}</h3>
                    <span className="text-xs text-[#72767d] font-mono">ID: {role.roleId}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-white opacity-20 group-hover:opacity-100 transition-opacity">
                    #{role.rank}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-2 bg-[#202225] rounded">
                  <span className="text-sm text-[#b9bbbe]">Auto-Assign</span>
                  <Badge variant={role.isAutoRole ? "success" : "default"}>
                    {role.isAutoRole ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                
                <div className="p-2 bg-[#202225] rounded min-h-[60px]">
                  <span className="text-xs text-[#72767d] uppercase font-bold block mb-1">Permissions</span>
                  <div className="flex flex-wrap gap-1">
                    {Object.keys(role.permissions as object).length > 0 ? (
                      Object.keys(role.permissions as object).map(perm => (
                        <span key={perm} className="text-[10px] bg-[#2f3136] px-1.5 py-0.5 rounded text-[#b9bbbe] border border-[#36393f]">
                          {perm}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-[#72767d] italic">No specific permissions set</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button 
                  onClick={() => deleteRole.mutate(role.id)}
                  className="text-[#72767d] hover:text-red-500 text-sm flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Remove Config
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
