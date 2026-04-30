// Pulse View — Casino BI federation (Phase 1: mock data, Phase 2: Metabase API)
// Per 3-team consensus: Read-only KPI hero + anomaly banner + 1-tap action chain
// Federation pattern (Strategy team): Metabase = SoR / tudidi cache = display
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
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

interface KpiTile {
    brand: string;
    metric: string;
    value: number;
    yesterday: number;
    unit: '¥' | '人' | '件';
    spark: number[]; // last 7 days
}

// PHASE 1 mock data. PHASE 2 で /api/casino/kpi に置換予定。
// Source of Record: Metabase (https://metabase.slotenpromotion.com)
// Real values pulled from MASTER_CONTEXT.md historical baselines.
const MOCK_KPI: KpiTile[] = [
    { brand: 'Konibet', metric: 'GGR', value: 4_200_000, yesterday: 5_460_000, unit: '¥', spark: [5800, 5500, 5200, 5400, 5300, 5460, 4200] },
    { brand: 'Konibet', metric: '入金', value: 6_100_000, yesterday: 7_180_000, unit: '¥', spark: [7800, 7600, 7300, 7200, 7100, 7180, 6100] },
    { brand: 'Konibet', metric: 'Active', value: 1_240, yesterday: 1_305, unit: '人', spark: [1280, 1290, 1295, 1300, 1300, 1305, 1240] },
    { brand: 'Konibet', metric: '登録', value: 38, yesterday: 51, unit: '件', spark: [55, 53, 50, 48, 49, 51, 38] },
    { brand: 'DSC', metric: 'GGR', value: 1_800_000, yesterday: 1_764_000, unit: '¥', spark: [1700, 1750, 1780, 1760, 1750, 1764, 1800] },
    { brand: 'DSC', metric: '入金', value: 2_400_000, yesterday: 2_380_000, unit: '¥', spark: [2300, 2350, 2380, 2400, 2390, 2380, 2400] },
    { brand: 'Sloten', metric: 'GGR', value: 920_000, yesterday: 851_000, unit: '¥', spark: [820, 830, 840, 850, 845, 851, 920] },
];

const formatValue = (v: number, unit: string): string => {
    if (unit === '¥') {
        if (v >= 1_000_000) return `¥${(v / 1_000_000).toFixed(1)}M`;
        if (v >= 1_000) return `¥${(v / 1_000).toFixed(0)}k`;
        return `¥${v}`;
    }
    return v.toLocaleString();
};

const deltaPct = (current: number, yesterday: number): number => {
    if (!yesterday) return 0;
    return ((current - yesterday) / yesterday) * 100;
};

const ANOMALY_THRESHOLD = 15; // ±15% で異常判定

