import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useRoleListMembers(roleId?: string) {
  const path = roleId
    ? `${api.roleListMembers.list.path}?roleId=${roleId}`
    : api.roleListMembers.list.path;
  return useQuery({
    queryKey: [api.roleListMembers.list.path, roleId],
    queryFn: async () => {
      const res = await fetch(path);
      if (!res.ok) throw new Error("Failed to fetch role list members");
      return res.json() as Promise<typeof api.roleListMembers.list.responses[200]["_type"]>;
    },
  });
}

export function useRoleListHistory() {
  return useQuery({
    queryKey: [api.roleListMembers.history.path],
    queryFn: async () => {
      const res = await fetch(api.roleListMembers.history.path);
      if (!res.ok) throw new Error("Failed to fetch role list history");
      return res.json() as Promise<typeof api.roleListMembers.history.responses[200]["_type"]>;
    },
  });
}

export function useRemoveRoleListMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ roleId, userId }: { roleId: string; userId: string }) => {
      const res = await fetch(`/api/role-list-members/${roleId}/${userId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove member");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.roleListMembers.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.roleListMembers.history.path] });
    },
  });
}
