import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertLog, type InsertCase, type InsertRule } from "@shared/routes";

// ============================================
// LOGS
// ============================================
export function useLogs(filters?: { type?: string; userId?: string }) {
  return useQuery({
    queryKey: [api.logs.list.path, filters],
    queryFn: async () => {
      const url = buildUrl(api.logs.list.path);
      const params = new URLSearchParams();
      if (filters?.type && filters.type !== "all") params.append("type", filters.type);
      if (filters?.userId) params.append("userId", filters.userId);
      
      const res = await fetch(`${url}?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch logs");
      return api.logs.list.responses[200].parse(await res.json());
    },
  });
}

// ============================================
// CASES
// ============================================
export function useCases(filters?: { type?: string; targetId?: string }) {
  return useQuery({
    queryKey: [api.cases.list.path, filters],
    queryFn: async () => {
      const url = buildUrl(api.cases.list.path);
      const params = new URLSearchParams();
      if (filters?.type && filters.type !== "all") params.append("type", filters.type);
      if (filters?.targetId) params.append("targetId", filters.targetId);
      
      const res = await fetch(`${url}?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch cases");
      return api.cases.list.responses[200].parse(await res.json());
    },
  });
}

export function useCase(id: number) {
  return useQuery({
    queryKey: [api.cases.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.cases.get.path, { id });
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch case");
      return api.cases.get.responses[200].parse(await res.json());
    },
  });
}

// ============================================
// RULES
// ============================================
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
    mutationFn: async (data: InsertRule) => {
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

// ============================================
// STATS
// ============================================
export function useStats() {
  return useQuery({
    queryKey: [api.stats.get.path],
    queryFn: async () => {
      const res = await fetch(api.stats.get.path);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return api.stats.get.responses[200].parse(await res.json());
    },
    refetchInterval: 10000, // Refresh every 10s
  });
}
