import type { ProxyConfiguration } from './proxy-configuration.value-object';

export interface NetworkIdentity {
  proxy: ProxyConfiguration;
  networkKillSwitch: boolean;
}
