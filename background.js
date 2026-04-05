chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action !== 'fetch') return;

    const options = { method: msg.method || 'GET' };

    if (msg.headers) {
        options.headers = msg.headers;
    }

    if (msg.body) {
        options.body = msg.body;
    }

    fetch(msg.url, options)
        .then(response => {
            if (!response.ok) {
                return { error: false, status: response.status, text: '' };
            }
            return response.text().then(text => ({ error: false, status: response.status, text }));
        })
        .catch(err => ({ error: true, message: err.message }))
        .then(result => sendResponse(result));

    return true; // async response
});
