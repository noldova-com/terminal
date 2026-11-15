/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const RunMethod = {
  InShell: "InShell",
  OneShot: "OneShot"
} as const;

export type RunMethod = (typeof RunMethod)[keyof typeof RunMethod];
