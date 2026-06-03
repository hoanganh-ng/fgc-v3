import type { BrowserCookie } from './browser-cookie.value-object.js';

export interface AuthSessionState {
  cookies: BrowserCookie[];
  localStorageSnapshot: string | null;
}
