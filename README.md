# NMO Helper v4.2.0

> Умный помощник в прохождении тестов НМО на портале [edu.rosminzdrav.ru](https://a.edu.rosminzdrav.ru) — бесплатное расширение для браузера с открытым исходным кодом.

Авто-поиск ответов на `rosmedicinfo.ru` и `24forcare.com`, автоответ с настраиваемым интервалом, AI-режим (GPT, Gemini, Claude, DeepSeek), PDF-режим: поиск по клиническим рекомендациям, работает из коробки.

[![Firefox Add-ons](https://img.shields.io/amo/v/nmo-helper?style=flat-square&label=Firefox%20Add-ons&color=ff9500&logo=firefox-browser&logoColor=white)](https://addons.mozilla.org/ru/firefox/addon/nmo-helper/)
[![Downloads](https://img.shields.io/github/downloads/lKolabrodl/nmo-helper/total?style=flat-square&label=скачиваний&color=667eea&cacheSeconds=3600)](https://github.com/lKolabrodl/nmo-helper/releases)
[![Stars](https://img.shields.io/github/stars/lKolabrodl/nmo-helper?style=flat-square&color=fbbf24&cacheSeconds=3600)](https://github.com/lKolabrodl/nmo-helper)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](https://github.com/lKolabrodl/nmo-helper/blob/main/LICENSE)
[![VirusTotal](https://img.shields.io/badge/VirusTotal-Clean-brightgreen?style=flat-square&logo=virustotal)](https://www.virustotal.com/gui/file/fb6bee3d7fe89b5d6f69d5d4e1353f793f43aba5970573b1906ed87db2908721?nocache=1)

🌐 **Сайт:** [nmo-helper.ru](https://nmo-helper.ru)<br>
📖 **Инструкция:** [nmo-helper.ru/instruction](https://nmo-helper.ru/instruction)<br>
💬 **Обратная связь:** [nmo-helper.ru/feedback](https://nmo-helper.ru/feedback)

---

## Возможности

| Функция | Описание |
|---|---|
| **Авто-поиск** | Автоматически находит тему теста и ищет ответы на двух сайтах |
| **AI-режим** | Решает тесты с помощью GPT, Gemini, Claude, DeepSeek через ProxyAPI или свой endpoint |
| **PDF-режим** | Поиск по клиническим рекомендациям из локального PDF, со score для вариантов |
| **Ручной поиск** | Поиск ответов по названию теста на `rosmedicinfo.ru` и `24forcare.com` |
| **Автоподсветка** | Правильные ответы подсвечиваются при переходе между вопросами |
| **Автоответ** | Может автоматически отмечать найденные ответы и переходить дальше с заданным интервалом |
| **Кеширование** | Ответы кешируются — при навигации назад/вперёд повторных запросов нет |
| **Умное сопоставление** | Нормализация тире, смешанных кириллица/латиница, нечёткий поиск |
| **Плавающая панель** | Перетаскивание, сворачивание, сохранение позиции между сессиями |
| **Обход CORS** | Работает без дополнительных плагинов |

## Требования

- **Google Chrome** / Яндекс Браузер / Edge / Brave / Opera (любой Chromium-браузер)
- **Mozilla Firefox 109+**

---

## Установка

### Chrome / Yandex / Edge / Brave / Opera

1. Скачайте [`nmo-helper-chrome-4.2.0.zip`](https://github.com/lKolabrodl/nmo-helper/releases/download/v4.2.0/nmo-helper-chrome-4.2.0.zip)
2. Разархивируйте в удобную папку
3. Откройте `chrome://extensions/` в адресной строке
4. Включите **«Режим разработчика»** (правый верхний угол)
5. Нажмите **«Загрузить распакованное расширение»**
6. Выберите папку `nmo-helper-chrome-4.2.0`

<details>
<summary>📹 Показать GIF-инструкцию</summary>

![Установка Chrome](demo/setup_1.gif)
</details>

### Mozilla Firefox

**Способ 1 (рекомендуется) — из Firefox Add-ons:**

Откройте страницу расширения в [Firefox Add-ons](https://addons.mozilla.org/ru/firefox/addon/nmo-helper/) и нажмите **«Добавить в Firefox»**. Расширение проверено и подписано Mozilla, обновляется автоматически.

**Способ 2 — прямая установка `.xpi`:**

1. Скачайте [`firefox_nmo_helper.xpi`](https://github.com/lKolabrodl/nmo-helper/releases/download/v4.2.0/firefox_nmo_helper.xpi)
2. Перетащите `.xpi` в окно Firefox, или откройте `about:addons` → ⚙ → **«Установить дополнение из файла»**
3. Подтвердите установку

<details>
<summary>📹 Показать GIF-инструкцию</summary>

![Установка Firefox](demo/setup_2.gif)
</details>

> **Почему в Chrome нет магазинной версии?** Расширение использует парсинг сайтов с готовыми ответами — политика Chrome Web Store это запрещает, и расширение быстро удалят. Ручная установка через `chrome://extensions` занимает пару минут и работает надёжно.

---

## Использование

После установки откройте страницу тестирования НМО — в правом верхнем углу появится панель **NMO Helper**.

![Установка Firefox](demo/setup_3.png)

### Режимы работы

Переключение между режимами через таб-бар в панели: **Авто** / **Сайты** / **AI** / **PDF**.

### Авто

Панель сама определяет тему теста, ищет ответы и подсвечивает правильные варианты. Никаких действий не требуется.

- Сначала ищет на **rosmedicinfo.ru**, если не нашёл — на **24forcare.com**
- Если один сайт недоступен — работает с другим
- Ответы кешируются при навигации

### Сайты

1. Введите название теста в поиск
2. Выберите источник (**rosmed** / **24forcare**) или вставьте ссылку
3. Нажмите **Запуск**

### PDF

Загрузите PDF с клиническими рекомендациями — расширение выполнит поиск по документу и покажет score рядом с вариантами.

- PDF обрабатывается локально в браузере и не загружается на сервер
- Score отображается перед radio/checkbox, не сдвигая текст варианта
- Режим экспериментальный: примерно 56-80% ответов могут быть правильными

### AI

Подключите нейросеть для решения тестов. Два варианта:

**ProxyAPI** (по умолчанию) — российский прокси с оплатой в рублях и без VPN:
1. Зарегистрируйтесь на [proxyapi.ru](https://proxyapi.ru) и пополните баланс
2. Получите API-ключ на [console.proxyapi.ru/keys](https://console.proxyapi.ru/keys)
3. Вставьте ключ и выберите модель
4. Нажмите **Запуск AI**

**Свой endpoint** — переключите свитч «Свой endpoint» и укажите:
- API Endpoint (OpenAI-совместимый, например `https://api.deepseek.com/v1/chat/completions`)
- API Token
- Название модели

### Модели (ProxyAPI)

| Уровень | Модели | Описание |
|---------|--------|----------|
| 🟢 low | gpt-4o-mini, gemini-2.0-flash, claude-haiku-4.5 | Быстрые и дешёвые |
| 🔵 medium | gpt-4.1-mini, gemini-2.5-flash | Баланс цена/качество |
| 🟡 high | gpt-5.3-chat-latest, o3-mini, o4-mini, claude-sonnet-4.6 | Высокая точность |
| 🟣 ultra | claude-opus-4.8, gemini-3.1-pro, gpt-5.5-pro | Максимальная точность |

> **Disclaimer:** AI-модели решают медицинские тесты НМО в среднем на оценку 3 — вопросы основаны на специфических клинических рекомендациях РФ. Рекомендуем использовать AI как вспомогательный инструмент, а основной упор делать на **авто-поиск**.

---

## Структура проекта

```
src/
├── content.ts                  # Точка входа (content-script)
├── content.scss                # Общие стили панели
├── vars.scss                   # SCSS-переменные (цвета, размеры, шрифты)
├── App.tsx                     # Корневой React-компонент
├── Panel.tsx                   # Создание панели + drag
├── background.ts               # Service worker (CORS proxy)
├── types.ts                    # Типы и интерфейсы
├── popup.html / popup.css / popup.js # Popup при клике на иконку
├── manifest.*.json             # Манифесты Chrome / Firefox / AMO
│
├── components/
│   ├── Header/                 # Хедер с индикатором статуса
│   ├── VersionCheck/           # Проверка доступной версии
│   ├── TabBar/                 # Таб-бар (Авто / Сайты / AI / PDF)
│   ├── CollapsedPill/          # Свернутая плавающая панель
│   ├── AutoSection/            # Авто-режим
│   ├── SitesSection/           # Ручной режим
│   ├── AiSection/              # AI-режим (ProxyAPI + свой endpoint)
│   ├── PdfSection/             # PDF-режим: поиск по клиническим рекомендациям
│   ├── ModelDropdown/          # Выбор AI-модели
│   ├── BugReportButton/        # Кнопка отправки баг-репорта
│   ├── ErrorBoundary/          # Перехват ошибок рендера
│   ├── Loader/                 # Headless-компоненты (загрузка, подсветка)
│   ├── ui/                     # Общие UI-компоненты панели
│   └── icons.tsx               # SVG-иконки интерфейса
│
├── contexts/
│   ├── PanelUiContext.tsx       # UI-состояние (режим, свёрнутость)
│   ├── PanelStatusContext.tsx   # Статус per-mode
│   ├── PdfScoreContext.tsx      # Score вариантов в PDF-режиме (только в памяти)
│   ├── BugReportContext.tsx     # Контекст текущего tab/mode для баг-репортов
│   └── QuestionFinderContext.tsx # Отслеживание вопроса на странице
│
├── api/                         # Обёртки над браузерными API и сетью
│   ├── dom.ts                   # DOM-запросы с fallback-цепочками селекторов
│   ├── fetch.ts                 # Fetch через background (CORS bypass)
│   ├── storage.ts               # Обёртки chrome.storage
│   ├── version-check.ts         # Проверка новых релизов
│   └── bug-report.ts            # Отправка баг-репортов на сервер
│
├── libs/                        # Локальные мини-утилиты (замена npm-зависимостям)
│   ├── debounce.ts              # debounce без lodash — обходим CSP в Firefox MV3
│   └── index.ts                 # Реэкспорты локальных библиотек
│
├── icons/                       # Иконки расширения для manifest/action
│
└── utils/                       # Чистые функции без сайд-эффектов
    ├── answer-cache.ts          # Кеш ответов (topic, question, variants) → answers
    ├── cases.ts                 # Диспатчер: extractCases + findAnswers (top-1 assignment)
    ├── extractors.ts            # Парсеры раскладок 24forcare / rosmedicinfo
    ├── matching.ts              # matchQuestion / variantScore / similarity
    ├── text.ts                  # Нормализация (тире, омоглифы, кавычки, пробелы)
    ├── html.ts                  # HTML-санитизация и парсинг
    ├── constants.ts             # Константы (селекторы, статусы, модели)
    └── index.ts                 # Реэкспорты для удобного импорта
```

### Сборка

```bash
npm install
npm run build       # Собрать dist/chrome, dist/firefox, dist/firefox-store
npm run dev         # Сборка в watch-режиме
npm test            # Запустить тесты
```

---

## Безопасность

Расширение **не собирает данные**, **не требует регистрации**, **не отправляет аналитику** и **не подсовывает реферальные ссылки**. Но не верьте на слово — проверьте сами:

- Исходный код открыт на GitHub
- Проверено через [VirusTotal](https://www.virustotal.com/gui/file/fb6bee3d7fe89b5d6f69d5d4e1353f793f43aba5970573b1906ed87db2908721?nocache=1)
- Подписано и опубликовано в [Firefox Add-ons](https://addons.mozilla.org/ru/firefox/addon/nmo-helper/)
- PDF-файлы обрабатываются локально в браузере и не отправляются на сервер
- Баг-репорт отправляется только вручную после подтверждения пользователя
- Политика конфиденциальности: [nmo-helper.ru/privacy](https://nmo-helper.ru/privacy)

## Поддержать проект

Проект создан на альтруистических началах — просто чтобы помочь. Если расширение оказалось полезным:

[![Support on Boosty](https://img.shields.io/badge/Boosty-Поддержать-orange?style=for-the-badge)](https://boosty.to/kolabrod/donate)
[![Support on CloudTips](https://img.shields.io/badge/CloudTips-Поддержать-blue?style=for-the-badge)](https://pay.cloudtips.ru/p/181ccc33)

## Предыдущие минорные версии

Ниже только последние релизы минорных веток. Полная история доступна в [GitHub Releases](https://github.com/lKolabrodl/nmo-helper/releases).

- [v4.1.1](https://github.com/lKolabrodl/nmo-helper/tree/v4.1.1) — обновление подписанного Firefox-пакета
- [v4.0.0](https://github.com/lKolabrodl/nmo-helper/tree/v4.0.0) — крупное обновление панели и подготовка к релизам 4.x
- [v3.1.5](https://github.com/lKolabrodl/nmo-helper/tree/v3.1.5) — мелкие правки extractor'ов и баг-репорта
- [v3.0.1](https://github.com/lKolabrodl/nmo-helper/tree/v3.0.1) — публикация в Firefox Add-ons
- [v2.3.0](https://github.com/lKolabrodl/nmo-helper/tree/v2.3.0) — новые AI-модели, обновлённый парсинг
- [v2.2.2](https://github.com/lKolabrodl/nmo-helper/tree/v2.2.2) — миграция на TypeScript, тесты, JSDoc
- [v2.1.1](https://github.com/lKolabrodl/nmo-helper/tree/v2.1.1) — реструктуризация, esbuild сборка
- [v2.0.0](https://github.com/lKolabrodl/nmo-helper/tree/v2.0.0) — AI-режим, авто-поиск
- [v1.4.2](https://github.com/lKolabrodl/nmo-helper/tree/v1.4.2) — только поиск по сайтам, без AI

## Лицензия

MIT
