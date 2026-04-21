'use client';

import { useQuery } from '@tanstack/react-query';
import { SEED_COUNTRIES } from '@conflict-game/shared-types';
import type { CountryData } from '@conflict-game/shared-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

/**
 * Country seed data ships with the client bundle (shared-types), so this
 * hook never actually needs the network. The useQuery wrapper stays to keep
 * the call site API compatible with the rest of the codebase.
 */
export function useCountries() {
  return useQuery<CountryData[]>({
    queryKey: ['countries'],
    queryFn: async () => SEED_COUNTRIES,
    staleTime: Infinity,
    initialData: SEED_COUNTRIES,
  });
}

export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/game/sessions`);
      if (!res.ok) throw new Error('Failed to fetch sessions');
      const data = await res.json();
      return data.sessions;
    },
    refetchInterval: 5000,
  });
}
