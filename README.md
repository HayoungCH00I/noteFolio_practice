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

## GitHub Pages 배포

배포 주소는 https://hayoungch00i.github.io/noteFolio_practice/ 입니다. 첫 배포가 성공한 뒤 접속할 수 있습니다.

1. GitHub 저장소의 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 선택합니다. GitHub Free 계정에서는 저장소를 Public으로 설정해야 합니다.
2. 이 설정 파일들을 포함한 변경 사항을 GitHub Desktop에서 Commit한 뒤 **Push origin**으로 `main`에 올립니다.
3. GitHub의 **Actions → Deploy to GitHub Pages**에서 `build`와 `deploy`가 모두 성공했는지 확인합니다. 이후 `main`에 올릴 때마다 자동으로 다시 배포됩니다.
4. **Settings → Pages → Visit site**에서 실제 배포 주소를 확인합니다. 이미 파일을 올린 뒤 Pages를 설정했다면 **Actions → Deploy to GitHub Pages → Run workflow**에서 `main`을 선택해 실행합니다.

`.github/workflows/deploy-pages.yml`이 Node.js 24에서 `npm ci`와 `npm run build`를 실행하고 `dist/`만 배포합니다. 별도 토큰이나 개발용 인증서를 등록할 필요는 없습니다.

자동 배포는 `GITHUB_PAGES=true` 환경 변수로 `vite.config.mjs`의 `base`를 `/noteFolio_practice/`로 지정합니다. 이미지·글꼴·작업용 스레드·카메라 모델·음악은 이 배포 경로를 따릅니다. 일반 로컬 개발·빌드·회사 서버는 기존 `/` 경로를 유지합니다. 저장소 이름을 바꾸거나 별도 도메인을 연결하면 Pages용 `base`도 해당 주소에 맞게 변경해야 합니다. 화면 이동은 `#` 주소를 사용하므로 개별 화면을 새로고침해도 같은 사이트로 열립니다.

```sh
GITHUB_PAGES=true npm run build
GITHUB_PAGES=true npm run preview -- --host 127.0.0.1
# http://127.0.0.1:4173/noteFolio_practice/
```

GitHub Pages는 HTML·이미지 같은 파일을 제공하는 서비스입니다. **회사 멀티플레이는 별도 WebSocket 서버가 필요해 Pages에서 접속할 수 없습니다.** 이 기능은 기존 `npm run company` 서버를 사용합니다. 카메라 기능은 Pages의 HTTPS 주소에서 브라우저의 카메라 권한을 허용해야 사용할 수 있습니다.

공식 안내: [Vite의 GitHub Pages 배포](https://vite.dev/guide/static-deploy.html#github-pages), [GitHub Pages 게시 방식 설정](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## 관련 문서

- [주차와 작업 기준](PROJECT_NOTES.md)
- [합창단 사용 방법](CHOIR.md)
- [HTTPS 접속과 인증서 설치](HTTPS_DEV.md)
- [다음 대화를 위한 인수인계](docs/HANDOFF_합창단_로컬HTTPS.md)

회사 멀티플레이의 별도 서버는 `npm run company`로 실행하며 기본 포트는 4173입니다. 자세한 연결 설정은 프로젝트 문서를 확인하세요.
