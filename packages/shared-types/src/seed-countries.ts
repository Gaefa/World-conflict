import type { CountryData } from './country';
import countriesData from './countries.json';

// Country seed data lives in countries.json (edit-friendly for non-coders).
// The cast is safe because the JSON is generated from / validated against the
// CountryData type in shared-types; if you edit the JSON by hand, run the
// server once — any type drift surfaces the first time the field is used.
export const SEED_COUNTRIES: CountryData[] = countriesData as CountryData[];
