# 로컬 네트워크 HTTPS 실행

이 PC의 현재 LAN IP는 `172.30.1.23`입니다. mkcert를 설치했고, `localhost`, `127.0.0.1`, `::1`, `172.30.1.23`이 포함된 개발 인증서를 생성했습니다. 개발 서버는 실행하지 않았습니다.

## 이 Mac에서 실행

터미널에서 아래 명령을 실행합니다. 첫 번째 명령은 인증서를 신뢰하도록 등록하는 작업으로, 관리자 비밀번호를 입력해야 합니다. 자동 설정 중에는 비밀번호 입력이 불가능해 이 단계가 완료되지 않았습니다. 한 번 등록하면 매번 실행할 필요가 없습니다.

```sh
mkcert -install
npm run dev
```

Vite가 `0.0.0.0`에서 HTTPS로 수신합니다. 기본 포트는 5173이며, 터미널의 `Network`에 다음 형태의 주소가 표시됩니다.

```text
https://172.30.1.23:5173/
```

이 주소를 같은 공유기의 Wi-Fi 또는 유선 LAN에 연결된 사람에게 공유하세요. 5173 포트를 다른 프로그램이 사용 중이면 Vite가 다음 포트를 선택하므로 **실제 `Network`에 출력되는 주소**를 공유합니다. 브라우저는 자동으로 열지 않습니다. 자신의 PC에서는 `https://localhost:5173/`도 사용할 수 있습니다.

## 접속하는 PC에서 인증서 경고가 뜰 때

**설치 과정을 자동화한 ZIP도 사용할 수 있습니다.** 개발 PC에서 `npm run certs:clients`를 실행하면 `.certs/client-setup.zip`을 만듭니다. 상대방에게 이 ZIP을 전달하고, 압축을 완전히 푼 뒤 Mac은 `Mac-HTTPS-Setup.command`, Windows는 `Windows-HTTPS-Setup.cmd`를 실행하도록 안내하세요. 설치 파일이 공개 루트 인증서의 무결성을 확인하고 신뢰 등록 후 공유 주소를 엽니다. 상대방은 Node.js나 mkcert를 설치할 필요가 없습니다. OS가 요청하는 관리자 비밀번호·보안 승인은 상대방이 직접 처리합니다.

Windows는 현재 사용자 계정의 루트 인증서 저장소에, Mac은 관리자 승인을 거쳐 시스템 키체인에 등록합니다. 설치 뒤 기존 브라우저에서 경고가 남으면 완전히 종료했다 다시 엽니다. 실제 기기의 보안 정책에 따라 실행이 차단되면 아래 수동 설치 방법을 사용하거나 기기 관리자에게 문의하세요. 인증서 설치는 처음 한 번이며, 페이지의 카메라 접근 허용은 별도로 필요합니다.

ZIP에는 공개 인증서, 두 운영체제용 설치 파일, 사용 안내만 넣습니다. ZIP과 개별 설치 파일도 `.certs/` 안에 두어 Git과 웹 제공에서 제외합니다. 설치 파일을 만드는 명령은 서버 실행·인증서 설치를 하지 않습니다. 기본 공유 주소는 현재 LAN IP의 5173 포트입니다. Vite가 다른 포트를 출력하면 `npm run certs:clients -- https://172.30.1.23:5174/`처럼 실제 Network 주소를 지정해 ZIP을 다시 만들 수 있습니다. 이 ZIP 생성 명령은 현재 개발 PC인 macOS에서 실행합니다.

