// Portfolio View — 6 areas × 17 projects matrix with health indicators.
// Real-data driven from /api/areas, /api/projects, /api/tasks.
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FolderIcon,
    ChevronRightIcon,
    BoltIcon,
    PauseCircleIcon,
    CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { fetchTasks } from '../utils/tasksService';
import { fetchProjects } from '../utils/projectsService';
import { fetchAreas } from '../utils/areasService';
import { Task } from '../entities/Task';
import { Project } from '../entities/Project';

const AREA_COLORS: Record<string, { bg: string; ring: string; dot: string; text: string }> = {
    'iGaming': { bg: 'bg-rose-50 dark:bg-rose-950/40', ring: 'ring-rose-200 dark:ring-rose-900', dot: 'bg-rose-400', text: 'text-rose-700 dark:text-rose-300' },
    'Intel': { bg: 'bg-violet-50 dark:bg-violet-950/40', ring: 'ring-violet-200 dark:ring-violet-900', dot: 'bg-violet-400', text: 'text-violet-700 dark:text-violet-300' },
    'SaaS': { bg: 'bg-blue-50 dark:bg-blue-950/40', ring: 'ring-blue-200 dark:ring-blue-900', dot: 'bg-blue-400', text: 'text-blue-700 dark:text-blue-300' },
    'Media': { bg: 'bg-amber-50 dark:bg-amber-950/40', ring: 'ring-amber-200 dark:ring-amber-900', dot: 'bg-amber-400', text: 'text-amber-700 dark:text-amber-300' },
    'New Biz': { bg: 'bg-emerald-50 dark:bg-emerald-950/40', ring: 'ring-emerald-200 dark:ring-emerald-900', dot: 'bg-emerald-400', text: 'text-emerald-700 dark:text-emerald-300' },
    'Infra': { bg: 'bg-slate-50 dark:bg-slate-800/60', ring: 'ring-slate-200 dark:ring-slate-700', dot: 'bg-slate-400', text: 'text-slate-700 dark:text-slate-300' },
};

const defaultColor = { bg: 'bg-gray-50 dark:bg-gray-800/60', ring: 'ring-gray-200 dark:ring-gray-700', dot: 'bg-gray-400', text: 'text-gray-700 dark:text-gray-300' };

