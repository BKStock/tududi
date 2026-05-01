'use strict';

const { CasinoKpiSnapshot, sequelize } = require('../../../models');
const metabase = require('../../casino-bi/metabaseClient');
const { KPIS } = require('../../casino-bi/kpiConfig');
const scheduler = require('../../casino-bi/scheduler');

const NATIVE_FORBIDDEN_KEYWORDS = [
    /\binsert\s+into\b/i,
    /\bupdate\s+\w+\s+set\b/i,
    /\bdelete\s+from\b/i,
    /\bdrop\s+(table|view|database|schema)\b/i,
    /\balter\s+table\b/i,
    /\bcreate\s+(table|view|database|schema)\b/i,
    /\btruncate\b/i,
    /\bgrant\b/i,
    /\brevoke\b/i,
];

const isReadOnlySql = (sql) => {
    if (typeof sql !== 'string') return false;
    if (!/^[\s(]*(with|select)\b/i.test(sql.trim())) return false;
    return !NATIVE_FORBIDDEN_KEYWORDS.some((rx) => rx.test(sql));
};

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

const textJson = (obj) => ({
    content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }],
});

const errorPayload = (msg, extra = {}) =>
    textJson({ ok: false, error: msg, ...extra });

function registerCasinoBiTools(server, context, tools) {
    // 1. list_casino_kpis — declared KPI catalog (config-level, not data)
    tools.push({
        name: 'list_casino_kpis',
        description:
            'List the catalog of casino KPIs available via /api/casino/kpi. Returns each KPI key, brand, metric, unit, and Metabase card ID. Use this to discover what get_casino_kpi can return.',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => {
            const items = KPIS.map((k) => ({
                key: k.key,
                brand: k.brand,
                metric: k.metric,
                unit: k.unit,
                card_id: k.cardId,
            }));
            return textJson({
                count: items.length,
                kpis: items,
                source: 'metabase.slotenpromotion.com',
                pattern: 'federation (Metabase=SoR, tudidi=cache)',
            });
        },
    });

    // 2. get_casino_kpi — latest snapshot per KPI, optionally filtered
    tools.push({
        name: 'get_casino_kpi',
        description:
            'Get the latest casino KPI snapshots from the tudidi cache (15min sync from Metabase). Filter by brand or metric. Returns value + previous + spark + delta percentage.',
        inputSchema: {
            type: 'object',
            properties: {
                brand: {
                    type: 'string',
                    description:
                        'Filter by brand: Konibet | DSC | Sloten (case-insensitive). Optional.',
                },
                metric: {
                    type: 'string',
                    description:
                        'Filter by metric substring (case-insensitive). e.g. "GGR", "入金", "Active". Optional.',
                },
                key: {
                    type: 'string',
                    description: 'Exact KPI key (overrides brand/metric).',
                },
            },
        },
        handler: async (params) => {
            try {
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
                let items = rows.map((r) => {
                    const value = toFloat(r.value);
                    const previous = toFloat(r.previous);
                    const deltaPct =
                        previous && value != null
                            ? ((value - previous) / previous) * 100
                            : null;
                    return {
                        key: r.key,
                        brand: r.brand,
                        metric: r.metric,
                        unit: r.unit,
                        value,
                        previous,
                        delta_pct:
                            deltaPct != null
                                ? Number(deltaPct.toFixed(2))
                                : null,
                        spark: parseSpark(r.spark),
                        card_id: r.card_id,
                        captured_at: r.captured_at,
                        error: r.error,
                    };
                });
                if (params?.key) {
                    items = items.filter((i) => i.key === params.key);
                }
                if (params?.brand) {
                    const b = String(params.brand).toLowerCase();
                    items = items.filter((i) => i.brand.toLowerCase() === b);
                }
                if (params?.metric) {
                    const m = String(params.metric).toLowerCase();
                    items = items.filter((i) =>
                        i.metric.toLowerCase().includes(m)
                    );
                }
                const status = scheduler.getStatus();
                return textJson({
                    count: items.length,
                    items,
                    cache_age_min:
                        items.length && items[0].captured_at
                            ? Math.floor(
                                  (Date.now() -
                                      new Date(items[0].captured_at).getTime()) /
                                      60_000
                              )
                            : null,
                    scheduler: {
                        enabled: status.enabled,
                        last_run: status.lastRun,
                    },
                });
            } catch (err) {
                return errorPayload(err.message);
            }
        },
    });

    // 3. get_casino_kpi_history — time-series for one KPI
    tools.push({
        name: 'get_casino_kpi_history',
        description:
            'Get historical snapshots of a single KPI key. Returns chronological list ordered oldest-first. Useful for trend analysis beyond the spark window.',
        inputSchema: {
            type: 'object',
            properties: {
                key: {
                    type: 'string',
                    description:
                        'KPI key (use list_casino_kpis to discover). Required.',
                },
                limit: {
                    type: 'number',
                    description:
                        'Max snapshots returned (default 50, max 500).',
                    default: 50,
                },
            },
            required: ['key'],
        },
        handler: async (params) => {
            try {
                const limit = Math.min(
                    Math.max(parseInt(params?.limit) || 50, 1),
                    500
                );
                const rows = await CasinoKpiSnapshot.findAll({
                    where: { key: params.key },
                    order: [['captured_at', 'DESC']],
                    limit,
                });
                const items = rows
                    .reverse()
                    .map((r) => ({
                        captured_at: r.captured_at,
                        value: toFloat(r.value),
                        previous: toFloat(r.previous),
                        spark: parseSpark(r.spark),
                        error: r.error,
                    }));
                return textJson({
                    key: params.key,
                    count: items.length,
                    items,
                });
            } catch (err) {
                return errorPayload(err.message);
            }
        },
    });

    // 4. query_metabase_card — proxy a Metabase saved-card query
    tools.push({
        name: 'query_metabase_card',
        description:
            'Run a Metabase saved card by ID and return the result rows + columns. Read-only (Metabase enforces this on cards). Use this to fetch any pre-built KPI / dashboard query that is not in the cached snapshot table.',
        inputSchema: {
            type: 'object',
            properties: {
                card_id: {
                    type: 'number',
                    description:
                        'Metabase card numeric ID. Required.',
                },
                limit: {
                    type: 'number',
                    description:
                        'Max rows to return back to the caller (truncates from full result, default 200).',
                    default: 200,
                },
            },
            required: ['card_id'],
        },
        handler: async (params) => {
            if (!metabase.isConfigured()) {
                return errorPayload('Metabase env not configured on tudidi');
            }
            try {
                const data = await metabase.runCard(params.card_id);
                const cols = (data?.data?.cols || []).map((c) => ({
                    name: c.name,
                    display_name: c.display_name,
                    base_type: c.base_type,
                }));
                const allRows = data?.data?.rows || [];
                const limit = Math.min(
                    Math.max(parseInt(params?.limit) || 200, 1),
                    2000
                );
                const truncated = allRows.length > limit;
                return textJson({
                    card_id: params.card_id,
                    columns: cols,
                    row_count: allRows.length,
                    truncated,
                    rows: allRows.slice(0, limit),
                });
            } catch (err) {
                const status = err?.response?.status;
                return errorPayload(
                    `Metabase card query failed: ${err.message}`,
                    { http_status: status }
                );
            }
        },
    });

    // 5. query_metabase_native — proxy native SQL (read-only, allowlisted DBs)
    tools.push({
        name: 'query_metabase_native',
        description:
            'Run a read-only native SQL query against a Metabase BigQuery database (Konibet=2, Sloten=3, DSC=4). Only SELECT and WITH-CTE allowed. Mutations are rejected client-side. Use this for ad-hoc analysis when no saved card exists.',
        inputSchema: {
            type: 'object',
            properties: {
                database_id: {
                    type: 'number',
                    description:
                        'Metabase database id. 2=Konibet BigQuery, 3=Sloten BigQuery, 4=DSC BigQuery. Required.',
                },
                sql: {
                    type: 'string',
                    description:
                        'SQL query. Must start with SELECT or WITH. INSERT/UPDATE/DELETE/DROP/ALTER/CREATE/TRUNCATE/GRANT/REVOKE rejected. Required.',
                },
                limit: {
                    type: 'number',
                    description:
                        'Max rows returned (default 200, hard max 2000).',
                    default: 200,
                },
            },
            required: ['database_id', 'sql'],
        },
        handler: async (params) => {
            if (!metabase.isConfigured()) {
                return errorPayload('Metabase env not configured on tudidi');
            }
            const dbId = parseInt(params.database_id);
            if (![2, 3, 4].includes(dbId)) {
                return errorPayload(
                    `database_id must be 2 (Konibet), 3 (Sloten), or 4 (DSC). Got: ${params.database_id}`
                );
            }
            if (!isReadOnlySql(params.sql)) {
                return errorPayload(
                    'SQL rejected. Only read-only SELECT / WITH allowed. INSERT/UPDATE/DELETE/DROP/ALTER/CREATE/TRUNCATE/GRANT/REVOKE forbidden.'
                );
            }
            try {
                const data = await metabase.request('POST', '/api/dataset', {
                    type: 'native',
                    database: dbId,
                    native: { query: params.sql },
                });
                const cols = (data?.data?.cols || []).map((c) => ({
                    name: c.name,
                    display_name: c.display_name,
                    base_type: c.base_type,
                }));
                const allRows = data?.data?.rows || [];
                const limit = Math.min(
                    Math.max(parseInt(params?.limit) || 200, 1),
                    2000
                );
                const truncated = allRows.length > limit;
                return textJson({
                    database_id: dbId,
                    columns: cols,
                    row_count: allRows.length,
                    truncated,
                    rows: allRows.slice(0, limit),
                });
            } catch (err) {
                const status = err?.response?.status;
                const detail =
                    err?.response?.data?.error_type ||
                    err?.response?.data?.message ||
                    err.message;
                return errorPayload(
                    `Metabase native query failed: ${detail}`,
                    { http_status: status }
                );
            }
        },
    });

    // 6. trigger_casino_kpi_sync — manual refresh
    tools.push({
        name: 'trigger_casino_kpi_sync',
        description:
            'Manually trigger an immediate Metabase → tudidi cache sync of all configured KPIs. Useful when fresh data is needed before the next 15min cron tick.',
        inputSchema: { type: 'object', properties: {} },
        handler: async () => {
            try {
                const result = await scheduler.runOnce();
                return textJson({ ok: true, ...result });
            } catch (err) {
                return errorPayload(err.message);
            }
        },
    });
}

module.exports = { registerCasinoBiTools };
