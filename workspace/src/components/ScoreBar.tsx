import clsx from "clsx";

/** Small filled/unfilled segment bars. Not stars, not emoji (§11). */
export function ScoreBar({
  value,
  max = 5,
  tone = "default",
  size = "sm",
  label,
}: {
  value: number | null | undefined;
  max?: number;
  tone?: "default" | "warn" | "good" | "print";
  size?: "xs" | "sm";
  label?: string;
}) {
  const filled = value ?? 0;
  return (
    <span
      className="inline-flex items-center gap-[2px] align-middle"
      role="img"
      aria-label={label ?? (value ? `${value} of ${max}` : "not rated")}
    >
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={clsx(
            size === "xs" ? "h-2 w-[3px]" : "h-2.5 w-1",
            "rounded-[1px]",
            i < filled
              ? tone === "warn"
                ? "bg-warn"
                : tone === "good"
                  ? "bg-good"
                  : tone === "print"
                    ? "bg-neutral-800"
                    : "bg-accent"
              : tone === "print"
                ? "bg-neutral-300"
                : "bg-rule",
          )}
        />
      ))}
    </span>
  );
}
