// Team View — full page roster of AI staff + human teammates with workload, status, recent activity.
// Design: matches CeoView (light SaaS, Inter, soft cards, cyan/blue accent).
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BoltIcon,
    PauseCircleIcon,
    ExclamationCircleIcon,
    ChatBubbleLeftEllipsisIcon,
    ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import { fetchTasks } from '../utils/tasksService';
import { Task } from '../entities/Task';

type Status = 'active' | 'idle' | 'error';

interface Staff {
    name: string;
    role: string;
    type: 'human' | 'ai';
    status: Status;
    workload: number;
    lastActive: string;
    tasksAssigned: number;
    tasksDone: number;
    tags: string[];
    notes?: string;
}

const ROSTER: Staff[] = [
    { name: 'BK', role: 'CEO / 18 PJ 司令塔', type: 'human', status: 'active', workload: 95, lastActive: '今', tasksAssigned: 12, tasksDone: 4, tags: ['全権限', 'Multi-PJ'], notes: '全プロジェクト最終承認・戦略判断' },
    { name: 'ボンズ', role: 'AI 司令塔 / OpenClaw', type: 'ai', status: 'active', workload: 80, lastActive: '2 分前', tasksAssigned: 8, tasksDone: 6, tags: ['Telegram', 'タスク振分'], notes: 'BK の指示を解釈して各 AI へディスパッチ' },
    { name: 'ヘルメス', role: 'デリバリー Agent', type: 'ai', status: 'active', workload: 72, lastActive: '12 分前', tasksAssigned: 5, tasksDone: 3, tags: ['CURA', '実装'], notes: '実装系タスクの実行担当' },
    { name: 'OMEGA', role: 'OSINT / 戦略インテリジェンス', type: 'ai', status: 'idle', workload: 60, lastActive: '4 時間前', tasksAssigned: 3, tasksDone: 1, tags: ['データ', '分析'], notes: '次回実行 18:00 (cron)' },
    { name: 'Claude Code', role: 'Dev Engineer', type: 'ai', status: 'active', workload: 88, lastActive: '今', tasksAssigned: 20, tasksDone: 11, tags: ['Code', 'Infra'], notes: 'BK Dashboard / 自動化スクリプト 担当' },
    { name: 'フィリピン外注', role: 'Implementer (Manila)', type: 'human', status: 'active', workload: 48, lastActive: '1 時間前', tasksAssigned: 4, tasksDone: 1, tags: ['UI 実装'], notes: '指示された Tudidi UI 改修中' },
    { name: 'BKDesignbot', role: 'Telegram Task Input Bot', type: 'ai', status: 'active', workload: 22, lastActive: '5 分前', tasksAssigned: 0, tasksDone: 0, tags: ['Telegram', 'Polling'], notes: 'BK の Telegram 投稿を受信、tudidi に登録' },
    { name: 'Gemini 2.5 Pro', role: 'Cross-model Verification', type: 'ai', status: 'idle', workload: 15, lastActive: '昨日', tasksAssigned: 0, tasksDone: 0, tags: ['Review', 'Adversarial'], notes: 'Codex Gate の dual-track' },
];

const statusColor = (s: Status) =>
    s === 'active' ? { dot: 'bg-emerald-400', text: 'text-emerald-600 dark:text-emerald-400', label: 'Active', bg: 'bg-emerald-50 dark:bg-emerald-950/40' }
    : s === 'idle' ? { dot: 'bg-amber-400', text: 'text-amber-600 dark:text-amber-400', label: 'Idle', bg: 'bg-amber-50 dark:bg-amber-950/40' }
    : { dot: 'bg-rose-400', text: 'text-rose-600 dark:text-rose-400', label: 'Error', bg: 'bg-rose-50 dark:bg-rose-950/40' };

const avatarUrl = (name: string) =>
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=128&bold=true`;

const TeamView: React.FC = () => {
    const navigate = useNavigate();
    const [tasks, setTasks] = useState<Task[]>([]);

    useEffect(() => {
        fetchTasks('?status=all').then((r) => setTasks((r?.tasks || []) as Task[])).catch(() => {});
    }, []);

    const stats = useMemo(() => {
        const total = ROSTER.length;
        const active = ROSTER.filter((s) => s.status === 'active').length;
        const idle = ROSTER.filter((s) => s.status === 'idle').length;
        const error = ROSTER.filter((s) => s.status === 'error').length;
        const ai = ROSTER.filter((s) => s.type === 'ai').length;
        const avgLoad = Math.round(ROSTER.reduce((a, b) => a + b.workload, 0) / total);
        return { total, active, idle, error, ai, avgLoad };
    }, []);

    return (
        <div className="bg-gray-50 dark:bg-gray-900 min-h-screen pb-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">チーム / AI スタッフ</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">人間 + AI agents 合計 {stats.total} 名 — 稼働状況とロードバランス</p>
                    </div>
                </div>

                {/* KPI */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Total Members</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{stats.total}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">うち AI: {stats.ai}</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
                        <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Active</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{stats.active}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">稼働中</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
                        <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">Idle</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{stats.idle}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">待機 / 次回実行待ち</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
                        <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">平均負荷</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{stats.avgLoad}%</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">全員平均</div>
                    </div>
                </div>

                {/* Roster grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {ROSTER.map((s) => {
                        const sc = statusColor(s.status);
                        return (
                            <div key={s.name} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 hover:shadow-md transition">
                                <div className="flex items-start gap-3 mb-4">
                                    <img src={avatarUrl(s.name)} className="w-12 h-12 rounded-full ring-2 ring-gray-100 dark:ring-gray-700" alt="" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-gray-900 dark:text-white truncate">{s.name}</h3>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${s.type === 'ai' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'}`}>
                                                {s.type.toUpperCase()}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{s.role}</p>
                                    </div>
                                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${sc.bg}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                        <span className={`text-[10px] font-medium ${sc.text}`}>{sc.label}</span>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs text-gray-500 dark:text-gray-400">負荷</span>
                                            <span className="text-xs text-gray-900 dark:text-white tabular-nums font-semibold">{s.workload}%</span>
                                        </div>
                                        <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full ${s.workload >= 80 ? 'bg-rose-400' : s.workload >= 60 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${s.workload}%` }} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg py-2">
                                            <div className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">{s.tasksAssigned}</div>
                                            <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-0.5">担当</div>
                                        </div>
                                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg py-2">
                                            <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{s.tasksDone}</div>
                                            <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-0.5">完了</div>
                                        </div>
                                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg py-2">
                                            <div className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">{s.lastActive}</div>
                                            <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-0.5">最終応答</div>
                                        </div>
                                    </div>

                                    {s.notes && (
                                        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-2">{s.notes}</p>
                                    )}

                                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100 dark:border-gray-700">
                                        {s.tags.map((t) => (
                                            <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-medium">{t}</span>
                                        ))}
                                    </div>

                                    <div className="flex gap-2 pt-1">
                                        <button className="flex-1 text-xs py-2 px-3 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60 font-medium transition flex items-center justify-center gap-1.5">
                                            <ChatBubbleLeftEllipsisIcon className="w-3.5 h-3.5" />
                                            指示
                                        </button>
                                        <button className="flex-1 text-xs py-2 px-3 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 font-medium transition flex items-center justify-center gap-1.5">
                                            詳細
                                            <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default TeamView;
