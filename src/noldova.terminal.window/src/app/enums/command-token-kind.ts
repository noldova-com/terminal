/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const CommandTokenKind = {
  Command: "Command",
  NotFound: "NotFound",
  Keyword: "Keyword",
  Option: "Option",
  String: "String",
  Path: "Path",
  Variable: "Variable",
  Operator: "Operator",
  Comment: "Comment"
} as const;

export type CommandTokenKind = (typeof CommandTokenKind)[keyof typeof CommandTokenKind];
