/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { IVitestPlugin } from "./interfaces/i-vitest-plugin.ts";
import type { IVitestPluginContext } from "./interfaces/i-vitest-plugin-context.ts";
import { MarkedModule } from "./marked-module.ts";

export class ClassMetadataCoverage implements IVitestPlugin {
  private static readonly NAME: string = "noldova-class-metadata-coverage";
  private static readonly LINE_BREAK: string = "\n";
  private static readonly OPENING: string = "(() => {";
  private static readonly CLOSING: string = "})();";
  private static readonly CALL: RegExp = /^[\t ]+\(typeof ngDevMode === "undefined" \|\| ngDevMode\) && i\d+\.(?:ɵ|\\u0275)setClassMetadata\(([A-Za-z_$][\w$]*), /u;
  private static readonly HINT: string = " /* v8 ignore next */";

  private readonly ignored: Map<string, readonly string[]> = new Map();

  public readonly name: string = ClassMetadataCoverage.NAME;
  public readonly enforce: "post" = "post";
  public readonly transform: (code: string, id: string) => MarkedModule | null = (code, id) => this.mark(code, id);
  public readonly configureVitest: (context: IVitestPluginContext) => void = context => context.vitest.onClose(() => context.vitest.logger.log(this.summary));

  public get summary(): string {
    const calls: readonly string[] = [...this.ignored.values()].flat();
    return `Coverage ignores ${calls.length} compiler-generated class-metadata calls for ${new Set(calls).size} classes, which run only in development mode.`;
  }

  private mark(code: string, id: string): MarkedModule | null {
    const lines: string[] = code.split(ClassMetadataCoverage.LINE_BREAK);
    const classes: string[] = [];
    for (let index: number = 0; index < lines.length; index++) {
      const name: string | undefined = this.classAt(lines, index);
      if (Object.isUndefined(name))
        continue;
      lines[index] += ClassMetadataCoverage.HINT;
      classes.push(name);
    }
    if (classes.length === 0) {
      this.ignored.delete(id);
      return null;
    }
    this.ignored.set(id, classes);
    return new MarkedModule(lines.join(ClassMetadataCoverage.LINE_BREAK));
  }

  private classAt(lines: readonly string[], index: number): string | undefined {
    if (lines[index] !== ClassMetadataCoverage.OPENING)
      return undefined;
    const name: string | undefined = ClassMetadataCoverage.CALL.exec(lines[index + 1] ?? "")?.[1];
    if (!lines.slice(index + 2).includes(ClassMetadataCoverage.CLOSING))
      return undefined;
    return name;
  }
}
