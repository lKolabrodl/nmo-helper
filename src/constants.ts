/**
 * Константы расширения NMO Helper.
 * @module constants
 */

import type { AiModel } from './types';

/** Цвет подсветки правильных ответов */
export const HIGHLIGHT_COLOR = '#4ecca3';

/** Интервал опроса DOM на изменение вопроса (мс) */
export const POLL_INTERVAL = 500;

/** Единый OpenAI-совместимый endpoint ProxyAPI для всех провайдеров */
export const AI_URL = 'https://openai.api.proxyapi.ru/v1/chat/completions';

/**
 * Список доступных AI-моделей.
 * - tier: уровень (low → ultra)
 * - tag: 'rec' — рекомендованная, 'pricey' — дорогая
 */
export const AI_MODELS: AiModel[] = [
  { id: 'gpt-4.1-nano',           name: 'gpt-4.1-nano',           tier: 'low' },
  { id: 'gpt-4o-mini',            name: 'gpt-4o-mini',            tier: 'low' },
  { id: 'gpt-5.4-nano',           name: 'gpt-5.4-nano',           tier: 'low' },
  { id: 'gemini-2.0-flash-lite',  name: 'gemini-2.0-flash-lite',  tier: 'low' },
  { id: 'gemini-2.0-flash',       name: 'gemini-2.0-flash',       tier: 'low' },
  { id: 'claude-haiku-4-5',       name: 'claude-haiku-4.5',       tier: 'low' },
  { id: 'gpt-4.1-mini',           name: 'gpt-4.1-mini',           tier: 'medium', tag: 'rec' },
  { id: 'gpt-4o',                 name: 'gpt-4o',                 tier: 'medium' },
  { id: 'gpt-5-mini',             name: 'gpt-5-mini',             tier: 'medium' },
  { id: 'gpt-5.4-mini',           name: 'gpt-5.4-mini',           tier: 'medium' },
  { id: 'gemini-2.5-flash',       name: 'gemini-2.5-flash',       tier: 'medium', tag: 'rec' },
  { id: 'gpt-4.1',                name: 'gpt-4.1',                tier: 'high' },
  { id: 'gpt-5',                  name: 'gpt-5',                  tier: 'high',   tag: 'pricey' },
  { id: 'gpt-5.4',                name: 'gpt-5.4',                tier: 'high',   tag: 'pricey' },
  { id: 'o3-mini',                name: 'o3-mini',                tier: 'high',   tag: 'rec' },
  { id: 'o4-mini',                name: 'o4-mini',                tier: 'high',   tag: 'rec' },
  { id: 'gemini-2.5-pro',         name: 'gemini-2.5-pro',         tier: 'high' },
  { id: 'claude-sonnet-4-6',      name: 'claude-sonnet-4.6',      tier: 'high' },
  { id: 'o3',                     name: 'o3',                     tier: 'ultra',  tag: 'pricey' },
  { id: 'gemini-3.1-pro-preview', name: 'gemini-3.1-pro',         tier: 'ultra' },
  { id: 'claude-opus-4-6',        name: 'claude-opus-4.6',        tier: 'ultra',  tag: 'rec' },
];
