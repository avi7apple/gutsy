import type { ScanResult } from "@/types/scan";

let pendingScanResult: ScanResult | null = null;

export function setPendingScanResult(result: ScanResult): void {
  pendingScanResult = result;
}

export function getPendingScanResult(): ScanResult | null {
  const result = pendingScanResult;
  pendingScanResult = null;
  return result;
}
