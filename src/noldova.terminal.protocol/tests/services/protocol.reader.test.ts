/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonException, JsonReader } from "@noldova/context.json";
import { describe, it } from "vitest";

import { ProtocolReader } from "../../src/services/protocol.reader.ts";

function assertJsonError(action: () => unknown, path: string, text: string): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof JsonException);
    assert.equal(error.name, "JsonException");
    assert.equal(error.path, path);
    assert.equal(error.message, `${path}: ${text}`);
    return true;
  });
}

function assertContextRefuses(action: () => unknown, path: string): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof JsonException);
    assert.equal(error.path, path);
    return true;
  });
}

describe("ProtocolReader", () => {
  describe("fromValue", () => {
    it("reads a JSON object at the root path", () => {
      assert.equal(ProtocolReader.fromValue({}).path, "$");
    });

    it("keeps a given path", () => {
      assert.equal(ProtocolReader.fromValue({}, "$.size").path, "$.size");
    });

    for (const value of [null, "text", 1, true, []])
      it(`refuses ${JSON.stringify(value)} as not an object, with context's message`, () => {
        assertJsonError(() => ProtocolReader.fromValue(value), "$", "Expected a JSON object.");
      });

    it("refuses undefined, which JSON can't carry, with context's message", () => {
      assertJsonError(() => ProtocolReader.fromValue(undefined), "$", "A value of type \"undefined\" cannot be carried as JSON.");
    });

    it("refuses a value JSON can't carry nested in the object, through context's JsonReader", () => {
      assertContextRefuses(() => ProtocolReader.fromValue({ a: () => undefined }), "$.a");
      assertContextRefuses(() => ProtocolReader.fromValue({ a: Number.NaN }), "$.a");
      assertContextRefuses(() => ProtocolReader.fromValue({ a: Number.POSITIVE_INFINITY }), "$.a");
      assertContextRefuses(() => ProtocolReader.fromValue({ a: { b: Symbol.iterator } }, "$.params"), "$.params.a.b");
    });

    it("names the path once in each message", () => {
      const reader: ProtocolReader = ProtocolReader.fromValue({ a: { b: 1, c: ["x", 2] } }, "$.params").readObject("a");
      for (const action of [() => reader.readString("b", 3), () => reader.readNonBlankStringArray("c", 3, 5), () => reader.readBoolean("d")]) {
        assert.throws(action, (error: unknown) => {
          assert.ok(error instanceof JsonException);
          assert.equal(error.message.split(error.path).length, 2);
          return true;
        });
      }
    });

    it("refuses nesting deeper than context's JsonReader allows", () => {
      let value: object = {};
      for (let depth: number = 1; depth <= JsonReader.maximumDepth; depth++)
        value = { a: value };

      assert.throws(() => ProtocolReader.fromValue(value), JsonException);
    });
  });

  describe("create", () => {
    it("returns what the factory makes", () => {
      assert.equal(ProtocolReader.fromValue({}).create(() => 42), 42);
    });

    it("turns an ArgumentException into a JsonException at the parameter's field, keeping it as the cause", () => {
      const cause: ArgumentException = new ArgumentException("The value must be an absolute path.", "folder");

      assert.throws(() => ProtocolReader.fromValue({}, "$.params").create(() => {
        throw cause;
      }), (error: unknown) => {
        assert.ok(error instanceof JsonException);
        assert.equal(error.path, "$.params.folder");
        assert.equal(error.message, "$.params.folder: The value must be an absolute path. (Parameter 'folder')");
        assert.equal(error.cause, cause);
        return true;
      });
    });

    it("names a nested parameter by its path, and the object itself when the exception names no parameter", () => {
      assertJsonError(() => ProtocolReader.fromValue({}).create(() => {
        throw new ArgumentOutOfRangeException("environment.TERM", 1, "The value is refused.");
      }), "$.environment.TERM", "The value is refused. (Parameter 'environment.TERM')");
      assertJsonError(() => ProtocolReader.fromValue({}, "$.runs.1").create(() => {
        throw new ArgumentException("The value must give one answer.");
      }), "$.runs.1", "The value must give one answer.");
    });

    it("lets any other failure through unchanged", () => {
      const failure: TypeError = new TypeError("The factory failed.");

      assert.throws(() => ProtocolReader.fromValue({}).create(() => {
        throw failure;
      }), (error: unknown) => error === failure);
      assert.throws(() => ProtocolReader.fromValue({}).create(() => {
        throw new JsonException("Expected a string.", "$.a");
      }), { name: "JsonException", path: "$.a" });
    });
  });

  describe("allowOnly", () => {
    it("accepts known fields and absent ones", () => {
      ProtocolReader.fromValue({ a: 1 }).allowOnly(["a", "b"]);
    });

    it("names an unknown field", () => {
      assertJsonError(() => ProtocolReader.fromValue({ a: 1, c: 2 }).allowOnly(["a"]), "$.c", "The field is not known.");
    });

    it("reads a field set to undefined as absent, as context's JsonReader does", () => {
      ProtocolReader.fromValue({ a: 1, c: undefined }).allowOnly(["a"]);
    });

    it("reads an optional field set to undefined as absent", () => {
      assert.equal(ProtocolReader.fromValue({ a: undefined }).readOptionalString("a", 5), undefined);
      assert.equal(ProtocolReader.fromValue({ a: undefined }).readOptionalBoolean("a"), undefined);
    });
  });

  describe("readString", () => {
    it("reads a string up to its maximum length", () => {
      assert.equal(ProtocolReader.fromValue({ a: "abc" }).readString("a", 3), "abc");
      assert.equal(ProtocolReader.fromValue({ a: "" }).readString("a", 3), "");
    });

    it("names a missing field", () => {
      assertJsonError(() => ProtocolReader.fromValue({}).readString("a", 3), "$.a", "The field is required.");
    });

    it("refuses a value that is not a string", () => {
      assertJsonError(() => ProtocolReader.fromValue({ a: 1 }).readString("a", 3), "$.a", "Expected a string.");
    });

    it("refuses a string longer than its maximum", () => {
      assertJsonError(() => ProtocolReader.fromValue({ a: "abcd" }).readString("a", 3), "$.a", "Expected at most 3 characters.");
    });
  });

  describe("readNonBlankString", () => {
    it("reads a string with text", () => {
      assert.equal(ProtocolReader.fromValue({ a: " x " }).readNonBlankString("a", 3), " x ");
    });

    it("refuses a blank string", () => {
      assertJsonError(() => ProtocolReader.fromValue({ a: " \t" }).readNonBlankString("a", 3), "$.a", "Expected a string that is not blank.");
    });
  });

  describe("readBoolean", () => {
    it("reads true and false", () => {
      assert.equal(ProtocolReader.fromValue({ a: true }).readBoolean("a"), true);
      assert.equal(ProtocolReader.fromValue({ a: false }).readBoolean("a"), false);
    });

    it("refuses a value that is not a boolean", () => {
      assertJsonError(() => ProtocolReader.fromValue({ a: "true" }).readBoolean("a"), "$.a", "Expected a boolean.");
    });
  });

  describe("readInteger", () => {
    it("reads a whole number at either bound", () => {
      assert.equal(ProtocolReader.fromValue({ a: 1 }).readInteger("a", 1, 5), 1);
      assert.equal(ProtocolReader.fromValue({ a: 5 }).readInteger("a", 1, 5), 5);
    });

    it("refuses a number below the minimum", () => {
      assertJsonError(() => ProtocolReader.fromValue({ a: 0 }).readInteger("a", 1, 5), "$.a", "Expected a whole number from 1 to 5.");
    });

    it("refuses a number above the maximum", () => {
      assertJsonError(() => ProtocolReader.fromValue({ a: 6 }).readInteger("a", 1, 5), "$.a", "Expected a whole number from 1 to 5.");
    });

    for (const value of [2 ** 53, -(2 ** 53)])
      it(`refuses ${JSON.stringify(value)}, which isn't a safe integer`, () => {
        assertJsonError(() => ProtocolReader.fromValue({ a: value }).readInteger("a", -(2 ** 54), 2 ** 54), "$.a",
          `Expected a whole number from ${-(2 ** 54)} to ${2 ** 54}.`);
      });

    it("refuses a fraction and a string with context's messages", () => {
      assertJsonError(() => ProtocolReader.fromValue({ a: 1.5 }).readInteger("a", 1, 5), "$.a", "Expected an integer.");
      assertJsonError(() => ProtocolReader.fromValue({ a: "1" }).readInteger("a", 1, 5), "$.a", "Expected a number.");
      assertJsonError(() => ProtocolReader.fromValue({ a: null }).readInteger("a", 1, 5), "$.a", "Null is not an accepted value here.");
    });
  });

  describe("readNullableInteger", () => {
    it("reads null as null", () => {
      assert.equal(ProtocolReader.fromValue({ a: null }).readNullableInteger("a", 1, 5), null);
    });

    it("reads a whole number", () => {
      assert.equal(ProtocolReader.fromValue({ a: 3 }).readNullableInteger("a", 1, 5), 3);
    });

    it("names a missing field", () => {
      assertJsonError(() => ProtocolReader.fromValue({}).readNullableInteger("a", 1, 5), "$.a", "The field is required.");
    });
  });

  describe("readNullableNonBlankString", () => {
    it("reads null as null", () => {
      assert.equal(ProtocolReader.fromValue({ a: null }).readNullableNonBlankString("a", 5), null);
    });

    it("reads a non-blank string", () => {
      assert.equal(ProtocolReader.fromValue({ a: "abc" }).readNullableNonBlankString("a", 5), "abc");
    });

    it("refuses a blank string", () => {
      assertJsonError(() => ProtocolReader.fromValue({ a: " " }).readNullableNonBlankString("a", 5), "$.a", "Expected a string that is not blank.");
    });
  });

  describe("readOptionalNullableString", () => {
    it("reads an absent field and a JSON null as null, and a present string as itself", () => {
      assert.deepEqual([ProtocolReader.fromValue({}).readOptionalNullableString("a", 5), ProtocolReader.fromValue({ a: null }).readOptionalNullableString("a", 5),
        ProtocolReader.fromValue({ a: "abc" }).readOptionalNullableString("a", 5)], [null, null, "abc"]);
    });

    it("refuses another type or a longer string", () => {
      assertJsonError(() => ProtocolReader.fromValue({ a: 1 }).readOptionalNullableString("a", 5), "$.a", "Expected a string.");
      assertJsonError(() => ProtocolReader.fromValue({ a: "abcdef" }).readOptionalNullableString("a", 5), "$.a", "Expected at most 5 characters.");
    });
  });

  describe("readOptionalString", () => {
    it("reads an absent field as undefined", () => {
      assert.equal(ProtocolReader.fromValue({}).readOptionalString("a", 5), undefined);
    });

    it("reads a present string", () => {
      assert.equal(ProtocolReader.fromValue({ a: "abc" }).readOptionalString("a", 5), "abc");
    });

    it("refuses a JSON null rather than reading it as absent", () => {
      assertJsonError(() => ProtocolReader.fromValue({ a: null }).readOptionalString("a", 5), "$.a", "Null is not an accepted value here.");
    });
  });

  describe("readOptionalInteger", () => {
    it("reads an absent field as undefined", () => {
      assert.equal(ProtocolReader.fromValue({}).readOptionalInteger("a", 1, 5), undefined);
    });

    it("reads a present whole number", () => {
      assert.equal(ProtocolReader.fromValue({ a: 5 }).readOptionalInteger("a", 1, 5), 5);
    });

    it("refuses a present number out of range", () => {
      assertJsonError(() => ProtocolReader.fromValue({ a: 6 }).readOptionalInteger("a", 1, 5), "$.a", "Expected a whole number from 1 to 5.");
    });
  });

  describe("readOptionalBoolean", () => {
    it("reads an absent field as undefined", () => {
      assert.equal(ProtocolReader.fromValue({}).readOptionalBoolean("a"), undefined);
    });

    it("reads a present boolean", () => {
      assert.equal(ProtocolReader.fromValue({ a: false }).readOptionalBoolean("a"), false);
    });

    it("refuses a present value that is not a boolean", () => {
      assertJsonError(() => ProtocolReader.fromValue({ a: null }).readOptionalBoolean("a"), "$.a", "Null is not an accepted value here.");
    });
  });

  describe("readOneOf", () => {
    it("reads one of the given values", () => {
      assert.equal(ProtocolReader.fromValue({ a: "y" }).readOneOf("a", ["x", "y"]), "y");
    });

    it("refuses another value", () => {
      assertJsonError(() => ProtocolReader.fromValue({ a: "z" }).readOneOf("a", ["x", "y"]), "$.a", "Expected one of x, y.");
    });
  });

  describe("readOneOfArray", () => {
    it("reads each item in order, and an empty array", () => {
      assert.deepEqual(ProtocolReader.fromValue({ a: ["y", "x", "y"] }).readOneOfArray("a", ["x", "y"]), ["y", "x", "y"]);
      assert.deepEqual(ProtocolReader.fromValue({ a: [] }).readOneOfArray("a", ["x"]), []);
    });

    it("refuses a value that is not an array, and an item that isn't one of the values, naming its index", () => {
      assertJsonError(() => ProtocolReader.fromValue({ a: "x" }).readOneOfArray("a", ["x"]), "$.a", "Expected an array.");
      assertJsonError(() => ProtocolReader.fromValue({ a: ["x", "z"] }).readOneOfArray("a", ["x", "y"]), "$.a.1", "Expected one of x, y.");
      assertJsonError(() => ProtocolReader.fromValue({}).readOneOfArray("a", ["x"]), "$.a", "The field is required.");
    });
  });

  describe("readOptionalOneOfArray", () => {
    it("reads an absent field as an empty array, and a present one as readOneOfArray does", () => {
      assert.deepEqual(ProtocolReader.fromValue({}).readOptionalOneOfArray("a", ["x"]), []);
      assert.deepEqual(ProtocolReader.fromValue({ a: ["x"] }).readOptionalOneOfArray("a", ["x", "y"]), ["x"]);
      assertJsonError(() => ProtocolReader.fromValue({ a: ["z"] }).readOptionalOneOfArray("a", ["x"]), "$.a.0", "Expected one of x.");
    });
  });

  describe("readObject", () => {
    it("reads a nested object with its path", () => {
      const reader: ProtocolReader = ProtocolReader.fromValue({ a: { b: "c" } }).readObject("a");

      assert.equal(reader.path, "$.a");
      assert.equal(reader.readString("b", 1), "c");
    });

    it("refuses a value that is not an object", () => {
      assertJsonError(() => ProtocolReader.fromValue({ a: [] }).readObject("a"), "$.a", "Expected an object.");
    });
  });

  describe("readNullableObject", () => {
    it("reads null as null", () => {
      assert.equal(ProtocolReader.fromValue({ a: null }).readNullableObject("a"), null);
    });

    it("reads a nested object", () => {
      assert.equal(ProtocolReader.fromValue({ a: {} }).readNullableObject("a")?.path, "$.a");
    });
  });

  describe("readStringRecord", () => {
    it("reads an object of strings, an own __proto__ field included", () => {
      const record: Readonly<Record<string, string>> = ProtocolReader.fromValue(JSON.parse("{\"a\":{\"X\":\"1\",\"__proto__\":\"2\"}}")).readStringRecord("a", 3);

      assert.deepEqual(Object.entries(record), [["X", "1"], ["__proto__", "2"]]);
      assert.equal(Object.getPrototypeOf(record), Object.prototype);
      assert.deepEqual(ProtocolReader.fromValue({ a: {} }).readStringRecord("a", 3), {});
    });

    it("names the field that isn't a string or is too long, never its value", () => {
      assertJsonError(() => ProtocolReader.fromValue({ a: { X: 1 } }).readStringRecord("a", 3), "$.a.X", "Expected a string.");
      assertJsonError(() => ProtocolReader.fromValue({ a: { X: "secret" } }).readStringRecord("a", 3), "$.a.X", "Expected at most 3 characters.");
      assertJsonError(() => ProtocolReader.fromValue({ a: [] }).readStringRecord("a", 3), "$.a", "Expected an object.");
      assertJsonError(() => ProtocolReader.fromValue({}).readStringRecord("a", 3), "$.a", "The field is required.");
    });
  });

  describe("readObjectArray", () => {
    it("reads each object with its index path", () => {
      const readers: readonly ProtocolReader[] = ProtocolReader.fromValue({ a: [{}, {}] }).readObjectArray("a");

      assert.deepEqual(readers.map(t => t.path), ["$.a.0", "$.a.1"]);
    });

    it("refuses a value that is not an array", () => {
      assertJsonError(() => ProtocolReader.fromValue({ a: {} }).readObjectArray("a"), "$.a", "Expected an array.");
    });

    it("names an item that is not an object", () => {
      assertJsonError(() => ProtocolReader.fromValue({ a: [{}, 1] }).readObjectArray("a"), "$.a.1", "Expected an object.");
    });
  });

  describe("readNonBlankStringArray", () => {
    it("reads the strings in order, up to the most allowed", () => {
      assert.deepEqual(ProtocolReader.fromValue({ a: ["ls", " x "] }).readNonBlankStringArray("a", 3, 2), ["ls", " x "]);
      assert.deepEqual(ProtocolReader.fromValue({ a: [] }).readNonBlankStringArray("a", 3, 0), []);
    });

    it("refuses a missing field, a value that is not an array, and too many items", () => {
      assertJsonError(() => ProtocolReader.fromValue({}).readNonBlankStringArray("a", 3, 2), "$.a", "The field is required.");
      assertJsonError(() => ProtocolReader.fromValue({ a: "ls" }).readNonBlankStringArray("a", 3, 2), "$.a", "Expected an array.");
      assertJsonError(() => ProtocolReader.fromValue({ a: ["a", "b", "c"] }).readNonBlankStringArray("a", 3, 2), "$.a", "Expected at most 2 items.");
    });

    it("names an item that is not a string, is too long or is blank", () => {
      assertJsonError(() => ProtocolReader.fromValue({ a: ["ls", 1] }).readNonBlankStringArray("a", 3, 2), "$.a.1", "Expected a string.");
      assertJsonError(() => ProtocolReader.fromValue({ a: ["abcd"] }).readNonBlankStringArray("a", 3, 2), "$.a.0", "Expected at most 3 characters.");
      assertJsonError(() => ProtocolReader.fromValue({ a: ["ls", " "] }).readNonBlankStringArray("a", 3, 2), "$.a.1", "The item must not be blank.");
    });
  });
});
