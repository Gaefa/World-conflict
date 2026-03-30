/** Format large numbers: 1000000 → "1.0M", 1500 → "1.5K" */
export function formatNumber(num: number): string {
  if (Math.abs(num) >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B';
  if (Math.abs(num) >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(num) >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return num.toFixed(0);
}

/** Format currency: 1500000 → "$1.5M" */
export function formatCurrency(num: number): string {
  return '$' + formatNumber(num);
}

/** Format percentage: 0.156 → "15.6%" */
export function formatPercent(num: number, decimals: number = 1): string {
  return (num * 100).toFixed(decimals) + '%';
}

/** Format time ago from ticks: 5 → "5 ticks ago" */
export function formatTicksAgo(currentTick: number, eventTick: number): string {
  const diff = currentTick - eventTick;
  if (diff <= 0) return 'just now';
  if (diff === 1) return '1 tick ago';
  return `${diff} ticks ago`;
}

/** Clamp a number between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Generate random number between min and max */
export function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/** Generate random integer between min and max (inclusive) */
export function randomInt(min: number, max: number): number {
  return Math.floor(randomBetween(min, max + 1));
}
