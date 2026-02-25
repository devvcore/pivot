import { Shield, Key } from "lucide-react";

export function TeamView() {
  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-12 max-w-5xl">
      {/* Header */}
      <div className="border-b border-zinc-200 pb-6">
        <div className="text-xs font-mono text-zinc-500 mb-2 uppercase tracking-widest">Platform Administration</div>
        <div className="flex items-end justify-between">
          <h1 className="text-3xl font-light tracking-tight text-zinc-900">IAM & Access Control</h1>
          <button className="px-4 py-2 bg-zinc-900 text-white text-xs font-mono uppercase tracking-wider hover:bg-zinc-800 transition-colors">
            Provision User
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
        {/* Left: User Roster */}
        <div className="xl:col-span-2">
          <h2 className="text-sm font-mono text-zinc-900 uppercase tracking-wider mb-4 border-b border-zinc-200 pb-2">Active Principals</h2>
          
          <div className="border border-zinc-200 bg-white">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-50 text-zinc-500 font-mono text-[10px] uppercase tracking-wider border-b border-zinc-200">
                <tr>
                  <th className="px-4 py-2.5 font-normal">Identity</th>
                  <th className="px-4 py-2.5 font-normal">Role</th>
                  <th className="px-4 py-2.5 font-normal">Status</th>
                  <th className="px-4 py-2.5 font-normal text-right">Last Auth</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {[
                  { name: "Sarah Jenkins", email: "sarah@acmecorp.com", role: "ADMIN", status: "ACTIVE", lastActive: "Just now" },
                  { name: "Michael Chen", email: "m.chen@acmecorp.com", role: "EDITOR", status: "ACTIVE", lastActive: "2h ago" },
                  { name: "David Rodriguez", email: "david.r@acmecorp.com", role: "VIEWER", status: "PENDING", lastActive: "-" },
                  { name: "Emma Thompson", email: "emma@acmecorp.com", role: "EDITOR", status: "ACTIVE", lastActive: "1d ago" },
                ].map((person, i) => (
                  <tr key={i} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-900">{person.name}</div>
                      <div className="text-xs text-zinc-500 font-mono">{person.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-zinc-600 flex items-center gap-1.5">
                        <Shield className="w-3 h-3 text-zinc-400" /> {person.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 border ${person.status === 'ACTIVE' ? 'border-zinc-300 text-zinc-900' : 'border-zinc-200 text-zinc-500'}`}>
                        {person.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-mono text-zinc-400">
                      {person.lastActive}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Security Settings & Audit */}
        <div className="space-y-8">
          <div>
            <h2 className="text-sm font-mono text-zinc-900 uppercase tracking-wider mb-4 border-b border-zinc-200 pb-2">Connected Directories</h2>
            <div className="border border-zinc-200 bg-white divide-y divide-zinc-100">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  <span className="text-sm font-medium text-zinc-900">Google Workspace</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-zinc-900 rounded-full"></span>
                  <span className="text-[10px] font-mono text-zinc-900">CONNECTED</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-zinc-50/50">
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4" fill="#00a4ef" viewBox="0 0 24 24"><path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z"/></svg>
                  <span className="text-sm font-medium text-zinc-900 opacity-70">Microsoft 365</span>
                </div>
                <button className="text-[10px] font-mono text-zinc-600 border border-zinc-300 px-2 py-1 hover:bg-zinc-100 bg-white">CONNECT</button>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-mono text-zinc-900 uppercase tracking-wider mb-4 border-b border-zinc-200 pb-2">Security Policies</h2>
            <div className="border border-zinc-200 bg-white p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-zinc-900">Require 2FA</div>
                  <div className="text-xs text-zinc-500 font-mono mt-0.5">Enforce MFA for all principals</div>
                </div>
                <div className="w-8 h-4 bg-zinc-900 rounded-none relative cursor-pointer">
                  <div className="w-3 h-3 bg-white absolute right-0.5 top-0.5"></div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
                <div>
                  <div className="text-sm font-medium text-zinc-900">SSO Integration</div>
                  <div className="text-xs text-zinc-500 font-mono mt-0.5">SAML / Okta configuration</div>
                </div>
                <button className="text-xs font-mono text-zinc-900 border border-zinc-200 px-2 py-1 hover:bg-zinc-50">CONFIG</button>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-mono text-zinc-900 uppercase tracking-wider mb-4 border-b border-zinc-200 pb-2 flex items-center justify-between">
              Audit Log
              <Key className="w-3.5 h-3.5 text-zinc-400" />
            </h2>
            <div className="space-y-3">
              <div className="border-l-2 border-zinc-300 pl-3">
                <div className="text-xs font-medium text-zinc-900">Successful login from new IP</div>
                <div className="text-[10px] font-mono text-zinc-500 mt-0.5">Sarah J. • 192.168.1.1 • 2h ago</div>
              </div>
              <div className="border-l-2 border-zinc-300 pl-3">
                <div className="text-xs font-medium text-zinc-900">API Key Generated</div>
                <div className="text-[10px] font-mono text-zinc-500 mt-0.5">Michael C. • PROD • Yesterday</div>
              </div>
              <div className="border-l-2 border-zinc-300 pl-3">
                <div className="text-xs font-medium text-zinc-900">Role Modified (VIEWER -&gt; EDITOR)</div>
                <div className="text-[10px] font-mono text-zinc-500 mt-0.5">System • Emma T. • 2d ago</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
