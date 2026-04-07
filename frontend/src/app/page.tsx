'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, setAuth } = useAuthStore();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try { setAuth(JSON.parse(userStr), token); } catch {}
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050a18]">
      <div className="animate-pulse text-mine-amber text-xl font-semibold">Loading Astrikos Platform...</div>
    </div>
  );
}
