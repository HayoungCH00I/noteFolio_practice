# noteFolio_practice

Vite + vanilla TypeScript로 만든 인터랙션 실습 프로젝트입니다. React나 Vue 없이 Canvas, Three.js, MediaPipe와 Web Audio를 사용합니다.

- **1주차:** 밤과 낮, 뽁뽁이, 우사기, 나만의 페이지, 고양이
- **2주차:** 글자 비 게임, 인형뽑기, 회사 멀티플레이
- **3주차:** Ninja Fruit Slash, Snow, 합창단

## 개발 환경 준비

macOS 기준입니다. 프로젝트 폴더에서 아래 명령을 실행합니다. mkcert는 이미 설치되어 있다면 다시 설치할 필요가 없습니다.

```sh
npm install
brew install mkcert
mkcert -install
npm run certs
npm run dev
```

개발 서버는 기본 5173 포트의 HTTPS로 실행됩니다. 터미널의 `Network` 주소를 같은 로컬 네트워크의 기기에 공유합니다. 다른 PC에서 카메라를 사용하려면 개발 인증서의 신뢰 등록과 카메라 권한 허용이 필요합니다.

```sh
# 접속자용 Mac·Windows 인증서 설치 ZIP 만들기
npm run certs:clients

# 전체 검사 및 빌드
npm test
npm run build
```

인증서·비밀키와 접속자용 ZIP이 들어 있는 `.certs/`, 설치된 패키지 `node_modules/`, 빌드 결과 `dist/`는 Git에 포함하지 않습니다. 새로 받은 프로젝트에서는 자신의 개발 인증서를 생성해야 합니다.

## 관련 문서

- [주차와 작업 기준](PROJECT_NOTES.md)
- [합창단 사용 방법](CHOIR.md)
- [HTTPS 접속과 인증서 설치](HTTPS_DEV.md)
- [다음 대화를 위한 인수인계](docs/HANDOFF_합창단_로컬HTTPS.md)

회사 멀티플레이의 별도 서버는 `npm run company`로 실행하며 기본 포트는 4173입니다. 자세한 연결 설정은 프로젝트 문서를 확인하세요.
