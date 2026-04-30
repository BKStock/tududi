'use strict';

const { CasinoKpiSnapshot, sequelize } = require('../../models');
const scheduler = require('./scheduler');

const parseSpark = (s) => {
    if (!s) return [];
    try {
        const parsed = JSON.parse(s);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const toFloat = (v) => (v == null ? null : Number(v));

// Returns the latest snapshot for each KPI key.
const getLatestKpis = async (req, res) => {
    try {
        // SQLite-friendly: window functions present in Sequelize via raw query.
        const [rows] = await sequelize.query(`
            SELECT s.*
            FROM casino_kpi_snapshots s
            INNER JOIN (
                SELECT key, MAX(captured_at) AS max_captured
                FROM casino_kpi_snapshots
                GROUP BY key
            ) latest
                ON s.key = latest.key AND s.captured_at = latest.max_captured
            ORDER BY s.brand, s.metric
        `);
        const items = rows.map((r) => ({
            key: r.key,
            brand: r.brand,
            metric: r.metric,
            unit: r.unit,
            value: toFloat(r.value),
            previous: toFloat(r.previous),
            spark: parseSpark(r.spark),
            card_id: r.card_id,
            captured_at: r.captured_at,
            error: r.error,
        }));
        const status = scheduler.getStatus();
        return res.json({
            kpis: items,
            scheduler: {
                enabled: status.enabled,
                cron: status.cron,
                lastRun: status.lastRun,
                healthy: !!items.length && items.every((i) => !i.error || i.value != null),
            },
        });
    } catch (err) {
        return res
            .status(500)
            .json({ error: 'failed to load casino kpi', detail: err.message });
    }
};

const refresh = async (req, res) => {
    try {
        const result = await scheduler.runOnce();
        return res.json(result);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

const status = async (req, res) => res.json(scheduler.getStatus());

module.exports = { getLatestKpis, refresh, status };
