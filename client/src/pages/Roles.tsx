import { useRoles, useCreateRole, useDeleteRole } from "@/hooks/use-roles";
import { useRoleListMembers, useRoleListHistory, useRemoveRoleListMember } from "@/hooks/use-role-list";
import { PageHeader } from "@/components/PageHeader";
import { Plus, Trash2, Shield, Users, Clock, UserMinus } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";

type Tab = "configs" | "members" | "history";

export default function Roles() {
  const { data: roles, isLoading } = useRoles();
  const { data: allMembers, isLoading: membersLoading } = useRoleListMembers();
  const { data: history, isLoading: historyLoading } = useRoleListHistory();
  const createRole = useCreateRole();
  const deleteRole = useDeleteRole();
  const removeFromList = useRemoveRoleListMember();

  const [activeTab, setActiveTab] = useState<Tab>("configs");
  const [isAdding, setIsAdding] = useState(false);
  const [filterRole, setFilterRole] = useState("");
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

  const filteredMembers = filterRole
    ? allMembers?.filter(m => m.roleName.toLowerCase().includes(filterRole.toLowerCase()) || m.roleId === filterRole)
    : allMembers;

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "configs", label: "Role Configs", icon: Shield },
    { id: "members", label: "Role Members", icon: Users },
    { id: "history", label: "Assignment History", icon: Clock },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader title="Roles & Permissions" description="Manage role configs, role list members, and assignment history.">
        {activeTab === "configs" && (
          <button
            data-testid="button-add-role-config"
            onClick={() => setIsAdding(!isAdding)}
            className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-md font-medium flex items-center gap-2 transition-colors shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            Add Role Config
          </button>
        )}
      </PageHeader>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 bg-[#202225] p-1 rounded-lg w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            data-testid={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-primary text-white shadow"
                : "text-[#b9bbbe] hover:text-white"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Role Configs Tab */}
      {activeTab === "configs" && (
        <>
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
                        data-testid="input-role-name"
                        type="text"
                        value={formData.roleName}
                        onChange={(e) => setFormData({ ...formData, roleName: e.target.value })}
                        className="w-full bg-[#202225] border border-[#202225] text-white p-3 rounded-md focus:outline-none focus:border-primary"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#b9bbbe] uppercase tracking-wider mb-2">Discord Role ID</label>
                      <input
                        data-testid="input-role-id"
                        type="text"
                        value={formData.roleId}
                        onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                        className="w-full bg-[#202225] border border-[#202225] text-white p-3 rounded-md focus:outline-none focus:border-primary font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#b9bbbe] uppercase tracking-wider mb-2">Rank (Higher = More Power)</label>
                      <input
                        data-testid="input-rank"
                        type="number"
                        value={formData.rank}
                        onChange={(e) => setFormData({ ...formData, rank: parseInt(e.target.value) })}
                        className="w-full bg-[#202225] border border-[#202225] text-white p-3 rounded-md focus:outline-none focus:border-primary"
                        required
                      />
                    </div>
                    <div className="flex items-center gap-3 pt-6">
                      <input
                        data-testid="checkbox-autorole"
                        type="checkbox"
                        checked={formData.isAutoRole}
                        onChange={(e) => setFormData({ ...formData, isAutoRole: e.target.checked })}
                        className="w-5 h-5 bg-[#202225] border border-[#202225] rounded focus:ring-primary text-primary"
                        id="autorole"
                      />
                      <label htmlFor="autorole" className="text-white font-medium cursor-pointer">Auto-Assign on Join?</label>
                    </div>
                    <div className="col-span-full">
                      <label className="block text-xs font-bold text-[#b9bbbe] uppercase tracking-wider mb-2">Permissions (JSON)</label>
                      <textarea
                        data-testid="input-permissions"
                        value={formData.permissions}
                        onChange={(e) => setFormData({ ...formData, permissions: e.target.value })}
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
                      data-testid="button-save-role"
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
            ) : roles?.length === 0 ? (
              <div className="col-span-full text-center text-[#72767d] py-16">No role configs yet.</div>
            ) : roles?.map((role, i) => (
              <motion.div
                key={role.id}
                data-testid={`card-role-${role.id}`}
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
                        <h3 className="font-bold text-white text-lg" data-testid={`text-role-name-${role.id}`}>{role.roleName}</h3>
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
                      data-testid={`button-delete-role-${role.id}`}
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
        </>
      )}

      {/* Role Members Tab */}
      {activeTab === "members" && (
        <div>
          <div className="mb-6 flex items-center gap-3">
            <input
              data-testid="input-filter-role"
              type="text"
              placeholder="Filter by role name or ID..."
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="bg-[#202225] border border-[#36393f] text-white px-4 py-2 rounded-md focus:outline-none focus:border-primary w-72 text-sm"
            />
            {filterRole && (
              <button onClick={() => setFilterRole("")} className="text-[#72767d] hover:text-white text-sm transition-colors">
                Clear
              </button>
            )}
            <span className="text-[#72767d] text-sm ml-auto">
              {filteredMembers?.length ?? 0} member(s)
            </span>
          </div>

          {membersLoading ? (
            <div className="text-center text-[#72767d] py-16">Loading members...</div>
          ) : filteredMembers?.length === 0 ? (
            <div className="text-center text-[#72767d] py-16">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No members in any role list yet.</p>
              <p className="text-sm mt-1">Use <span className="font-mono text-primary">/rolelist add</span> in Discord to add members.</p>
            </div>
          ) : (
            <div className="bg-[#2f3136] rounded-xl border border-[#202225] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#202225]">
                    <th className="text-left p-4 text-xs font-bold text-[#b9bbbe] uppercase tracking-wider">User</th>
                    <th className="text-left p-4 text-xs font-bold text-[#b9bbbe] uppercase tracking-wider">Role</th>
                    <th className="text-left p-4 text-xs font-bold text-[#b9bbbe] uppercase tracking-wider">Added By</th>
                    <th className="text-left p-4 text-xs font-bold text-[#b9bbbe] uppercase tracking-wider">Added</th>
                    <th className="text-right p-4 text-xs font-bold text-[#b9bbbe] uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers?.map((member, i) => (
                    <motion.tr
                      key={member.id}
                      data-testid={`row-role-member-${member.id}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-[#202225] last:border-0 hover:bg-[#36393f]/30 transition-colors"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                            {member.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-white text-sm font-medium" data-testid={`text-member-name-${member.id}`}>{member.username}</div>
                            <div className="text-[#72767d] text-xs font-mono">{member.userId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Shield className="w-3.5 h-3.5 text-primary" />
                          <span className="text-white text-sm" data-testid={`text-member-role-${member.id}`}>{member.roleName}</span>
                        </div>
                        <div className="text-[#72767d] text-xs font-mono mt-0.5">{member.roleId}</div>
                      </td>
                      <td className="p-4 text-[#b9bbbe] text-sm">{member.addedByName}</td>
                      <td className="p-4 text-[#72767d] text-sm">
                        {formatDistanceToNow(new Date(member.timestamp), { addSuffix: true })}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          data-testid={`button-remove-member-${member.id}`}
                          onClick={() => removeFromList.mutate({ roleId: member.roleId, userId: member.userId })}
                          disabled={removeFromList.isPending}
                          className="text-[#72767d] hover:text-red-500 transition-colors flex items-center gap-1 ml-auto text-sm"
                        >
                          <UserMinus className="w-4 h-4" />
                          Remove
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <div>
          {historyLoading ? (
            <div className="text-center text-[#72767d] py-16">Loading history...</div>
          ) : history?.length === 0 ? (
            <div className="text-center text-[#72767d] py-16">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No assignment history yet.</p>
            </div>
          ) : (
            <div className="bg-[#2f3136] rounded-xl border border-[#202225] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#202225]">
                    <th className="text-left p-4 text-xs font-bold text-[#b9bbbe] uppercase tracking-wider">Action</th>
                    <th className="text-left p-4 text-xs font-bold text-[#b9bbbe] uppercase tracking-wider">User</th>
                    <th className="text-left p-4 text-xs font-bold text-[#b9bbbe] uppercase tracking-wider">Role</th>
                    <th className="text-left p-4 text-xs font-bold text-[#b9bbbe] uppercase tracking-wider">By</th>
                    <th className="text-left p-4 text-xs font-bold text-[#b9bbbe] uppercase tracking-wider">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {history?.map((entry, i) => (
                    <motion.tr
                      key={entry.id}
                      data-testid={`row-history-${entry.id}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-[#202225] last:border-0 hover:bg-[#36393f]/30 transition-colors"
                    >
                      <td className="p-4">
                        <Badge variant={entry.action === "add" ? "success" : "danger"}>
                          {entry.action === "add" ? "➕ Added" : "➖ Removed"}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="text-white text-sm">{entry.username}</div>
                        <div className="text-[#72767d] text-xs font-mono">{entry.userId}</div>
                      </td>
                      <td className="p-4 text-[#b9bbbe] text-sm">{entry.roleName}</td>
                      <td className="p-4 text-[#b9bbbe] text-sm">{entry.addedByName}</td>
                      <td className="p-4 text-[#72767d] text-sm">
                        {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
