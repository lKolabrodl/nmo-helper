import {describe, expect, it} from 'vitest';
import {AI_MODELS, DEFAULT_AI_MODEL, normalizeAiModel} from './constants';

describe('AI models', () => {
	it('contains the default model', () => {
		expect(AI_MODELS.some(model => model.id === DEFAULT_AI_MODEL)).toBe(true);
	});

	it('contains no duplicate IDs', () => {
		const ids = AI_MODELS.map(model => model.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('keeps available models and replaces removed models with the default', () => {
		expect(normalizeAiModel('gpt-5.6-terra')).toBe('gpt-5.6-terra');
		expect(normalizeAiModel('removed-model')).toBe(DEFAULT_AI_MODEL);
	});
});