const Sparkline: React.FC<{ data: number[]; color: string }> = ({ data, color }) => {
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

const PulseView: React.FC = () => {
    const navigate = useNavigate();
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 60_000);
        return () => clearInterval(t);
    }, []);

    const lastSync = useMemo(() => {
        // PHASE 2: 実際の cache timestamp を表示
        const d = new Date();
        d.setMinutes(d.getMinutes() - 5);
        return d;
    }, []);

    const minutesAgo = Math.floor((now.getTime() - lastSync.getTime()) / 60000);
    const isStale = minutesAgo > 60;

    const anomalies = useMemo(() => {
        return MOCK_KPI.filter((k) => Math.abs(deltaPct(k.value, k.yesterday)) >= ANOMALY_THRESHOLD);
    }, []);

    const heroTiles = MOCK_KPI.slice(0, 4); // Konibet 4 KPI
    const secondaryTiles = MOCK_KPI.slice(4); // DSC + Sloten

    const handleQuickAction = (kpi: KpiTile, action: 'analyze' | 'investigate' | 'dismiss') => {
        const labels = {
            analyze: 'ヘルメスに分析させる',
            investigate: 'ログ調査タスク作成',
            dismiss: '無視 (既知)',
        };
        // PHASE 3: POST /api/task で自動生成 + AI assignee
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
                        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono ${isStale ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'}`}>
                            <ClockIcon className="w-3.5 h-3.5" />
                            updated {minutesAgo}min ago
                        </span>
                        <a
                            href="https://casino.and-ai.one"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition"
                        >
                            Casino BI で深掘り
                            <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                        </a>
                    </div>
                </div>

                {/* Anomaly banner */}
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
                            <span className="text-[10px] font-mono uppercase tracking-wider text-rose-600 dark:text-rose-400">前日比 ±{ANOMALY_THRESHOLD}% 超過</span>
                        </div>
                        <div className="space-y-2">
                            {anomalies.map((a) => {
                                const d = deltaPct(a.value, a.yesterday);
                                return (
                                    <div key={a.brand + a.metric} className="flex items-center gap-3 px-3 py-2 bg-white/70 dark:bg-gray-800/70 rounded-lg">
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

                {/* Hero 4-tile (Konibet primary) */}
                <div className="mb-6">
                    <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 mb-3 px-1">PRIMARY · Konibet</h2>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {heroTiles.map((k) => {
                            const d = deltaPct(k.value, k.yesterday);
                            const isAnomaly = Math.abs(d) >= ANOMALY_THRESHOLD;
                            const trendUp = d >= 0;
                            const trendColor = isAnomaly ? (trendUp ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400')
                                : (trendUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400');
                            const sparkColor = isAnomaly ? '#ef4444' : trendUp ? '#10b981' : '#94a3b8';
                            return (
                                <div key={k.brand + k.metric} className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 p-5 transition ${isAnomaly ? 'ring-rose-300 dark:ring-rose-800' : 'ring-gray-200 dark:ring-gray-700'}`}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{k.metric}</span>
                                        {k.metric === 'GGR' || k.metric === '入金' ? <CurrencyYenIcon className="w-3.5 h-3.5 text-gray-300" />
                                            : k.metric === 'Active' ? <UserGroupIcon className="w-3.5 h-3.5 text-gray-300" />
                                            : <ChartBarSquareIcon className="w-3.5 h-3.5 text-gray-300" />}
                                    </div>
                                    <div className="text-3xl font-bold text-gray-900 dark:text-white tabular-nums tracking-tight leading-none mb-2">
                                        {formatValue(k.value, k.unit)}
                                    </div>
                                    <div className={`flex items-center gap-1 text-xs font-mono ${trendColor} mb-3`}>
                                        {trendUp ? <ArrowTrendingUpIcon className="w-3.5 h-3.5" /> : <ArrowTrendingDownIcon className="w-3.5 h-3.5" />}
                                        <span className="font-semibold">{d > 0 ? '+' : ''}{d.toFixed(1)}%</span>
                                        <span className="text-gray-400 dark:text-gray-500 ml-1">vs 昨日</span>
                                    </div>
                                    <Sparkline data={k.spark} color={sparkColor} />
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Secondary tiles */}
                <div>
                    <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 mb-3 px-1">SECONDARY · DSC / Sloten</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {secondaryTiles.map((k) => {
                            const d = deltaPct(k.value, k.yesterday);
                            const isAnomaly = Math.abs(d) >= ANOMALY_THRESHOLD;
                            const trendUp = d >= 0;
                            const trendColor = isAnomaly ? (trendUp ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400')
                                : (trendUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400');
                            const sparkColor = isAnomaly ? '#ef4444' : trendUp ? '#10b981' : '#94a3b8';
                            return (
                                <div key={k.brand + k.metric} className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 p-5 ${isAnomaly ? 'ring-rose-300 dark:ring-rose-800' : 'ring-gray-200 dark:ring-gray-700'}`}>
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

                {/* Phase 2 indicator */}
                <div className="mt-8 px-4 py-3 bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-200 dark:ring-blue-900 rounded-xl flex items-start gap-3">
                    <BoltIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 text-xs text-blue-900 dark:text-blue-200">
                        <strong>Phase 1 (mock data)</strong> — 現在は MASTER_CONTEXT.md ベースのプレースホルダー値。
                        <strong>Phase 2</strong> で Metabase REST API → tudidi backend cache → 5 分 cron sync で実データに置換予定。
                        <strong>Phase 3</strong> で MCP tools (`get_casino_kpi`) 経由で Claude Code から横断クエリ可能に。
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PulseView;
