import type { VaultNookApi, WindowControls } from './preload';

declare global {
  interface Window {
    vaultNookApi: VaultNookApi;
    windowControls: WindowControls;
  }
}

declare module '*.css';