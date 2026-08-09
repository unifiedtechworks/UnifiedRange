import { getUrl, uploadData } from "aws-amplify/storage";

export const privateImageMaxBytes = 8 * 1024 * 1024;

export const allowedPrivateImageTypes = ["image/jpeg", "image/png", "image/webp"];

export type PrivateImageFolder = "equipment" | "targets";

export type PrivateImageUploadResult = {
  storageKey: string;
  storageIdentityId: string;
  sanitizedFileName: string;
  contentType: string;
  sizeBytes: number;
};

export function validatePrivateImageFile(file: File) {
  if (!allowedPrivateImageTypes.includes(file.type)) {
    return "Use a JPG, JPEG, PNG, or WEBP image.";
  }

  if (file.size > privateImageMaxBytes) {
    return "Use an image smaller than 8MB.";
  }

  return "";
}

function extensionForFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension && ["jpg", "jpeg", "png", "webp"].includes(extension)) {
    return extension;
  }

  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export function sanitizePrivateImagePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 80);
}

export async function uploadPrivateImage({
  file,
  folder,
  recordId,
  onProgress
}: {
  file: File;
  folder: PrivateImageFolder;
  recordId: string;
  onProgress?: (percent: number) => void;
}) {
  const validationMessage = validatePrivateImageFile(file);

  if (validationMessage) {
    throw new Error(validationMessage);
  }

  const safeRecordId = sanitizePrivateImagePathSegment(recordId);

  if (!safeRecordId) {
    throw new Error("This private image is missing a valid source record.");
  }

  const safeName = `${Date.now()}-${crypto.randomUUID()}.${extensionForFile(file)}`;
  let storageIdentityId = "";
  const result = await uploadData({
    path: ({ identityId }) => {
      if (!identityId) {
        throw new Error("Sign in before uploading private images.");
      }

      storageIdentityId = identityId;

      return `private/${folder}/${identityId}/${safeRecordId}/${safeName}`;
    },
    data: file,
    options: {
      contentType: file.type,
      onProgress: ({ transferredBytes, totalBytes }) => {
        if (!totalBytes || !onProgress) {
          return;
        }

        onProgress(Math.round((transferredBytes / totalBytes) * 100));
      }
    }
  }).result;

  if (!storageIdentityId) {
    throw new Error("The private image storage identity could not be verified.");
  }

  return {
    storageKey: result.path,
    storageIdentityId,
    sanitizedFileName: safeName,
    contentType: file.type,
    sizeBytes: file.size
  } satisfies PrivateImageUploadResult;
}

export async function getPrivateImageUrl(storageKey?: string | null) {
  if (!storageKey) {
    return "";
  }

  const result = await getUrl({
    path: storageKey,
    options: {
      validateObjectExistence: true,
      expiresIn: 3600
    }
  });

  return result.url.toString();
}
