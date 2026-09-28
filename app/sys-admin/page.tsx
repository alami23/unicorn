'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SysAdminRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin');
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-xs">
      Forwarding to Master Admin Portal...
    </div>
  );
}
