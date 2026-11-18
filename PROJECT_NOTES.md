# 페이지 구성 기준

- 사용자가 별도로 변경을 요청하기 전까지 새 작업은 모두 3주차에 추가한다.
- 1주차: 기존 다섯 페이지 (`first`~`fifth`).
- 2주차: 글자 비 게임 (`sixth`), 인형뽑기 (`seventh`), 회사 (`eighth`).
- 3주차: 예제 08 Ninja Fruit Slash (`ninth`), 예제 09 Snow (`tenth`), 자유 예제 합창단 (`eleventh`).
- 사용자가 요청하기 전까지 개발 서버를 실행하지 않는다. 검증은 빌드와 서버가 필요 없는 테스트로 진행한다.

- 회사 멀티플레이는 `npm run company`로 빌드 결과와 WebSocket을 4173 포트에서 함께 제공한다. 사용자가 요청하기 전까지 실행하지 않는다.
- `npm run dev`는 `.certs/`의 mkcert 인증서를 사용해 LAN HTTPS(기본 5173 포트)로 실행한다. 인증서·키는 public 밖에 보관하고 Git과 Vite 파일 제공에서 제외한다. IP가 바뀌면 `npm run certs`로 재발급한다. 접속 기기의 루트 인증서 신뢰 등록과 카메라 권한은 `HTTPS_DEV.md`를 참고한다.

- 작업 폴더는 `/Users/choihayoung/Documents/notefolio/noteFolio_practice`로 변경했다. GitHub 비공개 저장소는 `HayoungCH00I/noteFolio_practice`, 기본 브랜치는 `main`이다. 이전 `vs code` 경로를 사용하지 않는다.
