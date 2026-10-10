import { useState, useEffect, useCallback } from "react";
import type { BrowserProvider } from "ethers";
import { getParticipantInfo } from "./contract";

export interface ParticipantNameInfo {
  name: string;
  isRegistered: boolean;
  loading: boolean;
}

type ParticipantMap = Record<string, ParticipantNameInfo>;

const NOT_FOUND: ParticipantNameInfo = {
  name: "Unknown organization",
  isRegistered: false,
  loading: false,
};

export function useParticipantCache(provider: BrowserProvider | null) {
  const [participants, setParticipants] = useState<ParticipantMap>({});

  const fetchParticipant = useCallback(
    async (address: string): Promise<ParticipantNameInfo> => {
      if (!provider) return NOT_FOUND;
      try {
        const info = await getParticipantInfo(provider, address);
        if (info.isRegistered) {
          return { name: info.name, isRegistered: true, loading: false };
        }
        return NOT_FOUND;
      } catch {
        return NOT_FOUND;
      }
    },
    [provider]
  );

  const getParticipant = useCallback(
    (address: string): ParticipantNameInfo => {
      const key = address.toLowerCase();
      return participants[key] ?? { name: "", isRegistered: false, loading: true };
    },
    [participants]
  );

  const ensureParticipant = useCallback(
    (address: string) => {
      if (!address || !provider) return;
      const key = address.toLowerCase();
      setParticipants((prev) => {
        if (prev[key] !== undefined) return prev;
        return { ...prev, [key]: { name: "", isRegistered: false, loading: true } };
      });
    },
    [provider]
  );

  useEffect(() => {
    if (!provider) return;
    const loadingKeys = Object.entries(participants)
      .filter(([, info]) => info.loading)
      .map(([key]) => key);
    if (loadingKeys.length === 0) return;

    let cancelled = false;
    (async () => {
      const updates: ParticipantMap = {};
      for (const key of loadingKeys) {
        const info = await fetchParticipant(key);
        updates[key] = info;
      }
      if (!cancelled && Object.keys(updates).length > 0) {
        setParticipants((prev) => ({ ...prev, ...updates }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [participants, fetchParticipant]);

  return { getParticipant, ensureParticipant };
}
