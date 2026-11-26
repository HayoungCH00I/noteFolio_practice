# 페이지 구성 기준

- 사용자가 별도로 변경을 요청하기 전까지 새 작업은 모두 3주차에 추가한다.
- 1주차: 기존 다섯 페이지 (`first`~`fifth`).
- 2주차: 글자 비 게임 (`sixth`), 인형뽑기 (`seventh`), 회사 (`eighth`).
- 3주차: 예제 08 Ninja Fruit Slash (`ninth`), 예제 09 Snow (`tenth`), 자유 예제 합창단 (`eleventh`).
- 4주차: 고무 인간 (`twelfth`), MineCraft (`thirteenth`), 포켓몬스터 : 트레이너들의 역습 (`fourteenth`), 자세 통과 (`fifteenth`).
- 사용자가 요청하기 전까지 개발 서버를 실행하지 않는다. 검증은 빌드와 서버가 필요 없는 테스트로 진행한다.

- 회사 멀티플레이는 `npm run company`로 빌드 결과와 WebSocket을 4173 포트에서 함께 제공한다. 사용자가 요청하기 전까지 실행하지 않는다.
- `npm run dev`는 `.certs/`의 mkcert 인증서를 사용해 LAN HTTPS(기본 5173 포트)로 실행한다. 인증서·키는 public 밖에 보관하고 Git과 Vite 파일 제공에서 제외한다. IP가 바뀌면 `npm run certs`로 재발급한다. 접속 기기의 루트 인증서 신뢰 등록과 카메라 권한은 `HTTPS_DEV.md`를 참고한다.

- 작업 폴더는 `/Users/choihayoung/Documents/notefolio/noteFolio_practice`로 변경했다. GitHub 비공개 저장소는 `HayoungCH00I/noteFolio_practice`, 기본 브랜치는 `main`이다. 이전 `vs code` 경로를 사용하지 않는다.

## 최종 QA 대기

- 자세 통과를 4주차로 옮긴 뒤 전체 테스트와 브라우저 메뉴 진입 검증을 보류했다.
- 자세 통과 전·후면 카메라 전환 후 전체 테스트, 브라우저 화면 검증, 아이폰·갤럭시 실기기 전환 검증을 보류했다.
- 자세 통과의 사진 참고 랜덤 자세와 1·2인 모드 적용 후, 브라우저 화면과 실제 전신 판정·2인 협동 플레이 검증을 보류했다.
- 자세 통과의 반투명 벽, 3D 안내 캐릭터, 인식 재시도 적용 후 전체 브라우저 및 실기기 QA를 보류했다. 휴대폰 전·후면 실영상으로 인물 윤곽과 구멍의 합성, 2인 상태색과 판정, 연습 후 점수 반영을 확인한다.
- 자세 통과 안내 마네킹을 Spline에서 모델링하고 게임에 단일 변형 메시로 연결했다. 전신 아홉 자세의 브라우저 모션 검증과 모바일 실제 플레이를 최종 QA에서 확인한다.
- 자세 통과 안내 캐릭터를 MakeHuman의 CC0 hm08 성인 남성형 비율을 바탕으로 교체했다. 흉곽과 골반 앞면은 중성적인 실루엣이 되도록 평탄화했다. [기본 메시](https://github.com/makehumancommunity/makehuman/blob/master/makehuman/data/3dobjs/base.obj)와 [공식 관절 가중치](https://github.com/makehumancommunity/makehuman/blob/master/makehuman/data/rigs/default_weights.mhw)를 게임용 14개 관절로 정리한 에셋은 `src/assets/pose-wall-human.glb`에 있다. 게임 브라우저에서 자세별 손발 모양과 상태색 가독성을 최종 QA에서 확인한다.
