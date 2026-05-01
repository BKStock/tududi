// Pulse View — Casino BI federation
// Phase 2: Live data from /api/casino/kpi (Metabase → cache → tudidi)
// Source of Record: Metabase (https://metabase.slotenpromotion.com)
// Falls back to mock when backend cache empty (cold-start) or Metabase env unset.
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
    ArrowPathIcon,
    ArrowTopRightOnSquareIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    BoltIcon,
    ChartBarSquareIcon,
    ClockIcon,
    CurrencyYenIcon,
    UserGroupIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { getApiPath } from '../config/paths';

interface ApiKpi {
    key: string;
    brand: string;
    metric: string;
    unit: string;
    value: number | null;
    previous: number | null;
    spark: number[];
    captured_at: string | null;
    error: string | null;
}

interface KpiTile {
    key: string;
    brand: string;
    metric: string;
    value: number;
    previous: number;
    unit: 'JPY' | 'count';
    spark: number[];
    error?: string | null;
}

const MOCK_KPI: KpiTile[] = [
    { key: 'mock_konibet_ggr', brand: 'Konibet', metric: 'GGR', value: 4_200_000, previous: 5_460_000, unit: 'JPY', spark: [5800000, 5500000, 5200000, 5400000, 5300000, 5460000, 4200000] },
    { key: 'mock_konibet_dep', brand: 'Konibet', metric: '入金', value: 6_100_000, previous: 7_180_000, unit: 'JPY', spark: [7800000, 7600000, 7300000, 7200000, 7100000, 7180000, 6100000] },
    { key: 'mock_konibet_act', brand: 'Konibet', metric: 'Active', value: 1_240, previous: 1_305, unit: 'count', spark: [1280, 1290, 1295, 1300, 1300, 1305, 1240] },
    { key: 'mock_konibet_reg', brand: 'Konibet', metric: '登録', value: 38, previous: 51, unit: 'count', spark: [55, 53, 50, 48, 49, 51, 38] },
    { key: 'mock_dsc_ggr', brand: 'DSC', metric: 'GGR', value: 1_800_000, previous: 1_764_000, unit: 'JPY', spark: [1700000, 1750000, 1780000, 1760000, 1750000, 1764000, 1800000] },
    { key: 'mock_dsc_dep', brand: 'DSC', metric: '入金', value: 2_400_000, previous: 2_380_000, unit: 'JPY', spark: [2300000, 2350000, 2380000, 2400000, 2390000, 2380000, 2400000] },
    { key: 'mock_sloten_ggr', brand: 'Sloten', metric: 'GGR', value: 920_000, previous: 851_000, unit: 'JPY', spark: [820000, 830000, 840000, 850000, 845000, 851000, 920000] },
];

const formatValue = (v: number, unit: string): string => {
    if (unit === 'JPY' || unit === '¥') {
        if (Math.abs(v) >= 1_000_000_000) return `¥${(v / 1_000_000_000).toFixed(2)}B`;
        if (Math.abs(v) >= 1_000_000) return `¥${(v / 1_000_000).toFixed(1)}M`;
        if (Math.abs(v) >= 1_000) return `¥${(v / 1_000).toFixed(0)}k`;
        return `¥${v}`;
    }
    return v.toLocaleString();
};

const deltaPct = (current: number, previous: number): number => {
    if (!previous) return 0;
    return ((current - previous) / previous) * 100;
};

const ANOMALY_THRESHOLD = 15;

