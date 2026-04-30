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

    const stats = useMemo(() => {
        const total = tasks.length;
        const done = tasks.filter((t) => (t as any).status === 2).length;
        const inProg = tasks.filter((t) => (t as any).status === 1).length;
        const todo = tasks.filter((t) => (t as any).status === 0).length;
        const review = tasks.filter((t) => (t as any).status === 3).length;
        const overdue = tasks.filter((t: any) => {
            if (t.status === 2) return false;
            if (!t.due_date) return false;
            return new Date(t.due_date) < new Date(new Date().toDateString());
        }).length;
        return { total, done, inProg, todo, review, overdue };
    }, [tasks]);

    const todaysTasks = useMemo(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        return tasks
            .filter((t: any) => t.status !== 2 && t.due_date && t.due_date.startsWith(todayStr.substring(0, 7)))
            .sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0))
            .slice(0, 8);
    }, [tasks]);

    const upcomingDeadlines = useMemo(() => {
        return tasks
            .filter((t: any) => t.status !== 2 && t.due_date)
            .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
            .slice(0, 5);
    }, [tasks]);

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

    const projectName = (id: number) => projects.find((p: any) => p.id === id)?.name || '—';

    if (loading) {
        return <div className="p-8 text-center text-gray-500">読み込み中...</div>;
    }

    return (
        <div className="bg-gray-50 dark:bg-gray-900 min-h-screen pb-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">経営ダッシュボード</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">CEO View — 18+ プロジェクトの状況を 3 秒で把握</p>
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
                                    {recentActivity.map((t: any) => (
                                        <div key={t.id} className="flex items-start gap-3">
                                            <img src={avatarUrl('BK')} className="w-8 h-8 rounded-full ring-1 ring-gray-200 dark:ring-gray-700" alt="" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs text-gray-700 dark:text-gray-300">
                                                    <span className="font-medium">BK</span>
                                                    <span className="text-gray-500"> が </span>
                                                    <span className="text-gray-900 dark:text-white truncate inline-block max-w-[140px] align-bottom">"{t.name}"</span>
                                                    <span className="text-gray-500"> を更新</span>
                                                </div>
                                                <div className="text-[10px] text-gray-400 mt-0.5">{formatDate(t.updated_at || t.created_at)}</div>
                                            </div>
                                        </div>
                                    ))}
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
