import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";

export function useRules() {
  return useQuery({
    queryKey: [api.rules.list.path],
    queryFn: async () => {
      const res = await fetch(api.rules.list.path);
      if (!res.ok) throw new Error("Failed to fetch rules");
      return api.rules.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: z.infer<typeof api.rules.create.input>) => {
      const res = await fetch(api.rules.create.path, {
        method: api.rules.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create rule");
      return api.rules.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.rules.list.path] });
    },
  });
}

export function useDeleteRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.rules.delete.path, { id });
      const res = await fetch(url, { method: api.rules.delete.method });
      if (!res.ok) throw new Error("Failed to delete rule");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.rules.list.path] });
    },
  });
}
