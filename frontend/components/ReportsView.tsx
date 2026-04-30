// Reports View — analytics dashboard with KPIs, trends, breakdowns.
// Real-data driven from /api/tasks + /api/projects.
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    ChartBarIcon,
    ClockIcon,
    CheckCircleIcon,
    ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { fetchTasks } from '../utils/tasksService';
import { fetchProjects } from '../utils/projectsService';
import { fetchAreas } from '../utils/areasService';
import { Task } from '../entities/Task';
import { Project } from '../entities/Project';
import DashboardSkeleton from './Shared/Skeleton';

const formatPct = (n: number) => `${Math.round(n * 100)}%`;

const KpiCard: React.FC<{ label: string; value: string | number; trend?: { value: number; up: boolean }; icon: React.ReactNode; bgClass: string }> = ({ label, value, trend, icon, bgClass }) => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
        <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bgClass}`}>{icon}</div>
            <div className="flex-1">
                <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{value}</div>
            </div>
        </div>
        {trend && (
            <div className={`flex items-center gap-1 mt-3 text-xs font-medium ${trend.up ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {trend.up ? <ArrowTrendingUpIcon className="w-3.5 h-3.5" /> : <ArrowTrendingDownIcon className="w-3.5 h-3.5" />}
                <span>{trend.value > 0 ? '+' : ''}{trend.value}% 先週比</span>
            </div>
        )}
    </div>
);

const HBar: React.FC<{ label: string; value: number; max: number; color: string }> = ({ label, value, max, color }) => {
    const pct = max ? (value / max) * 100 : 0;
    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[180px]">{label}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums font-medium">{value}</span>
            </div>
            <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
            </div>
        </div>
    );
};

