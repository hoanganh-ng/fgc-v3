import type { ProxyConfiguration } from './proxy-configuration.value-object.js';

export interface NetworkIdentity {
  proxy: ProxyConfiguration;
  networkKillSwitch: boolean;
}
