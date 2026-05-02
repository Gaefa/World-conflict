'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import type { Army, ArmyType, CountryState, PlayerAction, DiplomaticRelation } from '@conflict-game/shared-types';
import { useLocaleStore } from '@/stores/localeStore';

// ── Projection ───────────────────────────────────────────────────────────────
const W = 960;
const H = 480;

function project(lng: number, lat: number): [number, number] {
  return [((lng + 180) / 360) * W, ((90 - lat) / 180) * H];
}

// ── Capital locations (lat, lng) for all 30 game countries ──────────────────
const COUNTRY_LATLON: Record<string, [number, number]> = {
  US: [38.8951, -77.0364], CN: [39.9042, 116.4074], RU: [55.7558, 37.6173],
  IN: [28.6139, 77.209],   GB: [51.5074, -0.1278],  FR: [48.8566, 2.3522],
  DE: [52.52, 13.405],     JP: [35.6762, 139.6503], BR: [-15.7975, -47.8919],
  KR: [37.5665, 126.978],  AU: [-35.2809, 149.13],  CA: [45.4215, -75.6972],
  IT: [41.9028, 12.4964],  SA: [24.7136, 46.6753],  IR: [35.6892, 51.389],
  TR: [39.9334, 32.8597],  IL: [31.7683, 35.2137],  UA: [50.4501, 30.5234],
  PK: [33.6844, 73.0479],  EG: [30.0444, 31.2357],  NG: [9.0765, 7.3986],
  ZA: [-25.7479, 28.2293], MX: [19.4326, -99.1332], ID: [-6.2088, 106.8456],
  TH: [13.7563, 100.5018], PL: [52.2297, 21.0122],  AR: [-34.6037, -58.3816],
  ES: [40.4168, -3.7038],  SE: [59.3293, 18.0686],  KP: [39.0392, 125.7625],
};

// Pre-project capitals
const CAPITALS: Record<string, [number, number]> = {};
for (const [code, [lat, lng]] of Object.entries(COUNTRY_LATLON)) {
  CAPITALS[code] = project(lng, lat);
}

// ── Army icon shapes ─────────────────────────────────────────────────────────
function ArmyIcon({ type, cx, cy, size = 6 }: { type: ArmyType; cx: number; cy: number; size?: number }) {
  const s = size;
  switch (type) {
    case 'infantry':
      return <polygon points={`${cx},${cy - s} ${cx - s},${cy + s} ${cx + s},${cy + s}`} />;
    case 'armored':
      return <rect x={cx - s} y={cy - s} width={s * 2} height={s * 2} />;
    case 'airforce':
      return (
        <g strokeWidth={2}>
          <line x1={cx - s} y1={cy} x2={cx + s} y2={cy} />
          <line x1={cx} y1={cy - s} x2={cx} y2={cy + s} />
        </g>
      );
    case 'naval':
      return <circle cx={cx} cy={cy} r={s * 0.75} />;
    case 'special_ops':
      return (
        <g strokeWidth={1.5}>
          {[0, 60, 120, 180, 240, 300].map((angle) => {
            const r = (angle * Math.PI) / 180;
            return <line key={angle} x1={cx} y1={cy} x2={cx + Math.cos(r) * s} y2={cy + Math.sin(r) * s} />;
          })}
        </g>
      );
    default:
      return <circle cx={cx} cy={cy} r={s * 0.75} />;
  }
}

// ── Country fill color ────────────────────────────────────────────────────────
function getCountryFill(
  code: string | null,
  playerCode: string | null,
  relations: DiplomaticRelation[],
  isInGame: boolean,
): string {
  if (!code || !isInGame) return 'rgba(12, 17, 28, 0.5)';
  if (code === playerCode) return 'rgba(29, 78, 216, 0.65)';
  if (!playerCode) return 'rgba(35, 50, 72, 0.75)';
  const active = relations.filter(
    (r) =>
      r.status === 'active' &&
      ((r.fromCountry === playerCode && r.toCountry === code) ||
        (r.fromCountry === code && r.toCountry === playerCode)),
  );
  if (active.some((r) => r.type === 'war')) return 'rgba(185, 28, 28, 0.65)';
  if (active.some((r) => r.type === 'alliance')) return 'rgba(21, 128, 61, 0.55)';
  if (active.some((r) => r.type === 'sanction')) return 'rgba(180, 83, 9, 0.55)';
  return 'rgba(35, 50, 72, 0.75)';
}

// ── Topojson → SVG path (equirectangular, no d3) ────────────────────────────
interface GeoGeometry { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][]; }
interface GeoFeature { id?: string | number; type: 'Feature'; geometry: GeoGeometry; properties: Record<string, unknown>; }

