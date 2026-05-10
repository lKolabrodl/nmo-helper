export function join(...parts) { return parts.join('/'); }
export function dirname(p) { return p.replace(/\/[^/]+$/, '') || '.'; }
export function resolve(...parts) { return parts.join('/'); }
