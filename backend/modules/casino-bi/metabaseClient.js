'use strict';

const axios = require('axios');

const TOKEN_TTL_MS = 13 * 24 * 60 * 60 * 1000; // 13 days (Metabase default = 14d)

const state = {
    sessionId: null,
    expiresAt: 0,
    loginPromise: null,
};

const getConfig = () => ({
    url: (process.env.METABASE_URL || '').replace(/\/$/, ''),
    username: process.env.METABASE_USERNAME,
    password: process.env.METABASE_PASSWORD,
});

const isConfigured = () => {
    const c = getConfig();
    return Boolean(c.url && c.username && c.password);
};

const login = async () => {
    if (state.loginPromise) return state.loginPromise;
    const cfg = getConfig();
    if (!isConfigured()) {
        throw new Error(
            'Metabase env vars missing: METABASE_URL / METABASE_USERNAME / METABASE_PASSWORD'
        );
    }
    state.loginPromise = (async () => {
        const { data } = await axios.post(
            `${cfg.url}/api/session`,
            { username: cfg.username, password: cfg.password },
            { timeout: 15000 }
        );
        state.sessionId = data.id;
        state.expiresAt = Date.now() + TOKEN_TTL_MS;
        return state.sessionId;
    })();
    try {
        return await state.loginPromise;
    } finally {
        state.loginPromise = null;
    }
};

const getSession = async () => {
    if (state.sessionId && Date.now() < state.expiresAt) return state.sessionId;
    return login();
};

const request = async (method, path, body = undefined, retry = true) => {
    const cfg = getConfig();
    const session = await getSession();
    try {
        const { data } = await axios({
            method,
            url: `${cfg.url}${path}`,
            data: body,
            headers: { 'X-Metabase-Session': session },
            timeout: 60000,
        });
        return data;
    } catch (err) {
        const status = err?.response?.status;
        if (status === 401 && retry) {
            state.sessionId = null;
            state.expiresAt = 0;
            return request(method, path, body, false);
        }
        throw err;
    }
};

const runCard = (cardId) => request('POST', `/api/card/${cardId}/query`, {});

module.exports = {
    isConfigured,
    runCard,
    request,
    _state: state,
};
