import {describe, expect, it} from 'vitest';
import {
	buildCanonicalNmoRequest,
	createInstallationIdentity,
	isValidIdentity,
} from './nmo-crypto';

describe('buildCanonicalNmoRequest', () => {
	it('совпадает с серверным протоколом для пустого GET-тела', async () => {
		const canonical = await buildCanonicalNmoRequest(
			'11111111-2222-4333-8444-555555555555',
			'2000000000',
			'AAAAAAAAAAAAAAAAAAAAAQ',
			'get',
			'/api/nmo/topics?q=%D0%A2%D0%B5%D0%BC%D0%B0',
			'',
			new Uint8Array(),
		);

		expect(new TextDecoder().decode(canonical)).toBe([
			'NMO-REQUEST-V1',
			'11111111-2222-4333-8444-555555555555',
			'2000000000',
			'AAAAAAAAAAAAAAAAAAAAAQ',
			'GET',
			'/api/nmo/topics?q=%D0%A2%D0%B5%D0%BC%D0%B0',
			'',
			'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		].join('\n'));
	});

	it('создаёт валидную P-256 идентичность с неэкспортируемым закрытым ключом', async () => {
		const identity = await createInstallationIdentity();
		const canonical = await buildCanonicalNmoRequest(
			'',
			'2000000000',
			'AAAAAAAAAAAAAAAAAAAAAQ',
			'POST',
			'/api/nmo/installations',
			'',
			new TextEncoder().encode('{"public_key":"test"}'),
		);
		const signature = await crypto.subtle.sign(
			{name: 'ECDSA', hash: 'SHA-256'},
			identity.privateKey,
			canonical,
		);

		expect(identity.privateKey.extractable).toBe(false);
		expect(identity.publicKey).toMatch(/^[A-Za-z0-9_-]{87}$/);
		expect(isValidIdentity(identity)).toBe(true);
		expect(signature.byteLength).toBe(64);
	});
});
