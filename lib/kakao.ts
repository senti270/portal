// 카카오톡 SDK 초기화 및 유틸리티 함수

declare global {
  interface Window {
    Kakao: any;
  }
}

export const initKakao = () => {
  if (typeof window !== 'undefined' && window.Kakao) {
    if (!window.Kakao.isInitialized()) {
      // JavaScript SDK는 JavaScript 키를 사용해야 합니다
      // 환경 변수가 없으면 기존 REST API 키 변수도 확인 (하위 호환성)
      const kakaoJsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY || process.env.NEXT_PUBLIC_KAKAO_APP_KEY;
      if (kakaoJsKey) {
        window.Kakao.init(kakaoJsKey);
        console.log('✅ 카카오 SDK 초기화 완료');
      } else {
        console.warn('⚠️ NEXT_PUBLIC_KAKAO_JS_KEY 또는 NEXT_PUBLIC_KAKAO_APP_KEY가 설정되지 않았습니다.');
      }
    }
  }
};

export const loadKakaoSDK = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('브라우저 환경이 아닙니다.'));
      return;
    }

    if (window.Kakao && window.Kakao.isInitialized()) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://developers.kakao.com/sdk/js/kakao.js';
    script.async = true;
    script.onload = () => {
      initKakao();
      resolve();
    };
    script.onerror = () => {
      reject(new Error('카카오 SDK 로드 실패'));
    };
    document.head.appendChild(script);
  });
};

export const loginWithKakao = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (!window.Kakao || !window.Kakao.isInitialized()) {
      reject(new Error('카카오 SDK가 초기화되지 않았습니다.'));
      return;
    }

    try {
      window.Kakao.Auth.login({
        success: (authObj: any) => {
          resolve(authObj);
        },
        fail: (err: any) => {
          console.error('카카오 로그인 실패:', err);
          
          // KOE004 에러 처리
          if (err.error === 'KOE004' || err.error_code === 'KOE004') {
            reject(new Error('KOE004: 카카오 개발자 콘솔에서 앱 관리자를 설정해주세요. 관리자에게 문의하세요.'));
          } else {
            reject(new Error(err.error || err.error_description || '카카오 로그인에 실패했습니다.'));
          }
        },
        // 닉네임만 요청 (프로필 사진, 이메일 제외)
        scope: 'profile_nickname',
      });
    } catch (error: any) {
      reject(new Error(error.message || '카카오 로그인 중 오류가 발생했습니다.'));
    }
  });
};

export const getKakaoUserInfo = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (!window.Kakao || !window.Kakao.isInitialized()) {
      reject(new Error('카카오 SDK가 초기화되지 않았습니다.'));
      return;
    }

    window.Kakao.API.request({
      url: '/v2/user/me',
      success: (response: any) => {
        resolve(response);
      },
      fail: (err: any) => {
        reject(err);
      },
    });
  });
};

export const logoutKakao = () => {
  if (window.Kakao && window.Kakao.isInitialized()) {
    window.Kakao.Auth.logout(() => {
      console.log('카카오 로그아웃 완료');
    });
  }
};

