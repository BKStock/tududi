// Helper function to get bot info from Telegram API
async function getBotInfo(token) {
    return new Promise((resolve, reject) => {
        const url = `https://api.telegram.org/bot${token}/getMe`;

        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const req = require('https').request(url, options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (response.ok) {
                        resolve(response.result);
                    } else {
                        console.error(
                            'Telegram API error:',
                            response.description
                        );
                        resolve(null);
                    }
                } catch (error) {
                    console.error('Error parsing Telegram response:', error);
                    resolve(null);
                }
            });
        });

        req.on('error', (error) => {
            console.error('Error getting bot info:', error);
            resolve(null);
        });

        req.end();
    });
}

// Generic sendMessage helper (Markdown by default).
async function sendMessage(token, chatId, text, opts = {}) {
    return new Promise((resolve) => {
        const payload = JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: opts.parse_mode || 'Markdown',
            disable_web_page_preview: opts.disable_web_page_preview ?? true,
            ...(opts.reply_markup ? { reply_markup: opts.reply_markup } : {}),
        });
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        const req = require('https').request(
            url,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload),
                },
            },
            (res) => {
                let data = '';
                res.on('data', (c) => (data += c));
                res.on('end', () => {
                    try {
                        const j = JSON.parse(data);
                        resolve(j.ok ? j.result : null);
                    } catch {
                        resolve(null);
                    }
                });
            }
        );
        req.on('error', () => resolve(null));
        req.write(payload);
        req.end();
    });
}

module.exports = { getBotInfo, sendMessage };
