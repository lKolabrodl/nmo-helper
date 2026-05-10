export function createHash() {
	const parts = [];
	return {
		update(data) { parts.push(String(data)); return this; },
		digest() {
			const s = parts.join('');
			let h = 0x811c9dc5;
			for (let i = 0; i < s.length; i++) {
				h ^= s.charCodeAt(i);
				h = Math.imul(h, 0x01000193);
			}
			return (h >>> 0).toString(16).padStart(16, '0');
		},
	};
}
