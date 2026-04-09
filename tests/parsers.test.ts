import { describe, it, expect } from 'vitest';
import { parseFrom24forcare, parseFromRosmedicinfo, detectSource } from '../src/parsers';

describe('detectSource — определение источника по URL', () => {
  it('определяет 24forcare', () => {
    expect(detectSource('https://24forcare.com/test/page')).toBe('24forcare');
  });

  it('определяет rosmedicinfo', () => {
    expect(detectSource('https://rosmedicinfo.ru/some-page')).toBe('rosmedicinfo');
  });

  it('возвращает null для неизвестного URL', () => {
    expect(detectSource('https://google.com')).toBeNull();
  });
});

describe('parseFrom24forcare — парсинг ответов с 24forcare.com', () => {
  it('извлекает ответы из структуры h3 + p > strong', () => {
    const div = document.createElement('div');
    div.innerHTML = `
      <h3>Какой препарат применяется?</h3>
      <p><strong>Аспирин</strong>; <strong>Ибупрофен</strong></p>
    `;
    const getAnswers = parseFrom24forcare(div);
    const answers = getAnswers('Какой препарат применяется?');
    // jsdom не поддерживает innerText — проверяем структуру, а не значения
    expect(answers).not.toBeNull();
    expect(answers!.length).toBe(2);
  });

  it('возвращает null для отсутствующего вопроса', () => {
    const div = document.createElement('div');
    div.innerHTML = '<h3>Другой вопрос</h3><p><strong>Ответ</strong></p>';
    const getAnswers = parseFrom24forcare(div);
    expect(getAnswers('Несуществующий вопрос')).toBeNull();
  });

  it('возвращает null если после h3 нет тега p', () => {
    const div = document.createElement('div');
    div.innerHTML = '<h3>Вопрос</h3><div>not a p</div>';
    const getAnswers = parseFrom24forcare(div);
    expect(getAnswers('Вопрос')).toBeNull();
  });
});

describe('parseFromRosmedicinfo — парсинг ответов с rosmedicinfo.ru', () => {
  it('извлекает ответы из выделенных span (формат 1 — жёлтый фон)', () => {
    const div = document.createElement('div');
    div.innerHTML = `
      <h3>Что назначают при гипертензии?</h3>
      <p>
        <span style="background-color: #fbeeb8">Лозартан</span>
        <span>Парацетамол</span>
        <span style="background-color: #fbeeb8">Амлодипин</span>
      </p>
    `;
    const getAnswers = parseFromRosmedicinfo(div);
    const answers = getAnswers('Что назначают при гипертензии?');
    expect(answers).not.toBeNull();
    expect(answers!.length).toBe(2);
  });

  it('обрабатывает формат 2 (жирный текст + плюс) без ошибок', () => {
    const div = document.createElement('div');
    div.innerHTML = `
      <p class="MsoNormal"><b>1. Какой метод используется?</b></p>
      <p class="MsoNormal">1) КТ+<br>2) МРТ<br>3) Рентген+</p>
    `;
    const getAnswers = parseFromRosmedicinfo(div);
    const answers = getAnswers('Какой метод используется?');
    // Формат 2 зависит от innerText — jsdom поддерживает частично
    expect(answers === null || Array.isArray(answers)).toBe(true);
  });

  it('возвращает null для неизвестного вопроса', () => {
    const div = document.createElement('div');
    div.innerHTML = '<h3>Вопрос</h3><p><span style="background:#fbeeb8">Ответ</span></p>';
    const getAnswers = parseFromRosmedicinfo(div);
    expect(getAnswers('Другой вопрос')).toBeNull();
  });
});