const PortfolioView: React.FC = () => {
    const navigate = useNavigate();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [areas, setAreas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'active' | 'attention'>('all');

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

    const enriched = useMemo(() => {
        return projects.map((p: any) => {
            const ts = tasks.filter((t: any) => t.project_id === p.id);
            const total = ts.length;
            const done = ts.filter((t: any) => t.status === 2).length;
            const inProg = ts.filter((t: any) => t.status === 1).length;
            const todo = ts.filter((t: any) => t.status === 0).length;
            const today0 = new Date(); today0.setHours(0, 0, 0, 0);
            const overdue = ts.filter((t: any) => t.status !== 2 && t.due_date && new Date(t.due_date) < today0).length;
            const pct = total ? Math.round((done / total) * 100) : 0;
            const area = areas.find((a) => a.id === p.area_id);
            const lastUpdate = ts.length ? Math.max(...ts.map((t: any) => new Date(t.updated_at || t.created_at || 0).getTime())) : 0;
            const daysSince = lastUpdate ? Math.round((Date.now() - lastUpdate) / 86400000) : 999;

            // Health: overdue → 'attention', no recent activity → 'idle', has in-progress → 'active'
            let health: 'active' | 'idle' | 'attention' | 'planned' = 'planned';
            if (overdue > 0) health = 'attention';
            else if (inProg > 0) health = 'active';
            else if (total === 0 || daysSince > 14) health = 'idle';
            else health = 'active';

            return { ...p, area, total, done, inProg, todo, overdue, pct, health, daysSince, lastUpdate };
        });
    }, [tasks, projects, areas]);

    const filtered = useMemo(() => {
        if (filter === 'active') return enriched.filter((p) => p.health === 'active');
        if (filter === 'attention') return enriched.filter((p) => p.health === 'attention');
        return enriched;
    }, [enriched, filter]);

    // Group by area
    const groupedByArea = useMemo(() => {
        const m = new Map<number, any[]>();
        filtered.forEach((p: any) => {
            const aid = p.area_id ?? 0;
            if (!m.has(aid)) m.set(aid, []);
            m.get(aid)!.push(p);
        });
        return Array.from(m.entries())
            .map(([aid, list]) => {
                const area = areas.find((a) => a.id === aid);
                return { id: aid, name: area?.name ?? '未分類', list };
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [filtered, areas]);

    const portfolioStats = useMemo(() => {
        const total = enriched.length;
        const active = enriched.filter((p) => p.health === 'active').length;
        const attention = enriched.filter((p) => p.health === 'attention').length;
        const idle = enriched.filter((p) => p.health === 'idle').length;
        const totalTasks = enriched.reduce((a, b) => a + b.total, 0);
        const totalDone = enriched.reduce((a, b) => a + b.done, 0);
        return { total, active, attention, idle, totalTasks, totalDone };
    }, [enriched]);

    if (loading) return <div className="p-8 text-gray-500 text-center">読み込み中...</div>;

    return (
        <div className="bg-gray-50 dark:bg-gray-900 min-h-screen pb-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ポートフォリオ</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{portfolioStats.total} プロジェクト × {areas.length} エリアの全体状況</p>
                    </div>
                    <div className="flex gap-2">
                        {[
                            { k: 'all', label: 'All', count: portfolioStats.total },
                            { k: 'active', label: 'Active', count: portfolioStats.active },
                            { k: 'attention', label: 'Attention', count: portfolioStats.attention },
                        ].map((b) => (
                            <button
                                key={b.k}
                                onClick={() => setFilter(b.k as any)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${filter === b.k ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 ring-1 ring-gray-200 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                            >
                                {b.label}
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${filter === b.k ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700'}`}>{b.count}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Top KPI */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">プロジェクト総数</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{portfolioStats.total}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{areas.length} エリアに分散</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
                        <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Active</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{portfolioStats.active}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">進行中</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
                        <div className="text-xs text-rose-600 dark:text-rose-400 font-medium">要対応</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{portfolioStats.attention}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">期限超過あり</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
                        <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">完了率</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{portfolioStats.totalTasks ? Math.round((portfolioStats.totalDone / portfolioStats.totalTasks) * 100) : 0}%</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{portfolioStats.totalDone}/{portfolioStats.totalTasks} タスク</div>
                    </div>
                </div>

                {/* Grouped grid */}
                <div className="space-y-8">
                    {groupedByArea.map((g) => {
                        const c = AREA_COLORS[g.name] ?? defaultColor;
                        return (
                            <section key={g.id}>
                                <div className="flex items-center gap-3 mb-4">
                                    <span className={`w-2 h-8 rounded-full ${c.dot}`} />
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">{g.name}</h2>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase tracking-wide ${c.bg} ${c.text} ring-1 ring-inset ${c.ring}`}>{g.list.length} projects</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {g.list.map((p: any) => {
                                        const healthChip = p.health === 'attention'
                                            ? { bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-700 dark:text-rose-300', dot: 'bg-rose-400', label: '要対応' }
                                            : p.health === 'active'
                                            ? { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-400', label: 'Active' }
                                            : { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-400', label: 'Idle' };
                                        return (
                                            <button
                                                key={p.id}
                                                onClick={() => navigate(`/project/${p.uid}`)}
                                                className="group bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 hover:shadow-md hover:ring-blue-300 transition text-left"
                                            >
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <FolderIcon className={`w-5 h-5 flex-shrink-0 ${c.text}`} />
                                                        <h3 className="font-semibold text-gray-900 dark:text-white truncate">{p.name}</h3>
                                                    </div>
                                                    <ChevronRightIcon className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-blue-500 transition" />
                                                </div>

                                                <div className="flex items-center gap-1.5 mb-4">
                                                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${healthChip.bg} ${healthChip.text}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${healthChip.dot}`} />
                                                        {healthChip.label}
                                                    </span>
                                                    {p.overdue > 0 && (
                                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">超過 {p.overdue}</span>
                                                    )}
                                                    <span className="ml-auto text-[10px] text-gray-400 dark:text-gray-500">
                                                        {p.daysSince === 999 ? '未着手' : `${p.daysSince}d 前`}
                                                    </span>
                                                </div>

                                                <div className="space-y-2 mb-4">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs text-gray-500 dark:text-gray-400">進捗</span>
                                                        <span className="text-xs text-gray-900 dark:text-white tabular-nums font-semibold">{p.pct}%</span>
                                                    </div>
                                                    <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                                        <div className={`h-full rounded-full ${p.health === 'attention' ? 'bg-gradient-to-r from-rose-400 to-rose-600' : 'bg-gradient-to-r from-blue-400 to-blue-600'}`} style={{ width: `${p.pct}%` }} />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-3 gap-2 text-center">
                                                    <div className="py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                                                        <div className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">{p.todo}</div>
                                                        <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase">Todo</div>
                                                    </div>
                                                    <div className="py-2 rounded-lg bg-blue-50 dark:bg-blue-900/30">
                                                        <div className="text-sm font-bold text-blue-700 dark:text-blue-300 tabular-nums">{p.inProg}</div>
                                                        <div className="text-[10px] text-blue-600 dark:text-blue-400 uppercase">進行</div>
                                                    </div>
                                                    <div className="py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/30">
                                                        <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">{p.done}</div>
                                                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase">完了</div>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default PortfolioView;
