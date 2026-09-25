/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_BASE?: string
  readonly VITE_YANDEX_CLIENT_ID?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
