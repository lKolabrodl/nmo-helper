import { describe, it, expect } from 'vitest';
import { detectSource, similarity } from './matching';

describe('detectSource', () => {
	it('24forcare.com → "24forcare"', () => {
		expect(detectSource('https://24forcare.com/test/123')).toBe('24forcare');
	});

	it('rosmedicinfo.ru → "rosmedicinfo"', () => {
		expect(detectSource('https://rosmedicinfo.ru/answers')).toBe('rosmedicinfo');
	});

	it('неизвестный домен → null', () => {
		expect(detectSource('https://example.com')).toBeNull();
	});

	it('пустая строка → null', () => {
		expect(detectSource('')).toBeNull();
	});
});

describe('similarity', () => {
	it('одинаковые строки → 1', () => {
		expect(similarity('abc', 'abc')).toBe(1);
	});

	it('совершенно разные строки → близко к 0', () => {
		expect(similarity('abc', 'xyz')).toBeLessThan(0.3);
	});

	it('короткие строки (<2 символов) → 0', () => {
		expect(similarity('a', 'a')).toBe(1); // exact match
		expect(similarity('a', 'b')).toBe(0);
	});

	it('похожие строки → высокий score', () => {
		const score = similarity('кардиология', 'кардиологии');
		expect(score).toBeGreaterThan(0.8);
	});

	it('непохожие строки → низкий score', () => {
		const score = similarity('кардиология', 'офтальмология');
		expect(score).toBeLessThan(0.5);
	});
});
