import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertLog, type InsertCase } from "@shared/routes";

// ==========================================
// LOGS HOOKS
// ==========================================

export function useLogs(params?: { userId?: string; type?: string; limit?: number }) {
  return useQuery({
    queryKey: [api.logs.list.path, params],
    queryFn: async () => {
      // Build query string manually since fetch doesn't support params object directly
      const searchParams = new URLSearchParams();
      if (params?.userId) searchParams.append("userId", params.userId);
      if (params?.type) searchParams.append("type", params.type);
      if (params?.limit) searchParams.append("limit", params.limit.toString());

      const url = `${api.logs.list.path}?${searchParams.toString()}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch logs");
      return api.logs.list.responses[200].parse(await res.json());
    },
  });
}

// Mostly for testing/internal use as per schema
export function useCreateLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertLog) => {
      const res = await fetch(api.logs.create.path, {
        method: api.logs.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
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

// ==========================================
// CASES HOOKS
// ==========================================

export function useCases(params?: { targetId?: string; moderatorId?: string; type?: string }) {
  return useQuery({
    queryKey: [api.cases.list.path, params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.targetId) searchParams.append("targetId", params.targetId);
      if (params?.moderatorId) searchParams.append("moderatorId", params.moderatorId);
      if (params?.type) searchParams.append("type", params.type);

      const url = `${api.cases.list.path}?${searchParams.toString()}`;
      const res = await fetch(url, { credentials: "include" });
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
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch case");
      return api.cases.get.responses[200].parse(await res.json());
    },
  });
}

export function useCreateCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertCase) => {
      const res = await fetch(api.cases.create.path, {
        method: api.cases.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create case");
      return api.cases.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.cases.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.stats.get.path] });
    },
  });
}

// ==========================================
// STATS HOOKS
// ==========================================

export function useStats() {
  return useQuery({
    queryKey: [api.stats.get.path],
    queryFn: async () => {
      const res = await fetch(api.stats.get.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return api.stats.get.responses[200].parse(await res.json());
    },
    // Refresh stats more frequently for a dashboard feel
    refetchInterval: 30000, 
  });
}
