import { startTransition, useEffect, useState } from "react";
import { type AiDigestDto, fetchAiDigest } from "../services/bffClient";

type UseAiDigestResult = {
  aiDigest: AiDigestDto | null;
  refreshAiDigest: () => Promise<AiDigestDto | null>;
};

async function loadAiDigest(siteId: string): Promise<AiDigestDto | null> {
  try {
    return await fetchAiDigest(siteId);
  } catch {
    return null;
  }
}

export default function useAiDigest(siteId: string): UseAiDigestResult {
  const [aiDigest, setAiDigest] = useState<AiDigestDto | null>(null);

  async function refreshAiDigest(): Promise<AiDigestDto | null> {
    const nextDigest = await loadAiDigest(siteId);
    startTransition(() => {
      setAiDigest(nextDigest);
    });
    return nextDigest;
  }

  useEffect(() => {
    let active = true;

    startTransition(() => {
      setAiDigest(null);
    });

    async function load() {
      const nextDigest = await loadAiDigest(siteId);
      if (!active) {
        return;
      }
      startTransition(() => {
        setAiDigest(nextDigest);
      });
    }

    void load();
    return () => {
      active = false;
    };
  }, [siteId]);

  return { aiDigest, refreshAiDigest };
}