개발용 인증서는 각 접속 기기에서 이 프로젝트의 발급 기관을 신뢰하도록 등록해야 합니다. 개발 PC의 `.certs/rootCA.pem` **한 파일만** USB·AirDrop 등으로 전달하세요. `dev-key.pem`이나 mkcert CA 폴더의 `rootCA-key.pem`은 전달하지 않습니다. mkcert가 없는 접속 PC도 OS의 인증서 관리 화면에서 루트 인증서를 가져올 수 있습니다. [mkcert 공식 안내](https://github.com/FiloSottile/mkcert#installing-the-ca-on-other-systems)

- **Mac:** 키체인 접근에서 `rootCA.pem`을 가져온 뒤, 해당 mkcert 루트 인증서를 열고 ‘신뢰 → 이 인증서 사용 시 → 항상 신뢰’를 선택합니다. 비밀번호 입력 후 저장합니다. [Apple 안내](https://support.apple.com/guide/keychain-access/change-the-trust-settings-of-a-certificate-kyca11871/mac)
- **Windows:** `certmgr.msc`를 열고 ‘신뢰할 수 있는 루트 인증 기관 → 인증서 → 모든 작업 → 가져오기’에서 `rootCA.pem`을 가져옵니다. 파일이 목록에 보이지 않으면 파일 유형을 ‘모든 파일’로 바꿉니다. [Microsoft 안내](https://learn.microsoft.com/en-us/windows-hardware/drivers/install/trusted-root-certification-authorities-certificate-store)
- **Firefox:** OS에 등록해도 경고가 남으면 Firefox 인증서 관리자에서 인증 기관으로 `rootCA.pem`을 가져와 웹사이트 식별을 신뢰하도록 설정합니다.

등록 후 브라우저를 완전히 종료했다 다시 열고 HTTPS 주소로 접속하세요. 경고 화면에서 임시로 ‘계속 진행’만 누르는 방식보다 정상적인 인증서 신뢰 등록을 권장합니다. 이 인증서는 이 개발 프로젝트를 확인할 기기에만 등록합니다.

## 카메라가 차단될 때

1. 주소가 `http://`가 아닌 **`https://`**인지 확인합니다.
2. 위 절차로 인증서 경고를 해결한 뒤 새로고침합니다.
3. 주소창의 사이트 설정에서 카메라를 ‘허용’하고, OS 개인정보 설정에서도 사용하는 브라우저의 카메라 접근을 허용합니다.
4. 다른 앱에서 카메라를 독점하고 있다면 종료한 뒤 페이지의 카메라 켜기를 다시 누릅니다.

카메라 API에는 신뢰할 수 있는 HTTPS 환경과 사용자의 카메라 권한이 필요합니다. [MDN 안내](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia#privacy_and_security)

## IP 변경·접속 실패

- 공유기나 Wi-Fi가 바뀌어 IP가 달라졌으면 서버를 중지하고 `npm run certs`로 새 IP를 포함해 재발급한 뒤 `npm run dev`로 다시 실행합니다. 이 명령은 현재 활성 인터페이스의 IPv4를 자동으로 포함하며 서버를 실행하지 않습니다. 발급 기관이 그대로라면 접속 기기의 루트 인증서를 다시 등록할 필요는 없습니다.
- 같은 LAN인데 연결 자체가 안 되면 공유기의 게스트 Wi-Fi·기기 간 통신 차단과 개발 PC 방화벽의 Node.js 수신 허용을 확인합니다. 이 주소는 인터넷 전체에 공개되는 주소가 아닙니다.

## 파일과 기존 기능

`.certs/dev-cert.pem`은 서버 인증서, `.certs/dev-key.pem`은 비밀키, `.certs/rootCA.pem`은 접속 기기에 전달할 공개 루트 인증서입니다. 폴더는 권한 700, 비밀키는 600으로 제한합니다. `.gitignore`와 Vite 파일 접근 제한에서 제외했고 `public`과 `dist`에는 복사하지 않습니다. CA 비밀키는 mkcert의 사용자 데이터 폴더에 보관하며 프로젝트에 복사하지 않습니다.

기존 오디오 준비 스크립트, 빌드, ES 형식의 MediaPipe 워커, 회사 WebSocket 플러그인을 유지합니다. 회사는 HTTPS 접속 시 기존 코드에서 자동으로 `wss://`를 사용합니다. `npm run build`와 기존 미리보기는 개발 인증서 없이도 동작하도록 유지했습니다. `npm run company`의 별도 4173 서버 설정은 바꾸지 않았습니다.
