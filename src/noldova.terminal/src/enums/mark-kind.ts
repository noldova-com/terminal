/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const MarkKind = {
  PromptStart: "PromptStart",
  PromptEnd: "PromptEnd",
  OutputStart: "OutputStart",
  CommandEnd: "CommandEnd",
  Property: "Property",
  RightPrompt: "RightPrompt",
  ContinuationEnd: "ContinuationEnd",
  Options: "Options",
  Loaded: "Loaded"
} as const;

export type MarkKind = (typeof MarkKind)[keyof typeof MarkKind];
