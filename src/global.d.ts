import type { DevVaultApi, WindowControls } from './preload';

declare global {
  interface Window {
    devVaultApi: DevVaultApi;
    windowControls: WindowControls;
  }

  const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
  const MAIN_WINDOW_VITE_NAME: string;
}

declare module '*.css';