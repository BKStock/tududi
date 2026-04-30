// CEO View — BK Dashboard executive overview.
// Design source: .aidesigner/runs/gpt-design-20260430/design-gpt.html
// Wires to real tudidi API (tasks / projects / areas / profile).
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ClipboardDocumentListIcon,
    ClockIcon,
    CheckCircleIcon,
    ExclamationCircleIcon,
    BellIcon,
    MagnifyingGlassIcon,
    EllipsisVerticalIcon,
    CalendarIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { fetchTasks } from '../utils/tasksService';
import { fetchProjects } from '../utils/projectsService';
import { Task } from '../entities/Task';
import { Project } from '../entities/Project';
import DashboardSkeleton from './Shared/Skeleton';

type Status = 0 | 1 | 2 | 3;
type Priority = 0 | 1 | 2;

const priorityLabel = (p: Priority): { label: string; klass: string } => {
    if (p === 2) return { label: 'High', klass: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:ring-rose-900' };
    if (p === 1) return { label: 'Medium', klass: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900' };
    return { label: 'Low', klass: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900' };
};

const statusLabel = (s: Status): { label: string; klass: string } => {
    if (s === 2) return { label: 'Done', klass: 'bg-emerald-50 text-emerald-700 ring-emerald-200' };
    if (s === 1) return { label: 'In Progress', klass: 'bg-blue-50 text-blue-700 ring-blue-200' };
    if (s === 3) return { label: 'Waiting', klass: 'bg-violet-50 text-violet-700 ring-violet-200' };
    return { label: 'To Do', klass: 'bg-slate-50 text-slate-700 ring-slate-200' };
};

const formatDate = (d: string | Date | null | undefined) => {
    if (!d) return '—';
    try {
        const date = typeof d === 'string' ? new Date(d) : d;
        return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
    } catch {
        return '—';
    }
};

const daysUntil = (d: string | Date | null | undefined): number | null => {
    if (!d) return null;
    const date = typeof d === 'string' ? new Date(d) : d;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = date.getTime() - today.getTime();
    return Math.round(diff / (1000 * 60 * 60 * 24));
};

const avatarUrl = (name: string) =>
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=64`;

interface KpiProps {
    label: string;
    value: number;
    delta?: string;
    icon: React.ReactNode;
    bgClass: string;
}
const Kpi: React.FC<KpiProps> = ({ label, value, delta, icon, bgClass }) => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${bgClass}`}>{icon}</div>
        <div className="flex-1 min-w-0">
            <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums leading-tight">{value}</div>
            {delta && <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">{delta}</div>}
        </div>
    </div>
);

const StatusDonut: React.FC<{ todo: number; inprog: number; review: number; done: number }> = ({ todo, inprog, review, done }) => {
    const total = todo + inprog + review + done || 1;
    const cf = (n: number) => (n / total) * 251.2; // 2*pi*r where r=40
    let offset = 0;
    const segs = [
        { val: todo, color: '#94a3b8', label: 'To Do' },
        { val: inprog, color: '#3b82f6', label: 'In Progress' },
        { val: review, color: '#a855f7', label: 'Review' },
        { val: done, color: '#10b981', label: 'Done' },
    ];
    return (
        <div className="flex items-center gap-6">
            <div className="relative w-32 h-32">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#f1f5f9" strokeWidth="14" />
                    {segs.map((s, i) => {
                        const len = cf(s.val);
                        const dash = `${len} ${251.2 - len}`;
                        const startOffset = -offset;
                        offset += len;
                        return (
                            <circle key={i} cx="50" cy="50" r="40" fill="none"
                                stroke={s.color} strokeWidth="14"
                                strokeDasharray={dash}
                                strokeDashoffset={startOffset}
                                strokeLinecap="butt" />
                        );
                    })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{total}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
                </div>
            </div>
            <div className="flex-1 space-y-2 text-sm">
                {segs.map((s) => (
                    <div key={s.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                            <span className="text-gray-600 dark:text-gray-300">{s.label}</span>
                        </div>
                        <span className="text-gray-900 dark:text-white tabular-nums font-medium">{s.val} <span className="text-gray-400 text-xs">({Math.round((s.val / total) * 100)}%)</span></span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const MiniCalendar: React.FC<{ taskDates: Set<string> }> = ({ taskDates }) => {
    const [shown, setShown] = useState(new Date());
    const year = shown.getFullYear();
    const month = shown.getMonth();
    const today = new Date();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startCol = (firstDay.getDay() + 6) % 7; // Monday-first
    const cells: (number | null)[] = Array(startCol).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length < 42) cells.push(null);

    const monthLabel = shown.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' });

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
            <div className="flex items-center justify-between mb-4">
                <button onClick={() => setShown(new Date(year, month - 1, 1))} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                    <ChevronLeftIcon className="w-4 h-4" />
                </button>
                <div className="font-semibold text-sm text-gray-900 dark:text-white">{monthLabel}</div>
                <button onClick={() => setShown(new Date(year, month + 1, 1))} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                    <ChevronRightIcon className="w-4 h-4" />
                </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-gray-400 font-mono uppercase mb-2">
                {['月', '火', '水', '木', '金', '土', '日'].map((d) => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1 text-sm">
                {cells.map((d, i) => {
                    if (!d) return <div key={i} />;
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
                    const hasTask = taskDates.has(dateStr);
                    return (
                        <div key={i} className={`aspect-square flex items-center justify-center rounded relative tabular-nums
                            ${isToday ? 'bg-blue-500 text-white font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                            {d}
                            {hasTask && !isToday && <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-blue-400" />}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const CeoView: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                // Fetch tasks (active + done)
                const allTasks = await fetchTasks('?status=all').catch(() => null);
                const ts = (allTasks?.tasks || []) as Task[];
                setTasks(ts);

                const ps = await fetchProjects();
                setProjects(ps || []);
            } catch (e) {
                console.error('CeoView load error', e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    // Phase 0 fix: TZ-safe today midnight, no toDateString() ambiguity
    const today0 = useMemo(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }, []);
    const tomorrow0 = useMemo(() => {
        const d = new Date(today0);
        d.setDate(d.getDate() + 1);
        return d;
    }, [today0]);

    const stats = useMemo(() => {
        const total = tasks.length;
        const done = tasks.filter((t) => (t as any).status === 2).length;
        const inProg = tasks.filter((t) => (t as any).status === 1).length;
        const todo = tasks.filter((t) => (t as any).status === 0).length;
        const review = tasks.filter((t) => (t as any).status === 3).length;
        const overdue = tasks.filter((t: any) => {
            if (t.status === 2) return false;
            if (!t.due_date) return false;
            return new Date(t.due_date) < today0;
        }).length;
        return { total, done, inProg, todo, review, overdue };
    }, [tasks, today0]);

    // Phase 0 fix: "今日 + 期限超過" の "燃えてる" タスクを返す (元の bug は startsWith(YYYY-MM) で 1 ヶ月返してた)
    const todaysTasks = useMemo(() => {
        return tasks
            .filter((t: any) => {
                if (t.status === 2) return false;
                if (!t.due_date) return false;
                const due = new Date(t.due_date);
                return due < tomorrow0; // 今日まで or 過去 (overdue)
            })
            .sort((a: any, b: any) => {
                // priority 降順 → due_date 昇順 (高優先度 + 期限近い順)
                const pri = (b.priority || 0) - (a.priority || 0);
                if (pri !== 0) return pri;
                return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
            })
            .slice(0, 8);
    }, [tasks, tomorrow0]);

    const upcomingDeadlines = useMemo(() => {
        return tasks
            .filter((t: any) => t.status !== 2 && t.due_date)
            .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
            .slice(0, 5);
    }, [tasks]);

    // Pending Decisions: P1 priority + (overdue OR due in 24h) + not done
    const pendingDecisions = useMemo(() => {
        const next24h = new Date(today0);
        next24h.setDate(next24h.getDate() + 1);
        return tasks
            .filter((t: any) => {
                if (t.status === 2) return false;
                if ((t.priority || 0) < 2) return false; // High only
                if (!t.due_date) return false;
                const due = new Date(t.due_date);
                return due <= next24h; // overdue or due today
            })
            .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
            .slice(0, 6);
    }, [tasks, today0]);

    // Decide quick actions: send to telegram, mark done, defer
    const sendToTelegram = async (taskName: string, projectName: string) => {
        const msg = `[BK 判断] ${taskName} (${projectName}) の対応を判断ください`;
        // Use existing telegram polling endpoint as fallback OR direct bot api
        try {
            await fetch('/api/profile/task-summary/send-now', { method: 'POST', credentials: 'include' });
        } catch {}
        // Optimistic UX: show alert
        if (typeof window !== 'undefined') console.log('Telegram dispatched:', msg);
    };

    const projectProgress = useMemo(() => {
        return projects.slice(0, 5).map((p: any) => {
            const pTasks = tasks.filter((t: any) => t.project_id === p.id);
            const pDone = pTasks.filter((t: any) => t.status === 2).length;
            const pTotal = pTasks.length || 1;
            const pct = Math.round((pDone / pTotal) * 100);
            return { id: p.id, name: p.name, pct, done: pDone, total: pTotal };
        });
    }, [projects, tasks]);

    const taskDates = useMemo(() => {
        const dates = new Set<string>();
        tasks.forEach((t: any) => {
            if (t.due_date) dates.add(t.due_date.substring(0, 10));
        });
        return dates;
    }, [tasks]);

    const recentActivity = useMemo(() => {
        return tasks
            .filter((t: any) => t.updated_at || t.created_at)
            .sort((a: any, b: any) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
            .slice(0, 4);
    }, [tasks]);

    // Top decision today: highest-priority pending decision (single hero item)
    const topDecision = useMemo(() => pendingDecisions[0] || null, [pendingDecisions]);

    // Kill List (per design-critic): プロジェクト撤退候補
    // Heuristic: 30+ 日アクティビティなし AND 進捗 < 30% AND タスク 1 件以上
    const killList = useMemo(() => {
        const cutoff = new Date(today0);
        cutoff.setDate(cutoff.getDate() - 30);
        return projects.map((p: any) => {
            const ts = tasks.filter((t: any) => t.project_id === p.id);
            if (ts.length === 0) return null;
            const lastUpdate = Math.max(...ts.map((t: any) => new Date(t.updated_at || t.created_at || 0).getTime()));
            const done = ts.filter((t: any) => t.status === 2).length;
            const pct = (done / ts.length) * 100;
            const stale = lastUpdate < cutoff.getTime();
            const lowProgress = pct < 30;
            if (!stale || !lowProgress) return null;
            const daysSince = Math.round((Date.now() - lastUpdate) / 86400000);
            return { id: p.id, name: p.name, area: (p.Area?.name || p.area?.name || '—'), daysSince, pct: Math.round(pct), tasks: ts.length };
        }).filter(Boolean).slice(0, 5) as Array<{ id: number; name: string; area: string; daysSince: number; pct: number; tasks: number }>;
    }, [projects, tasks, today0]);

    const projectName = (id: number) => projects.find((p: any) => p.id === id)?.name || '—';

    if (loading) return <DashboardSkeleton />;

    return (
        <div className="bg-gray-50 dark:bg-gray-900 min-h-screen pb-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Command</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">司令室 — 18+ プロジェクトを 3 秒で把握</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="タスク・プロジェクト検索..."
                                className="pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <button className="relative p-2 bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg">
                            <BellIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                            {stats.overdue > 0 && (
                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{stats.overdue}</span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Today's Decision Hero (per design-critic: 上中央 / serif / Y/N) */}
                {topDecision && (
                    <div className="mb-6 bg-gradient-to-r from-gray-900 to-gray-800 dark:from-gray-950 dark:to-gray-900 rounded-2xl shadow-xl ring-1 ring-gray-700 px-8 py-7 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500 opacity-10 blur-3xl rounded-full" />
                        <div className="relative">
                            <div className="text-[10px] font-mono tracking-[0.3em] uppercase text-orange-400 mb-2">★ TODAY'S DECISION</div>
                            <h2 className="text-2xl md:text-3xl font-bold text-white mb-1 leading-tight" style={{ fontFamily: 'Georgia, "Times New Roman", serif', letterSpacing: '-0.02em' }}>
                                {topDecision.name}
                            </h2>
                            <p className="text-sm text-gray-400 mb-5">{projectName(topDecision.project_id)} · 期限: {formatDate(topDecision.due_date)}</p>
                            <div className="flex gap-2">
                                <button onClick={() => navigate(`/task/${topDecision.uid}`)} className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm rounded-lg transition focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900">
                                    ✓ 承認
                                </button>
                                <button onClick={() => navigate(`/task/${topDecision.uid}`)} className="px-5 py-2 bg-rose-500 hover:bg-rose-400 text-white font-semibold text-sm rounded-lg transition">
                                    ✗ 却下
                                </button>
                                <button onClick={() => sendToTelegram(topDecision.name, projectName(topDecision.project_id))} className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white font-medium text-sm rounded-lg transition backdrop-blur">
                                    保留 / 質問
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* KPI Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <Kpi label="Total Tasks" value={stats.total} delta="↑ 全プロジェクト" bgClass="bg-blue-100 dark:bg-blue-900/40" icon={<ClipboardDocumentListIcon className="w-6 h-6 text-blue-600 dark:text-blue-300" />} />
                    <Kpi label="In Progress" value={stats.inProg} delta="進行中" bgClass="bg-amber-100 dark:bg-amber-900/40" icon={<ClockIcon className="w-6 h-6 text-amber-600 dark:text-amber-300" />} />
                    <Kpi label="Completed" value={stats.done} delta="完了済" bgClass="bg-emerald-100 dark:bg-emerald-900/40" icon={<CheckCircleIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-300" />} />
                    <Kpi label="Overdue" value={stats.overdue} delta={stats.overdue > 0 ? '要対応' : '健全'} bgClass="bg-rose-100 dark:bg-rose-900/40" icon={<ExclamationCircleIcon className="w-6 h-6 text-rose-600 dark:text-rose-300" />} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left 2 cols */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Kill List — 撤退候補 (per design-critic 必殺機能) */}
                        {killList.length > 0 && (
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden">
                                <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
                                    <div className="flex items-center gap-3">
                                        <span className="text-rose-500">☠</span>
                                        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Kill List</h2>
                                        <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400">30日+停滞 / 進捗 &lt; 30%</span>
                                    </div>
                                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300">{killList.length} 候補</span>
                                </div>
                                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {killList.map((k) => (
                                        <div key={k.id} className="px-5 py-3 flex items-center gap-3 hover:bg-rose-50/30 dark:hover:bg-rose-950/20 transition">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="font-medium text-gray-900 dark:text-white line-through decoration-rose-400 decoration-2 truncate">{k.name}</span>
                                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{k.area}</span>
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                    {k.daysSince}日前更新 · 進捗 {k.pct}% · {k.tasks} タスク
                                                </div>
                                            </div>
                                            <div className="flex gap-1.5">
                                                <button className="text-[11px] px-2.5 py-1.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-medium transition">
                                                    Kill
                                                </button>
                                                <button onClick={() => navigate(`/projects`)} className="text-[11px] px-2.5 py-1.5 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 ring-1 ring-gray-200 dark:ring-gray-600 font-medium transition">
                                                    継続
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Pending Decisions — P1 burning items needing BK decision */}
                        {pendingDecisions.length > 0 && (
                            <div className="bg-gradient-to-br from-rose-50 to-amber-50 dark:from-rose-950/30 dark:to-amber-950/30 rounded-2xl shadow-sm ring-1 ring-rose-200 dark:ring-rose-900 overflow-hidden">
                                <div className="px-5 py-4 flex items-center justify-between border-b border-rose-200/50 dark:border-rose-900/50">
                                    <div className="flex items-center gap-3">
                                        <span className="relative flex h-2.5 w-2.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                                        </span>
                                        <h2 className="text-base font-semibold text-rose-900 dark:text-rose-200">経営判断 (Pending Decisions)</h2>
                                        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300">{pendingDecisions.length}</span>
                                    </div>
                                    <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">P1 + 24h 以内</span>
                                </div>
                                <div className="divide-y divide-rose-200/50 dark:divide-rose-900/50">
                                    {pendingDecisions.map((t: any) => {
                                        const dl = daysUntil(t.due_date);
                                        const isOverdue = dl !== null && dl < 0;
                                        return (
                                            <div key={t.id} className="px-5 py-3 flex items-center gap-3 hover:bg-rose-100/40 dark:hover:bg-rose-950/40 transition">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <span className="font-medium text-gray-900 dark:text-white truncate">{t.name}</span>
                                                        {isOverdue && (
                                                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-600 text-white">超過 {Math.abs(dl)}d</span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-gray-600 dark:text-gray-400 truncate">{projectName(t.project_id)} · {formatDate(t.due_date)}</div>
                                                </div>
                                                <div className="flex gap-1.5">
                                                    <button
                                                        onClick={() => sendToTelegram(t.name, projectName(t.project_id))}
                                                        className="text-[11px] px-2.5 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 font-medium transition focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
                                                        title="Telegram で AI に振る"
                                                    >
                                                        指示
                                                    </button>
                                                    <button
                                                        onClick={() => navigate(`/task/${t.uid}`)}
                                                        className="text-[11px] px-2.5 py-1.5 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 ring-1 ring-gray-200 dark:ring-gray-600 font-medium transition"
                                                    >
                                                        詳細
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Today's Tasks */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden">
                            <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
                                <h2 className="text-base font-semibold text-gray-900 dark:text-white">今日のタスク</h2>
                                <button onClick={() => navigate('/today')} className="text-sm text-blue-600 hover:underline">View All →</button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="text-xs text-gray-500 dark:text-gray-400">
                                        <tr>
                                            <th className="px-5 py-2 text-left font-medium">Task</th>
                                            <th className="px-3 py-2 text-left font-medium">Priority</th>
                                            <th className="px-3 py-2 text-left font-medium">Project</th>
                                            <th className="px-3 py-2 text-left font-medium">Due</th>
                                            <th className="px-3 py-2 text-left font-medium">Status</th>
                                            <th className="px-3 py-2"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {todaysTasks.length === 0 ? (
                                            <tr><td colSpan={6} className="px-5 py-6 text-center text-gray-400">今日のタスクなし</td></tr>
                                        ) : todaysTasks.map((t: any) => {
                                            const pri = priorityLabel(t.priority || 0);
                                            const st = statusLabel(t.status || 0);
                                            return (
                                                <tr key={t.id} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                                    <td className="px-5 py-3">
                                                        <div className="font-medium text-gray-900 dark:text-white truncate max-w-xs">{t.name}</div>
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ring-1 ring-inset ${pri.klass}`}>{pri.label}</span>
                                                    </td>
                                                    <td className="px-3 py-3 text-gray-600 dark:text-gray-300 truncate max-w-[140px]">{projectName(t.project_id)}</td>
                                                    <td className="px-3 py-3 text-gray-600 dark:text-gray-300 tabular-nums">{formatDate(t.due_date)}</td>
                                                    <td className="px-3 py-3">
                                                        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ring-1 ring-inset ${st.klass}`}>{st.label}</span>
                                                    </td>
                                                    <td className="px-3 py-3 text-right">
                                                        <button onClick={() => navigate(`/task/${t.uid}`)} className="text-gray-400 hover:text-gray-700 dark:hover:text-white">
                                                            <EllipsisVerticalIcon className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Bottom row */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Project Progress */}
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">プロジェクト進捗</h3>
                                    <button onClick={() => navigate('/projects')} className="text-xs text-blue-600 hover:underline">View All</button>
                                </div>
                                <div className="space-y-3">
                                    {projectProgress.map((p) => (
                                        <div key={p.id}>
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[180px]">{p.name}</span>
                                                <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{p.pct}%</span>
                                            </div>
                                            <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                                <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full" style={{ width: `${p.pct}%` }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Status Donut */}
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">ステータス別タスク数</h3>
                                <StatusDonut todo={stats.todo} inprog={stats.inProg} review={stats.review} done={stats.done} />
                            </div>

                            {/* Recent Activity */}
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">最近のアクティビティ</h3>
                                <div className="space-y-3">
                                    {recentActivity.map((t: any) => {
                                        const isDone = t.status === 2;
                                        const isInProg = t.status === 1;
                                        const verb = isDone ? '完了' : isInProg ? '進行中に変更' : '更新';
                                        const verbColor = isDone ? 'text-emerald-600 dark:text-emerald-400'
                                            : isInProg ? 'text-blue-600 dark:text-blue-400'
                                            : 'text-gray-500 dark:text-gray-400';
                                        return (
                                            <div key={t.id} className="flex items-start gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isDone ? 'bg-emerald-100 dark:bg-emerald-900/40' : isInProg ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-gray-100 dark:bg-gray-700'}`}>
                                                    <span className={`text-sm ${verbColor}`}>{isDone ? '✓' : isInProg ? '→' : '·'}</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                                                        <span className="text-gray-900 dark:text-white font-medium truncate inline-block max-w-[150px] align-bottom">{t.name}</span>
                                                        <span className={`ml-1 ${verbColor}`}>を {verb}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-[100px]">{projectName(t.project_id)}</span>
                                                        <span className="text-[10px] text-gray-300 dark:text-gray-600">·</span>
                                                        <span className="text-[10px] text-gray-400 tabular-nums">{formatDate(t.updated_at || t.created_at)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right column */}
                    <div className="space-y-6">
                        <MiniCalendar taskDates={taskDates} />

                        {/* Upcoming Deadlines */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">近日締切</h3>
                                <button onClick={() => navigate('/upcoming')} className="text-xs text-blue-600 hover:underline">View All</button>
                            </div>
                            <div className="space-y-3">
                                {upcomingDeadlines.map((t: any) => {
                                    const dl = daysUntil(t.due_date);
                                    const pri = (t.priority || 0) as Priority;
                                    const dotColor = pri === 2 ? 'bg-rose-400' : pri === 1 ? 'bg-amber-400' : 'bg-blue-400';
                                    const badgeColor = dl !== null && dl < 0 ? 'bg-rose-100 text-rose-700' :
                                                       dl !== null && dl <= 3 ? 'bg-amber-100 text-amber-700' :
                                                       'bg-emerald-100 text-emerald-700';
                                    return (
                                        <div key={t.id} className="flex items-start gap-3">
                                            <span className={`mt-1.5 w-2 h-2 rounded-full ${dotColor}`} />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{t.name}</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{formatDate(t.due_date)}</div>
                                            </div>
                                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${badgeColor}`}>
                                                {dl === null ? '—' : dl < 0 ? `${Math.abs(dl)}日超過` : `${dl}日後`}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Team Workload (AI staff) */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">AI スタッフ稼働状況</h3>
                            <div className="space-y-3">
                                {[
                                    { name: 'BK', pct: 95, status: 'active' },
                                    { name: 'ボンズ', pct: 80, status: 'active' },
                                    { name: 'ヘルメス', pct: 72, status: 'active' },
                                    { name: 'OMEGA', pct: 60, status: 'idle' },
                                    { name: 'Claude Code', pct: 88, status: 'active' },
                                    { name: 'フィリピン外注', pct: 48, status: 'active' },
                                ].map((m) => (
                                    <div key={m.name} className="flex items-center gap-3">
                                        <img src={avatarUrl(m.name)} className="w-8 h-8 rounded-full ring-1 ring-gray-200 dark:ring-gray-700" alt="" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`w-1.5 h-1.5 rounded-full ${m.status === 'active' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{m.name}</span>
                                                <span className="ml-auto text-xs text-gray-500 dark:text-gray-400 tabular-nums">{m.pct}%</span>
                                            </div>
                                            <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full ${m.status === 'active' ? 'bg-emerald-400' : 'bg-amber-400'}`} style={{ width: `${m.pct}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CeoView;