const ReportsView: React.FC = () => {
    const navigate = useNavigate();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [areas, setAreas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [range, setRange] = useState<7 | 14 | 30 | 90>(14);

    useEffect(() => {
        Promise.all([
            fetchTasks('?status=all').then((r) => r?.tasks || []).catch(() => []),
            fetchProjects().catch(() => []),
            fetchAreas().catch(() => []),
        ]).then(([t, p, a]) => {
            setTasks(t as Task[]);
            setProjects(p as Project[]);
            setAreas(a as any[]);
            setLoading(false);
        });
    }, []);

    const stats = useMemo(() => {
        const total = tasks.length;
        const done = tasks.filter((t: any) => t.status === 2).length;
        const inProg = tasks.filter((t: any) => t.status === 1).length;
        const todo = tasks.filter((t: any) => t.status === 0).length;
        const today0 = new Date(); today0.setHours(0, 0, 0, 0);
        const overdue = tasks.filter((t: any) => t.status !== 2 && t.due_date && new Date(t.due_date) < today0).length;

        // Done in last 7 days
        const week7 = new Date(); week7.setDate(week7.getDate() - 7);
        const doneThisWeek = tasks.filter((t: any) => t.status === 2 && t.completed_at && new Date(t.completed_at) >= week7).length;
        const doneLastWeek = tasks.filter((t: any) => {
            if (t.status !== 2 || !t.completed_at) return false;
            const c = new Date(t.completed_at);
            const w14 = new Date(); w14.setDate(w14.getDate() - 14);
            return c >= w14 && c < week7;
        }).length;
        const trend = doneLastWeek ? Math.round(((doneThisWeek - doneLastWeek) / doneLastWeek) * 100) : (doneThisWeek > 0 ? 100 : 0);

        const completionRate = total ? done / total : 0;
        return { total, done, inProg, todo, overdue, doneThisWeek, doneLastWeek, trend, completionRate };
    }, [tasks]);

    const byPriority = useMemo(() => {
        const buckets = { high: 0, medium: 0, low: 0 };
        tasks.forEach((t: any) => {
            if (t.status === 2) return;
            if (t.priority === 2) buckets.high++;
            else if (t.priority === 1) buckets.medium++;
            else buckets.low++;
        });
        return buckets;
    }, [tasks]);

    const byArea = useMemo(() => {
        const m = new Map<number, { name: string; total: number; done: number }>();
        areas.forEach((a) => m.set(a.id, { name: a.name, total: 0, done: 0 }));
        tasks.forEach((t: any) => {
            const proj = projects.find((p: any) => p.id === t.project_id) as any;
            if (!proj || !proj.area_id) return;
            const slot = m.get(proj.area_id);
            if (!slot) return;
            slot.total++;
            if (t.status === 2) slot.done++;
        });
        return Array.from(m.values()).filter((x) => x.total > 0).sort((a, b) => b.total - a.total);
    }, [tasks, projects, areas]);

    const topProjects = useMemo(() => {
        return projects.map((p: any) => {
            const ts = tasks.filter((t: any) => t.project_id === p.id);
            const dn = ts.filter((t: any) => t.status === 2).length;
            return { id: p.id, name: p.name, total: ts.length, done: dn, pct: ts.length ? dn / ts.length : 0 };
        }).filter((p) => p.total > 0).sort((a, b) => b.total - a.total).slice(0, 8);
    }, [projects, tasks]);

    // Last N days completion sparkline (range-controlled)
    const completionTrend = useMemo(() => {
        const days: { day: string; count: number }[] = [];
        for (let i = range - 1; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
            const next = new Date(d); next.setDate(next.getDate() + 1);
            const c = tasks.filter((t: any) => {
                if (t.status !== 2 || !t.completed_at) return false;
                const ct = new Date(t.completed_at);
                return ct >= d && ct < next;
            }).length;
            days.push({ day: d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }), count: c });
        }
        return days;
    }, [tasks, range]);

    const maxBucket = Math.max(byPriority.high, byPriority.medium, byPriority.low) || 1;
    const maxCompletion = Math.max(...completionTrend.map((d) => d.count)) || 1;
    const maxAreaTotal = Math.max(...byArea.map((a) => a.total)) || 1;

    if (loading) return <DashboardSkeleton />;

    return (
        <div className="bg-gray-50 dark:bg-gray-900 min-h-screen pb-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">レポート / 分析</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{areas.length} エリア × {projects.length} プロジェクト × {tasks.length} タスクの全体傾向</p>
                    </div>
                    <div className="flex gap-1.5 bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg p-1">
                        {([7, 14, 30, 90] as const).map((r) => (
                            <button
                                key={r}
                                onClick={() => setRange(r)}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${range === r ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                            >
                                {r}日
                            </button>
                        ))}
                    </div>
                </div>

                {/* KPI Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <KpiCard label="完了率" value={formatPct(stats.completionRate)} icon={<CheckCircleIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-300" />} bgClass="bg-emerald-100 dark:bg-emerald-900/40" />
                    <KpiCard label="今週完了" value={stats.doneThisWeek} trend={{ value: stats.trend, up: stats.trend >= 0 }} icon={<ArrowTrendingUpIcon className="w-5 h-5 text-blue-600 dark:text-blue-300" />} bgClass="bg-blue-100 dark:bg-blue-900/40" />
                    <KpiCard label="進行中" value={stats.inProg} icon={<ClockIcon className="w-5 h-5 text-amber-600 dark:text-amber-300" />} bgClass="bg-amber-100 dark:bg-amber-900/40" />
                    <KpiCard label="期限超過" value={stats.overdue} icon={<ExclamationCircleIcon className="w-5 h-5 text-rose-600 dark:text-rose-300" />} bgClass="bg-rose-100 dark:bg-rose-900/40" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Trend chart */}
                    <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-base font-semibold text-gray-900 dark:text-white">{range} 日間の完了タスク推移</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">日次の完了数</p>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">合計 {completionTrend.reduce((a, b) => a + b.count, 0)} 件</div>
                        </div>
                        <div className="flex items-end gap-1.5 h-40">
                            {completionTrend.map((d, i) => {
                                const h = (d.count / maxCompletion) * 100;
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
                                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-md relative" style={{ height: `${Math.max(h, 4)}%`, minHeight: '4px' }}>
                                            <div className="absolute inset-0 bg-gradient-to-t from-blue-500 to-cyan-400 rounded-md" />
                                            {d.count > 0 && (
                                                <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-mono text-gray-500 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition">{d.count}</div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex gap-1.5 mt-2">
                            {completionTrend.map((d, i) => (
                                <div key={i} className="flex-1 text-[9px] text-center text-gray-400 font-mono">{i % 3 === 0 ? d.day : ''}</div>
                            ))}
                        </div>
                    </div>

                    {/* Priority breakdown */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-6">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">優先度別 (未完了)</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">アクティブタスクの分布</p>
                        <div className="space-y-4">
                            <HBar label="High (P1)" value={byPriority.high} max={maxBucket} color="#f43f5e" />
                            <HBar label="Medium (P2)" value={byPriority.medium} max={maxBucket} color="#f59e0b" />
                            <HBar label="Low (P3)" value={byPriority.low} max={maxBucket} color="#10b981" />
                        </div>
                        <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">期限超過率</div>
                            <div className="text-3xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">{stats.total ? Math.round((stats.overdue / Math.max(stats.total - stats.done, 1)) * 100) : 0}%</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">アクティブタスクのうち</div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                    {/* By Area */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-6">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">エリア別タスク量</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{areas.length} エリア中 {byArea.length} がアクティブ</p>
                        <div className="space-y-4">
                            {byArea.map((a, i) => {
                                const colors = ['#3b82f6', '#a855f7', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];
                                return (
                                    <div key={a.name}>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-sm font-medium text-gray-900 dark:text-white">{a.name}</span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{a.done}/{a.total} ({Math.round((a.done / a.total) * 100)}%)</span>
                                        </div>
                                        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full" style={{ width: `${(a.total / maxAreaTotal) * 100}%`, background: colors[i % colors.length] }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Top projects */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-6">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">プロジェクト別 (タスク数 Top 8)</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">活動量ランキング</p>
                        <div className="space-y-3">
                            {topProjects.map((p, i) => (
                                <div key={p.id} className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-md bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center">{i + 1}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm text-gray-900 dark:text-white truncate max-w-[180px]">{p.name}</span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{p.done}/{p.total}</span>
                                        </div>
                                        <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full" style={{ width: `${p.pct * 100}%` }} />
                                        </div>
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 tabular-nums w-10 text-right">{Math.round(p.pct * 100)}%</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportsView;
