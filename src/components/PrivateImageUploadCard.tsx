"use client";

import { useEffect, useId, useState } from "react";
import { getPrivateImageUrl, uploadPrivateImage, validatePrivateImageFile, type PrivateImageFolder } from "@/lib/privateImageStorage";

export function PrivateImageUploadCard({
  title,
  description,
  folder,
  recordId,
  storageKey,
  uploadLabel = "Upload private image",
  onUploaded
}: {
  title: string;
  description: string;
  folder: PrivateImageFolder;
  recordId: string;
  storageKey?: string | null;
  uploadLabel?: string;
  onUploaded: (storageKey: string) => Promise<void> | void;
}) {
  const inputId = useId();
  const [imageUrl, setImageUrl] = useState("");
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let isCurrent = true;

    async function loadImageUrl() {
      setError("");
      setImageUrl("");

      if (!storageKey) {
        return;
      }

      setIsLoadingUrl(true);

      try {
        const url = await getPrivateImageUrl(storageKey);

        if (isCurrent) {
          setImageUrl(url);
        }
      } catch (urlError) {
        console.error("Unable to load private image URL", urlError);

        if (isCurrent) {
          setError("This private image could not be loaded.");
        }
      } finally {
        if (isCurrent) {
          setIsLoadingUrl(false);
        }
      }
    }

    void loadImageUrl();

    return () => {
      isCurrent = false;
    };
  }, [storageKey]);

  async function handleFileChange(file?: File) {
    setError("");
    setSuccess("");
    setProgress(0);

    if (!file) {
      return;
    }

    const validationMessage = validatePrivateImageFile(file);

    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setIsUploading(true);

    try {
      const uploadedKey = await uploadPrivateImage({
        file,
        folder,
        recordId,
        onProgress: setProgress
      });

      await onUploaded(uploadedKey);
      setSuccess("Private image uploaded.");
      setProgress(100);
    } catch (uploadError) {
      console.error("Unable to upload private image", uploadError);
      setError(uploadError instanceof Error ? uploadError.message : "This private image could not be uploaded.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="rounded-md border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-bold text-ink">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-ink/70">{description}</p>
          <p className="mt-3 rounded-md bg-field px-3 py-2 text-sm leading-6 text-ink/70">
            Images are private by default. Public sharing will require a separate sanitized publishing step later. Do not upload images containing serial numbers, exact locations, license plates, or sensitive personal info unless you intend to keep them private.
          </p>
          <p className="mt-2 text-xs leading-5 text-ink/55">Metadata stripping is not implemented yet and will be required before public publishing.</p>
        </div>

        <div className="w-full lg:w-64">
          <div className="flex aspect-[4/3] min-h-40 items-center justify-center overflow-hidden rounded-md border border-dashed border-ink/20 bg-paper sm:h-44 sm:aspect-auto">
            {isLoadingUrl ? <span className="text-sm text-ink/60">Loading private image...</span> : null}
            {!isLoadingUrl && imageUrl ? <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${imageUrl})` }} aria-hidden="true" /> : null}
            {!isLoadingUrl && !imageUrl ? <span className="px-4 text-center text-sm text-ink/60">No private image uploaded yet.</span> : null}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label htmlFor={inputId} className="inline-flex w-full cursor-pointer justify-center rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white sm:w-auto">
          {isUploading ? "Uploading..." : uploadLabel}
        </label>
        <input
          id={inputId}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          disabled={isUploading}
          className="sr-only"
          onChange={(event) => {
            void handleFileChange(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <span className="text-xs leading-5 text-ink/55">JPG, PNG, or WEBP. Max 8MB.</span>
      </div>

      {isUploading ? (
        <div className="mt-3">
          <div className="flex justify-between text-xs font-semibold text-ink/60">
            <span>Upload progress</span>
            <span>{progress}%</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-ink/10">
            <div className="h-2 rounded-full bg-moss" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-3 rounded-md border border-clay/30 bg-clay/10 px-3 py-2 text-sm font-semibold text-clay">{error}</p> : null}
      {success ? <p className="mt-3 rounded-md border border-moss/30 bg-field px-3 py-2 text-sm font-semibold text-moss">{success}</p> : null}
    </section>
  );
}
