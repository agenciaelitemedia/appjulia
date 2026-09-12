import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { ThemeProvider } from "next-themes";
import { Suspense, useEffect } from "react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DebugBar } from "@/components/debug/DebugBar";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { DebugProvider } from "@/contexts/DebugContext";
import { UaZapiProvider } from "@/contexts/UaZapiContext";
import { WavoipProvider } from "@/contexts/WavoipContext";
import { registerServiceWorker } from "@/lib/pushNotifications";
import appCss from "@/styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0, maximum-scale=5.0" },
      { title: "Atende Julia — Atendimento inteligente para advocacia" },
      {
        name: "description",
        content:
          "Plataforma de atendimento com IA, CRM e telefonia para escritórios de advocacia. Centralize WhatsApp, leads e equipe em um só lugar.",
      },
      { name: "author", content: "Atende Julia" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Atende Julia — Atendimento inteligente para advocacia" },
      {
        property: "og:description",
        content:
          "Plataforma de atendimento com IA, CRM e telefonia para escritórios de advocacia.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#7c3aed" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png" },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    void registerServiceWorker();
  }, []);

  return (
    <html lang="pt-BR" translate="no" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <TooltipProvider>
            <DebugProvider>
              <Toaster />
              <Sonner />
              <AuthProvider>
                <UaZapiProvider>
                  <WavoipProvider>
                    <ErrorBoundary>
                      <Suspense fallback={null}>
                        <Outlet />
                      </Suspense>
                      <DebugBar />
                    </ErrorBoundary>
                  </WavoipProvider>
                </UaZapiProvider>
              </AuthProvider>
            </DebugProvider>
          </TooltipProvider>
        </ThemeProvider>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
