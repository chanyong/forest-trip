export function cleanSearchTerm(q: unknown): string;
export function track(name: string, params?: Record<string, unknown>): void;
export function trackSearch(q: string, results: number): string;
export function searchStep(skip: string | null | undefined, q: string): { skip: string | null; send: boolean };
