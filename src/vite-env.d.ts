/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional self-hosted path for @imgly/background-removal resources (must end with "/"). */
  readonly VITE_IMGLY_PUBLIC_PATH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
