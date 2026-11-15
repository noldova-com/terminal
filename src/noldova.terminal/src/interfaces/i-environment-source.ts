/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IEnvironmentSource {
  start(): void;

  readAsync(): Promise<Readonly<Record<string, string | undefined>>>;

  end(): void;
}
