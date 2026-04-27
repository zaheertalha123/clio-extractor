/// <reference types="vite/client" />

interface SplashApi {
  onLog: (callback: (line: string) => void) => void
  onStatus: (callback: (text: string) => void) => void
}

declare global {
  interface Window {
    splashApi: SplashApi
  }
}

export {}
