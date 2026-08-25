import clsx from "clsx";

/** "3.5", but "4" rather than "4.0" — trailing zeros read as false precision. */
export function formatScore(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * Small filled/unfilled segment bars. Not stars, not emoji (§11).
 *
 * The values these show are averages across every coach who rated the case, so
 * they are rarely whole. The last lit segment fills partway up rather than
 * rounding: 3.7 is three segments and a bit, which is visibly not the same as
 * a flat 4. The fill runs bottom-up because these bars are 4px wide and 10px
 * tall — a partial fill across the width would be a sliver nobody can read.
 */
export function ScoreBar({
  value,
  max = 5,
  tone = "default",
  size = "sm",
  label,
  name,
  /** How many coaches this average is over. Named in the tooltip when given. */
  ratingCount,
}: {
  value: number | null | undefined;
  max?: number;
  tone?: "default" | "warn" | "good" | "print";
  size?: "xs" | "sm";
  /** Full override of the spoken and hovered description. */
  label?: string;
  /** What is being rated, prefixed to the description ScoreBar builds. */
  name?: string;
  ratingCount?: number;
}) {
  const score = value ?? 0;
  const shown = formatScore(value);

  const reading =
    shown === null
      ? "not yet rated"
      : ratingCount && ratingCount > 1
        ? `${shown} of ${max}, average of ${ratingCount} ratings`
        : `${shown} of ${max}`;

  const described = label ?? (name ? `${name}: ${reading}` : reading);

  return (
    <span
      className="inline-flex items-center gap-[2px] align-middle"
      role="img"
      aria-label={described}
      title={described}
    >
      {Array.from({ length: max }, (_, i) => {
        // How much of this segment the score reaches into: all of it, none of
        // it, or the fraction left over at the end.
        const fill = Math.min(1, Math.max(0, score - i));
        return (
          <span
            key={i}
            className={clsx(
              size === "xs" ? "h-2 w-[3px]" : "h-2.5 w-1",
              "relative overflow-hidden rounded-[1px]",
              tone === "print" ? "bg-neutral-300" : "bg-rule",
            )}
          >
            {fill > 0 && (
              <span
                className={clsx(
                  "absolute inset-x-0 bottom-0",
                  tone === "warn"
                    ? "bg-warn"
                    : tone === "good"
                      ? "bg-good"
                      : tone === "print"
                        ? "bg-neutral-800"
                        : "bg-accent",
                )}
                style={{ height: `${fill * 100}%` }}
              />
            )}
          </span>
        );
      })}
    </span>
  );
}
