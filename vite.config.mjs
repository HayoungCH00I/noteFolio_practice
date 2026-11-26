import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'
import { attachCompanySocket } from './server/company-socket.mjs'

function developmentHttps() {
  try {
    return {
      cert: readFileSync(new URL('./.certs/dev-cert.pem', import.meta.url)),
      key: readFileSync(new URL('./.certs/dev-key.pem', import.meta.url)),
    }
  } catch (error) {
    throw new Error('HTTPS 개발 인증서가 없어요. mkcert 설치 후 npm run certs를 실행해 주세요.', { cause: error })
  }
}

export default defineConfig(({ command, isPreview }) => ({
  base: process.env.GITHUB_PAGES === 'true' ? '/noteFolio_practice/' : '/',
  worker: { format: 'es' },
  server: {
    host: isPreview ? undefined : '0.0.0.0',
    port: 5173,
    open: false,
    https: command === 'serve' && !isPreview ? developmentHttps() : undefined,
    fs: {
      deny: ['.env', '.env.*', '*.{crt,pem,key,p12,pfx,cer,der}', '.npmrc', '.yarnrc.yml', '**/.git/**', '**/.certs/**'],
    },
  },
  plugins: [{
    name: 'company-local-multiplayer',
    configureServer(server) {
      if (server.httpServer) attachCompanySocket(server.httpServer)
    },
    configurePreviewServer(server) {
      if (server.httpServer) attachCompanySocket(server.httpServer)
    },
  }],
}))
