import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_main/julia-chat")({
  beforeLoad: () => {
    throw redirect({ to: "/chat", replace: true } as never);
  },
});