const Sparkline: React.FC<{ data: number[]; color: string }> = ({ data, color }) => {
    if (!data || data.length < 2) {
        return <div className="w-full h-8 flex items-center justify-center text-[10px] text-gray-300 dark:text-gray-600">no trend</div>;
    }
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const points = data.map((v, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 100 - ((v - min) / range) * 90 - 5;
        return `${x},${y}`;
    }).join(' ');
    return (
        <svg viewBox="0 0 100 100" className="w-full h-8" preserveAspectRatio="none">
            <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
};

const apiToTile = (k: ApiKpi): KpiTile | null => {
    if (k.value == null) return null;
    return {
        key: k.key,
        brand: k.brand,
        metric: k.metric,
        unit: (k.unit === 'JPY' ? 'JPY' : 'count'),
        value: Number(k.value),
        previous: k.previous != null ? Number(k.previous) : Number(k.value),
        spark: Array.isArray(k.spark) ? k.spark.filter((v) => v != null).map(Number) : [],
        error: k.error,
    };
};

const PulseView: React.FC = () => {
    const [now, setNow] = useState(new Date());
    const [tiles, setTiles] = useState<KpiTile[]>([]);
    const [usingMock, setUsingMock] = useState(true);
    const [lastSync, setLastSync] = useState<Date | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [schedulerHealth, setSchedulerHealth] = useState<{ enabled: boolean; lastRun: string | null } | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const loadKpi = useCallback(async () => {
        try {
            const res = await fetch(getApiPath('casino/kpi'), { credentials: 'include' });
            if (!res.ok) throw new Error(`http ${res.status}`);
            const data = await res.json();
            const items: ApiKpi[] = data.kpis || [];
            const live = items.map(apiToTile).filter(Boolean) as KpiTile[];
            if (live.length === 0) {
                setTiles(MOCK_KPI);
                setUsingMock(true);
                setLastSync(null);
            } else {
                setTiles(live);
                setUsingMock(false);
                const latest = items
                    .map((i) => (i.captured_at ? new Date(i.captured_at).getTime() : 0))
                    .reduce((a, b) => Math.max(a, b), 0);
                setLastSync(latest ? new Date(latest) : null);
            }
            setSchedulerHealth({
                enabled: !!data.scheduler?.enabled,
                lastRun: data.scheduler?.lastRun || null,
            });
            setErrorMsg(null);
        } catch (e: any) {
            setTiles(MOCK_KPI);
            setUsingMock(true);
            setErrorMsg(e?.message || 'fetch failed');
        }
    }, []);

    useEffect(() => {
        loadKpi();
        const t = setInterval(() => setNow(new Date()), 60_000);
        const t2 = setInterval(loadKpi, 5 * 60_000);
        return () => { clearInterval(t); clearInterval(t2); };
    }, [loadKpi]);

    const handleRefresh = async () => {
        if (refreshing) return;
        setRefreshing(true);
        try {
            await fetch(getApiPath('casino/kpi/refresh'), { method: 'POST', credentials: 'include' });
            await loadKpi();
        } finally {
            setRefreshing(false);
        }
    };

    const minutesAgo = lastSync ? Math.floor((now.getTime() - lastSync.getTime()) / 60000) : null;
    const isStale = minutesAgo == null || minutesAgo > 60;

    const anomalies = useMemo(() => {
        return tiles.filter((k) => k.previous && Math.abs(deltaPct(k.value, k.previous)) >= ANOMALY_THRESHOLD);
    }, [tiles]);

    // Primary lane: 4 most decision-critical Konibet metrics in fixed order.
    const HERO_ORDER = ['GGR', '入金', 'Active', 'Players'];
    const konibetTiles = tiles.filter((t) => t.brand === 'Konibet');
    const heroTiles = HERO_ORDER
        .map((m) => konibetTiles.find((t) => t.metric === m))
        .filter(Boolean) as KpiTile[];
    const heroKeys = new Set(heroTiles.map((t) => t.key));
    const secondaryTiles = [
        ...konibetTiles.filter((t) => !heroKeys.has(t.key)),
        ...tiles.filter((t) => t.brand !== 'Konibet'),
    ];

    const handleQuickAction = (kpi: KpiTile, action: 'analyze' | 'investigate') => {
        const labels = {
            analyze: 'ヘルメスに分析させる',
            investigate: 'ログ調査タスク作成',
        };
        // PHASE 3: POST /api/task で auto-create + AI assignee
        // eslint-disable-next-line no-console
        console.log(`[Pulse] action: ${action} for ${kpi.brand} ${kpi.metric}`, labels[action]);
    };

    return (
        <div className="bg-gray-50 dark:bg-gray-900 min-h-screen pb-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pulse</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">金融脈拍 — Casino KPI 横断モニタ</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                        {usingMock && (
                            <span className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-mono uppercase tracking-wider text-[10px]">
                                mock data
                            </span>
                        )}
                        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono ${isStale ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'}`}>
                            <ClockIcon className="w-3.5 h-3.5" />
                            {minutesAgo == null ? 'no sync yet' : `updated ${minutesAgo}min ago`}
                        </span>
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition disabled:opacity-50"
                        >
                            <ArrowPathIcon className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                            {refreshing ? '同期中…' : '再同期'}
                        </button>
                        <a
                            href="https://casino.and-ai.one"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:opacity-90 font-medium transition"
                        >
                            Casino BI で深掘り
                            <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                        </a>
                    </div>
                </div>

                {errorMsg && !usingMock && (
                    <div className="mb-4 px-3 py-2 bg-rose-50 dark:bg-rose-950/40 ring-1 ring-rose-200 dark:ring-rose-900 rounded-lg text-xs text-rose-700 dark:text-rose-300 font-mono">
                        API error: {errorMsg}
                    </div>
                )}

                {anomalies.length > 0 && (
                    <div className="mb-6 bg-gradient-to-r from-rose-50 to-amber-50 dark:from-rose-950/40 dark:to-amber-950/40 ring-1 ring-rose-200 dark:ring-rose-900 rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                            </span>
                            <h2 className="text-base font-semibold text-rose-900 dark:text-rose-200">
                                {anomalies.length} 件の異常検知
                            </h2>
                            <span className="text-[10px] font-mono uppercase tracking-wider text-rose-600 dark:text-rose-400">前期比 ±{ANOMALY_THRESHOLD}% 超過</span>
                        </div>
                        <div className="space-y-2">
                            {anomalies.map((a) => {
                                const d = deltaPct(a.value, a.previous);
                                return (
                                    <div key={a.key} className="flex items-center gap-3 px-3 py-2 bg-white/70 dark:bg-gray-800/70 rounded-lg">
                                        <ExclamationTriangleIcon className={`w-4 h-4 flex-shrink-0 ${d < 0 ? 'text-rose-500' : 'text-amber-500'}`} />
                                        <div className="flex-1 min-w-0">
                                            <span className="font-semibold text-gray-900 dark:text-white">{a.brand} {a.metric}</span>
                                            <span className="text-gray-500 dark:text-gray-400 ml-2 text-sm">{formatValue(a.value, a.unit)}</span>
                                            <span className={`ml-2 text-sm font-mono font-semibold ${d < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                                {d > 0 ? '+' : ''}{d.toFixed(1)}%
                                            </span>
                                        </div>
                                        <div className="flex gap-1.5">
                                            <button onClick={() => handleQuickAction(a, 'analyze')} className="text-[11px] px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium transition">
                                                分析依頼
                                            </button>
                                            <button onClick={() => handleQuickAction(a, 'investigate')} className="text-[11px] px-2.5 py-1 rounded-md bg-white dark:bg-gray-700 ring-1 ring-gray-200 dark:ring-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 font-medium transition">
                                                ログ調査
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="mb-6">
                    <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 mb-3 px-1">PRIMARY · Konibet</h2>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {heroTiles.map((k) => {
                            const d = deltaPct(k.value, k.previous);
                            const isAnomaly = Math.abs(d) >= ANOMALY_THRESHOLD;
                            const trendUp = d >= 0;
                            const trendColor = isAnomaly ? (trendUp ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400')
                                : (trendUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400');
                            const sparkColor = isAnomaly ? '#ef4444' : trendUp ? '#10b981' : '#94a3b8';
                            return (
                                <div key={k.key} className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 p-5 transition ${isAnomaly ? 'ring-rose-300 dark:ring-rose-800' : 'ring-gray-200 dark:ring-gray-700'}`}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{k.metric}</span>
                                        {k.metric === 'GGR' || k.metric === '入金' || k.metric === '出金' ? <CurrencyYenIcon className="w-3.5 h-3.5 text-gray-300" />
                                            : k.metric === 'Active' ? <UserGroupIcon className="w-3.5 h-3.5 text-gray-300" />
                                            : <ChartBarSquareIcon className="w-3.5 h-3.5 text-gray-300" />}
                                    </div>
                                    <div className="text-3xl font-bold text-gray-900 dark:text-white tabular-nums tracking-tight leading-none mb-2">
                                        {formatValue(k.value, k.unit)}
                                    </div>
                                    <div className={`flex items-center gap-1 text-xs font-mono ${trendColor} mb-3`}>
                                        {trendUp ? <ArrowTrendingUpIcon className="w-3.5 h-3.5" /> : <ArrowTrendingDownIcon className="w-3.5 h-3.5" />}
                                        <span className="font-semibold">{d > 0 ? '+' : ''}{d.toFixed(1)}%</span>
                                        <span className="text-gray-400 dark:text-gray-500 ml-1">vs 前期</span>
                                    </div>
                                    <Sparkline data={k.spark} color={sparkColor} />
                                </div>
                            );
                        })}
                    </div>
                </div>

                {secondaryTiles.length > 0 && (
                    <div>
                        <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 mb-3 px-1">SECONDARY · DSC / Sloten</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {secondaryTiles.map((k) => {
                                const d = deltaPct(k.value, k.previous);
                                const isAnomaly = Math.abs(d) >= ANOMALY_THRESHOLD;
                                const trendUp = d >= 0;
                                const trendColor = isAnomaly ? (trendUp ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400')
                                    : (trendUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400');
                                const sparkColor = isAnomaly ? '#ef4444' : trendUp ? '#10b981' : '#94a3b8';
                                return (
                                    <div key={k.key} className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 p-5 ${isAnomaly ? 'ring-rose-300 dark:ring-rose-800' : 'ring-gray-200 dark:ring-gray-700'}`}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-mono text-gray-500 dark:text-gray-400 uppercase tracking-wide">{k.brand} · {k.metric}</span>
                                        </div>
                                        <div className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums tracking-tight leading-none mb-2">
                                            {formatValue(k.value, k.unit)}
                                        </div>
                                        <div className={`flex items-center gap-1 text-xs font-mono ${trendColor} mb-3`}>
                                            {trendUp ? <ArrowTrendingUpIcon className="w-3.5 h-3.5" /> : <ArrowTrendingDownIcon className="w-3.5 h-3.5" />}
                                            <span className="font-semibold">{d > 0 ? '+' : ''}{d.toFixed(1)}%</span>
                                        </div>
                                        <Sparkline data={k.spark} color={sparkColor} />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="mt-8 px-4 py-3 bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-200 dark:ring-blue-900 rounded-xl flex items-start gap-3">
                    <BoltIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 text-xs text-blue-900 dark:text-blue-200">
                        <strong>Phase 2 (live)</strong> — Metabase API → tudidi cache (15min sync). Source of Record: <code className="px-1 bg-white/40 dark:bg-blue-950 rounded">metabase.slotenpromotion.com</code>.
                        {schedulerHealth && <> Scheduler: {schedulerHealth.enabled ? '✓ enabled' : '✗ disabled'}.</>}
                        <strong className="ml-2">Phase 3</strong> で MCP tools (`get_casino_kpi`) 経由 Claude Code 横断クエリ予定。
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PulseView;
