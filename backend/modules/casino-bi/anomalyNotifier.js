'use strict';

const { sendMessage } = require('../telegram/telegramApi');

// Threshold matches the Pulse UI banner so users see the same signal twice:
// once on the dashboard, once on Telegram.
const THRESHOLD_PCT = 15;

// In-memory dedupe state: key → last-sent { value, ts }.
// Resets on container restart (one extra notification possible on restart;
// acceptable for v1, simpler than DB-backed state machine).
const lastSent = new Map();

// 30 minute floor between repeat notifications for the same KPI key when the
// underlying value barely moved. Prevents noisy spam if a metric oscillates
// around the threshold boundary.
const REPEAT_FLOOR_MS = 30 * 60 * 1000;

const formatJpy = (n) => {
    if (n == null) return '—';
    if (Math.abs(n) >= 1_000_000_000) return `¥${(n / 1_000_000_000).toFixed(2)}B`;
    if (Math.abs(n) >= 1_000_000) return `¥${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `¥${(n / 1_000).toFixed(0)}k`;
    return `¥${Math.round(n)}`;
};

const formatValue = (v, unit) => {
    if (unit === 'JPY') return formatJpy(v);
    return v == null ? '—' : v.toLocaleString();
};

const isConfigured = () => {
    return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.BK_TELEGRAM_CHAT_ID);
};

const shouldNotify = (key, value, deltaPct) => {
    if (!Number.isFinite(deltaPct)) return false;
    if (Math.abs(deltaPct) < THRESHOLD_PCT) return false;
    const last = lastSent.get(key);
    if (!last) return true;
    // Only repeat if value moved meaningfully OR repeat-floor elapsed.
    const valueMoved =
        last.value && Math.abs((value - last.value) / last.value) >= 0.05;
    const elapsed = Date.now() - last.ts > REPEAT_FLOOR_MS;
    return valueMoved && elapsed;
};

const buildMessage = (anomalies) => {
    const arrow = (d) => (d > 0 ? '📈' : '📉');
    const lines = [
        '🚨 *Casino BI Anomaly* — 前期比 ±' + THRESHOLD_PCT + '% 超過',
        '',
    ];
    for (const a of anomalies) {
        const dir = arrow(a.deltaPct);
        const sign = a.deltaPct > 0 ? '+' : '';
        lines.push(
            `${dir} *${a.brand} ${a.metric}*: ${formatValue(a.value, a.unit)} (${sign}${a.deltaPct.toFixed(1)}%)`
        );
    }
    lines.push('');
    lines.push('🔗 [Open Pulse](https://dashboard.and-ai.one/pulse) · ' +
        '[Casino BI](https://casino.and-ai.one)');
    return lines.join('\n');
};

const checkAndNotify = async (kpiList) => {
    if (!isConfigured()) {
        return { ok: false, reason: 'TELEGRAM_BOT_TOKEN or BK_TELEGRAM_CHAT_ID missing' };
    }
    const fired = [];
    for (const k of kpiList) {
        const value = Number(k.value);
        const previous = Number(k.previous);
        if (!Number.isFinite(value) || !Number.isFinite(previous) || previous === 0) {
            continue;
        }
        const deltaPct = ((value - previous) / previous) * 100;
        if (shouldNotify(k.key, value, deltaPct)) {
            fired.push({
                key: k.key,
                brand: k.brand,
                metric: k.metric,
                unit: k.unit,
                value,
                previous,
                deltaPct,
            });
        }
    }
    if (fired.length === 0) {
        return { ok: true, fired: 0 };
    }
    const text = buildMessage(fired);
    const result = await sendMessage(
        process.env.TELEGRAM_BOT_TOKEN,
        process.env.BK_TELEGRAM_CHAT_ID,
        text
    );
    if (result) {
        const ts = Date.now();
        for (const a of fired) {
            lastSent.set(a.key, { value: a.value, ts });
        }
        return { ok: true, fired: fired.length, anomalies: fired.map((a) => a.key) };
    }
    return { ok: false, reason: 'Telegram send failed' };
};

const _reset = () => lastSent.clear();

module.exports = { checkAndNotify, isConfigured, _reset, THRESHOLD_PCT };
