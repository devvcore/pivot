"use client";

import { motion } from "motion/react";
import {
    Terminal,
    Activity,
    Users,
    Code,
    TrendingUp,
    LayoutDashboard,
    Search,
    Bell,
    Cpu,
    ChevronRight,
    ShieldCheck,
    Play,
    Settings,
    ArrowLeft
} from "lucide-react";
import { useState, useEffect } from "react";
import type { Job } from "@/lib/types";

interface ExecutionViewProps {
    job: Job;
    onBack: () => void;
}

export function ExecutionView({ job, onBack }: ExecutionViewProps) {
    const [activeTab, setActiveTab] = useState<"orchestrator" | "agents" | "tasks">("orchestrator");

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
            {/* Execution Header */}
            <header className="bg-zinc-900/50 backdrop-blur-md border-b border-zinc-800 p-4 flex items-center justify-between sticky top-0 z-40">
                <div className="flex items-center gap-6">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-500 hover:text-white"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white/10 flex items-center justify-center rounded-lg border border-white/10">
                            <Cpu className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <div className="text-sm font-bold tracking-tight text-white leading-none">Execution Command Center</div>
                            <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> Phase 3: Autonomous Operations
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-mono text-zinc-400">
                        <ShieldCheck className="w-3 h-3 text-green-500" /> System Integrity Validated
                    </div>
                    <button className="p-2 hover:bg-white/5 rounded-full transition-colors text-zinc-500 hover:text-white">
                        <Settings className="w-4 h-4" />
                    </button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* Navigation Sidebar */}
                <nav className="w-20 lg:w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col p-4">
                    <div className="space-y-2 flex-1">
                        <NavButton
                            active={activeTab === "orchestrator"}
                            onClick={() => setActiveTab("orchestrator")}
                            icon={<LayoutDashboard className="w-4 h-4" />}
                            label="Orchestrator"
                        />
                        <NavButton
                            active={activeTab === "agents"}
                            onClick={() => setActiveTab("agents")}
                            icon={<Users className="w-4 h-4" />}
                            label="Agent Roster"
                        />
                        <NavButton
                            active={activeTab === "tasks"}
                            onClick={() => setActiveTab("tasks")}
                            icon={<Activity className="w-4 h-4" />}
                            label="Task Matrix"
                        />
                    </div>
                    <div className="pt-4 mt-4 border-t border-zinc-800">
                        <div className="hidden lg:block">
                            <div className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mb-4">Operations Status</div>
                            <div className="space-y-4">
                                <StatusItem label="Coach" status="Idle" />
                                <StatusItem label="Developer" status="Active" />
                                <StatusItem label="Sales" status="Scanning" />
                            </div>
                        </div>
                    </div>
                </nav>

                {/* Main Content */}
                <main className="flex-1 overflow-y-auto bg-zinc-950 flex flex-col p-4 lg:p-10">
                    <div className="max-w-6xl mx-auto w-full space-y-10">
                        {/* Real-time Feed */}
                        <section className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
                            <div className="px-6 py-3 border-b border-zinc-800 flex items-center justify-between">
                                <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                    <Terminal className="w-3.5 h-3.5" /> Operations Log
                                </div>
                                <div className="flex items-center gap-2 text-[10px] font-mono text-blue-500">
                                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" /> Uplink Active
                                </div>
                            </div>
                            <div className="p-6 font-mono text-[11px] space-y-2 text-zinc-400">
                                <LogItem time="12:04:12" msg="Orchestrator initiated Phase 3 boot sequence." />
                                <LogItem time="12:04:15" msg="Ingesting approved transformation roadmap." />
                                <LogItem time="12:04:22" msg="Agent 'Developer' deployed to task [DB-MIGRATION-SQLITE]." />
                                <LogItem time="12:04:28" msg="Agent 'Sales' analyzing revenue leak patterns 004-B..." color="text-blue-400" />
                                <LogItem time="12:05:01" msg="System waiting for human confirmation on consequential action [CRM-AUTO-FOLLOWUP]." />
                            </div>
                        </section>

                        {/* Agent Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <AgentCard
                                name="Coach"
                                role="People & Performance"
                                icon={<Users className="w-5 h-5" />}
                                status="Idle"
                                task="Monitoring engagement"
                            />
                            <AgentCard
                                name="Developer"
                                role="Technical Execution"
                                icon={<Code className="w-5 h-5" />}
                                status="Active"
                                task="Schema synchronization"
                                progress={72}
                            />
                            <AgentCard
                                name="Sales"
                                role="Revenue Growth"
                                icon={<TrendingUp className="w-5 h-5" />}
                                status="Active"
                                task="Price correction audit"
                                progress={45}
                            />
                            <AgentCard
                                name="Transform"
                                role="Systems Design"
                                icon={<Settings className="w-5 h-5" />}
                                status="Idle"
                                task="Awaiting task assignment"
                            />
                        </div>

                        {/* Decision Platform Placeholder */}
                        <section className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-light">Pending Decisions</h2>
                                <span className="px-2 py-0.5 bg-zinc-800 text-[10px] font-mono text-zinc-400 rounded">1 ACTION REQUIRED</span>
                            </div>
                            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col lg:flex-row items-center justify-between gap-6">
                                <div className="flex items-start gap-5">
                                    <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20 text-blue-500 shrink-0">
                                        <TrendingUp className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-white mb-1">Revenue Recovery Authorization</div>
                                        <p className="text-xs text-zinc-500 max-w-lg leading-relaxed">
                                            Sales Agent identified 12 undercharged accounts. Action: Apply 15% price correction as per Phase 2 Roadmap. Estimated Impact: $4,200/mo.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <button className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-bold transition-colors">Discard</button>
                                    <button className="px-6 py-2 bg-white text-zinc-950 hover:bg-zinc-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-2">
                                        <Play className="w-3 h-3 fill-current" /> Execute Action
                                    </button>
                                </div>
                            </div>
                        </section>
                    </div>
                </main>
            </div>
        </div>
    );
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: any; label: string; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${active
                    ? "bg-white/10 text-white shadow-lg"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                }`}
        >
            {icon}
            <span className="hidden lg:block font-medium">{label}</span>
            {active && <motion.div layoutId="nav-bg" className="ml-auto w-1 h-1 bg-white rounded-full hidden lg:block" />}
        </button>
    );
}

function StatusItem({ label, status }: { label: string; status: string }) {
    return (
        <div className="flex justify-between items-center text-[11px]">
            <span className="text-zinc-500">{label}</span>
            <span className={status === "Idle" ? "text-zinc-700" : "text-green-500"}>{status}</span>
        </div>
    );
}

function LogItem({ time, msg, color = "text-zinc-400" }: { time: string; msg: string; color?: string }) {
    return (
        <div className="flex gap-4">
            <span className="text-zinc-700 shrink-0">[{time}]</span>
            <span className={color}>{msg}</span>
        </div>
    );
}

function AgentCard({ name, role, icon, status, task, progress }: { name: string; role: string; icon: any; status: string; task: string; progress?: number }) {
    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition-colors group">
            <div className="flex justify-between items-start mb-6">
                <div className={`p-2.5 rounded-xl ${status === 'Active' ? 'bg-blue-500/10 text-blue-500' : 'bg-white/5 text-zinc-500'}`}>
                    {icon}
                </div>
                <div className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase tracking-widest ${status === 'Active' ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-800 text-zinc-500'
                    }`}>
                    {status}
                </div>
            </div>
            <div>
                <div className="text-sm font-bold text-white">{name}</div>
                <div className="text-[10px] text-zinc-500 mb-4">{role}</div>
                <div className="text-[11px] text-zinc-400 leading-tight min-h-[2.5em] mb-4 group-hover:text-zinc-200 transition-colors">
                    {task}
                </div>
                {progress && (
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] font-mono">
                            <span className="text-zinc-600 uppercase tracking-widest">Progress</span>
                            <span className="text-zinc-400">{progress}%</span>
                        </div>
                        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                className="h-full bg-blue-500"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
