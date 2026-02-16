'use client';

import React from 'react';
import AppLayout from '@/components/layout/app-layout';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { FileCode, Terminal, Book, Code2, Cpu } from 'lucide-react';

const sidebarItems = [
    {
        title: 'API Documentation',
        href: '/developers/docs',
        icon: FileCode,
    },
    {
        title: 'SDK Usage',
        href: '/developers/sdk',
        icon: Terminal,
    },
    {
        title: 'Authentication',
        href: '/developers/docs#authentication',
        icon: Cpu,
    },
    {
        title: 'WebSockets',
        href: '/developers/docs#websockets',
        icon: Code2,
    },
];

export default function DevelopersLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    return (
        <AppLayout>
            <div className="dark flex flex-col lg:flex-row min-h-[calc(100vh-80px)] bg-[#101010] text-[#f5f5f5]">
                {/* Secondary Sidebar */}
                <aside className="w-full lg:w-64 border-r border-border/20 bg-[#141414] p-6 hidden lg:block">
                    <div className="mb-8">
                        <h2 className="text-xl font-bold text-primary flex items-center">
                            <Book className="mr-2 h-5 w-5" />
                            Dev Portal
                        </h2>
                        <p className="text-xs text-muted-foreground mt-1">Build on KOLPLAY</p>
                    </div>
                    <nav className="space-y-1">
                        {sidebarItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200",
                                    pathname === item.href
                                        ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_rgba(var(--primary-rgb),0.1)]"
                                        : "text-muted-foreground hover:bg-white/5 hover:text-white"
                                )}
                            >
                                <item.icon className={cn("mr-3 h-4 w-4", pathname === item.href ? "text-primary" : "text-muted-foreground")} />
                                {item.title}
                            </Link>
                        ))}
                    </nav>

                    <div className="mt-12 p-4 rounded-xl bg-gradient-to-br from-primary/5 to-secondary/5 border border-primary/10">
                        <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Support</h3>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                            Need help? Reach out to our developer support team on Discord.
                        </p>
                        <Button variant="outline" size="sm" className="w-full mt-3 h-8 text-[10px] bg-transparent border-primary/20 hover:bg-primary/10">
                            Join Discord
                        </Button>
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 overflow-auto p-4 lg:p-12">
                    <div className="max-w-4xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </AppLayout>
    );
}

import { Button } from '@/components/ui/button';
