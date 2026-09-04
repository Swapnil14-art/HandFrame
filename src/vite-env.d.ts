/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FILTER_EDITOR_PATH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
