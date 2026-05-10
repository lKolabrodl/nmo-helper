export const process = {env: {}};

export const Buffer = {
	from(data) {
		if (data instanceof Uint8Array) return data;
		if (data instanceof ArrayBuffer) return new Uint8Array(data);
		if (typeof data === 'string') return new TextEncoder().encode(data);
		return new Uint8Array(data);
	},
};
