'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { loadKakaoSDK, loginWithKakao, getKakaoUserInfo } from '@/lib/kakao';
import { PermissionProvider } from '@/contexts/PermissionContext';

interface PortalAuthProps {
  children: React.ReactNode;
}

export default function PortalAuth({ children }: PortalAuthProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [kakaoLoading, setKakaoLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      setShowLogin(!user);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // 카카오 SDK 로드
    loadKakaoSDK().catch((err) => {
      console.error('카카오 SDK 로드 실패:', err);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    
    try {
      // 기존 계정들은 기존 방식 유지
      if (userId === 'drawing555') {
        const email = 'drawing555@naver.com';
        await signInWithEmailAndPassword(auth, email, password);
        return;
      }
      
      // 매니저 계정 DB에서 해당 userId 확인
      const managerAccountsSnapshot = await getDocs(collection(db, 'managerAccounts'));
      const managerAccount = managerAccountsSnapshot.docs.find(doc => {
        const data = doc.data();
        return data.userId === userId && data.password === password && data.isActive;
      });
      
      if (managerAccount) {
        // 매니저 계정이면 기존 Firebase Auth 계정 시도
        const possibleEmails = [
          `${userId}@naver.com`,
          `${userId}@gmail.com`, 
          `${userId}@workschedule.local`
        ];
        
        // 첫 번째로 성공하는 이메일 사용
        for (const testEmail of possibleEmails) {
          try {
            await signInWithEmailAndPassword(auth, testEmail, password);
            return; // 성공하면 함수 종료
          } catch {
            console.log(`${testEmail} 로그인 실패, 다음 시도...`);
          }
        }
        
        // 모든 기존 이메일 실패시 새 Firebase Auth 계정 생성
        console.log('기존 이메일 형식 모두 실패, 새 Firebase Auth 계정 생성...');
      } else {
        alert('등록되지 않은 계정이거나 아이디/비밀번호가 틀렸습니다.');
        return;
      }
      
      // 매니저 계정이 확인되면 Firebase Auth로 로그인
      const email = `${managerAccount.data().userId}@manager.workschedule.local`;
      const firebasePassword = 'workschedule_manager_2024';
      
      try {
        await signInWithEmailAndPassword(auth, email, firebasePassword);
      } catch {
        console.log('Firebase 계정이 없어서 생성합니다...');
        await createUserWithEmailAndPassword(auth, email, firebasePassword);
      }
      
    } catch (error: any) {
      console.error('인증 오류:', error);
      alert(`로그인에 실패했습니다. 관리자에게 문의하세요.\n오류: ${error?.code || error?.message || '알 수 없는 오류'}`);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleKakaoLogin = async () => {
    try {
      setKakaoLoading(true);
      
      // 카카오톡 로그인
      await loginWithKakao();
      
      // 카카오톡 사용자 정보 가져오기
      const kakaoUser = await getKakaoUserInfo();
      const kakaoId = kakaoUser.id.toString();
      
      // Firestore에서 승인된 사용자 찾기
      const approvalsSnapshot = await getDocs(
        query(collection(db, 'userApprovals'), where('kakaoId', '==', kakaoId), where('status', '==', 'approved'))
      );
      
      if (approvalsSnapshot.empty) {
        alert('승인되지 않은 계정입니다. 관리자에게 문의하세요.');
        return;
      }
      
      const approvalData = approvalsSnapshot.docs[0].data();
      
      // Firebase Auth로 로그인 (카카오 ID를 이메일로 사용)
      const kakaoEmail = `kakao_${kakaoId}@kakao.workschedule.local`;
      
      try {
        // 이미 생성된 계정으로 로그인 시도
        // 실제로는 서버에서 Custom Token을 생성해야 하지만, 
        // 간단하게 하기 위해 승인된 사용자의 Firebase UID로 직접 인증
        // TODO: 서버 사이드 Custom Token 생성 API 구현 필요
        alert('카카오톡 로그인은 현재 개발 중입니다. 관리자에게 문의하세요.');
      } catch (error: any) {
        console.error('카카오 로그인 오류:', error);
        alert('카카오톡 로그인에 실패했습니다. 관리자에게 문의하세요.');
      }
    } catch (error: any) {
      console.error('카카오 로그인 오류:', error);
      alert('카카오톡 로그인에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setKakaoLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">로딩중...</div>
      </div>
    );
  }

  if (!user || showLogin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              로그인
            </h2>
            <p className="text-sm text-gray-600">
              카페드로잉&청담장어마켓 통합 업무 포털
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  아이디
                </label>
                <input
                  type="text"
                  placeholder="아이디를 입력하세요"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  비밀번호
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="비밀번호를 입력하세요"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loginLoading ? '로그인 중...' : '로그인'}
              </button>
            </form>
            
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">또는</span>
                </div>
              </div>
              
              <button
                type="button"
                onClick={handleKakaoLogin}
                disabled={kakaoLoading}
                className="mt-4 w-full bg-yellow-400 text-black py-3 px-4 rounded-lg hover:bg-yellow-500 font-medium text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {kakaoLoading ? '로그인 중...' : (
                  <>
                    <span>카카오톡으로 로그인</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PermissionProvider user={user}>
      {children}
    </PermissionProvider>
  );
}

