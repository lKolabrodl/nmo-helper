/**
 * Типы и интерфейсы расширения NMO Helper.
 * @module types
 */

/** Сохранённое состояние панели расширения из chrome.storage */
export interface IExtensionState {
  /** URL страницы с ответами */
  readonly savedUrl: string;
  /** Панель свёрнута */
  readonly savedCollapsed: boolean;
  /** Позиция панели X (px) */
  readonly savedLeft: number | null;
  /** Позиция панели Y (px) */
  readonly savedTop: number | null;
  /** Активный режим */
  readonly savedMode: string;
  /** API-ключ ProxyAPI */
  readonly savedApiKey: string;
  /** Выбранная AI-модель */
  readonly savedModel: string;
  /** Кастомный AI endpoint URL */
  readonly savedCustomAiUrl: string;
  /** Токен для кастомного AI endpoint */
  readonly savedCustomAiToken: string;
  /** Модель для кастомного AI endpoint */
  readonly savedCustomAiModel: string;
}

/** Описание AI-модели для выбора в панели */
export interface IAiModel {
  /** Идентификатор модели для API */
  readonly id: string;
  /** Отображаемое название */
  readonly name: string;
  /** Уровень: low — дешёвые, ultra — максимальная точность */
  readonly tier: 'low' | 'medium' | 'high' | 'ultra';
  /** Метка: rec — рекомендованная, pricey — дорогая */
  readonly tag?: 'rec' | 'pricey';
}

/** Ключ источника ответов */
export type ISourceKey = '24forcare' | 'rosmedicinfo';

/** Варианты статуса панели */
export const Status = {
  IDLE: 'idle',
  OK: 'ok',
  ERR: 'err',
  WARN: 'warn',
  LOADING: 'loading',
} as const;

export type StatusType = typeof Status[keyof typeof Status];

/** Информация о статусе для отображения в панели */
export interface IStatusInfo {
  readonly title: string;
  readonly status: StatusType;
}
