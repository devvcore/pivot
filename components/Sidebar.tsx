import { 
  Activity, 
  Database, 
  BrainCircuit, 
  Terminal, 
  Users,
  Search,
  Command,
  MessageSquare
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const navItems = [
    { id: "overview", label: "System Overview", icon: Activity },
    { id: "ingest", label: "Phase 1: Ingest", icon: Database },
    { id: "plan", label: "Phase 2: Plan", icon: BrainCircuit },
    { id: "execute", label: "Phase 3: Execute", icon: Terminal, badge: "2 REQ" },
    { id: "chat", label: "Agent Comms", icon: MessageSquare },
    { id: "team", label: "IAM & Access", icon: Users },
  ];

  return (
    <div className="w-64 border-r border-zinc-200 bg-[#FDFDFD] flex flex-col h-screen sticky top-0">
      {/* Brand & Workspace */}
      <div className="p-5 border-b border-zinc-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-6 h-6 bg-zinc-900 flex items-center justify-center">
            <div className="w-2 h-2 bg-white" />
          </div>
          <div className="font-semibold tracking-widest text-sm uppercase text-zinc-900">
            Pivot
          </div>
        </div>
        
        <div className="text-xs font-mono text-zinc-500 mb-1 uppercase tracking-wider">Active Workspace</div>
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-zinc-900">Acme Corporation</div>
          <div className="text-[10px] font-mono bg-zinc-100 px-1.5 py-0.5 text-zinc-600 border border-zinc-200">ENT</div>
        </div>
      </div>

      {/* Global Search */}
      <div className="px-4 py-4 border-b border-zinc-200">
        <div className="relative group">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-zinc-900 transition-colors" />
          <input 
            type="text" 
            placeholder="Search entities..." 
            className="w-full bg-zinc-50 border border-zinc-200 rounded-none pl-8 pr-8 py-1.5 text-xs focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-all placeholder:text-zinc-400"
          />
          <Command className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-5 py-2 text-sm transition-all border-l-2 ${
                isActive 
                  ? "border-zinc-900 bg-zinc-100/50 text-zinc-900 font-medium" 
                  : "border-transparent text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-zinc-900' : 'text-zinc-400'}`} />
                {item.label}
              </div>
              {item.badge && (
                <span className={`text-[10px] font-mono px-1.5 py-0.5 ${
                  isActive ? 'bg-zinc-900 text-white' : 'bg-zinc-200 text-zinc-600'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Status */}
      <div className="p-5 border-t border-zinc-200 bg-zinc-50/50">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-mono text-zinc-500">SYSTEM STATUS</div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-[10px] font-mono text-zinc-600">ONLINE</span>
          </div>
        </div>
        <div className="text-[10px] font-mono text-zinc-400">
          Last sync: 2 mins ago<br/>
          Agent runtime: Active
        </div>
      </div>
    </div>
  );
}
