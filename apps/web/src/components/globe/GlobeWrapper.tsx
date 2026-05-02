'use client';

import dynamic from 'next/dynamic';
import { useRef, useCallback, useState, useEffect } from 'react';
import type { GlobeMethods } from 'react-globe.gl';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import { NUMERIC_TO_COUNTRY } from './country-codes';

const Globe = dynamic(() => import('react-globe.gl').then((mod) => mod.default), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-text-muted text-sm animate-pulse">Loading Globe...</div>
    </div>
  ),
});

interface CountryPolygon {
  id: string;
  properties: Record<string, unknown>;
}

interface CountryPoint {
  lat: number;
  lng: number;
  code: string;
  name: string;
  flag: string;
  size: number;
  color: string;
}

interface GlobeWrapperProps {
  onCountryClick?: (countryCode: string, countryName: string) => void;
  selectedCountry?: string | null;
  highlightedCountries?: string[];
  countryPoints?: CountryPoint[];
  gameCountryCodes?: string[];
  /** Disable auto-rotation once game is active so the map stays put */
  isGameActive?: boolean;
  /** Set of country codes the player is at war with */
  warCountries?: Set<string>;
  /** Set of country codes that are allied with the player */
  allyCountries?: Set<string>;
  /** Set of country codes the player has sanctioned */
  sanctionedCountries?: Set<string>;
}

function resolveCountry(feat: CountryPolygon): { code: string; name: string } | null {
  // Try numeric ID first (countries-110m.json uses this)
  const numId = feat.id?.toString().padStart(3, '0');
  if (numId && NUMERIC_TO_COUNTRY[numId]) {
    return NUMERIC_TO_COUNTRY[numId];
  }
  // Try ISO_A2 from properties (some GeoJSON sources)
  const iso = feat.properties?.ISO_A2 as string;
  const admin = feat.properties?.ADMIN as string;
  if (iso && iso !== '-99') return { code: iso, name: admin || iso };
  return null;
}