function ringPath(ring: number[][]): string {
  return ring.map(([lng, lat], i) => {
    const [x, y] = project(lng, lat);
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ') + ' Z';
}

function geometryToPath(geo: GeoGeometry): string {
  if (geo.type === 'Polygon') {
    return (geo.coordinates as number[][][]).map(ringPath).join(' ');
  }
  return (geo.coordinates as number[][][][]).flatMap((p) => p.map(ringPath)).join(' ');
}

// Numeric ISO 3166-1 → alpha-2 mapping for the 30 game countries
const NUMERIC_TO_CODE: Record<string, string> = {
  '840': 'US', '156': 'CN', '643': 'RU', '356': 'IN', '826': 'GB',
  '250': 'FR', '276': 'DE', '392': 'JP', '076': 'BR', '410': 'KR',
  '036': 'AU', '124': 'CA', '380': 'IT', '682': 'SA', '364': 'IR',
  '792': 'TR', '376': 'IL', '804': 'UA', '586': 'PK', '818': 'EG',
  '566': 'NG', '710': 'ZA', '484': 'MX', '360': 'ID', '764': 'TH',
  '616': 'PL', '032': 'AR', '724': 'ES', '752': 'SE', '408': 'KP',
};

function featureCode(feat: GeoFeature): string | null {
  const numId = feat.id?.toString().padStart(3, '0');
  if (numId && NUMERIC_TO_CODE[numId]) return NUMERIC_TO_CODE[numId];
  const iso = feat.properties?.ISO_A2 as string;
  return iso && iso !== '-99' ? iso : null;
}

// ── Owner color palette ───────────────────────────────────────────────────────
const OWNER_COLORS: Record<string, string> = {
  US: '#3b82f6', CN: '#ef4444', RU: '#f97316', IN: '#eab308', GB: '#a855f7',
  FR: '#06b6d4', DE: '#84cc16', JP: '#ec4899', BR: '#10b981', KR: '#f59e0b',
  AU: '#22d3ee', CA: '#818cf8', IT: '#fb7185', SA: '#fde68a', IR: '#34d399',
  TR: '#f472b6', IL: '#60a5fa', UA: '#fbbf24', PK: '#a3e635', EG: '#e879f9',
};
function ownerColor(code: string): string {
  return OWNER_COLORS[code] ?? '#94a3b8';
}

// ── Component ─────────────────────────────────────────────────────────────────
export interface WarMapProps {
  armies: Army[];
  relations: DiplomaticRelation[];
  allCountries: Record<string, CountryState>;
  playerCountryCode: string | null;
  onAction?: (action: PlayerAction) => void;
}

export function WarMap({ armies, relations, allCountries, playerCountryCode, onAction }: WarMapProps) {
  const { t } = useLocaleStore();
  const [geoFeatures, setGeoFeatures] = useState<GeoFeature[]>([]);
  const [selectedArmyId, setSelectedArmyId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    fetch('/countries-110m.json')
      .then((r) => r.json())
      .then((topo: Topology) => {
        const land = feature(topo, topo.objects.countries);
        setGeoFeatures((land as unknown as { features: GeoFeature[] }).features);
      })
      .catch(() => {/* offline */});
  }, []);

  const gameCountryCodes = Object.keys(allCountries);
  const warFronts = relations.filter((r) => r.type === 'war' && r.status === 'active');
  const selectedArmy = armies.find((a) => a.id === selectedArmyId) ?? null;

  const handleSvgClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!selectedArmyId || !onAction) return;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * W;
      const py = ((e.clientY - rect.top) / rect.height) * H;
      const lng = (px / W) * 360 - 180;
      const lat = 90 - (py / H) * 180;
      onAction({ type: 'move_army', armyId: selectedArmyId, targetLat: lat, targetLng: lng });
      setSelectedArmyId(null);
    },
    [selectedArmyId, onAction],
  );

  return (
    <div className="space-y-1.5">
      {/* Legend */}
      <div className="flex gap-3 flex-wrap text-[10px] text-text-muted items-center">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: 'rgba(29,78,216,0.65)' }} /> {t.warmap_you}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: 'rgba(185,28,28,0.65)' }} /> {t.warmap_war}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: 'rgba(21,128,61,0.55)' }} /> {t.warmap_allied}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: 'rgba(180,83,9,0.55)' }} /> {t.warmap_sanctioned}
        </span>
        <span className="flex items-center gap-1 ml-2 text-[10px]">
          {t.warmap_units_legend}
        </span>
        {selectedArmyId && (
          <span className="ml-auto text-accent-amber font-bold text-[11px] animate-pulse">
            {t.warmap_click_move}
          </span>
        )}
      </div>

      {/* SVG map */}
      <div className="overflow-x-auto rounded border border-border-default bg-[#0a0f1a]">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          style={{ minWidth: 480, width: '100%', maxHeight: 260, display: 'block' }}
          onClick={handleSvgClick}
          className={selectedArmyId ? 'cursor-crosshair' : 'cursor-default'}
        >
          <rect width={W} height={H} fill="#0a0f1a" />

          {/* Country polygons */}
          {geoFeatures.map((feat, i) => {
            const code = featureCode(feat);
            const path = geometryToPath(feat.geometry);
            if (!path) return null;
            const inGame = code ? gameCountryCodes.includes(code) : false;
            return (
              <path
                key={i}
                d={path}
                fill={getCountryFill(code, playerCountryCode, relations, inGame)}
                stroke="#1e2d40"
                strokeWidth={0.4}
              />
            );
          })}

          {/* War front lines */}
          {warFronts.map((r) => {
            const a = CAPITALS[r.fromCountry];
            const b = CAPITALS[r.toCountry];
            if (!a || !b) return null;
            return (
              <g key={`front-${r.id}`}>
                <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
                  stroke="#ef4444" strokeWidth={2} strokeDasharray="7 3" opacity={0.75} />
                {/* Midpoint war badge */}
                <text
                  x={(a[0] + b[0]) / 2} y={(a[1] + b[1]) / 2 - 3}
                  textAnchor="middle" fontSize={8} fill="#ef4444" fontWeight="bold"
                  style={{ userSelect: 'none' }}
                >
                  ⚔
                </text>
              </g>
            );
          })}

          {/* Army movement target lines */}
          {armies.map((army) => {
            if (!army.targetLatitude || !army.targetLongitude) return null;
            const [x1, y1] = project(army.longitude, army.latitude);
            const [x2, y2] = project(army.targetLongitude, army.targetLatitude);
            return (
              <line key={`mv-${army.id}`}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={ownerColor(army.ownerCountry)} strokeWidth={0.8}
                strokeDasharray="3 2" opacity={0.45}
              />
            );
          })}

          {/* Capital dots */}
          {gameCountryCodes.map((code) => {
            const pos = CAPITALS[code];
            if (!pos) return null;
            return <circle key={`cap-${code}`} cx={pos[0]} cy={pos[1]} r={2} fill="#475569" opacity={0.5} />;
          })}

          {/* Army markers */}
          {armies.map((army) => {
            const [cx, cy] = project(army.longitude, army.latitude);
            const color = ownerColor(army.ownerCountry);
            const isSelected = army.id === selectedArmyId;
            const isOwn = army.ownerCountry === playerCountryCode;
            return (
              <g
                key={army.id}
                onClick={(e) => { e.stopPropagation(); setSelectedArmyId(isSelected ? null : army.id); }}
                style={{ cursor: isOwn ? 'pointer' : 'default' }}
              >
                {/* Selection / status rings */}
                {isSelected && (
                  <circle cx={cx} cy={cy} r={15} fill="none" stroke="#fff" strokeWidth={1.5} opacity={0.85} />
                )}
                {army.status === 'moving' && (
                  <circle cx={cx} cy={cy} r={12} fill="none" stroke={color} strokeWidth={1}
                    strokeDasharray="3 2" opacity={0.5} />
                )}
                {/* Background halo */}
                <circle cx={cx} cy={cy} r={9} fill={color} opacity={0.18} />
                {/* Icon */}
                <g fill={color} stroke={color} strokeWidth={0.5}>
                  <ArmyIcon type={army.type as ArmyType} cx={cx} cy={cy} size={6} />
                </g>
                {/* Labels */}
                <text x={cx} y={cy + 19} textAnchor="middle" fontSize={7} fill={color}
                  opacity={0.9} fontFamily="monospace" style={{ userSelect: 'none' }}>
                  {army.ownerCountry}
                </text>
                <text x={cx} y={cy - 14} textAnchor="middle" fontSize={6} fill="#94a3b8"
                  opacity={0.8} fontFamily="monospace" style={{ userSelect: 'none' }}>
                  {army.size >= 1000 ? `${(army.size / 1000).toFixed(0)}k` : army.size}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected army detail */}
      {selectedArmy && (
        <div className="flex items-center gap-3 bg-bg-card border border-border-default rounded px-3 py-1.5 text-xs">
          <span className="font-bold text-text-primary">{selectedArmy.name}</span>
          <span className="text-text-muted uppercase">{selectedArmy.ownerCountry}</span>
          <span className="text-accent-blue capitalize">{selectedArmy.type.replace('_', ' ')}</span>
          <span className="font-mono text-text-secondary">{selectedArmy.size.toLocaleString()}</span>
          <span className={`capitalize ${
            selectedArmy.status === 'moving' ? 'text-accent-amber' :
            selectedArmy.status === 'attacking' ? 'text-severity-high' :
            selectedArmy.status === 'defending' ? 'text-accent-green' : 'text-text-muted'
          }`}>{selectedArmy.status}</span>
          <span className="text-text-muted">morale {selectedArmy.morale}</span>
          <span className="text-text-muted">exp {selectedArmy.experience}</span>
          {selectedArmy.ownerCountry === playerCountryCode && (
            <span className="ml-auto text-text-muted text-[10px]">Click map to issue move order</span>
          )}
        </div>
      )}
    </div>
  );
}
