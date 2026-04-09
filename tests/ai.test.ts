import { describe, it, expect } from 'vitest';
import { getApiModel } from '../src/ai';

describe('getApiModel — маппинг моделей с префиксом провайдера', () => {
  it('добавляет префикс anthropic/ для моделей Claude', () => {
    expect(getApiModel('claude-sonnet-4-6')).toBe('anthropic/claude-sonnet-4-6');
    expect(getApiModel('claude-opus-4-6')).toBe('anthropic/claude-opus-4-6');
    expect(getApiModel('claude-haiku-4-5')).toBe('anthropic/claude-haiku-4-5');
  });

  it('добавляет префикс gemini/ для моделей Gemini', () => {
    expect(getApiModel('gemini-2.0-flash')).toBe('gemini/gemini-2.0-flash');
    expect(getApiModel('gemini-2.5-pro')).toBe('gemini/gemini-2.5-pro');
  });

  it('возвращает модели OpenAI без префикса', () => {
    expect(getApiModel('gpt-4o-mini')).toBe('gpt-4o-mini');
    expect(getApiModel('gpt-4.1')).toBe('gpt-4.1');
    expect(getApiModel('o3-mini')).toBe('o3-mini');
  });
});
