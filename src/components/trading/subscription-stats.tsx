'use client';

import React from 'react';
import { Users, Activity, Play, Pause, TrendingUp, Eye, ChevronDown } from 'lucide-react';

interface SubscriptionStatsProps {
  stats: {
    total: number;
    active: number;
    paused: number;
    trading: number;
    watching: number;
  };
}

const SubscriptionStats: React.FC<SubscriptionStatsProps> = ({ stats }) => {
  const statCards = [
    {
      title: 'Total Subscriptions',
      value: stats.total,
      icon: Users,
      color: 'blue',
      description: "All KOLs you're following",
    },
    {
      title: 'Active',
      value: stats.active,
      icon: Play,
      color: 'green',
      description: 'Currently active subscriptions',
    },
    {
      title: 'Paused',
      value: stats.paused,
      icon: Pause,
      color: 'yellow',
      description: 'Temporarily paused subscriptions',
    },
    {
      title: 'Copy Trading',
      value: stats.trading,
      icon: TrendingUp,
      color: 'purple',
      description: 'Automatic trade copying',
    },
    {
      title: 'Watch Only',
      value: stats.watching,
      icon: Eye,
      color: 'gray',
      description: 'Monitoring without copying',
    },
  ];

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue':
        return {
          iconBg: 'bg-blue-500/10',
          iconText: 'text-blue-500',
          valueText: 'text-blue-600 dark:text-blue-400',
        };
      case 'green':
        return {
          iconBg: 'bg-green-500/10',
          iconText: 'text-green-500',
          valueText: 'text-green-600 dark:text-green-400',
        };
      case 'yellow':
        return {
          iconBg: 'bg-yellow-500/10',
          iconText: 'text-yellow-500',
          valueText: 'text-yellow-600 dark:text-yellow-400',
        };
      case 'purple':
        return {
          iconBg: 'bg-purple-500/10',
          iconText: 'text-purple-500',
          valueText: 'text-purple-600 dark:text-purple-400',
        };
      case 'gray':
        return {
          iconBg: 'bg-gray-500/10',
          iconText: 'text-gray-500',
          valueText: 'text-gray-600 dark:text-gray-400',
        };
      default:
        return {
          iconBg: 'bg-primary/10',
          iconText: 'text-primary',
          valueText: 'text-primary',
        };
    }
  };

  return (
    <>
      {/* Mobile: collapsible simple table */}
      <div className="sm:hidden">
        <details className="bg-background border border-border rounded-lg">
          <summary className="list-none cursor-pointer px-4 py-3 flex items-center justify-between">
            <span className="font-medium text-foreground">Subscription Stats</span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </summary>
          <div className="px-4 pb-4">
            <div className="divide-y divide-border text-sm">
              {statCards.map(stat => (
                <div key={stat.title} className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">{stat.title}</span>
                  <span className="font-semibold text-foreground">{stat.value}</span>
                </div>
              ))}
            </div>
          </div>
        </details>
      </div>

      {/* Desktop and up: existing card grid */}
      <div className="hidden sm:grid grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map(stat => {
          const colors = getColorClasses(stat.color);
          const IconComponent = stat.icon;

          return (
            <div
              key={stat.title}
              className="bg-background border border-border rounded-lg p-6 hover:border-muted-foreground transition-colors"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-lg ${colors.iconBg}`}>
                  <IconComponent className={`w-5 h-5 ${colors.iconText}`} />
                </div>
                <div className={`text-2xl font-bold ${colors.valueText}`}>
                  {stat.value}
                </div>
              </div>

              <div>
                <h3 className="font-medium text-foreground text-sm mb-1">
                  {stat.title}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default SubscriptionStats;
