"use client";

import { generateClient } from "aws-amplify/data";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { configureAmplifyClient } from "@/lib/amplifyClient";
import {
  loadPublicPassportImageDelivery,
  type PublicPassportImageDelivery
} from "@/lib/publicPassportImageDeliveryData";

type PublicImageState = "checking" | "loading" | "loaded" | "unavailable";
type ActiveDelivery = Extract<PublicPassportImageDelivery, { status: "available" }> & { requestId: number };

const imageLoadTimeoutMilliseconds = 15_000;
const processedImageMaxDimension = 1_600;

export function PublicPassportImage({ publicPassportSnapshotId }: { publicPassportSnapshotId: string }) {
  const client = useMemo(() => {
    configureAmplifyClient();
    return generateClient<Schema>();
  }, []);
  const [state, setState] = useState<PublicImageState>("checking");
  const [delivery, setDelivery] = useState<ActiveDelivery | null>(null);
  const requestIdRef = useRef(0);

  const loadDelivery = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setDelivery(null);
    setState("checking");

    const result = await loadPublicPassportImageDelivery(client, publicPassportSnapshotId);
    if (requestIdRef.current !== requestId) {
      return;
    }

    if (result.status !== "available") {
      setState("unavailable");
      return;
    }

    setDelivery({ ...result, requestId });
    setState("loading");
  }, [client, publicPassportSnapshotId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadDelivery();
    }, 0);

    return () => {
      window.clearTimeout(timeout);
      requestIdRef.current += 1;
    };
  }, [loadDelivery]);

  useEffect(() => {
    if (state !== "loading" || !delivery) {
      return;
    }

    const timeout = window.setTimeout(() => {
      if (requestIdRef.current === delivery.requestId) {
        setDelivery(null);
        setState("unavailable");
      }
    }, imageLoadTimeoutMilliseconds);

    return () => window.clearTimeout(timeout);
  }, [delivery, state]);

  if (state === "unavailable") {
    return null;
  }

  if (state === "checking" || !delivery) {
    return (
      <div
        className="mb-6 flex aspect-[8/5] max-h-[34rem] w-full max-w-full items-center justify-center rounded-md border border-ink/10 bg-ink/[0.03] px-4 text-center text-sm text-ink/55 shadow-soft"
        role="status"
      >
        Checking for a public setup image...
      </div>
    );
  }

  return (
    <figure className="mb-6 min-w-0 max-w-full overflow-hidden rounded-md border border-ink/10 bg-white shadow-soft">
      <div className="relative aspect-[8/5] max-h-[34rem] w-full max-w-full overflow-hidden bg-ink/[0.04]" aria-busy={state === "loading"}>
        {state === "loading" ? (
          <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-ink/55" role="status">
            Loading public setup image...
          </p>
        ) : null}
        {/* The resolver supplies a short-lived, validated public derivative URL. It must bypass framework/CDN optimization. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={`${publicPassportSnapshotId}:${delivery.requestId}`}
          src={delivery.imageUrl}
          alt={delivery.altText}
          width={1600}
          height={1000}
          decoding="async"
          loading="eager"
          draggable={false}
          referrerPolicy="no-referrer"
          onLoad={(event) => {
            if (requestIdRef.current !== delivery.requestId) {
              return;
            }

            if (
              event.currentTarget.naturalWidth < 1 ||
              event.currentTarget.naturalHeight < 1 ||
              event.currentTarget.naturalWidth > processedImageMaxDimension ||
              event.currentTarget.naturalHeight > processedImageMaxDimension
            ) {
              setDelivery(null);
              setState("unavailable");
              return;
            }

            setState("loaded");
          }}
          onError={() => {
            if (requestIdRef.current !== delivery.requestId) {
              return;
            }

            setDelivery(null);
            setState("unavailable");
          }}
          className={`h-full w-full object-cover transition-opacity duration-200 ${state === "loaded" ? "opacity-100" : "opacity-0"}`}
        />
      </div>
      <figcaption className="border-t border-ink/10 px-4 py-3 text-xs leading-5 text-ink/55">
        User-approved processed public image. Private originals and image metadata are not shown.
      </figcaption>
    </figure>
  );
}