export function GlobeWrapper({
  onCountryClick,
  selectedCountry,
  highlightedCountries = [],
  countryPoints = [],
  gameCountryCodes = [],
  isGameActive = false,
  warCountries = new Set(),
  allyCountries = new Set(),
  sanctionedCountries = new Set(),
}: GlobeWrapperProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [countries, setCountries] = useState<{ features: CountryPolygon[] }>({ features: [] });
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [ready, setReady] = useState(false);

  // Load country polygons
  useEffect(() => {
    // Load country polygons from our own bundled copy first, so the game
    // works 100% offline. Fall back to jsDelivr, then unpkg, only if the
    // local copy is missing (e.g. dev hot-reload before public/ is ready).
    const tryLoad = async () => {
      const urls = [
        'countries-110m.json',
        'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json',
        'https://unpkg.com/world-atlas@2/countries-110m.json',
      ];
      for (const url of urls) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const worldData: Topology = await res.json();
          const land = feature(worldData, worldData.objects.countries);
          setCountries(land as unknown as { features: CountryPolygon[] });
          return;
        } catch {
          // try next
        }
      }
    };
    tryLoad();
  }, []);

  // Measure container
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        if (clientWidth > 0 && clientHeight > 0) {
          setDimensions({ width: clientWidth, height: clientHeight });
          setReady(true);
        }
      }
    };
    requestAnimationFrame(updateDimensions);
    const observer = new ResizeObserver(updateDimensions);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Configure globe controls
  useEffect(() => {
    if (globeRef.current) {
      const controls = globeRef.current.controls();
      // Stop auto-rotation once a game is active — prevents the map from
      // "floating away" while the player is trying to click on countries.
      controls.autoRotate = !isGameActive;
      controls.autoRotateSpeed = 0.3;
      controls.enableZoom = true;
      controls.minDistance = 150;
      controls.maxDistance = 500;
    }
  }, [ready, countries, isGameActive]);

  // ── Polygon callbacks ──
  const getPolygonColor = useCallback(
    (d: object) => {
      const resolved = resolveCountry(d as CountryPolygon);
      if (!resolved) return 'rgba(40, 50, 65, 0.6)';
      const code = resolved.code;
      if (code === selectedCountry)       return 'rgba(220, 38, 38, 0.85)';  // selected: bright red
      if (warCountries.has(code))         return 'rgba(185, 28, 28, 0.75)';  // at war: dark red
      if (allyCountries.has(code))        return 'rgba(21, 128, 61, 0.65)';  // ally: green
      if (sanctionedCountries.has(code))  return 'rgba(180, 83, 9, 0.65)';   // sanctioned: orange
      if (highlightedCountries.includes(code)) return 'rgba(245, 158, 11, 0.45)'; // other game country: amber
      if (gameCountryCodes.includes(code)) return 'rgba(70, 85, 110, 0.85)';
      return 'rgba(50, 60, 80, 0.7)';
    },
    [selectedCountry, highlightedCountries, gameCountryCodes, warCountries, allyCountries, sanctionedCountries],
  );

  const getPolygonSideColor = useCallback(() => 'rgba(40, 45, 60, 0.6)', []);
  const getPolygonStrokeColor = useCallback(() => '#4a5568', []);

  const handlePolygonClick = useCallback(
    (polygon: object) => {
      const resolved = resolveCountry(polygon as CountryPolygon);
      if (resolved && onCountryClick) {
        onCountryClick(resolved.code, resolved.name);
      }
    },
    [onCountryClick],
  );

  const getPolygonLabel = useCallback((d: object) => {
    const resolved = resolveCountry(d as CountryPolygon);
    if (!resolved) return '';
    return `<div style="background:rgba(10,10,15,0.92);padding:6px 12px;border-radius:4px;border:1px solid #3a3a50;font-size:13px;color:#e5e7eb;">
      <b>${resolved.name}</b> <span style="color:#6b7280;font-size:11px;">(${resolved.code})</span>
    </div>`;
  }, []);

  // ── Point callbacks ──
  const getPointColor = useCallback((d: object) => (d as CountryPoint).color, []);
  const getPointAlt = useCallback(() => 0.015, []);
  const getPointRadius = useCallback((d: object) => (d as CountryPoint).size, []);

  const getPointLabel = useCallback((d: object) => {
    const pt = d as CountryPoint;
    return `<div style="background:rgba(10,10,15,0.95);padding:8px 14px;border-radius:4px;border:1px solid #3a3a50;font-size:14px;color:#e5e7eb;">
      <span style="font-size:20px">${pt.flag}</span>&nbsp;&nbsp;<b>${pt.name}</b>
    </div>`;
  }, []);

  const handlePointClick = useCallback(
    (point: object) => {
      const pt = point as CountryPoint;
      if (onCountryClick) {
        onCountryClick(pt.code, pt.name);
      }
    },
    [onCountryClick],
  );

  return (
    <div ref={containerRef} className="w-full h-full absolute inset-0">
      {ready && (
        <Globe
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          globeImageUrl="earth-dark.jpg"
          backgroundColor="rgba(0,0,0,0)"
          atmosphereColor="#334155"
          atmosphereAltitude={0.12}
          polygonsData={countries.features}
          polygonAltitude={0.01}
          polygonCapColor={getPolygonColor}
          polygonSideColor={getPolygonSideColor}
          polygonStrokeColor={getPolygonStrokeColor}
          polygonLabel={getPolygonLabel}
          onPolygonClick={handlePolygonClick}
          pointsData={countryPoints}
          pointLat="lat"
          pointLng="lng"
          pointColor={getPointColor}
          pointAltitude={getPointAlt}
          pointRadius={getPointRadius}
          pointLabel={getPointLabel}
          onPointClick={handlePointClick}
          animateIn={true}
        />
      )}
    </div>
  );
}
