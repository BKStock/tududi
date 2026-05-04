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

// When the calendar month has not had enough elapsed days to produce a stable
// number (first 5 days), drop the partial current-month row so the displayed
// "latest" is the most recent fully-elapsed month. This avoids showing
// "Sloten 入金 -99%" anomaly on May 1st when only one day of May is live.
const PARTIAL_MONTH_CUTOFF_DAY = 5;

const currentYm = () => {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
};

const isPartialCurrentMonth = (monthStr) => {
    const now = new Date();
    if (now.getUTCDate() > PARTIAL_MONTH_CUTOFF_DAY) return false;
    return monthStr === currentYm();
};

// Source data sometimes contains future-dated typo rows (e.g. DSC bank_deposit
// has "2026-12" entries in May). Drop anything strictly newer than the current
// month so the "latest" tile reflects reality, not data-entry mistakes.
const isFutureMonth = (monthStr) => String(monthStr) > currentYm();

const monthlyByColumn = (colName) => (data) => {
    const cols = data?.data?.cols || [];
    const rows = data?.data?.rows || [];
    const monthIdx = findCol(cols, 'month');
    const valIdx = findCol(cols, colName);
    if (monthIdx < 0 || valIdx < 0) return null;
    let sorted = monthSort(rows, monthIdx).filter(
        (r) => numericOrNull(r[valIdx]) != null && !isFutureMonth(r[monthIdx])
    );
    if (sorted.length === 0) return null;
    if (isPartialCurrentMonth(String(sorted[0][monthIdx])) && sorted.length > 1) {
        sorted = sorted.slice(1);
    }
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

// Card 140 = [KPI] Monthly Trend - All Metrics (Konibet master card)
//   month / unique_depositors / active_players / deposit_jpy / ggr_jpy /
//   withdrawal_jpy / avg_deposit / ggr_ltv_jpy / ggr_per_depositor
// All Konibet monthly KPIs share this single card to minimize Metabase load.
const KONIBET_MASTER_CARD = 140;

const KPIS = [
    {
        key: 'konibet_ggr_jpy',
        brand: 'Konibet',
        metric: 'GGR',
        unit: 'JPY',
        cardId: KONIBET_MASTER_CARD,
        parse: monthlyByColumn('ggr_jpy'),
    },
    {
        key: 'konibet_deposit_jpy',
        brand: 'Konibet',
        metric: '入金',
        unit: 'JPY',
        cardId: KONIBET_MASTER_CARD,
        parse: monthlyByColumn('deposit_jpy'),
    },
    {
        key: 'konibet_withdrawal_jpy',
        brand: 'Konibet',
        metric: '出金',
        unit: 'JPY',
        cardId: KONIBET_MASTER_CARD,
        parse: monthlyByColumn('withdrawal_jpy'),
    },
    {
        key: 'konibet_unique_depositors',
        brand: 'Konibet',
        metric: 'Active',
        unit: 'count',
        cardId: KONIBET_MASTER_CARD,
        parse: monthlyByColumn('unique_depositors'),
    },
    {
        key: 'konibet_active_players',
        brand: 'Konibet',
        metric: 'Players',
        unit: 'count',
        cardId: KONIBET_MASTER_CARD,
        parse: monthlyByColumn('active_players'),
    },
    {
        key: 'konibet_avg_deposit',
        brand: 'Konibet',
        metric: 'AVG入金',
        unit: 'JPY',
        cardId: KONIBET_MASTER_CARD,
        parse: monthlyByColumn('avg_deposit'),
    },
    {
        // Phase 2.2: BK-created card 827 — month / registrations
        key: 'konibet_registrations',
        brand: 'Konibet',
        metric: '登録',
        unit: 'count',
        cardId: 827,
        parse: monthlyByColumn('registrations'),
    },
    {
        // Phase 2.2: BK-created card 826 — month / deposit_jpy / txns
        // (raw bank_deposit_native, confirmed amount only)
        key: 'sloten_deposit_jpy',
        brand: 'Sloten',
        metric: '入金',
        unit: 'JPY',
        cardId: 826,
        parse: monthlyByColumn('deposit_jpy'),
    },
    {
        key: 'sloten_deposit_txns',
        brand: 'Sloten',
        metric: '入金回数',
        unit: 'count',
        cardId: 826,
        parse: monthlyByColumn('txns'),
    },
    {
        key: 'sloten_ggr_total_jpy',
        brand: 'Sloten',
        metric: 'GGR累計',
        unit: 'JPY',
        cardId: 145, // [Sloten] Total GGR (JPY) — single scalar (cumulative)
        parse: singleScalar,
    },
    {
        // Phase 2.3: card 825 expanded to UNION ALL across all 4 DSC deposit
        // channels (bank_deposit + crypto_deposit + ec_deposit + paypay_deposit).
        // April: ¥46.2M total (~3× the bank-only ¥15.2M previously reported).
        key: 'dsc_deposit_jpy',
        brand: 'DSC',
        metric: '入金',
        unit: 'JPY',
        cardId: 825,
        parse: monthlyByColumn('deposit_jpy'),
    },
    {
        key: 'dsc_deposit_count',
        brand: 'DSC',
        metric: '入金件数',
        unit: 'count',
        cardId: 825,
        parse: monthlyByColumn('deposits'),
    },
    {
        key: 'dsc_ggr_total_jpy',
        brand: 'DSC',
        metric: 'GGR累計',
        unit: 'JPY',
        cardId: 40, // DSC Summary (JPY) — single row cumulative GGR (sam_customers)
        parse: (data) => {
            const cols = data?.data?.cols || [];
            const rows = data?.data?.rows || [];
            if (rows.length === 0) return null;
            const idx = findCol(cols, 'total_ggr');
            if (idx < 0) return null;
            const v = numericOrNull(rows[0][idx]);
            if (v == null) return null;
            return { value: v, previous: null, spark: [v] };
        },
    },
];

module.exports = { KPIS };
