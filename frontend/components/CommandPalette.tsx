// Command Palette (Cmd+K) — fuzzy search across pages, projects, tasks.
// Per design-critic: "Linear / Stripe / Notion の核。これがないと power user 体験が成立しない"
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    MagnifyingGlassIcon,
    PresentationChartLineIcon,
    Squares2X2Icon,
    UserGroupIcon,
    ChartBarIcon,
    InboxIcon,
    CalendarDaysIcon,
    ListBulletIcon,
    FolderIcon,
    ClipboardDocumentListIcon,
    ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { fetchTasks } from '../utils/tasksService';
import { fetchProjects } from '../utils/projectsService';

type Cmd = {
    id: string;
    label: string;
    sub?: string;
    icon: React.ReactNode;
    action: () => void;
    section: string;
    keywords?: string;
};

const PAGES: { path: string; label: string; sub: string; icon: React.ReactNode }[] = [
    { path: '/ceo', label: '経営ダッシュボード', sub: 'CEO View', icon: <PresentationChartLineIcon className="w-4 h-4" /> },
    { path: '/portfolio', label: 'ポートフォリオ', sub: '17 PJ × 6 areas', icon: <Squares2X2Icon className="w-4 h-4" /> },
    { path: '/team', label: 'チーム', sub: 'AI staff + 人間', icon: <UserGroupIcon className="w-4 h-4" /> },
    { path: '/reports', label: 'レポート', sub: 'KPI / 分析', icon: <ChartBarIcon className="w-4 h-4" /> },
    { path: '/today', label: 'Today', sub: '今日のタスク', icon: <CalendarDaysIcon className="w-4 h-4" /> },
    { path: '/inbox', label: 'Inbox', sub: '受信箱', icon: <InboxIcon className="w-4 h-4" /> },
    { path: '/tasks?status=active', label: 'All Tasks', sub: '全タスク', icon: <ListBulletIcon className="w-4 h-4" /> },
    { path: '/projects', label: 'Projects', sub: 'プロジェクト一覧', icon: <FolderIcon className="w-4 h-4" /> },
];

const fuzzyScore = (q: string, text: string): number => {
    if (!q) return 1;
    q = q.toLowerCase();
    text = text.toLowerCase();
    if (text.includes(q)) return 10 - text.indexOf(q) / 100; // earlier match = higher score
    // chars match in order
    let i = 0;
    for (const c of text) {
        if (c === q[i]) i++;
        if (i >= q.length) return 5;
    }
    return 0;
};

