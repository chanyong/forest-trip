export interface PolicyInput { cycle?: string; day?: string | null; time?: string | null; weeks?: number | null; lastDay?: string | null }
export function policyInfo(p: PolicyInput | null | undefined, nowIso: string): { lastDay: string; rule: string | null; next: string | null; text: string; html: string } | null;
