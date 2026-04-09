/**
 * Background service worker.
 * Принимает сообщения от content-скриптов и проксирует fetch-запросы
 * для обхода CORS-ограничений (content-скрипты не могут делать cross-origin запросы).
 * @module background
 */

/** Формат сообщения от content-скрипта */
interface FetchMessage {
  action: 'fetch';
  url: string;
  method: string;
  headers: Record<string, string> | null;
  body: string | null;
}

chrome.runtime.onMessage.addListener(
  (message: FetchMessage, _sender: chrome.runtime.MessageSender, sendResponse: (response: unknown) => void) => {
    if (message.action !== 'fetch') return false;

    fetch(message.url, {
      method: message.method || 'GET',
      headers: message.headers || undefined,
      body: message.body || undefined,
    })
      .then(async (res) => {
        const text = await res.text();
        sendResponse({ error: false, status: res.status, text });
      })
      .catch((err) => {
        sendResponse({ error: true, message: (err as Error).message });
      });

    return true;
  }
);
