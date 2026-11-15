/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { ClassMetadataCoverage } from "./class-metadata-coverage.ts";
import type { MarkedModule } from "./marked-module.ts";

describe("ClassMetadataCoverage", () => {
  it("marks exactly the compiler's class-metadata call inside its block, in either spelling, and counts the classes", () => {
    const coverage: ClassMetadataCoverage = new ClassMetadataCoverage();
    const code: string = [
      "export class A {}",
      "(() => {",
      "  (typeof ngDevMode === \"undefined\" || ngDevMode) && i0.ɵsetClassMetadata(A, [{",
      "  }], null, null);",
      "})();",
      "(() => {",
      "  (typeof ngDevMode === \"undefined\" || ngDevMode) && i0.\\u0275setClassMetadata(B, [{",
      "  }], null, null);",
      "})();"
    ].join("\n");

    const marked: MarkedModule | null = coverage.transform(code, "a.ts");

    expect(marked?.code.split("\n")).toEqual([
      "export class A {}",
      "(() => { /* v8 ignore next */",
      "  (typeof ngDevMode === \"undefined\" || ngDevMode) && i0.ɵsetClassMetadata(A, [{",
      "  }], null, null);",
      "})();",
      "(() => { /* v8 ignore next */",
      "  (typeof ngDevMode === \"undefined\" || ngDevMode) && i0.\\u0275setClassMetadata(B, [{",
      "  }], null, null);",
      "})();"
    ]);
    expect(coverage.summary).toBe("Coverage ignores 2 compiler-generated class-metadata calls for 2 classes, which run only in development mode.");
  });

  it("leaves a block alone that holds another call, that has no closing line, or that the module no longer has", () => {
    const coverage: ClassMetadataCoverage = new ClassMetadataCoverage();
    const otherCall: string = ["(() => {", "  (typeof ngDevMode === \"undefined\" || ngDevMode) && i0.ɵsetClassDebugInfo(A, {});", "})();"].join("\n");
    const unclosed: string = ["(() => {", "  (typeof ngDevMode === \"undefined\" || ngDevMode) && i0.ɵsetClassMetadata(A, [{"].join("\n");
    const unguarded: string = ["(() => {", "  i0.ɵsetClassMetadata(A, [{", "  }], null, null);", "})();"].join("\n");
    coverage.transform(["(() => {", "  (typeof ngDevMode === \"undefined\" || ngDevMode) && i0.ɵsetClassMetadata(A, [{", "})();"].join("\n"), "b.ts");

    expect([otherCall, unclosed, unguarded].map(t => coverage.transform(t, "a.ts"))).toEqual([null, null, null]);
    expect(coverage.transform("export class B {}", "b.ts")).toBeNull();
    expect(coverage.summary).toBe("Coverage ignores 0 compiler-generated class-metadata calls for 0 classes, which run only in development mode.");
  });
});
