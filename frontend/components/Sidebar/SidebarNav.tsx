import React, { useEffect, useState } from 'react';
import { Location } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    CalendarDaysIcon,
    InboxIcon,
    ListBulletIcon,
    ClockIcon,
    CalendarIcon,
    PresentationChartLineIcon,
    UserGroupIcon,
    ChartBarIcon,
    Squares2X2Icon,
    BoltIcon,
} from '@heroicons/react/24/solid';
import { PlusCircleIcon } from '@heroicons/react/24/outline';
import { useStore } from '../../store/useStore';
import { loadInboxItemsToStore } from '../../utils/inboxService';
import { getFeatureFlags, FeatureFlags } from '../../utils/featureFlags';

interface SidebarNavProps {
    handleNavClick: (path: string, title: string, icon: JSX.Element) => void;
    location: Location;
    isDarkMode: boolean;
    openTaskModal: () => void;
}

const SidebarNav: React.FC<SidebarNavProps> = ({
    handleNavClick,
    location,
    openTaskModal,
}) => {
    const { t } = useTranslation();
    const store = useStore();
    const [featureFlags, setFeatureFlags] = useState<FeatureFlags>({
        backups: false,
        calendar: false,
        caldav: false,
        habits: false,
        mcp: false,
    });

    const inboxItemsCount = store.inboxStore.pagination.total;

    useEffect(() => {
        loadInboxItemsToStore(false).catch(console.error);

        const fetchFlags = async () => {
            const flags = await getFeatureFlags();
            setFeatureFlags(flags);
        };
        fetchFlags();
    }, []);

    type NavLink = { path: string; title: string; icon: JSX.Element; query?: string; featureFlag?: string };
    type NavSection = { label: string; links: NavLink[] };

    const navSections: NavSection[] = [
        {
            // BRIDGE = 艦隊司令塔。Design team consensus 採用 (Fleet メタファー).
            label: 'BRIDGE',
            links: [
                { path: '/today', title: t('sidebar.today', 'Today'), icon: <CalendarDaysIcon className="h-5 w-5" />, query: 'type=today' },
                { path: '/ceo', title: t('sidebar.command', 'Command'), icon: <PresentationChartLineIcon className="h-5 w-5" /> },
                { path: '/pulse', title: t('sidebar.pulse', 'Pulse'), icon: <BoltIcon className="h-5 w-5" /> },
                { path: '/portfolio', title: t('sidebar.fleet', 'Fleet'), icon: <Squares2X2Icon className="h-5 w-5" /> },
                { path: '/team', title: t('sidebar.crew', 'Crew'), icon: <UserGroupIcon className="h-5 w-5" /> },
                { path: '/reports', title: t('sidebar.sonar', 'Sonar'), icon: <ChartBarIcon className="h-5 w-5" /> },
            ],
        },
        {
            label: 'PLAN',
            links: [
                { path: '/upcoming?status=active', title: t('sidebar.upcoming', 'Upcoming'), icon: <ClockIcon className="h-5 w-5" /> },
                { path: '/calendar', title: t('sidebar.calendar', 'Calendar'), icon: <CalendarIcon className="h-5 w-5" />, featureFlag: 'calendar' },
            ],
        },
        {
            label: 'CAPTURE',
            links: [
                { path: '/inbox', title: t('sidebar.inbox', 'Inbox'), icon: <InboxIcon className="h-5 w-5" /> },
                { path: '/tasks?status=active', title: t('sidebar.allTasks', 'All Tasks'), icon: <ListBulletIcon className="h-5 w-5" />, query: 'status=active' },
            ],
        },
    ];

    const allNavLinks = navSections.flatMap((s) => s.links);

    const navLinks = allNavLinks.filter((link) => {
        if (link.featureFlag) {
            return featureFlags[link.featureFlag as keyof FeatureFlags];
        }
        return true;
    });

    const isActive = (path: string, query?: string) => {
        if (path === '/inbox' || path === '/today' || path === '/calendar') {
            const isPathMatch = location.pathname === path;
            return isPathMatch
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                : 'text-gray-700 dark:text-gray-300';
        }

        if (path.startsWith('/upcoming')) {
            const isPathMatch = location.pathname === '/upcoming';
            return isPathMatch
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                : 'text-gray-700 dark:text-gray-300';
        }

        const isPathMatch = location.pathname === '/tasks';
        const isQueryMatch = query
            ? location.search.includes(query)
            : location.search === '';
        return isPathMatch && isQueryMatch
            ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
            : 'text-gray-700 dark:text-gray-300';
    };

    const visibleLinks = new Set(navLinks.map((l) => l.path));

    return (
        <ul className="flex flex-col space-y-1">
            {navSections.map((section) => {
                const sectionLinks = section.links.filter((l) => visibleLinks.has(l.path));
                if (sectionLinks.length === 0) return null;
                return (
                    <React.Fragment key={section.label}>
                        <li className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 select-none">
                            {section.label}
                        </li>
                        {sectionLinks.map((link) => (
                            <li key={link.path}>
                                <button
                                    onClick={() => handleNavClick(link.path, link.title, link.icon)}
                                    data-testid={`sidebar-nav-${link.path.replace(/^\//, '').replace(/\?.*$/, '')}`}
                                    className={`w-full text-left px-4 py-1 flex items-center justify-between rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${isActive(link.path, link.query)}`}
                                >
                            <div className="flex items-center">
                                {link.icon}
                                <span className="ml-2">{link.title}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {link.path === '/inbox' &&
                                    inboxItemsCount > 0 && (
                                        <span className="text-sm font-bold text-blue-500 dark:text-blue-400">
                                            {inboxItemsCount > 99
                                                ? '99+'
                                                : inboxItemsCount}
                                        </span>
                                    )}
                                {link.path === '/tasks?status=active' && (
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openTaskModal();
                                        }}
                                        onKeyDown={(e) => {
                                            if (
                                                e.key === 'Enter' ||
                                                e.key === ' '
                                            ) {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                openTaskModal();
                                            }
                                        }}
                                        className="text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white focus:outline-none cursor-pointer"
                                        aria-label={t(
                                            'sidebar.addTaskAriaLabel',
                                            'Add Task'
                                        )}
                                        title={t(
                                            'sidebar.addTaskTitle',
                                            'Add Task'
                                        )}
                                    >
                                        <PlusCircleIcon className="h-5 w-5" />
                                    </div>
                                )}
                            </div>
                                </button>
                            </li>
                        ))}
                    </React.Fragment>
                );
            })}
        </ul>
    );
};

export default SidebarNav;
