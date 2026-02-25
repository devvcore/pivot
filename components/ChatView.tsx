import { useState } from "react";
import { Terminal, User, Send, Bot } from "lucide-react";

export function ChatView() {
  const [activeAgent, setActiveAgent] = useState<"orchestrator" | "coach">("orchestrator");
  const [input, setInput] = useState("");

  const orchestratorMessages = [
    { role: "agent", text: "System health is currently at 72/100. I have identified 3 critical issues in the register. How would you like to proceed?", time: "10:42:01" },
    { role: "user", text: "Can you explain the legacy contract pricing gap?", time: "10:45:12" },
    { role: "agent", text: "Certainly. We have 14 enterprise clients on contracts signed before Q3 2024. They are currently paying an average of 18% below our current pricing floor. The Sales & Marketing agent has drafted an upgrade campaign that is projected to recover $82,000 in annualized revenue. Would you like me to queue this for your approval?", time: "10:45:15" }
  ];

  const coachMessages = [
    { role: "agent", text: "I've detected a drop in sentiment in the engineering team's Slack channels, correlating with a market compensation gap for Senior Engineers.", time: "09:12:00" },
    { role: "user", text: "Who is at the highest risk?", time: "09:14:20" },
    { role: "agent", text: "Based on recent communication patterns and tenure, David R. is at high risk of attrition. Estimated replacement cost is $135,000. I recommend scheduling a 1:1 this week. I can draft a compensation review brief for you.", time: "09:14:22" }
  ];

  const messages = activeAgent === "orchestrator" ? orchestratorMessages : coachMessages;

  return (
    <div className="h-[calc(100vh-8rem)] flex border border-zinc-200 bg-white animate-in fade-in duration-500">
      {/* Agent Selection Sidebar */}
      <div className="w-64 border-r border-zinc-200 bg-zinc-50 flex flex-col">
        <div className="p-4 border-b border-zinc-200">
          <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Active Agents</div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <button 
            onClick={() => setActiveAgent("orchestrator")}
            className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-colors ${activeAgent === "orchestrator" ? "bg-white border border-zinc-200 shadow-sm" : "hover:bg-zinc-100 border border-transparent"}`}
          >
            <Terminal className={`w-4 h-4 ${activeAgent === "orchestrator" ? "text-zinc-900" : "text-zinc-400"}`} />
            <div>
              <div className={`text-sm font-medium ${activeAgent === "orchestrator" ? "text-zinc-900" : "text-zinc-600"}`}>Orchestrator</div>
              <div className="text-[10px] font-mono text-zinc-400 mt-0.5">System Admin</div>
            </div>
          </button>
          
          <button 
            onClick={() => setActiveAgent("coach")}
            className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-colors ${activeAgent === "coach" ? "bg-white border border-zinc-200 shadow-sm" : "hover:bg-zinc-100 border border-transparent"}`}
          >
            <Bot className={`w-4 h-4 ${activeAgent === "coach" ? "text-zinc-900" : "text-zinc-400"}`} />
            <div>
              <div className={`text-sm font-medium ${activeAgent === "coach" ? "text-zinc-900" : "text-zinc-600"}`}>Coach</div>
              <div className="text-[10px] font-mono text-zinc-400 mt-0.5">People & Performance</div>
            </div>
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-white">
        <div className="p-4 border-b border-zinc-200 flex items-center justify-between bg-[#FDFDFD]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span className="text-sm font-mono text-zinc-900 uppercase tracking-wider">
              {activeAgent === "orchestrator" ? "ORCHESTRATOR_SESSION" : "COACH_SESSION"}
            </span>
          </div>
          <div className="text-[10px] font-mono text-zinc-400">SECURE CONNECTION</div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono text-zinc-400">{msg.time}</span>
                <span className="text-[10px] font-mono font-bold text-zinc-900 uppercase">{msg.role === 'user' ? 'Admin' : activeAgent}</span>
              </div>
              <div className={`max-w-xl p-4 text-sm leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-zinc-900 text-white' 
                  : 'bg-zinc-50 border border-zinc-200 text-zinc-800'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-zinc-200 bg-zinc-50">
          <div className="relative flex items-center">
            <span className="absolute left-4 text-zinc-400 font-mono text-sm">&gt;</span>
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter command or query..." 
              className="w-full bg-white border border-zinc-300 pl-8 pr-12 py-3 text-sm font-mono focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-all placeholder:text-zinc-300"
            />
            <button className="absolute right-2 p-2 text-zinc-400 hover:text-zinc-900 transition-colors">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
