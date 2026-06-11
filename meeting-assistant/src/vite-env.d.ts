/// <reference types="vite/client" />

import type { ObserverAPI } from './types';

declare global {
  interface Window {
    observerAPI?: ObserverAPI;
  }
}
