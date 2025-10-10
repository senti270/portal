# 할일 위젯 (TODO Widget) for Android

Portal의 할일 목록을 Android 홈 화면 위젯으로 표시하는 앱입니다.

## 📱 기능

- ✅ Android 홈 화면 위젯으로 할일 표시 (최대 3개)
- ✅ 앱 내에서 전체 할일 목록 확인
- ✅ 자동 업데이트 (30분마다)
- ✅ 수동 새로고침 지원
- ✅ 비밀번호 인증 (43084308)
- ✅ API: https://www.cdcdcd.kr/api/widget/todos

## 🚀 빌드 방법

### 1. Flutter 설치

Flutter가 설치되어 있지 않다면:
1. https://flutter.dev/docs/get-started/install 에서 Flutter SDK 다운로드
2. PATH 환경 변수에 Flutter bin 디렉토리 추가
3. `flutter doctor` 실행하여 설치 확인

### 2. 프로젝트 설정

```bash
cd todo_widget
flutter pub get
```

### 3. Android APK 빌드

#### Debug APK (테스트용)
```bash
flutter build apk --debug
```
생성된 APK 위치: `build/app/outputs/flutter-apk/app-debug.apk`

#### Release APK (배포용)
```bash
flutter build apk --release
```
생성된 APK 위치: `build/app/outputs/flutter-apk/app-release.apk`

### 4. APK 설치

생성된 APK 파일을 Android 기기로 전송하고 설치:
- USB 연결 후 복사
- 또는 이메일/클라우드로 전송
- 기기에서 APK 파일 실행하여 설치

## 📲 사용 방법

### 앱 사용
1. 앱 실행
2. 비밀번호 입력: `43084308`
3. 할일 목록 확인
4. "위젯 업데이트" 버튼으로 수동 새로고침

### 위젯 추가
1. 홈 화면 길게 누르기
2. 위젯 선택
3. "할일 위젯" 찾기
4. 원하는 위치에 드래그

## 🔧 커스터마이징

### API 엔드포인트 변경
`lib/main.dart` 파일에서:
```dart
Uri.parse('https://www.cdcdcd.kr/api/widget/todos?password=$password')
```

### 비밀번호 변경
`lib/main.dart` 파일에서:
```dart
if (password == '43084308')
```

### 위젯 디자인 변경
`android/app/src/main/res/layout/todo_widget.xml` 파일 수정

## 📦 필요한 사항

### Android 개발 환경
- Android Studio 설치
- Android SDK 설치
- Java JDK 11 이상

### Flutter 개발 환경
- Flutter SDK 3.0.0 이상
- Dart SDK

## 🎨 위젯 디자인

- 배경: 흰색 (둥근 모서리)
- 제목: "할일 N개"
- 할일 표시: 최대 3개
- 포맷: "□ 할일내용 - 요청자"
- 하단: "앱에서 더보기 →"

## 🔄 자동 업데이트

위젯은 30분마다 자동으로 업데이트됩니다.
수동 업데이트는 앱에서 "위젯 업데이트" 버튼을 누르면 됩니다.

## 🐛 문제 해결

### 위젯이 업데이트되지 않을 때
1. 앱을 열어서 "위젯 업데이트" 버튼 클릭
2. 위젯 삭제 후 다시 추가
3. 앱 재설치

### 빌드 오류
```bash
flutter clean
flutter pub get
flutter build apk
```

## 📝 라이선스

MIT License

