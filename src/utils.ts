/**
 * Утилиты: обёртки над Chrome API, нормализация текста, очистка HTML.
 * @module utils
 */

import type { FetchResponse } from './types';

/**
 * Читает значение из chrome.storage.local.
 * @param key — ключ хранилища
 * @param defaultValue — значение по умолчанию, если ключ не найден
 */
export function storageGet<T>(key: string, defaultValue: T): Promise<T> {
  return new Promise<T>(resolve => {
    chrome.storage.local.get(key, (result: Record<string, unknown>) => {
      resolve((result[key] !== undefined ? result[key] : defaultValue) as T);
    });
  });
}

/**
 * Записывает значение в chrome.storage.local.
 * @param key — ключ хранилища
 * @param value — значение для сохранения
 */
export function storageSet(key: string, value: unknown): void {
  chrome.storage.local.set({ [key]: value });
}

/**
 * Выполняет HTTP-запрос через background service worker (обход CORS).
 * Content-скрипты не могут делать cross-origin запросы напрямую,
 * поэтому запрос отправляется через chrome.runtime.sendMessage → background.ts.
 */
export function fetchViaBackground(url: string, options: {
  method?: string;
  headers?: Record<string, string> | null;
  body?: string | null;
} = {}): Promise<FetchResponse> {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({
      action: 'fetch',
      url,
      method: options.method || 'GET',
      headers: options.headers || null,
      body: options.body || null,
    }, resolve);
  });
}

/** Регулярка для всех Unicode-тире и дефисов */
const DASH_RE = /[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\u00AD\uFE58\uFE63\uFF0D]/g;

/**
 * Нормализует текст для поиска: тире → дефис, пробелы, кириллица-двойники → латиница, lowercase.
 * Используется для сравнения текста вопроса с заголовками на сайтах-источниках.
 */
export function normalizeDashes(s: string): string {
  return s
    .replace(DASH_RE, '-')
    .replace(/\s+/g, ' ')
    .replace(/\u0410/gi, 'a').replace(/\u0415/gi, 'e')
    .replace(/\u041E/gi, 'o').replace(/\u0420/gi, 'p')
    .replace(/\u0421/gi, 'c').replace(/\u0425/gi, 'x')
    .trim()
    .toLowerCase();
}

/**
 * Исправляет смешанные кириллические/латинские символы-двойники в тексте.
 * Например, русская «а» в английском слове заменяется на латинскую «a» и наоборот.
 */
export function fixMixedChars(text: string): string {
  return text
    // Кириллическая «а» в латинском слове → латинская «a»
    .replace(/\b[a-zA-Z]*[\u0430\u0410]\w*\b/g, m => m.replace(/\u0430/g, 'a'))
    // Кириллическая «о» в латинском слове → латинская «o»
    .replace(/\b[a-zA-Z]*[\u043E\u041E]\w*\b/g, m => m.replace(/\u043E/g, 'o'))
    // Латинская «a» в кириллическом слове → кириллическая «а»
    .replace(/[\u0430-\u044F\u0410-\u042F\u0451\u0401]+[aA]\w*/g, m => m.replace(/a/gi, '\u0430'))
    // Латинская «o» в кириллическом слове → кириллическая «о»
    .replace(/[\u0430-\u044F\u0410-\u042F\u0451\u0401]+[oO]\w*/g, m => m.replace(/o/gi, '\u043E'));
}

/**
 * Исправляет смешанные символы во всех текстовых элементах внутри контейнера.
 * Обрабатывает h3, strong, span — элементы, содержащие текст вопросов и ответов.
 */
export function fixAllTextNodes(div: HTMLElement): void {
  const fix = (sel: string) => {
    div.querySelectorAll<HTMLElement>(sel).forEach(el => {
      if (!(el.innerText || '').match(/[aAoO]/)) return;
      el.innerText = fixMixedChars(el.innerText);
    });
  };
  fix('h3'); fix('strong'); fix('span');
}

/**
 * Удаляет опасные теги и event-handler атрибуты из HTML через DOMParser.
 * DOMParser не выполняет скрипты при парсинге (по спецификации),
 * но мы дополнительно вычищаем опасные элементы и атрибуты.
 */
export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,iframe,object,embed,form,svg,math,link,meta,base,template,style')
    .forEach(el => el.remove());
  doc.querySelectorAll('*').forEach(el => {
    for (const attr of [...el.attributes]) {
      if (attr.name.startsWith('on') || attr.value.trim().toLowerCase().startsWith('javascript:')) {
        el.removeAttribute(attr.name);
      }
    }
  });
  return doc.body.innerHTML;
}

/**
 * Очищает HTML-строку от навигации, скриптов, меню и прочих лишних элементов.
 * Оставляет только контент с ответами (начиная с `<div class="row">`).
 */
export function cleanHtml(html: string): string {
  return html.replace(/\s+/g, ' ')
    .replace(/.*?(<div class="row">)/, '$1')
    .replace(/<footer.*?>.*/, '')
    .replace(/<script[^>]*>.*?<\/script>/gs, '')
    .replace(/<a[^>]*>.*?<\/a>/gs, '')
    .replace(/<div class="menu"[^>]*>.*?<\/div>/gs, '')
    .replace(/<div class="search-form"[^>]*>.*?<\/div>/gs, '')
    .replace(/<div class="info-donat-bg"[^>]*>.*?<\/div>/gs, '')
    .replace(/<div class="sticky"[^>]*>.*?<\/div>/gs, '')
    .replace(/<nav[^>]*>.*?<\/nav>/gs, '')
    .replace(/<ul[^>]*>.*?<\/ul>/gs, '');
}

/**
 * Нормализует строку для точного сравнения вариантов ответов.
 * В отличие от normalizeDashes, сохраняет регистр символов перед финальным toLowerCase,
 * что даёт корректное сопоставление кириллических А/а, Е/е, О/о и т.д.
 */
export function normalizeText(s: string): string {
  return s
    .replace(DASH_RE, '-')
    .replace(/\s+/g, ' ')
    .replace(/\u0410/g, 'A').replace(/\u0430/g, 'a')  // А → A, а → a
    .replace(/\u0415/g, 'E').replace(/\u0435/g, 'e')  // Е → E, е → e
    .replace(/\u041E/g, 'O').replace(/\u043E/g, 'o')  // О → O, о → o
    .replace(/\u0420/g, 'P').replace(/\u0440/g, 'p')  // Р → P, р → p
    .replace(/\u0421/g, 'C').replace(/\u0441/g, 'c')  // С → C, с → c
    .replace(/\u0425/g, 'X').replace(/\u0445/g, 'x')  // Х → X, х → x
    .trim()
    .toLowerCase();
}
