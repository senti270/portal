'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { loadKakaoSDK, loginWithKakao, getKakaoUserInfo } from '@/lib/kakao';
import { collection, addDoc, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';

interface InviteData {
  id: string;
  token: string;
  employeeId: string;
  employeeName: string;
  invitedBy: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export default function SignupPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [realName, setRealName] = useState('');
  const [kakaoUser, setKakaoUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'verify' | 'kakao' | 'name' | 'complete'>('verify');

  useEffect(() => {
    if (!token) {
      setError('초대링크가 유효하지 않습니다.');
      return;
    }

    // 초대링크 정보 조회
    fetch(`/api/work-schedule/invitations?token=${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.invite) {
          setInviteData(data.invite);
          setStep('kakao');
        } else {
          setError(data.error || '초대링크를 찾을 수 없습니다.');
        }
      })
      .catch((err) => {
        console.error('초대링크 조회 오류:', err);
        setError('초대링크 조회에 실패했습니다.');
      });

    // 카카오 SDK 로드
    loadKakaoSDK().catch((err) => {
      console.error('카카오 SDK 로드 실패:', err);
    });
  }, [token]);

  const handleKakaoLogin = async () => {
    try {
      setLoading(true);
      setError('');

      // 카카오톡 로그인
      await loginWithKakao();
      
      // 카카오톡 사용자 정보 가져오기
      const userInfo = await getKakaoUserInfo();
      setKakaoUser(userInfo);
      setStep('name');
    } catch (err: any) {
      console.error('카카오 로그인 오류:', err);
      setError('카카오톡 로그인에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!realName.trim()) {
      setError('실명을 입력해주세요.');
      return;
    }

    if (!inviteData || !kakaoUser) {
      setError('필수 정보가 누락되었습니다.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // 1. Firebase Auth 계정 생성 (카카오 ID를 이메일로 사용)
      const kakaoEmail = `kakao_${kakaoUser.id}@kakao.workschedule.local`;
      const tempPassword = `kakao_${kakaoUser.id}_${Date.now()}`;
      
      let firebaseUser;
      try {
        firebaseUser = await createUserWithEmailAndPassword(auth, kakaoEmail, tempPassword);
      } catch (err: any) {
        if (err.code === 'auth/email-already-in-use') {
          setError('이미 가입된 카카오톡 계정입니다.');
          return;
        }
        throw err;
      }

      // 2. 사용자 승인 대기 데이터 생성
      const approvalData = {
        firebaseUid: firebaseUser.user.uid,
        kakaoId: kakaoUser.id.toString(),
        kakaoNickname: kakaoUser.kakao_account?.profile?.nickname || '',
        kakaoEmail: kakaoUser.kakao_account?.email || '',
        realName: realName.trim(),
        employeeId: inviteData.employeeId,
        employeeName: inviteData.employeeName,
        inviteToken: inviteData.token,
        status: 'pending', // pending, approved, rejected
        createdAt: new Date(),
      };

      await addDoc(collection(db, 'userApprovals'), approvalData);

      // 3. 초대링크 상태를 'used'로 변경
      const inviteDoc = doc(db, 'invitations', inviteData.id);
      await updateDoc(inviteDoc, {
        status: 'used',
        usedAt: new Date(),
      });

      // 4. 직원 데이터에 Firebase UID 연결 (나중에 승인되면 업데이트)
      const employeeDoc = doc(db, 'employees', inviteData.employeeId);
      // 여기서는 아직 승인 전이므로 임시로 저장하지 않음
      // 승인 시 업데이트

      setStep('complete');
    } catch (err: any) {
      console.error('가입 오류:', err);
      setError(`가입에 실패했습니다: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'verify') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">초대링크 확인 중...</h2>
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (step === 'complete') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">가입 신청 완료</h2>
            <p className="text-gray-600 mb-6">
              가입 신청이 완료되었습니다.<br />
              관리자 승인 후 로그인할 수 있습니다.
            </p>
            <button
              onClick={() => router.push('/work-schedule')}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 font-medium"
            >
              로그인 페이지로 이동
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'kakao') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">카카오톡 가입</h2>
            <p className="text-sm text-gray-600 mb-4">
              {inviteData?.employeeName}님을 위한 초대링크입니다.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 mb-4">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <p className="text-gray-700 text-center">
                카카오톡으로 로그인하여 가입을 진행해주세요.
              </p>
              <button
                onClick={handleKakaoLogin}
                disabled={loading}
                className="w-full bg-yellow-400 text-black py-3 px-4 rounded-lg hover:bg-yellow-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <span>카카오톡 로그인</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'name') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">실명 입력</h2>
            <p className="text-sm text-gray-600 mb-4">
              가입을 위해 실명을 입력해주세요.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  실명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="실명을 입력하세요"
                  value={realName}
                  onChange={(e) => setRealName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  required
                />
                <p className="mt-2 text-sm text-gray-500">
                  입력하신 실명은 직원 관리 데이터와 연결됩니다.
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">카카오톡 정보:</p>
                <p className="text-sm font-medium">
                  {kakaoUser?.kakao_account?.profile?.nickname || '정보 없음'}
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !realName.trim()}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '가입 중...' : '가입 신청'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

