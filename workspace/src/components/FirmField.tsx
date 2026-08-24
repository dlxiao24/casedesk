"use client";

import { FIRM_SUGGESTIONS } from "@/lib/constants";

/**
 * Which firm's case this is. A datalist rather than a select: the suggestions
 * cover the firms a club sees most, and the field still accepts anything, for
 * the alumni-written cases no fixed list would have anticipated.
 */
export function FirmField({
  defaultValue,
  id = "firm",
  label = "Firm",
}: {
  defaultValue?: string | null;
  id?: string;
  label?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name="firm"
        list="firm-suggestions"
        defaultValue={defaultValue ?? ""}
        placeholder="McKinsey & Company"
        className="field mt-1"
        autoComplete="off"
      />
      <datalist id="firm-suggestions">
        {FIRM_SUGGESTIONS.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
    </div>
  );
}
