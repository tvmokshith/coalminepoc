'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import {
  LayoutDashboard, Mountain, Box, BarChart3, AlertTriangle,
  Truck, Users, DollarSign, Leaf, ShieldAlert, Brain, Map
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['ceo', 'ops_head', 'mine_manager', 'field_engineer'] },
  { label: 'Mines', href: '/mines', icon: Mountain, roles: ['ceo', 'ops_head', 'mine_manager'] },
  { label: 'Digital Twin', href: '/digital-twin', icon: Map, roles: ['ceo', 'ops_head', 'mine_manager', 'field_engineer'] },
  { label: 'AI Advisory', href: '/advisory', icon: Brain, roles: ['ceo', 'ops_head', 'mine_manager', 'field_engineer'] },
  { type: 'divider', label: 'Subsystems' },
  { label: 'Mining Ops', href: '/subsystems/mining', icon: Box, roles: ['ops_head', 'mine_manager', 'field_engineer'] },
  { label: 'Logistics', href: '/subsystems/logistics', icon: Truck, roles: ['ops_head', 'mine_manager'] },
  { label: 'HR & Workforce', href: '/subsystems/hr', icon: Users, roles: ['ops_head', 'mine_manager'] },
  { label: 'Finance', href: '/subsystems/finance', icon: DollarSign, roles: ['ceo', 'ops_head'] },
  { label: 'ESG', href: '/subsystems/esg', icon: Leaf, roles: ['ceo', 'ops_head', 'mine_manager'] },
  { label: 'EHS / Safety', href: '/subsystems/ehs', icon: ShieldAlert, roles: ['ops_head', 'mine_manager', 'field_engineer'] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const role = user?.role || 'ceo';

  return (
    <aside className="w-64 h-screen bg-[#0a1025] border-r border-[#1e2d52] flex flex-col fixed left-0 top-0 z-40">
      {/* Logo */}
      <div className="p-5 border-b border-[#1e2d52]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg">
            <Mountain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">ASTRIKOS</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">Mining Intelligence</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {navItems.map((item, i) => {
          if ('type' in item && item.type === 'divider') {
            return (
              <div key={i} className="mt-5 mb-2 px-3">
                <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">
                  {item.label}
                </span>
              </div>
            );
          }

          if ('roles' in item && item.roles && !item.roles.includes(role)) return null;

          const Icon = item.icon!;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href!}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-0.5 transition-all duration-150 group ${
                isActive
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-[#1e2d52]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-300 truncate">{user?.name}</p>
            <p className="text-[10px] text-slate-600 uppercase">{role.replace('_', ' ')}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
