import { createFileRoute } from "@tanstack/react-router";
import { ScenarioBoard } from "@/components/ScenarioSimulator/ScenarioBoard";

export const Route = createFileRoute("/_command/simulator")({
  component: SimulatorPage,
});

function SimulatorPage() {
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Digital twin</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Inject snow, air, damage, or cross-level authority. The engine re-scores every option. Commit the
          recommended plan to watch stockout fall in Monte Carlo.
        </p>
      </div>
      <ScenarioBoard />
    </div>
  );
}
