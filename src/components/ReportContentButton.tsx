"use client";

import { useState } from "react";

const reportReasons = [
  "Unsafe weapon content",
  "Illegal hunting / poaching",
  "Personal information",
  "Harassment or threat",
  "Sales or marketplace activity",
  "Other"
];

export function ReportContentButton({ targetLabel }: { targetLabel: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState(reportReasons[0]);
  const [details, setDetails] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  function submitReport() {
    console.log("Mock report submitted", { targetLabel, reason, details });
    setSuccessMessage("Report received locally. Moderation workflow will be connected later.");
    setIsOpen(false);
    setDetails("");
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
          setSuccessMessage("");
        }}
        className="inline-flex rounded-md border border-clay/40 bg-white px-3 py-2 text-sm font-semibold text-clay"
      >
        Report
      </button>

      {successMessage ? <p className="mt-2 text-sm font-semibold text-moss">{successMessage}</p> : null}

      {isOpen ? (
        <div className="mt-3 rounded-md border border-ink/10 bg-paper p-4">
          <h3 className="text-sm font-bold text-ink">Report {targetLabel}</h3>
          <label className="mt-3 block">
            <span className="text-sm font-semibold text-ink">Reason</span>
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-2 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-moss"
            >
              {reportReasons.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block">
            <span className="text-sm font-semibold text-ink">Details</span>
            <textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={3}
              className="mt-2 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-moss"
            />
          </label>
          <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setIsOpen(false)} className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm font-semibold text-ink">
              Cancel
            </button>
            <button type="button" onClick={submitReport} className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white">
              Submit report
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
