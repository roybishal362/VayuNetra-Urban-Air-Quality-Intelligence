/** Shared loading / error / empty state for pages and panels. */
export default function StateMsg({
  kind = "loading",
  title,
  detail,
  className = "",
}: {
  kind?: "loading" | "error" | "empty";
  title: string;
  detail?: string;
  className?: string;
}) {
  return (
    <div className={`grid h-full place-items-center p-6 ${className}`}>
      <div className="glass max-w-sm p-5 text-center">
        {kind === "loading" && (
          <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border-2 border-white/15 border-t-text-hi" aria-hidden />
        )}
        {kind === "error" && (
          <div className="mx-auto mb-2 text-xs font-medium uppercase tracking-[0.14em] text-[#E93F33]">Error</div>
        )}
        <div className="text-sm font-semibold text-text-hi">{title}</div>
        {detail && <div className="mt-1.5 break-words text-xs leading-relaxed text-text-mid">{detail}</div>}
      </div>
    </div>
  );
}
