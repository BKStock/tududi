'use strict';

const metabase = require('./metabaseClient');
const { KPIS } = require('./kpiConfig');
const { CasinoKpiSnapshot } = require('../../models');
const anomalyNotifier = require('./anomalyNotifier');

const cardCache = new Map();

const fetchCardCached = async (cardId) => {
    if (cardCache.has(cardId)) return cardCache.get(cardId);
    const promise = metabase.runCard(cardId).finally(() => {
        // hold cache only for the duration of one sync run
        setTimeout(() => cardCache.delete(cardId), 30_000);
    });
    cardCache.set(cardId, promise);
    return promise;
};

const persistSnapshot = async (kpi, parsed, error = null) => {
    return CasinoKpiSnapshot.create({
        key: kpi.key,
        brand: kpi.brand,
        metric: kpi.metric,
        unit: kpi.unit,
        value: parsed?.value ?? null,
        previous: parsed?.previous ?? null,
        spark: parsed?.spark ? JSON.stringify(parsed.spark) : null,
        card_id: kpi.cardId,
        captured_at: new Date(),
        error: error ? String(error).slice(0, 500) : null,
    });
};

const syncOne = async (kpi) => {
    try {
        const data = await fetchCardCached(kpi.cardId);
        const parsed = kpi.parse(data);
        if (!parsed) {
            await persistSnapshot(kpi, null, 'parse returned null');
            return { key: kpi.key, ok: false, reason: 'parse-null' };
        }
        await persistSnapshot(kpi, parsed);
        return {
            key: kpi.key,
            ok: true,
            value: parsed.value,
            previous: parsed.previous,
        };
    } catch (err) {
        const msg = err?.response?.status
            ? `http ${err.response.status}`
            : err?.message || 'unknown';
        try {
            await persistSnapshot(kpi, null, msg);
        } catch (_) {
            /* swallow */
        }
        return { key: kpi.key, ok: false, reason: msg };
    }
};

const syncAll = async () => {
    if (!metabase.isConfigured()) {
        return { ok: false, skipped: true, reason: 'METABASE env not set' };
    }
    cardCache.clear();
    const results = [];
    const fresh = [];
    for (const kpi of KPIS) {
        // serial — keeps load on Metabase low and avoids burst rate-limit
        const r = await syncOne(kpi);
        results.push(r);
        if (r.ok) {
            fresh.push({
                key: kpi.key,
                brand: kpi.brand,
                metric: kpi.metric,
                unit: kpi.unit,
                value: r.value,
                previous: r.previous,
            });
        }
    }
    let notify = null;
    try {
        notify = await anomalyNotifier.checkAndNotify(fresh);
    } catch (e) {
        // never let notification failure block sync result
        notify = { ok: false, reason: e?.message || 'notifier threw' };
    }
    return {
        ok: true,
        total: results.length,
        success: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok),
        notified: notify,
        startedAt: new Date().toISOString(),
    };
};

module.exports = { syncAll, syncOne };