const CommandPalette: React.FC = () => {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [tasks, setTasks] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [selectedIdx, setSelectedIdx] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Cmd+K / Ctrl+K to open, Esc to close
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setOpen((o) => !o);
            } else if (e.key === 'Escape' && open) {
                setOpen(false);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open]);

    // Focus input on open + load lazily once
    useEffect(() => {
        if (open) {
            setTimeout(() => inputRef.current?.focus(), 50);
            if (tasks.length === 0) {
                fetchTasks('?status=all').then((r) => setTasks(r?.tasks || [])).catch(() => {});
            }
            if (projects.length === 0) {
                fetchProjects().then((r: any) => setProjects(Array.isArray(r) ? r : (r?.projects || []))).catch(() => {});
            }
        } else {
            setQuery('');
            setSelectedIdx(0);
        }
    }, [open]);

    const items: Cmd[] = useMemo(() => {
        const list: Cmd[] = [];
        // Pages
        PAGES.forEach((p) => list.push({
            id: 'page:' + p.path,
            label: p.label,
            sub: p.sub,
            icon: p.icon,
            section: 'Pages',
            keywords: p.path + ' ' + p.label + ' ' + p.sub,
            action: () => navigate(p.path),
        }));
        // Projects
        projects.forEach((p: any) => list.push({
            id: 'proj:' + p.uid,
            label: p.name,
            sub: p.Area?.name || p.area?.name || 'Project',
            icon: <FolderIcon className="w-4 h-4" />,
            section: 'Projects',
            keywords: p.name,
            action: () => navigate(`/project/${p.uid}-${p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`),
        }));
        // Tasks (limit 50 most recent for perf)
        tasks.slice(0, 50).forEach((t: any) => list.push({
            id: 'task:' + t.uid,
            label: t.name,
            sub: 'Task' + (t.status === 1 ? ' · 進行中' : t.status === 2 ? ' · 完了' : ''),
            icon: <ClipboardDocumentListIcon className="w-4 h-4" />,
            section: 'Tasks',
            keywords: t.name,
            action: () => navigate(`/task/${t.uid}`),
        }));
        return list;
    }, [tasks, projects, navigate]);

    const filtered = useMemo(() => {
        if (!query) return items.slice(0, 30);
        return items
            .map((c) => ({ ...c, score: fuzzyScore(query, c.keywords || c.label) }))
            .filter((c) => c.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 30);
    }, [items, query]);

    // Group by section
    const groups = useMemo(() => {
        const m = new Map<string, Cmd[]>();
        filtered.forEach((c) => {
            if (!m.has(c.section)) m.set(c.section, []);
            m.get(c.section)!.push(c);
        });
        return Array.from(m.entries());
    }, [filtered]);

    // Reset selection on filter change
    useEffect(() => { setSelectedIdx(0); }, [query]);

    // Arrow nav
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIdx((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const cmd = filtered[selectedIdx];
                if (cmd) {
                    cmd.action();
                    setOpen(false);
                }
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open, filtered, selectedIdx]);

    // Scroll selected into view
    useEffect(() => {
        if (!listRef.current) return;
        const el = listRef.current.querySelector(`[data-idx="${selectedIdx}"]`) as HTMLElement | null;
        if (el) el.scrollIntoView({ block: 'nearest' });
    }, [selectedIdx]);

    if (!open) return null;

    let runningIdx = -1;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4" role="dialog" aria-modal="true" aria-label="Command Palette">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 w-full max-w-2xl max-h-[70vh] flex flex-col overflow-hidden animate-fade-in">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                    <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="ページ・プロジェクト・タスクを検索..."
                        className="flex-1 bg-transparent border-0 outline-none text-base text-gray-900 dark:text-white placeholder-gray-400"
                        aria-label="検索"
                    />
                    <kbd className="text-[10px] font-mono px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">ESC</kbd>
                </div>
                <div ref={listRef} className="flex-1 overflow-y-auto py-2">
                    {filtered.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-gray-500">該当なし</div>
                    ) : groups.map(([section, cmds]) => (
                        <div key={section}>
                            <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                {section}
                            </div>
                            {cmds.map((cmd) => {
                                runningIdx++;
                                const isSelected = runningIdx === selectedIdx;
                                return (
                                    <button
                                        key={cmd.id}
                                        data-idx={runningIdx}
                                        onClick={() => { cmd.action(); setOpen(false); }}
                                        onMouseEnter={() => setSelectedIdx(runningIdx)}
                                        className={`w-full text-left px-4 py-2 flex items-center gap-3 transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-900/40' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                                    >
                                        <span className={`flex-shrink-0 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>{cmd.icon}</span>
                                        <span className="flex-1 min-w-0">
                                            <span className={`block text-sm truncate ${isSelected ? 'text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-900 dark:text-white'}`}>{cmd.label}</span>
                                            {cmd.sub && <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">{cmd.sub}</span>}
                                        </span>
                                        {isSelected && <ArrowRightIcon className="w-3.5 h-3.5 text-blue-500" />}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>
                <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 flex items-center gap-4 text-[10px] text-gray-500 dark:text-gray-400 font-mono">
                    <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700">↑↓</kbd> 移動</span>
                    <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700">↵</kbd> 開く</span>
                    <span><kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700">⌘K</kbd> 切替</span>
                    <span className="ml-auto">Command Palette</span>
                </div>
            </div>
        </div>
    );
};

export default CommandPalette;
