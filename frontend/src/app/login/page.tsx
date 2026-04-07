'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Mountain, Eye, EyeOff } from 'lucide-react';

const DEMO_ACCOUNTS = [
  { email: 'ceo@astrikos.com', label: 'CEO', desc: 'Strategic insights, aggregated KPIs' },
  { email: 'opshead@astrikos.com', label: 'Operations Head', desc: 'All mines, full drilldown' },
  { email: 'manager_mine1@astrikos.com', label: 'Mine Manager (Gevra)', desc: 'Mine-level access only' },
  { email: 'engineer1@astrikos.com', label: 'Field Engineer (Gevra)', desc: 'Equipment-level data' },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('password');
  };

  return (
    <div className="min-h-screen bg-[#050a18] flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-600/20 via-[#050a18] to-purple-900/20" />
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23f59e0b' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        <div className="relative flex flex-col justify-center px-16 z-10">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-xl shadow-amber-500/20">
              <Mountain className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">ASTRIKOS</h1>
              <p className="text-sm text-amber-400/80 tracking-wider">MINING INTELLIGENCE</p>
            </div>
          </div>
          <h2 className="text-4xl font-bold text-white mb-4 leading-tight">
            Coal Mining<br />Command Center
          </h2>
          <p className="text-slate-400 text-lg max-w-md">
            Real-time monitoring, AI-powered advisory, and digital twin visualization
            for enterprise mining operations.
          </p>
          <div className="mt-12 grid grid-cols-3 gap-6">
            {[
              { value: '5', label: 'Active Mines' },
              { value: '105+', label: 'Equipment Units' },
              { value: '24/7', label: 'Live Monitoring' },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-2xl font-bold text-amber-400">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center px-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
              <Mountain className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">ASTRIKOS</h1>
          </div>

          <h3 className="text-2xl font-bold text-white mb-1">Sign In</h3>
          <p className="text-slate-500 mb-8 text-sm">Access the mining intelligence platform</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-[#0c1228] border border-[#1e2d52] text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all text-sm"
                placeholder="Enter your email"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-[#0c1228] border border-[#1e2d52] text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all text-sm pr-10"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-white font-semibold hover:from-amber-600 hover:to-amber-700 transition-all text-sm disabled:opacity-50 shadow-lg shadow-amber-500/20"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-8">
            <p className="text-xs text-slate-600 mb-3 uppercase tracking-wider font-medium">Quick Access</p>
            <div className="space-y-2">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  onClick={() => quickLogin(a.email)}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg bg-[#0c1228] border border-[#1e2d52] hover:border-amber-500/30 hover:bg-[#111a35] transition-all group"
                >
                  <div className="text-left">
                    <p className="text-xs font-medium text-slate-300 group-hover:text-amber-400 transition-colors">{a.label}</p>
                    <p className="text-[10px] text-slate-600">{a.desc}</p>
                  </div>
                  <span className="text-[10px] text-slate-600 font-mono">{a.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
