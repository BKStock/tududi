'use strict';

// Time-series row shape: { rows: [[col1,col2,...]], cols: [{name}, ...] }.
// Each parser returns { value, previous, spark[] } or null when unavailable.

const monthSort = (rows, monthIdx) =>
    [...rows]
        .filter((r) => r[monthIdx] != null)
        .sort((a, b) => (a[monthIdx] > b[monthIdx] ? -1 : 1));

const numericOrNull = (v) => {
    if (v == null) return null;
    if (typeof v === 'number') return v;
    const s = String(v).replace(/[¥,$\s,]/g, '');
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
};

const findCol = (cols, ...names) => {
    for (const n of names) {
        const idx = cols.findIndex(
            (c) =>
                (c.name || '').toLowerCase() === n.toLowerCase() ||
                (c.display_name || '').toLowerCase() === n.toLowerCase()
        );
        if (idx >= 0) return idx;
    }
    return -1;
};

const monthlyByColumn = (colName) => (data) => {
    const cols = data?.data?.cols || [];
    const rows = data?.data?.rows || [];
    const monthIdx = findCol(cols, 'month');
    const valIdx = findCol(cols, colName);
    if (monthIdx < 0 || valIdx < 0) return null;
    const sorted = monthSort(rows, monthIdx).filter(
        (r) => numericOrNull(r[valIdx]) != null
    );
    if (sorted.length === 0) return null;
    const latest = numericOrNull(sorted[0][valIdx]);
    const previous = sorted[1] ? numericOrNull(sorted[1][valIdx]) : null;
    const spark = sorted.slice(0, 7).reverse().map((r) => numericOrNull(r[valIdx]));
    return { value: latest, previous, spark };
};

const singleScalar = (data) => {
    const rows = data?.data?.rows || [];
    if (rows.length === 0) return null;
    const v = numericOrNull(rows[0][0]);
    if (v == null) return null;
    return { value: v, previous: null, spark: [v] };
};

// KPI declarations. card_id pulled from existing user-saved cards on
// metabase.slotenpromotion.com. Adjust here as Metabase content evolves.
const KPIS = [
    {
        key: 'konibet_ggr_jpy',
        brand: 'Konibet',
        metric: 'GGR',
        unit: 'JPY',
        cardId: 142, // [KPI] GGR Trend (JPY) — month / ggr_jpy / deposit_jpy / withdrawal_jpy
        parse: monthlyByColumn('ggr_jpy'),
    },
    {
        key: 'konibet_deposit_jpy',
        brand: 'Konibet',
        metric: '入金',
        unit: 'JPY',
        cardId: 142,
        parse: monthlyByColumn('deposit_jpy'),
    },
    {
        key: 'konibet_withdrawal_jpy',
        brand: 'Konibet',
        metric: '出金',
        unit: 'JPY',
        cardId: 142,
        parse: monthlyByColumn('withdrawal_jpy'),
    },
    {
        key: 'konibet_unique_depositors',
        brand: 'Konibet',
        metric: 'Active',
        unit: 'count',
        cardId: 137, // [KPI] Unique Depositors (Latest Month)
        parse: singleScalar,
    },
    {
        key: 'konibet_total_registrations',
        brand: 'Konibet',
        metric: '登録',
        unit: 'count',
        cardId: 143, // [KPI] Total Registrations
        parse: singleScalar,
    },
    {
        key: 'sloten_ggr_jpy',
        brand: 'Sloten',
        metric: 'GGR',
        unit: 'JPY',
        cardId: 145, // [Sloten] Total GGR (JPY)
        parse: singleScalar,
    },
];

module.exports = { KPIS };
