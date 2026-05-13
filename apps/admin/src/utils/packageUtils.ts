export const PACKAGE_PRICES: Record<number, number> = {
  1: 10,
  2: 20,
  3: 40,
  4: 80,
  5: 160,
  6: 320,
  7: 640,
  8: 1280,
  9: 2560,
  10: 5120
};

export function getPackagePrice(level: number): number {
  return PACKAGE_PRICES[level] || 0;
}

export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

export function formatUsdt(value: number): string {
  return `${value.toFixed(1)} USDT`;
}
