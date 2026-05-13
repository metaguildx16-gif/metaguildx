/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SYSTEM_PROXY_ADDRESS?: string;
  readonly VITE_USDT_ADDRESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  ethereum?: unknown;
}
