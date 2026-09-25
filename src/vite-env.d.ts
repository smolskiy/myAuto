/// <reference types="vite/client" />
/** Время сборки (ISO), подставляет vite.config.ts. */
declare const __BUILD_TIME__: string
interface ImportMetaEnv {
  readonly VITE_BASE?: string
  readonly VITE_YANDEX_CLIENT_ID?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
