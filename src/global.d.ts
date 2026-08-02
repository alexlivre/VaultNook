import type { DevVaultApi, WindowControls } from './preload';

declare global {
  interface Window {
    devVaultApi: DevVaultApi;
    windowControls: WindowControls;
  }
}

declare module '*.css';