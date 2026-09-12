import { createFileRoute } from "@tanstack/react-router";
import VideoQueuePage from "@/pages/video/VideoQueuePage";

export const Route = createFileRoute("/_main/video/queue")({
  component: VideoQueuePage,
});
