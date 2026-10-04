import { createFileRoute } from "@tanstack/react-router";
import { CommandShell } from "@/components/layout/CommandShell";

export const Route = createFileRoute("/_command")({
  component: CommandShell,
});
