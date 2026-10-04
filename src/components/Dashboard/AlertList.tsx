import { pctPts } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useOpsStore } from "@/store/ops-store";

export function AlertList() {
  const posts = useOpsStore((s) => s.report.posts);
  const selected = useOpsStore((s) => s.selectedUnitId);
  const selectPost = useOpsStore((s) => s.selectPost);

  return (
    <div className="flex flex-col gap-2">
      {posts.map((post) => {
        const tone =
          post.worst.stockoutRisk >= 0.55 ? "danger" : post.worst.stockoutRisk >= 0.28 ? "warn" : "ok";
        return (
          <button
            key={post.unit.id}
            type="button"
            onClick={() => selectPost(post.unit.id)}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-lg bg-surface-2 px-3 py-2 text-left shadow-[var(--shadow-border)] transition-colors duration-[var(--motion-quick)]",
              selected === post.unit.id ? "bg-surface" : "hover:bg-surface",
            )}
          >
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                tone === "danger" ? "bg-danger" : tone === "warn" ? "bg-warn" : "bg-ok",
              )}
            />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{post.unit.callsign}</span>
              <span className="block truncate text-xs text-muted">
                {post.item.short} · {post.location.elevationM} m
              </span>
            </span>
            <span
              className={cn(
                "font-mono text-sm tabular-nums",
                tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : "text-ok",
              )}
            >
              {pctPts(post.worst.stockoutRisk * 100)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
