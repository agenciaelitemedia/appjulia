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

  // O projeto usa tsconfig frouxo (strictNullChecks off), então o tipo público de
  // createRouter não resolve; o cast mantém o comportamento em runtime intacto.
  const router = (createRouter as unknown as (opts: unknown) => never)({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
