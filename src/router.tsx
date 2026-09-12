import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // Ported from the Classic src/App.tsx QueryClient defaults.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000, // 30s — evita refetch desnecessário ao trocar de aba
        refetchOnWindowFocus: false, // elimina storm de queries ao focar a janela
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
