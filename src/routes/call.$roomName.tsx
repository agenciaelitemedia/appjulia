import { createFileRoute } from "@tanstack/react-router";
import JoinCallPage from "@/pages/video/JoinCallPage";

export const Route = createFileRoute("/call/$roomName")({
  component: JoinCallPage,
});
