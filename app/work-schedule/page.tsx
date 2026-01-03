'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import Dashboard from '@/components/work-schedule/Dashboard';
import PortalAuth from '@/components/PortalAuth';

// work-schedule은 portal의 서브 시스템이므로 PortalAuth를 통해 인증됨
function WorkScheduleContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">로딩중...</div>
      </div>
    );
  }

  // PortalAuth가 이미 인증을 처리하므로 user는 항상 존재함
  if (!user) {
    return null;
  }

  return <Dashboard user={user} />;
}

export default function WorkSchedulePage() {
  return (
    <PortalAuth>
      <WorkScheduleContent />
    </PortalAuth>
  );
}

