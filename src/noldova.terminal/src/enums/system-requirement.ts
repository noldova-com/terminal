/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const SystemRequirement = {
  WindowsBuild: "WindowsBuild",
  Glibc: "Glibc"
} as const;

export type SystemRequirement = (typeof SystemRequirement)[keyof typeof SystemRequirement];
