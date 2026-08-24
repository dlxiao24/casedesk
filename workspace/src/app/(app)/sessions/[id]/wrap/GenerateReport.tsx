"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ReportOptionsDialog, type ReportOptions } from "@/components/ReportOptionsDialog";

/**
 * The last decision before a candidate sees anything: what goes in. Asking here
 * rather than on the report itself means the choice is made deliberately, not
 * discovered after the fact.
 */
export function GenerateReport({
  sessionId,
  options,
}: {
  sessionId: string;
  options: ReportOptions;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        Generate report
      </button>
      <ReportOptionsDialog
        sessionId={sessionId}
        initial={options}
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => router.push(`/sessions/${sessionId}/report`)}
        confirmLabel="Generate report"
      />
    </>
  );
}
