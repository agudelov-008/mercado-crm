import { createFileRoute } from "@tanstack/react-router";
import { CalendarPage } from "@/routes/tasks";

export const Route = createFileRoute("/calendar")({
  component: CalendarPage,
});
