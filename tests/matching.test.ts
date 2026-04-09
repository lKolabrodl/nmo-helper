import { describe, it, expect } from 'vitest';
import { highlightAnswers } from '../src/matching';

/** Создаёт массив span-элементов с заданными текстами */
function createVariants(texts: string[]): HTMLElement[] {
  return texts.map(text => {
    const el = document.createElement('span');
    el.innerText = text;
    return el;
  });
}

describe('highlightAnswers — подсветка правильных ответов', () => {
  it('подсвечивает точные совпадения', () => {
    const variants = createVariants(['Аспирин', 'Парацетамол', 'Ибупрофен']);
    const result = highlightAnswers(variants, ['Аспирин', 'Ибупрофен']);
    expect(result).toBe(true);
    expect(variants[0].style.color).toBe('rgb(78, 204, 163)'); // #4ecca3
    expect(variants[1].style.color).toBe('');
    expect(variants[2].style.color).toBe('rgb(78, 204, 163)');
  });

  it('возвращает false когда совпадений нет', () => {
    const variants = createVariants(['Аспирин', 'Парацетамол']);
    const result = highlightAnswers(variants, ['Несуществующий']);
    expect(result).toBe(false);
  });

  it('находит нечёткое совпадение по границе слова', () => {
    const variants = createVariants(['Артериальная гипертензия, стадия 2']);
    const answers = ['Артериальная гипертензия'];
    const result = highlightAnswers(variants, answers);
    expect(result).toBe(true);
    expect(variants[0].style.color).toBe('rgb(78, 204, 163)');
  });

  it('не совпадает по частям слов (не на границе)', () => {
    const variants = createVariants(['Гипертензия']);
    const answers = ['Гипер'];
    // «Гипер» не на границе слова внутри «Гипертензия»
    const result = highlightAnswers(variants, answers);
    expect(result).toBe(false);
  });

  it('совпадает когда ответ длиннее варианта', () => {
    const variants = createVariants(['Лозартан']);
    const answers = ['Лозартан 50мг'];
    // Вариант короче ответа — совпадение на границе
    const result = highlightAnswers(variants, answers);
    expect(result).toBe(true);
  });
});
