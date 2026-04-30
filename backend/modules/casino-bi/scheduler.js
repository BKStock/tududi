'use strict';

const cron = require('node-cron');
const kpiFetcher = require('./kpiFetcher');

const state = { task: null, lastRun: null, lastResult: null, running: false };

const isEnabled = () => {
    const flag = process.env.CASINO_KPI_SYNC_ENABLED;
    return flag === undefined ? true : flag === 'true' || flag === '1';
};

const getCronExpr = () => process.env.CASINO_KPI_SYNC_CRON || '*/15 * * * *';

const runOnce = async () => {
    if (state.running) return state.lastResult;
    state.running = true;
    try {
        state.lastRun = new Date();
        state.lastResult = await kpiFetcher.syncAll();
        return state.lastResult;
    } finally {
        state.running = false;
    }
};

const initialize = async () => {
    if (!isEnabled()) {
        // eslint-disable-next-line no-console
        console.log('[casino-bi] scheduler disabled (CASINO_KPI_SYNC_ENABLED=false)');
        return;
    }
    if (process.env.NODE_ENV === 'test') return;
    const expr = getCronExpr();
    state.task = cron.schedule(
        expr,
        () => {
            runOnce().catch((e) =>
                // eslint-disable-next-line no-console
                console.error('[casino-bi] sync error:', e?.message)
            );
        },
        { scheduled: true, timezone: 'UTC' }
    );
    // eslint-disable-next-line no-console
    console.log(`[casino-bi] scheduler armed: ${expr}`);
    // initial run after boot
    setTimeout(() => {
        runOnce()
            .then((r) =>
                // eslint-disable-next-line no-console
                console.log(
                    `[casino-bi] initial sync: ${r?.success}/${r?.total} ok`
                )
            )
            .catch((e) =>
                // eslint-disable-next-line no-console
                console.error('[casino-bi] initial sync failed:', e?.message)
            );
    }, 5000);
};

const stop = () => {
    if (state.task) {
        state.task.stop();
        state.task = null;
    }
};

const getStatus = () => ({
    enabled: isEnabled(),
    cron: getCronExpr(),
    running: state.running,
    lastRun: state.lastRun,
    lastResult: state.lastResult,
});

module.exports = { initialize, stop, runOnce, getStatus };
