import {
  PlaywrightProvisioningBrowserProvider,
  ResolvedProvisioningBrowserLauncher,
} from "./provisioning-browser-provider";

export class PlaywrightProvisioningBrowserLauncher extends ResolvedProvisioningBrowserLauncher {
  public constructor() {
    super(new PlaywrightProvisioningBrowserProvider());
  }
}
