"use client";

import { useState } from "react";

export function PublicPreviewActions() {
  const [message, setMessage] = useState("");

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => setMessage("Mock publish complete. A future Lambda workflow will sanitize and save the public snapshot.")}
          className="inline-flex justify-center rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white"
        >
          Publish public version
        </button>
        <button
          type="button"
          onClick={() => setMessage("Kept private locally. No public snapshot was changed.")}
          className="inline-flex justify-center rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink"
        >
          Keep private
        </button>
      </div>
      {message ? <p className="mt-3 rounded-md border border-moss/25 bg-field px-4 py-3 text-sm font-semibold text-moss">{message}</p> : null}
    </div>
  );
}
