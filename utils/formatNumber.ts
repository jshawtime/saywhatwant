/**
 * Format large numbers for display
 * 1-9999 → 1234
 * 10k-999k → 10k
 * 1M-999M → 1.2M
 * 1B-999B → 1.2B
 * 1T+ → 1.2T
 */
export function formatNumber(num: number): string {
  if (num < 10000) {
    // 1-9999: Display as is
    return num.toLocaleString();
  } else if (num < 1000000) {
    // 10k-999k
    const k = Math.floor(num / 1000);
    return `${k}k`;
  } else if (num < 1000000000) {
    // 1M-999M
    const m = (num / 1000000).toFixed(num < 10000000 ? 1 : 0);
    return `${m}M`.replace('.0', '');
  } else if (num < 1000000000000) {
    // 1B-999B
    const b = (num / 1000000000).toFixed(num < 10000000000 ? 1 : 0);
    return `${b}B`.replace('.0', '');
  } else {
    // 1T+
    const t = (num / 1000000000000).toFixed(num < 10000000000000 ? 1 : 0);
    return `${t}T`.replace('.0', '');
  }
}
