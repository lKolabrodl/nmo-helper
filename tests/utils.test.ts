import { describe, it, expect } from 'vitest';
import { normalizeDashes, normalizeText, fixMixedChars, cleanHtml, sanitizeHtml } from '../src/utils';

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

describe('sanitizeHtml — удаление опасных тегов и атрибутов', () => {
  it('удаляет теги script', () => {
    const result = sanitizeHtml('<p>text</p><script>alert(1)</script>');
    expect(result).not.toContain('script');
    expect(result).toContain('text');
  });

  it('удаляет теги iframe', () => {
    const result = sanitizeHtml('<p>ok</p><iframe src="evil.com"></iframe>');
    expect(result).not.toContain('iframe');
    expect(result).toContain('ok');
  });

  it('удаляет теги object, embed', () => {
    const result = sanitizeHtml('<object data="x"></object><embed src="y"><p>safe</p>');
    expect(result).not.toContain('object');
    expect(result).not.toContain('embed');
    expect(result).toContain('safe');
  });

  it('удаляет теги svg', () => {
    const result = sanitizeHtml('<svg onload="alert(1)"><circle/></svg><p>ok</p>');
    expect(result).not.toContain('svg');
    expect(result).toContain('ok');
  });

  it('удаляет теги style', () => {
    const result = sanitizeHtml('<style>@import url("evil")</style><p>ok</p>');
    expect(result).not.toContain('style');
    expect(result).not.toContain('@import');
    expect(result).toContain('ok');
  });

  it('удаляет теги form', () => {
    const result = sanitizeHtml('<form action="evil"><input></form><p>ok</p>');
    expect(result).not.toContain('form');
    expect(result).toContain('ok');
  });

  it('удаляет теги template', () => {
    const result = sanitizeHtml('<template><img src=x onerror=alert(1)></template><p>ok</p>');
    expect(result).not.toContain('template');
    expect(result).toContain('ok');
  });

  it('удаляет on* атрибуты с элементов', () => {
    const result = sanitizeHtml('<p onclick="alert(1)">click</p>');
    expect(result).not.toContain('onclick');
    expect(result).toContain('click');
  });

  it('удаляет onerror с img (сам img удалён по отсутствию в whitelist — нет, img не в списке удаляемых)', () => {
    const result = sanitizeHtml('<img src="x" onerror="alert(1)">');
    expect(result).not.toContain('onerror');
  });

  it('удаляет onmouseover атрибут', () => {
    const result = sanitizeHtml('<div onmouseover="alert(1)">hover</div>');
    expect(result).not.toContain('onmouseover');
    expect(result).toContain('hover');
  });

  it('удаляет javascript: в href', () => {
    const result = sanitizeHtml('<a href="javascript:alert(1)">link</a>');
    expect(result).not.toContain('javascript:');
  });

  it('удаляет javascript: с пробелами и регистром', () => {
    const result = sanitizeHtml('<a href="  JavaScript:alert(1)">link</a>');
    expect(result).not.toContain('JavaScript');
  });

  it('сохраняет безопасный HTML', () => {
    const html = '<h3>Вопрос</h3><p><strong>Ответ</strong></p><span style="background:#fbeeb8">подсветка</span>';
    const result = sanitizeHtml(html);
    expect(result).toContain('<h3>');
    expect(result).toContain('<strong>');
    expect(result).toContain('Ответ');
    expect(result).toContain('подсветка');
  });

  it('сохраняет структуру для парсеров (h3 + p + strong)', () => {
    const html = '<h3>Тема теста</h3><p><strong>правильный ответ</strong></p>';
    const result = sanitizeHtml(html);
    const div = new DOMParser().parseFromString(result, 'text/html').body;
    const h3 = div.querySelector('h3');
    expect(h3).not.toBeNull();
    expect(h3!.textContent).toBe('Тема теста');
    const strong = div.querySelector('strong');
    expect(strong).not.toBeNull();
    expect(strong!.textContent).toBe('правильный ответ');
  });

  it('обрабатывает пустую строку', () => {
    expect(sanitizeHtml('')).toBe('');
  });

  it('обрабатывает строку без HTML', () => {
    const result = sanitizeHtml('просто текст');
    expect(result).toContain('просто текст');
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
