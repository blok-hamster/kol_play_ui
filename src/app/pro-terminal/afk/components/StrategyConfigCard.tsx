'use client';

import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { useTradingStore } from '@/stores/use-trading-store';
import {
    Zap,
    Bot,
    GitBranch,
    Search,
    Crosshair,
    BarChart3,
    Rocket,
    Eye,
    Twitter,
    Globe,
    BookOpen,
    Map,
    Filter,
    Brain,
    Cpu,
    Wallet,
    ShieldCheck,
    Bell,
    PieChart,
    ChevronDown,
    ArrowDown,
    Users
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ───────────────────────────────────────────────
// Workflow Data Models
// ───────────────────────────────────────────────

interface AgentNode {
    id: string;
    name: string;
    icon: React.ReactNode;
    description: string;
    tools: string[];
}

interface TeamNode {
    id: string;
    name: string;
    label: string;
    icon: React.ReactNode;
    color: string;       // tailwind color stem e.g. "violet"
    description: string;
    agents: AgentNode[];
}

interface WorkflowConfig {
    id: string;
    label: string;
    description: string;
    supervisorPrompt: string;
    teams: TeamNode[];
}

// ───────────────────────────────────────────────
// Workflow Template Definitions (mirrors backend)
// ───────────────────────────────────────────────

const RESEARCH_TEAM: TeamNode = {
    id: 'research',
    name: 'RESEARCH_TEAM',
    label: 'Research',
    icon: <Search className="w-4 h-4" />,
    color: 'violet',
    description: 'Analyzes social media and the web for trending market narratives. Saves all findings to the research repository for use by downstream teams.',
    agents: [
        {
            id: 'twitter_scout',
            name: 'Twitter Scout',
            icon: <Twitter className="w-3.5 h-3.5" />,
            description: 'Scrapes Twitter/Nitter for viral memecoins, trending tokens, and KOL sentiment in real time.',
            tools: ['Nitter Scraper']
        },
        {
            id: 'web_analyst',
            name: 'Web Analyst',
            icon: <Globe className="w-3.5 h-3.5" />,
            description: 'Browses the web using a headless stealth browser to gather deep context on specific narratives or projects.',
            tools: ['Puppeteer Browser']
        },
        {
            id: 'rag_clerk',
            name: 'RAG Clerk',
            icon: <BookOpen className="w-3.5 h-3.5" />,
            description: 'Persists detailed reports to the Redis-backed research repository, tagging by token ticker for downstream retrieval.',
            tools: ['Research Repository']
        }
    ]
};

const DISCOVERY_TEAM: TeamNode = {
    id: 'discovery',
    name: 'DISCOVERY_TEAM',
    label: 'Discovery',
    icon: <Crosshair className="w-4 h-4" />,
    color: 'cyan',
    description: 'Identifies specific token mints by cross-referencing KOL mindmap data with research insights, then filters candidates against user-defined rules.',
    agents: [
        {
            id: 'mindmap_scout',
            name: 'Mindmap Scout',
            icon: <Map className="w-3.5 h-3.5" />,
            description: 'Reads KOL buy-in cluster data from the mindmap API to find tokens with high influencer density.',
            tools: ['KOL Mindmap API']
        },
        {
            id: 'filter_agent',
            name: 'Filter Agent',
            icon: <Filter className="w-3.5 h-3.5" />,
            description: 'Prunes candidates based on liquidity, market cap, holder count, and your custom AFK thresholds.',
            tools: ['SDK Discovery Tools', 'Research Repository']
        }
    ]
};

const ANALYST_TEAM: TeamNode = {
    id: 'analyst',
    name: 'ANALYST_TEAM',
    label: 'Analyst',
    icon: <BarChart3 className="w-4 h-4" />,
    color: 'amber',
    description: 'Performs deep sentiment and prediction analysis. Output is guardrailed with a Zod schema enforcing prediction score, risk level, and a BUY/SKIP recommendation.',
    agents: [
        {
            id: 'sentiment_specialist',
            name: 'Sentiment Specialist',
            icon: <Brain className="w-3.5 h-3.5" />,
            description: 'Runs VADER and FinBERT NLP models on token-related tweets after filtering out bot/shill content.',
            tools: ['VADER Sentiment', 'FinBERT Model', 'Bot Filter']
        },
        {
            id: 'ml_predictor',
            name: 'ML Predictor',
            icon: <Cpu className="w-3.5 h-3.5" />,
            description: 'Generates a prediction score (good / bad / neutral) using the SDK\'s built-in analytics engine.',
            tools: ['SDK Analyst Tools']
        }
    ]
};

const EXECUTION_TEAM: TeamNode = {
    id: 'execution',
    name: 'EXECUTION_TEAM',
    label: 'Execution',
    icon: <Rocket className="w-4 h-4" />,
    color: 'emerald',
    description: 'Handles blockchain interaction and wallet safety. Only executes if the Analyst Team recommended BUY. Output guardrailed with a Zod schema for trade results.',
    agents: [
        {
            id: 'on_chain_operator',
            name: 'On-Chain Operator',
            icon: <Wallet className="w-3.5 h-3.5" />,
            description: 'Submits swap transactions on Solana with the correct slippage and the \'agent_afk\' tag for tracking.',
            tools: ['SDK Executor Tools']
        },
        {
            id: 'vault_guard',
            name: 'Vault Guard',
            icon: <ShieldCheck className="w-3.5 h-3.5" />,
            description: 'Verifies the user has sufficient SOL balance before execution and confirms trade status after.',
            tools: ['Vault Connectivity Tool']
        }
    ]
};

const OBSERVATION_TEAM: TeamNode = {
    id: 'observation',
    name: 'OBSERVATION_TEAM',
    label: 'Observation',
    icon: <Eye className="w-4 h-4" />,
    color: 'rose',
    description: 'Performance reporting and user-facing notifications. Produces terminal briefings and portfolio summaries.',
    agents: [
        {
            id: 'notification_agent',
            name: 'Notification Agent',
            icon: <Bell className="w-3.5 h-3.5" />,
            description: 'Pushes real-time signals to the AFK terminal including discoveries, execution results, and market alerts.',
            tools: ['SDK Observer Tools']
        },
        {
            id: 'portfolio_auditor',
            name: 'Portfolio Auditor',
            icon: <PieChart className="w-3.5 h-3.5" />,
            description: 'Tracks current open positions, calculates PnL, and summarizes overall portfolio performance.',
            tools: ['SDK Observer Tools']
        }
    ]
};

const WORKFLOWS: Record<string, WorkflowConfig> = {
    FULL_AUTONOMY: {
        id: 'FULL_AUTONOMY',
        label: 'Full Autonomy',
        description: 'End-to-end autonomous trading: research → discover → analyze → execute → report.',
        supervisorPrompt: 'Manages the full lifecycle of autonomous trading across all five specialized teams.',
        teams: [RESEARCH_TEAM, DISCOVERY_TEAM, ANALYST_TEAM, EXECUTION_TEAM, OBSERVATION_TEAM]
    },
    MARKET_RESEARCHER: {
        id: 'MARKET_RESEARCHER',
        label: 'Market Researcher',
        description: 'Research-only mode: gathers narratives and provides briefings without executing trades.',
        supervisorPrompt: 'Gathers the latest crypto narratives via Research Team and produces portfolio briefings via Observation Team. No trades are executed.',
        teams: [RESEARCH_TEAM, OBSERVATION_TEAM]
    },
    SNIPER: {
        id: 'SNIPER',
        label: 'Sniper Trade',
        description: 'Fast execution: uses existing research to identify, verify, and execute trades quickly.',
        supervisorPrompt: 'Uses existing research to quickly identify, verify, and execute high-confidence trades across four teams.',
        teams: [DISCOVERY_TEAM, ANALYST_TEAM, EXECUTION_TEAM, OBSERVATION_TEAM]
    }
};

// ───────────────────────────────────────────────
// Color utility
// ───────────────────────────────────────────────

const colorMap: Record<string, { bg: string; bgHover: string; text: string; border: string; glow: string }> = {
    violet: { bg: 'bg-violet-500/10', bgHover: 'bg-violet-500/20', text: 'text-violet-400', border: 'border-violet-500/30', glow: 'shadow-violet-500/20' },
    cyan: { bg: 'bg-cyan-500/10', bgHover: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30', glow: 'shadow-cyan-500/20' },
    amber: { bg: 'bg-amber-500/10', bgHover: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', glow: 'shadow-amber-500/20' },
    emerald: { bg: 'bg-emerald-500/10', bgHover: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', glow: 'shadow-emerald-500/20' },
    rose: { bg: 'bg-rose-500/10', bgHover: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/30', glow: 'shadow-rose-500/20' },
};

// ───────────────────────────────────────────────
// Sub-components
// ───────────────────────────────────────────────

function Tooltip({ children, content, zIndex = 50 }: { children: React.ReactNode; content: React.ReactNode; zIndex?: number }) {
    const [show, setShow] = useState(false);
    const shouldShow = show && content != null;

    return (
        <div className="relative" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
            {children}
            {shouldShow && (
                <div style={{ zIndex }} className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-zinc-900/95 border border-border/50 rounded-xl shadow-2xl backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-150">
                    {content}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2.5 h-2.5 bg-zinc-900/95 border-r border-b border-border/50 rotate-45" />
                </div>
            )}
        </div>
    );
}

function AgentBadge({ agent, teamColor, onHover }: { agent: AgentNode; teamColor: string; onHover: (hovering: boolean) => void }) {
    const colors = colorMap[teamColor] || colorMap.violet;
    const [hovered, setHovered] = useState(false);

    return (
        <div
            className="relative"
            onMouseEnter={() => { setHovered(true); onHover(true); }}
            onMouseLeave={() => { setHovered(false); onHover(false); }}
        >
            <div className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-lg border cursor-default transition-all duration-200",
                colors.bg, colors.border, `hover:${colors.bgHover}`
            )}>
                <span className={colors.text}>{agent.icon}</span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-300">{agent.name}</span>
            </div>
            {hovered && (
                <div style={{ zIndex: 60 }} className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-zinc-900/95 border border-border/50 rounded-xl shadow-2xl backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-150">
                    <p className={cn("text-[11px] font-black uppercase tracking-widest mb-1", colors.text)}>{agent.name}</p>
                    <p className="text-[11px] text-zinc-300 leading-relaxed mb-2">{agent.description}</p>
                    <div className="flex flex-wrap gap-1">
                        {agent.tools.map(t => (
                            <span key={t} className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-zinc-400">{t}</span>
                        ))}
                    </div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2.5 h-2.5 bg-zinc-900/95 border-r border-b border-border/50 rotate-45" />
                </div>
            )}
        </div>
    );
}

function TeamCard({ team, isLast }: { team: TeamNode; isLast: boolean }) {
    const colors = colorMap[team.color] || colorMap.violet;
    const [agentHovered, setAgentHovered] = useState(false);
    return (
        <div className="flex flex-col items-center">
            <Tooltip content={
                agentHovered ? null : (
                    <div>
                        <p className={cn("text-[11px] font-black uppercase tracking-widest mb-1", colors.text)}>{team.label} Team</p>
                        <p className="text-[11px] text-zinc-300 leading-relaxed">{team.description}</p>
                    </div>
                )
            }>
                <div className={cn(
                    "w-full p-3 rounded-xl border cursor-default transition-all duration-300 hover:shadow-lg",
                    colors.bg, colors.border, `hover:${colors.glow}`
                )}>
                    <div className="flex items-center gap-2 mb-2.5">
                        <div className={cn("p-1.5 rounded-lg", colors.bg)}>
                            <span className={colors.text}>{team.icon}</span>
                        </div>
                        <span className={cn("text-[10px] font-black uppercase tracking-widest", colors.text)}>{team.label}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {team.agents.map(agent => (
                            <AgentBadge key={agent.id} agent={agent} teamColor={team.color} onHover={setAgentHovered} />
                        ))}
                    </div>
                </div>
            </Tooltip>

            {/* Connector arrow */}
            {!isLast && (
                <div className="flex flex-col items-center my-1.5">
                    <div className="w-px h-3 bg-gradient-to-b from-border/60 to-border/20" />
                    <ChevronDown className="w-3 h-3 text-border/60 -mt-0.5" />
                </div>
            )}
        </div>
    );
}

// ───────────────────────────────────────────────
// Main Component
// ───────────────────────────────────────────────

export function StrategyConfigCard({ mode = 'copy' }: { mode?: 'copy' | 'agent' }) {
    const { tradingSettings, updateTradingSettings, saveTradingSettings } = useTradingStore();

    const currentSettings = mode === 'agent' ? tradingSettings?.agentSettings : tradingSettings;

    const {
        runFrequency = 60,
        workflowTemplate = 'FULL_AUTONOMY'
    } = currentSettings || {};

    const handleUpdate = (updates: any) => {
        if (mode === 'agent') {
            updateTradingSettings({
                agentSettings: { ...tradingSettings.agentSettings, ...updates }
            } as any);
        } else {
            updateTradingSettings(updates);
        }
    };

    const handleSaveGlobal = async () => {
        try {
            await saveTradingSettings();
        } catch (error) {
            console.error('Failed to save global settings:', error);
        }
    };

    const activeWorkflow = useMemo(() => {
        return WORKFLOWS[workflowTemplate] || WORKFLOWS.FULL_AUTONOMY;
    }, [workflowTemplate]);

    return (
        <Card className="relative p-6 bg-card/40 border-border/50 backdrop-blur-md shadow-2xl shadow-black/40 rounded-2xl overflow-hidden transition-all duration-300">
            {/* Top Accent Line */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent opacity-50" />

            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 rounded-lg shadow-black/20 transition-all duration-500 shadow-lg">
                        <GitBranch className="w-5 h-5 text-indigo-500 transition-colors duration-500" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-foreground italic uppercase tracking-tight">Agent Strategy</h2>
                        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-60">Configure swarm execution flow</p>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
                <div className="flex flex-wrap items-center justify-between p-3 bg-muted/10 rounded-2xl border border-border/20 hover:bg-muted/20 transition-all group gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-500/10 rounded-lg group-hover:bg-orange-500/20 transition-colors">
                            <Zap className="w-4 h-4 text-orange-500" />
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-tight">Run Frequency</p>
                            <p className="text-[10px] text-muted-foreground uppercase opacity-60 font-medium">Scan interval</p>
                        </div>
                    </div>
                    <select
                        value={runFrequency}
                        onChange={(e) => {
                            handleUpdate({ runFrequency: parseInt(e.target.value) });
                            handleSaveGlobal();
                        }}
                        className="h-10 px-3 font-bold !bg-zinc-950 border border-border/20 focus:ring-primary/20 rounded-xl text-white appearance-none outline-none cursor-pointer"
                    >
                        <option value={15}>Every 15 mins</option>
                        <option value={30}>Every 30 mins</option>
                        <option value={60}>Every 1 hour</option>
                        <option value={120}>Every 2 hours</option>
                        <option value={240}>Every 4 hours</option>
                    </select>
                </div>

                <div className="flex flex-wrap items-center justify-between p-3 bg-muted/10 rounded-2xl border border-border/20 hover:bg-muted/20 transition-all group gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-lg group-hover:bg-indigo-500/20 transition-colors">
                            <Bot className="w-4 h-4 text-indigo-500" />
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-tight">Template</p>
                            <p className="text-[10px] text-muted-foreground uppercase opacity-60 font-medium">Swarm behavior</p>
                        </div>
                    </div>
                    <select
                        value={workflowTemplate}
                        onChange={(e) => {
                            handleUpdate({ workflowTemplate: e.target.value });
                            handleSaveGlobal();
                        }}
                        className="h-10 px-3 font-bold !bg-zinc-950 border border-border/20 focus:ring-primary/20 rounded-xl text-white appearance-none outline-none cursor-pointer"
                    >
                        <option value="FULL_AUTONOMY">Full Autonomy</option>
                        <option value="MARKET_RESEARCHER">Market Researcher</option>
                        <option value="SNIPER">Sniper Trade</option>
                    </select>
                </div>
            </div>

            {/* Workflow Diagram */}
            <div className="p-4 bg-zinc-950/60 rounded-2xl border border-border/20">
                {/* Header */}
                <div className="flex items-center gap-2 mb-4">
                    <Users className="w-4 h-4 text-indigo-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Workflow Diagram</span>
                    <span className="text-[9px] text-muted-foreground font-medium ml-auto opacity-60 uppercase">Hover for details</span>
                </div>

                {/* Supervisor Node */}
                <div className="flex flex-col items-center mb-2">
                    <Tooltip content={
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-widest text-indigo-400 mb-1">Swarm Supervisor</p>
                            <p className="text-[11px] text-zinc-300 leading-relaxed">{activeWorkflow.supervisorPrompt}</p>
                        </div>
                    }>
                        <div className="px-4 py-2 bg-indigo-500/15 border border-indigo-500/40 rounded-xl cursor-default hover:shadow-lg hover:shadow-indigo-500/10 transition-all">
                            <div className="flex items-center gap-2">
                                <Bot className="w-4 h-4 text-indigo-400" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Supervisor</span>
                            </div>
                        </div>
                    </Tooltip>
                    <div className="flex flex-col items-center my-1.5">
                        <div className="w-px h-3 bg-gradient-to-b from-indigo-500/40 to-border/20" />
                        <ChevronDown className="w-3 h-3 text-indigo-500/50 -mt-0.5" />
                    </div>
                </div>

                {/* Team Nodes */}
                <div className="flex flex-col items-center gap-0">
                    {activeWorkflow.teams.map((team, i) => (
                        <TeamCard key={team.id} team={team} isLast={i === activeWorkflow.teams.length - 1} />
                    ))}
                </div>

                {/* Description */}
                <div className="mt-4 p-3 bg-white/[0.02] rounded-xl border border-border/10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">{activeWorkflow.label}</p>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">{activeWorkflow.description}</p>
                </div>
            </div>
        </Card>
    );
}
