'use client';

import { useQuery } from '@tanstack/react-query';
import type { CountryData } from '@conflict-game/shared-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export function useCountries() {
  return useQuery<CountryData[]>({
    queryKey: ['countries'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/game/countries`);
      if (!res.ok) throw new Error('Failed to fetch countries');
      const data = await res.json();
      return data.countries;
    },
    staleTime: Infinity, // Seed data never changes
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
