import type { BrowserCookie } from './browser-cookie.value-object';

export interface AuthSessionState {
  cookies: BrowserCookie[];
  localStorageSnapshot: string | null;
}
