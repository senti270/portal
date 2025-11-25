# Flutter 설치 가이드 (Windows)

## 📋 시스템 요구사항

- Windows 10 이상 (64-bit)
- 디스크 공간: 2.5 GB 이상
- Git for Windows
- PowerShell 5.0 이상

## 🔧 1단계: Flutter SDK 다운로드

### 방법 1: 직접 다운로드 (권장)

1. **Flutter SDK 다운로드**
   - https://docs.flutter.dev/get-started/install/windows 접속
   - "Download Flutter SDK" 버튼 클릭
   - 또는 직접 다운로드: https://storage.googleapis.com/flutter_infra_release/releases/stable/windows/flutter_windows_3.24.5-stable.zip

2. **압축 해제**
   - 다운로드한 zip 파일을 원하는 위치에 압축 해제
   - 추천 위치: `C:\src\flutter` (공백 없는 경로)
   - ⚠️ `C:\Program Files\` 같은 권한이 필요한 곳은 피하세요

### 방법 2: Git Clone

```powershell
cd C:\src
git clone https://github.com/flutter/flutter.git -b stable
```

## 🌍 2단계: 환경 변수 설정

### PowerShell에서 설정 (관리자 권한 필요 없음)

1. **시스템 환경 변수 열기**
   ```
   Win + R → sysdm.cpl → 고급 탭 → 환경 변수
   ```

2. **사용자 변수의 Path 편집**
   - "사용자 변수" 섹션에서 `Path` 선택
   - "편집" 클릭
   - "새로 만들기" 클릭
   - Flutter bin 경로 추가: `C:\src\flutter\bin`
   - "확인" 클릭

3. **PowerShell 재시작**
   - 모든 PowerShell 창 닫기
   - 새 PowerShell 창 열기

4. **설치 확인**
   ```powershell
   flutter --version
   ```

## 🩺 3단계: Flutter Doctor 실행

```powershell
flutter doctor
```

이 명령어는 Flutter 개발 환경의 상태를 확인합니다.

### 예상 출력:
```
Doctor summary (to see all details, run flutter doctor -v):
[✓] Flutter (Channel stable, 3.24.5, on Microsoft Windows)
[✗] Android toolchain - develop for Android devices
    ✗ Unable to locate Android SDK
[✗] Chrome - develop for the web
[✗] Visual Studio - develop Windows apps
[✓] VS Code (version 1.x.x)
[!] Connected device
```

## 📱 4단계: Android 개발 환경 설정

### Android Studio 설치

1. **Android Studio 다운로드**
   - https://developer.android.com/studio
   - "Download Android Studio" 클릭

2. **설치 진행**
   - 설치 프로그램 실행
   - 기본 설정으로 설치 (모두 체크)
   - Android SDK, Android SDK Platform, Android Virtual Device 모두 선택

3. **Android Studio 최초 실행**
   - Welcome 화면에서 "More Actions" → "SDK Manager" 클릭
   - "SDK Tools" 탭 선택
   - 다음 항목들 체크:
     - ✅ Android SDK Build-Tools
     - ✅ Android SDK Command-line Tools
     - ✅ Android Emulator
     - ✅ Android SDK Platform-Tools
   - "Apply" 클릭하여 설치

4. **Flutter 플러그인 설치**
   - Android Studio 재시작
   - "Plugins" → "Marketplace" 검색: "Flutter"
   - "Install" 클릭
   - Android Studio 재시작

### Android 라이선스 동의

```powershell
flutter doctor --android-licenses
```
- 모든 라이선스에 `y` 입력

## 🎯 5단계: 최종 확인

```powershell
flutter doctor
```

### 모든 항목이 ✓ 표시되어야 합니다:
```
[✓] Flutter (Channel stable, 3.24.5)
[✓] Android toolchain - develop for Android devices (Android SDK version 34.0.0)
[✓] Chrome - develop for the web
[✓] Android Studio (version 2024.1)
[✓] VS Code (version 1.x.x)
[✓] Connected device (1 available)
[✓] Network resources
```

## 🏗️ 6단계: APK 빌드

### 프로젝트 디렉토리로 이동
```powershell
cd C:\Users\senti_czpx8a3\OneDrive\cursor_project\portal\todo_widget
```

### 의존성 설치
```powershell
flutter pub get
```

### Debug APK 빌드 (테스트용)
```powershell
flutter build apk --debug
```

### Release APK 빌드 (배포용)
```powershell
flutter build apk --release
```

### APK 위치
```
todo_widget\build\app\outputs\flutter-apk\app-release.apk
```

## 📲 7단계: APK 설치

1. **생성된 APK를 Android 기기로 전송**
   - USB 케이블로 연결
   - 또는 이메일/클라우드로 전송

2. **기기에서 설치**
   - 파일 관리자에서 APK 파일 찾기
   - 터치하여 설치
   - "알 수 없는 출처" 허용 필요할 수 있음

## 🐛 문제 해결

### Flutter 명령어가 인식되지 않을 때
```powershell
# PATH 확인
echo $env:PATH

# Flutter 경로 임시 추가
$env:PATH += ";C:\src\flutter\bin"
```

### Android SDK를 찾을 수 없을 때
```powershell
# Android SDK 위치 설정
flutter config --android-sdk C:\Users\YOUR_USERNAME\AppData\Local\Android\Sdk
```

### Visual Studio 관련 경고 (Windows 앱 개발 안 할 경우)
- 무시해도 됩니다 (Android만 빌드할 거라면)

### Chrome 관련 경고 (웹 앱 개발 안 할 경우)
- 무시해도 됩니다 (Android만 빌드할 거라면)

## ⏱️ 전체 설치 시간

- Flutter SDK 다운로드: 5-10분
- Android Studio 다운로드 및 설치: 15-20분
- Android SDK 구성요소 다운로드: 10-15분
- **총 소요 시간: 약 30-45분**

## 📚 추가 리소스

- Flutter 공식 문서: https://docs.flutter.dev
- Flutter 커뮤니티: https://flutter.dev/community
- Flutter Packages: https://pub.dev

## ✅ 빠른 체크리스트

- [ ] Flutter SDK 다운로드 및 압축 해제
- [ ] 환경 변수 PATH에 flutter\bin 추가
- [ ] `flutter doctor` 실행
- [ ] Android Studio 설치
- [ ] Android SDK 구성요소 설치
- [ ] Flutter 플러그인 설치
- [ ] `flutter doctor --android-licenses` 실행
- [ ] `flutter pub get` 실행
- [ ] `flutter build apk --release` 실행
- [ ] APK를 Android 기기로 전송 및 설치

---

설치 중 문제가 발생하면 `flutter doctor -v`를 실행하여 자세한 정보를 확인하세요!






