import {describe, expect, it} from 'vitest';
import {buildCanonicalNmoRequest, isProtectedNmoApiRequest} from './nmo-auth';

describe('isProtectedNmoApiRequest', () => {
	it.each([
		'https://nmo-helper.ru/api/nmo/topics?q=тема',
		'https://nmo-helper.ru/api/nmo/topic',
	])('разрешает точный защищённый endpoint: %s', value => {
		expect(isProtectedNmoApiRequest(value)).toBe(true);
	});

	it.each([
		'http://nmo-helper.ru/api/nmo/topics?q=тема',
		'https://www.nmo-helper.ru/api/nmo/topic',
		'https://nmo-helper.ru.evil.example/api/nmo/topic',
		'https://nmo-helper.ru/api/nmo/topic/uid',
		'https://nmo-helper.ru/api/version',
		'not a url',
	])('не выдаёт подпись постороннему URL: %s', value => {
		expect(isProtectedNmoApiRequest(value)).toBe(false);
	});
});

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

	it('P-256 создаёт неэкспортируемый закрытый ключ и 64-байтную подпись', async () => {
		const keyPair = await crypto.subtle.generateKey(
			{name: 'ECDSA', namedCurve: 'P-256'},
			false,
			['sign', 'verify'],
		) as CryptoKeyPair;
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
			keyPair.privateKey,
			canonical,
		);
		const publicKey = await crypto.subtle.exportKey('raw', keyPair.publicKey);

		expect(keyPair.privateKey.extractable).toBe(false);
		expect(publicKey.byteLength).toBe(65);
		expect(signature.byteLength).toBe(64);
	});
});
