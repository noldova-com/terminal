/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentValidator, Resources as ProtocolResources } from "@noldova/terminal.protocol";

import { Resources } from "../resources.ts";

export class VisualStudioInstallation {
  public readonly instanceId: string;
  public readonly name: string;
  public readonly path: string;

  public constructor(instanceId: string, name: string, path: string) {
    ArgumentValidator.requireIdentifier(Resources.visualStudioInstallationInstanceIdField, instanceId);
    ArgumentValidator.requireNonBlank(Resources.visualStudioInstallationNameField, name, ProtocolResources.maximumNameLength);
    ArgumentValidator.requireNonBlank(Resources.visualStudioInstallationPathField, path, ProtocolResources.maximumPathLength);

    this.instanceId = instanceId;
    this.name = name;
    this.path = path;
  }
}
