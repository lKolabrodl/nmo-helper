import {describe, expect, it} from 'vitest';
import {normalizeAiProvider, normalizeTestDataSharingEnabled} from './SettingsContext';
import {normalizeUiMode} from './PanelUiContext';

describe('AI provider migration', () => {
	it('использует бесплатный режим для новой установки', () => {
		expect(normalizeAiProvider(undefined, 'auto')).toBe('free');
	});

	it('переносит старые ai и ai-pro в отдельного провайдера', () => {
		expect(normalizeAiProvider(undefined, 'ai')).toBe('proxy');
		expect(normalizeAiProvider(undefined, 'ai-pro')).toBe('custom');
		expect(normalizeUiMode('ai-pro')).toBe('ai');
	});

	it('не заменяет уже сохранённого провайдера данными старого режима', () => {
		expect(normalizeAiProvider('free', 'ai-pro')).toBe('free');
		expect(normalizeAiProvider('proxy', 'ai-pro')).toBe('proxy');
		expect(normalizeAiProvider('custom', 'ai')).toBe('custom');
	});
});

describe('test data sharing opt-in', () => {
	it('считает согласием только явно сохранённое значение true', () => {
		expect(normalizeTestDataSharingEnabled(true)).toBe(true);
		expect(normalizeTestDataSharingEnabled(false)).toBe(false);
		expect(normalizeTestDataSharingEnabled(undefined)).toBe(false);
		expect(normalizeTestDataSharingEnabled('true')).toBe(false);
		expect(normalizeTestDataSharingEnabled(1)).toBe(false);
	});
});
