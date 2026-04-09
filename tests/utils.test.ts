import { describe, it, expect } from 'vitest';
import { normalizeDashes, normalizeText, fixMixedChars, cleanHtml } from '../src/utils';

describe('normalizeDashes — нормализация тире и символов', () => {
  it('заменяет unicode-тире на дефис', () => {
    const result = normalizeDashes('тест\u2013тест');
    expect(result).toContain('-');
    expect(result).not.toContain('\u2013');
  });

  it('нормализует пробелы', () => {
    expect(normalizeDashes('  hello   world  ')).toBe('hello world');
  });

  it('приводит к нижнему регистру', () => {
    expect(normalizeDashes('HELLO')).toBe('hello');
  });

  it('заменяет кириллические символы-двойники на латинские', () => {
    expect(normalizeDashes('\u0410')).toBe('a'); // А → a
    expect(normalizeDashes('\u0415')).toBe('e'); // Е → e
    expect(normalizeDashes('\u041E')).toBe('o'); // О → o
  });
});

describe('normalizeText — нормализация для сравнения ответов', () => {
  it('заменяет unicode-тире на дефис', () => {
    expect(normalizeText('a\u2013b')).toBe('a-b');
  });

  it('нормализует пробелы и обрезает края', () => {
    expect(normalizeText('  foo   bar  ')).toBe('foo bar');
  });

  it('заменяет кириллические двойники с учётом регистра', () => {
    expect(normalizeText('\u0410')).toBe('a'); // А → A → a
    expect(normalizeText('\u0430')).toBe('a'); // а → a
    expect(normalizeText('\u0420')).toBe('p'); // Р → P → p
    expect(normalizeText('\u0421')).toBe('c'); // С → C → c
  });

  it('обрабатывает смешанный кириллическо-латинский текст', () => {
    const result = normalizeText('Т\u0435ст'); // Т + е(кир.) + ст
    expect(result).toContain('e'); // Кириллическая «е» заменена на латинскую
  });
});

describe('fixMixedChars — исправление смешанных символов', () => {
  it('заменяет кириллическую «а» в латинском слове', () => {
    const result = fixMixedChars('c\u0430t'); // c + а(кир.) + t
    expect(result).toBe('cat');
  });

  it('заменяет латинскую «a» в кириллическом слове', () => {
    const result = fixMixedChars('\u043A\u043E\u0448\u043Aa'); // кошк + a(лат.)
    expect(result).toContain('\u0430'); // Латинская «a» → кириллическая «а»
  });
});

describe('cleanHtml — очистка HTML от лишних элементов', () => {
  it('удаляет теги script', () => {
    const html = '<div class="row"><p>content</p><script>alert(1)</script></div>';
    const cleaned = cleanHtml(html);
    expect(cleaned).not.toContain('script');
    expect(cleaned).toContain('content');
  });

  it('удаляет навигацию', () => {
    const html = '<nav>menu</nav><div class="row"><p>data</p></div>';
    const cleaned = cleanHtml(html);
    expect(cleaned).not.toContain('menu');
  });

  it('удаляет footer', () => {
    const html = '<div class="row"><p>data</p></div><footer>foot</footer>';
    const cleaned = cleanHtml(html);
    expect(cleaned).not.toContain('foot');
  });
});
