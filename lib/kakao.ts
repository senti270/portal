// 카카오톡 SDK 초기화 및 유틸리티 함수

declare global {
  interface Window {
    Kakao: any;
  }
}

export const initKakao = () => {
  if (typeof window !== 'undefined' && window.Kakao) {
    if (!window.Kakao.isInitialized()) {
      const kakaoAppKey = process.env.NEXT_PUBLIC_KAKAO_APP_KEY;
      if (kakaoAppKey) {
        window.Kakao.init(kakaoAppKey);
        console.log('✅ 카카오 SDK 초기화 완료');
      } else {
        console.warn('⚠️ NEXT_PUBLIC_KAKAO_APP_KEY가 설정되지 않았습니다.');
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

    window.Kakao.Auth.login({
      success: (authObj: any) => {
        resolve(authObj);
      },
      fail: (err: any) => {
        reject(err);
      },
    });
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

