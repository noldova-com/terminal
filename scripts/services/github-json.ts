/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitHubObjectExpectedException } from "../exceptions/github-object-expected.exception.ts";
import { GitHubTextExpectedException } from "../exceptions/github-text-expected.exception.ts";
import { Resources } from "../resources.ts";

export class GitHubJson {
  public static object(value: unknown, context: string): Readonly<Record<string, unknown>> {
    if (typeof value !== "object" || value === null || Array.isArray(value))
      throw new GitHubObjectExpectedException(context);
    return Object.fromEntries(Object.entries(value));
  }

  public static child(source: Readonly<Record<string, unknown>>, key: string, context: string): Readonly<Record<string, unknown>> {
    return GitHubJson.object(source[key], Resources.formatFieldContext(context, key));
  }

  public static nullableChild(source: Readonly<Record<string, unknown>>, key: string, context: string): Readonly<Record<string, unknown>> | null {
    return source[key] === null ? null : GitHubJson.child(source, key, context);
  }

  public static text(source: Readonly<Record<string, unknown>>, key: string, context: string): string {
    const value = source[key];
    if (typeof value !== "string")
      throw new GitHubTextExpectedException(context, key);
    return value;
  }
}
