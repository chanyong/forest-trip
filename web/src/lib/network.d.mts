export interface NetworkSite { url: string; name: string; desc: string; icon: string }
export interface NetworkData { utm: { source: string; medium: string }; self: string; sites: NetworkSite[] }
export function networkLinks(network: NetworkData): (NetworkSite & { href: string })[];
