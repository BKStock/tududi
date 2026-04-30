// Skeleton loader — replaces "読み込み中..." text with shimmering placeholders.
// Per design-critic: "現状の '読み込み中...' は犯罪レベル"
import React from 'react';

export const SkeletonLine: React.FC<{ w?: string; h?: string; className?: string }> = ({ w = 'w-full', h = 'h-3', className = '' }) => (
    <div className={`${w} ${h} bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 bg-[length:200%_100%] animate-skeleton rounded ${className}`} />
);

export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`bg-white dark:bg-gray-800 rounded-xl ring-1 ring-gray-200 dark:ring-gray-700 p-5 ${className}`}>
        <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 animate-skeleton bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 bg-[length:200%_100%]" />
            <div className="flex-1 space-y-2">
                <SkeletonLine w="w-1/3" h="h-2" />
                <SkeletonLine w="w-1/2" h="h-4" />
            </div>
        </div>
    </div>
);

export const DashboardSkeleton: React.FC = () => (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen pb-12" aria-busy="true" aria-label="Loading dashboard">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
            <div className="mb-6 space-y-2">
                <SkeletonLine w="w-64" h="h-7" />
                <SkeletonLine w="w-96" h="h-3" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <SkeletonCard className="h-64" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <SkeletonCard className="h-48" /><SkeletonCard className="h-48" /><SkeletonCard className="h-48" />
                    </div>
                </div>
                <div className="space-y-6">
                    <SkeletonCard className="h-64" /><SkeletonCard className="h-48" /><SkeletonCard className="h-48" />
                </div>
            </div>
        </div>
    </div>
);

export default DashboardSkeleton;
