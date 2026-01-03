'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { loadKakaoSDK, loginWithKakao, getKakaoUserInfo } from '@/lib/kakao';
import { PermissionProvider } from '@/contexts/PermissionContext';

interface PortalAuthProps {
  children: React.ReactNode;
}

export default function PortalAuth({ children }: PortalAuthProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [kakaoLoading, setKakaoLoading] = useState(false);

  useEffect(() => {
    // 초기 상태: 로그인 화면 표시
    setShowLogin(true);
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      // 사용자가 없으면 로그인 화면 유지
      if (!user) {
        setShowLogin(true);
      } else {
        setShowLogin(false);
      }
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
      
      // Firestore에서 사용자 승인 정보 찾기
      const approvalsSnapshot = await getDocs(
        query(collection(db, 'userApprovals'), where('kakaoId', '==', kakaoId))
      );
      
      // 승인된 사용자가 있으면 로그인
      const approvedApproval = approvalsSnapshot.docs.find(
        (doc) => doc.data().status === 'approved'
      );
      
      if (approvedApproval) {
        const approvalData = approvedApproval.data();
        const kakaoEmail = `kakao_${kakaoId}@kakao.workschedule.local`;
        
        try {
          // Firebase Auth로 로그인 시도
          const firebasePassword = `kakao_${kakaoId}_temp`;
          
          try {
            await signInWithEmailAndPassword(auth, kakaoEmail, firebasePassword);
          } catch (err: any) {
            if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
              // 계정이 없거나 비밀번호가 다르면 계정 생성
              await createUserWithEmailAndPassword(auth, kakaoEmail, firebasePassword);
            } else {
              throw err;
            }
          }
          return; // 로그인 성공
        } catch (error: any) {
          console.error('카카오 로그인 오류:', error);
          alert('카카오톡 로그인에 실패했습니다. 관리자에게 문의하세요.');
          return;
        }
      }
      
      // 승인되지 않은 사용자 처리
      const pendingApproval = approvalsSnapshot.docs.find(
        (doc) => doc.data().status === 'pending'
      );
      
      if (pendingApproval) {
        // 가입 신청이 대기 중인 경우
        alert('가입 신청이 대기 중입니다. 관리자 승인 후 로그인할 수 있습니다.');
        return;
      }
      
      // 아직 가입 신청을 하지 않은 경우 - 가입 페이지로 리다이렉트
      // 카카오 사용자 정보를 세션 스토리지에 저장하고 가입 페이지로 이동
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('kakaoSignupData', JSON.stringify({
          kakaoId: kakaoId,
          kakaoNickname: kakaoUser.kakao_account?.profile?.nickname || '',
        }));
        router.push('/signup');
      }
    } catch (error: any) {
      console.error('카카오 로그인 오류:', error);
      const errorMessage = error?.message || '알 수 없는 오류';
      
      if (errorMessage.includes('KOE004')) {
        alert('카카오톡 로그인 설정 오류가 발생했습니다.\n\n카카오 개발자 콘솔에서 앱 관리자 설정이 필요합니다.\n관리자에게 문의하세요.');
      } else {
        alert(`카카오톡 로그인에 실패했습니다.\n\n오류: ${errorMessage}\n\n다시 시도해주세요.`);
      }
    } finally {
      setKakaoLoading(false);
    }
  };

  // 로딩 중이거나 사용자가 없으면 로그인 화면 표시
  if (loading || !user || showLogin) {
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                  required
                  disabled={loading}
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
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                    required
                    disabled={loading}
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
                disabled={loginLoading || loading}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loginLoading || loading ? '로딩 중...' : '로그인'}
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
                disabled={kakaoLoading || loading}
                className="mt-4 w-full bg-yellow-400 text-black py-3 px-4 rounded-lg hover:bg-yellow-500 font-medium text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {kakaoLoading || loading ? '로딩 중...' : (
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

