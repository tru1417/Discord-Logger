import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";

export function useLogs(filters?: { type?: string; userId?: string }) {
  return useQuery({
    queryKey: [api.logs.list.path, filters],
    queryFn: async () => {
      const url = buildUrl(api.logs.list.path);
      // Append query params manually since buildUrl only handles path params
      const params = new URLSearchParams();
      if (filters?.type) params.append("type", filters.type);
      if (filters?.userId) params.append("userId", filters.userId);
      
      const res = await fetch(`${url}?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch logs");
      return api.logs.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: z.infer<typeof api.logs.create.input>) => {
      const res = await fetch(api.logs.create.path, {
        method: api.logs.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create log");
      return api.logs.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.logs.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.stats.get.path] });
    },
  });
}
