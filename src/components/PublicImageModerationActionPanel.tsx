"use client";

import { useEffect, useRef, useState } from "react";
import {
  normalizePublicImageModerationReason,
  publicImageModerationReasonMaxLength,
  type PublicImageModerationAction,
  type PublicImageModerationActionStatus
} from "@/lib/publicImageModerationData";

type ModeratePublicImage = (
  publicPassportSnapshotId: string,
  action: PublicImageModerationAction,
  reason: string
) => Promise<{ status: PublicImageModerationActionStatus }>;

const resultMessages: Record<Exclude<PublicImageModerationActionStatus, "failed">, string> = {
  hidden: "Public image hidden. Public delivery is unavailable; the sanitized text/setup remains published.",
  removed: "Public image removed. The public derivative was detached and cleaned up; the private original was not changed.",
  not_attached: "No public image is currently attached. The sanitized text/setup remains available if it is still published.",
  cleanup_pending: "Public delivery is detached. Backend derivative cleanup is pending and can be retried safely."
};

export function PublicImageModerationActionPanel({
  publicPassportSnapshotId,
  moderatePublicImage,
  onActionComplete
}: {
  publicPassportSnapshotId: string;
  moderatePublicImage: ModeratePublicImage;
  onActionComplete: () => Promise<void>;
}) {
  const [selectedAction, setSelectedAction] = useState<PublicImageModerationAction | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [resultStatus, setResultStatus] = useState<PublicImageModerationActionStatus | null>(null);
  const [error, setError] = useState("");
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, []);

  function chooseAction(action: PublicImageModerationAction) {
    if (isSaving) return;
    setSelectedAction(action);
    setConfirmed(false);
    setReasonError("");
    setResultStatus(null);
    setError("");
  }

  async function submitAction() {
    if (!selectedAction || !confirmed || isSaving) return;

    const normalizedReason = normalizePublicImageModerationReason(reason);
    if (normalizedReason.error) {
      setReasonError(normalizedReason.error);
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsSaving(true);
    setReasonError("");
    setResultStatus(null);
    setError("");

    const result = await moderatePublicImage(
      publicPassportSnapshotId,
      selectedAction,
      normalizedReason.value
    );

    if (!mountedRef.current || requestIdRef.current !== requestId) return;

    setIsSaving(false);
    if (result.status === "failed") {
      setError("The public image action could not be completed safely. Reopen the public setup, confirm the current image, and try again.");
      return;
    }

    setResultStatus(result.status);
    setSelectedAction(null);
    setConfirmed(false);
    setReason("");
    await onActionComplete();
  }

  return (
    <div className="mt-4 border-t border-moss/15 pt-4">
      <p className="text-sm font-bold text-ink">Public image action</p>
      <p className="mt-2 text-xs leading-5 text-ink/60">
        These actions affect only the current processed public derivative. The private original remains private and unchanged, and the sanitized text/setup remains published. Report status changes separately.
      </p>

      {resultStatus && resultStatus !== "failed" ? (
        <p className={`mt-3 rounded-md px-3 py-2 text-xs font-semibold leading-5 ${resultStatus === "cleanup_pending" ? "border border-amber-300 bg-amber-50 text-amber-900" : "border border-moss/20 bg-white text-moss"}`} role="status">
          {resultMessages[resultStatus]}
        </p>
      ) : null}
      {error ? <p className="mt-3 rounded-md border border-clay/30 bg-clay/10 px-3 py-2 text-xs font-semibold leading-5 text-clay" role="alert">{error}</p> : null}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          disabled={isSaving}
          onClick={() => chooseAction("hide")}
          className="rounded-md border border-ink/20 bg-white px-3 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          Hide public image
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => chooseAction("remove")}
          className="rounded-md border border-clay/40 bg-white px-3 py-2 text-sm font-semibold text-clay disabled:cursor-not-allowed disabled:opacity-60"
        >
          Remove public image
        </button>
      </div>

      {selectedAction ? (
        <div className="mt-4 rounded-md border border-ink/10 bg-white p-4">
          <p className="text-sm font-bold text-ink">
            Confirm {selectedAction === "hide" ? "hiding" : "removing"} the current public image
          </p>
          <p className="mt-2 text-xs leading-5 text-ink/60">
            {selectedAction === "hide"
              ? "Hide immediately detaches public delivery but retains the processed derivative for later cleanup."
              : "Remove detaches public delivery first, marks the derivative removed, and then deletes only the processed public object."}
          </p>
          <p className="mt-2 text-xs leading-5 text-ink/60">
            Review the linked public setup immediately before confirming. New reports identify the generation seen at submission, but this action intentionally targets only the image currently attached to the snapshot. A changed image must be reviewed again.
          </p>

          <label className="mt-3 block">
            <span className="flex items-center justify-between gap-3 text-xs font-semibold text-ink">
              <span>Moderation reason <span className="font-normal text-ink/50">(optional, owner-safe)</span></span>
              <span className="font-normal text-ink/50">{reason.length}/{publicImageModerationReasonMaxLength}</span>
            </span>
            <textarea
              value={reason}
              rows={3}
              maxLength={publicImageModerationReasonMaxLength}
              disabled={isSaving}
              onChange={(event) => {
                setReason(event.target.value);
                setReasonError("");
                setError("");
              }}
              className="mt-2 w-full resize-y rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-moss disabled:opacity-60"
            />
          </label>
          <p className="mt-2 text-xs leading-5 text-ink/50">
            Do not include reporter identity, private information, URLs, keys, or storage paths. This reason may be visible to the image owner later.
          </p>
          {reasonError ? <p className="mt-2 text-xs font-semibold text-clay">{reasonError}</p> : null}

          <label className="mt-3 flex items-start gap-3 text-xs leading-5 text-ink/70">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={isSaving}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 accent-moss"
            />
            <span>I reviewed the current public setup and understand this action preserves the private original and published sanitized text/setup.</span>
          </label>

          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => {
                setSelectedAction(null);
                setConfirmed(false);
                setReasonError("");
                setError("");
              }}
              className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm font-semibold text-ink disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving || !confirmed}
              onClick={() => void submitAction()}
              className={`rounded-md px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${selectedAction === "remove" ? "bg-clay" : "bg-ink"}`}
            >
              {isSaving ? "Applying..." : selectedAction === "hide" ? "Confirm hide" : "Confirm remove"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
