import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";

export function useRoles() {
  return useQuery({
    queryKey: [api.roles.list.path],
    queryFn: async () => {
      const res = await fetch(api.roles.list.path);
      if (!res.ok) throw new Error("Failed to fetch roles");
      return api.roles.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: z.infer<typeof api.roles.create.input>) => {
      const res = await fetch(api.roles.create.path, {
        method: api.roles.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create role");
      return api.roles.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.roles.list.path] });
    },
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<z.infer<typeof api.roles.create.input>>) => {
      const url = buildUrl(api.roles.update.path, { id });
      const res = await fetch(url, {
        method: api.roles.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update role");
      return api.roles.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.roles.list.path] });
    },
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.roles.delete.path, { id });
      const res = await fetch(url, { method: api.roles.delete.method });
      if (!res.ok) throw new Error("Failed to delete role");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.roles.list.path] });
    },
  });
}
