/**
 * Типы и интерфейсы расширения NMO Helper.
 * @module types
 */

/** Сохранённое состояние панели расширения из chrome.storage */
export interface ExtensionState {
  /** URL страницы с ответами */
  savedUrl: string;
  /** Панель свёрнута */
  savedCollapsed: boolean;
  /** Позиция панели X (px) */
  savedLeft: number | null;
  /** Позиция панели Y (px) */
  savedTop: number | null;
  /** AI-режим включён */
  savedAiMode: boolean;
  /** Авто-поиск включён */
  savedAutoMode: boolean;
  /** API-ключ ProxyAPI */
  savedApiKey: string;
  /** Выбранная AI-модель */
  savedModel: string;
}

/** Ответ от background service worker после fetch-запроса */
export interface FetchResponse {
  /** true если произошла сетевая ошибка */
  error: boolean;
  /** HTTP-статус ответа */
  status: number;
  /** Тело ответа (HTML или JSON) */
  text: string;
  /** Текст ошибки (при error: true) */
  message?: string;
}

/** Описание AI-модели для выбора в панели */
export interface AiModel {
  /** Идентификатор модели для API */
  id: string;
  /** Отображаемое название */
  name: string;
  /** Уровень: low — дешёвые, ultra — максимальная точность */
  tier: 'low' | 'medium' | 'high' | 'ultra';
  /** Метка: rec — рекомендованная, pricey — дорогая */
  tag?: 'rec' | 'pricey';
}

/**
 * Функция поиска ответов по тексту вопроса.
 * Возвращает массив текстов правильных ответов или null если вопрос не найден.
 */
export type ParserFunction = (questionText: string) => string[] | null;

/** Конфигурация источника ответов (сайт с готовыми ответами) */
export interface SourceConfig {
  /** Создаёт парсер из DOM-контейнера загруженной страницы */
  parseAnswers: (div: HTMLElement) => ParserFunction;
}

/** Ключ источника ответов */
export type SourceKey = '24forcare' | 'rosmedicinfo';

/** Результат поиска теста на сайте */
export interface SearchResult {
  source: SourceKey;
  title: string;
  url: string;
}

/** URL найденных страниц с ответами на обоих сайтах */
export interface SearchUrls {
  rosmed: string | null;
  forcare: string | null;
}

/** Запись кеша авто-режима: ответы + источник */
export interface AutoCacheEntry {
  answers: string[];
  source: string;
}
