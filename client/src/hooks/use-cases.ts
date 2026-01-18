import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";

export function useCases() {
  return useQuery({
    queryKey: [api.cases.list.path],
    queryFn: async () => {
      const res = await fetch(api.cases.list.path);
      if (!res.ok) throw new Error("Failed to fetch cases");
      return api.cases.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: z.infer<typeof api.cases.create.input>) => {
      const res = await fetch(api.cases.create.path, {
        method: api.cases.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
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
