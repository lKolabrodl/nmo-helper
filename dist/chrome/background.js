"use strict";
(() => {
  // src/background.ts
  if (true) {
    const devReloadMessage = { type: "NMO_DEV_RELOAD" };
    const nmoTabUrls = [
      "https://edu.rosminzdrav.ru/*",
      "https://*.edu.rosminzdrav.ru/*"
    ];
    let lastTimestamp = 0;
    const prepareNmoTabsForReload = async () => {
      try {
        const tabs = await chrome.tabs.query({ url: nmoTabUrls });
        await Promise.all(tabs.map((tab) => {
          if (tab.id === void 0) return Promise.resolve();
          const tabId = tab.id;
          const notification = new Promise((resolve) => {
            try {
              chrome.tabs.sendMessage(tabId, devReloadMessage, () => {
                void chrome.runtime.lastError;
                resolve();
              });
            } catch {
              resolve();
            }
          });
          const timeout = new Promise((resolve) => setTimeout(resolve, 500));
          return Promise.race([notification, timeout]);
        }));
      } catch {
      }
    };
    setInterval(async () => {
      try {
        const url = chrome.runtime.getURL("dev-reload.json");
        const res = await fetch(url, { cache: "no-store" });
        const { timestamp } = await res.json();
        if (lastTimestamp && timestamp !== lastTimestamp) {
          console.log("[NMO Dev] Reloading extension...");
          await prepareNmoTabsForReload();
          chrome.runtime.reload();
        }
        lastTimestamp = timestamp;
      } catch {
      }
    }, 1e3);
  }
  chrome.runtime.onMessage.addListener(
    (message, _sender, sendResponse) => {
      if (message.action !== "fetch") return false;
      fetch(message.url, {
        method: message.method || "GET",
        headers: message.headers || void 0,
        body: message.body || void 0,
        credentials: message.credentials || void 0
      }).then(async (res) => {
        const text = await res.text();
        sendResponse({ error: false, status: res.status, text });
      }).catch((err) => {
        sendResponse({ error: true, message: err.message });
      });
      return true;
    }
  );
})();
