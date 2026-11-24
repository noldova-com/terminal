/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonException, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { ProtocolReader } from "../../src/services/protocol.reader.ts";
import { Expect } from "../support/expect.ts";

function assertJsonError(action: () => unknown, path: string, text: string): void {
  const error: JsonException = Assert.throws(action, JsonException);
  Assert.areEqual("JsonException", error.name);
  Assert.areEqual(path, error.path);
  Assert.areEqual(`${path}: ${text}`, error.message);
}

function assertContextRefuses(action: () => unknown, path: string): void {
  Assert.areEqual(path, Assert.throws(action, JsonException).path);
}

@TestClass
export class ProtocolReaderTests {
  @TestMethod
  public fromValueReadsAJSONObjectAtTheRootPath(): void {
    Assert.areEqual("$", ProtocolReader.fromValue({}).path);
  }

  @TestMethod
  public fromValueKeepsAGivenPath(): void {
    Assert.areEqual("$.size", ProtocolReader.fromValue({}, "$.size").path);
  }

  @TestMethod
  public fromValueRefusesNullAStringANumberABooleanAndAnArrayAsNotAnObjectWithContextsMessage(): void {
    for (const value of [null, "text", 1, true, []])
      assertJsonError(() => ProtocolReader.fromValue(value), "$", "Expected a JSON object.");
  }

  @TestMethod
  public fromValueRefusesUndefinedWhichJSONCantCarryWithContextsMessage(): void {
    assertJsonError(() => ProtocolReader.fromValue(undefined), "$", "A value of type \"undefined\" cannot be carried as JSON.");
  }

  @TestMethod
  public fromValueRefusesAValueJSONCantCarryNestedInTheObjectThroughContextsJsonReader(): void {
    assertContextRefuses(() => ProtocolReader.fromValue({ a: () => undefined }), "$.a");
    assertContextRefuses(() => ProtocolReader.fromValue({ a: Number.NaN }), "$.a");
    assertContextRefuses(() => ProtocolReader.fromValue({ a: Number.POSITIVE_INFINITY }), "$.a");
    assertContextRefuses(() => ProtocolReader.fromValue({ a: { b: Symbol.iterator } }, "$.params"), "$.params.a.b");
  }

  @TestMethod
  public fromValueNamesThePathOnceInEachMessage(): void {
    const reader: ProtocolReader = ProtocolReader.fromValue({ a: { b: 1, c: ["x", 2] } }, "$.params").readObject("a");
    for (const action of [() => reader.readString("b", 3), () => reader.readNonBlankStringArray("c", 3, 5), () => reader.readBoolean("d")]) {
      const error: JsonException = Assert.throws(action, JsonException);
      Assert.areEqual(2, error.message.split(error.path).length);
    }
  }

  @TestMethod
  public fromValueRefusesNestingDeeperThanContextsJsonReaderAllows(): void {
    let value: object = {};
    for (let depth: number = 1; depth <= JsonReader.maximumDepth; depth++)
      value = { a: value };

    Assert.throws(() => ProtocolReader.fromValue(value), JsonException);
  }

  @TestMethod
  public createReturnsWhatTheFactoryMakes(): void {
    Assert.areEqual(42, ProtocolReader.fromValue({}).create(() => 42));
  }

  @TestMethod
  public createTurnsAnArgumentExceptionIntoAJsonExceptionAtTheParametersFieldKeepingItAsTheCause(): void {
    const cause: ArgumentException = new ArgumentException("The value must be an absolute path.", "folder");

    const error: JsonException = Assert.throws(() => ProtocolReader.fromValue({}, "$.params").create(() => {
      throw cause;
    }), JsonException);
    Assert.areEqual("$.params.folder", error.path);
    Assert.areEqual("$.params.folder: The value must be an absolute path. (Parameter 'folder')", error.message);
    Assert.areEqual(cause, error.cause);
  }

  @TestMethod
  public createNamesANestedParameterByItsPathAndTheObjectItselfWhenTheExceptionNamesNoParameter(): void {
    assertJsonError(() => ProtocolReader.fromValue({}).create(() => {
      throw new ArgumentOutOfRangeException("environment.TERM", 1, "The value is refused.");
    }), "$.environment.TERM", "The value is refused. (Parameter 'environment.TERM')");
    assertJsonError(() => ProtocolReader.fromValue({}, "$.runs.1").create(() => {
      throw new ArgumentException("The value must give one answer.");
    }), "$.runs.1", "The value must give one answer.");
  }

  @TestMethod
  public createLetsAnyOtherFailureThroughUnchanged(): void {
    const failure: TypeError = new TypeError("The factory failed.");

    Assert.areEqual(failure, Assert.throws(() => ProtocolReader.fromValue({}).create(() => {
      throw failure;
    }), TypeError));
    Expect.throwsMatching(() => ProtocolReader.fromValue({}).create(() => {
      throw new JsonException("Expected a string.", "$.a");
    }), { name: "JsonException", path: "$.a" });
  }

  @TestMethod
  public allowOnlyAcceptsKnownFieldsAndAbsentOnes(): void {
    ProtocolReader.fromValue({ a: 1 }).allowOnly(["a", "b"]);
  }

  @TestMethod
  public allowOnlyNamesAnUnknownField(): void {
    assertJsonError(() => ProtocolReader.fromValue({ a: 1, c: 2 }).allowOnly(["a"]), "$.c", "The field is not known.");
  }

  @TestMethod
  public allowOnlyReadsAFieldSetToUndefinedAsAbsentAsContextsJsonReaderDoes(): void {
    ProtocolReader.fromValue({ a: 1, c: undefined }).allowOnly(["a"]);
  }

  @TestMethod
  public allowOnlyReadsAnOptionalFieldSetToUndefinedAsAbsent(): void {
    Assert.areEqual(undefined, ProtocolReader.fromValue({ a: undefined }).readOptionalString("a", 5));
    Assert.areEqual(undefined, ProtocolReader.fromValue({ a: undefined }).readOptionalBoolean("a"));
  }

  @TestMethod
  public readStringReadsAStringUpToItsMaximumLength(): void {
    Assert.areEqual("abc", ProtocolReader.fromValue({ a: "abc" }).readString("a", 3));
    Assert.areEqual("", ProtocolReader.fromValue({ a: "" }).readString("a", 3));
  }

  @TestMethod
  public readStringNamesAMissingField(): void {
    assertJsonError(() => ProtocolReader.fromValue({}).readString("a", 3), "$.a", "The field is required.");
  }

  @TestMethod
  public readStringRefusesAValueThatIsNotAString(): void {
    assertJsonError(() => ProtocolReader.fromValue({ a: 1 }).readString("a", 3), "$.a", "Expected a string.");
  }

  @TestMethod
  public readStringRefusesAStringLongerThanItsMaximum(): void {
    assertJsonError(() => ProtocolReader.fromValue({ a: "abcd" }).readString("a", 3), "$.a", "Expected at most 3 characters.");
  }

  @TestMethod
  public readNonBlankStringReadsAStringWithText(): void {
    Assert.areEqual(" x ", ProtocolReader.fromValue({ a: " x " }).readNonBlankString("a", 3));
  }

  @TestMethod
  public readNonBlankStringRefusesABlankString(): void {
    assertJsonError(() => ProtocolReader.fromValue({ a: " \t" }).readNonBlankString("a", 3), "$.a", "Expected a string that is not blank.");
  }

  @TestMethod
  public readBooleanReadsTrueAndFalse(): void {
    Assert.areEqual(true, ProtocolReader.fromValue({ a: true }).readBoolean("a"));
    Assert.areEqual(false, ProtocolReader.fromValue({ a: false }).readBoolean("a"));
  }

  @TestMethod
  public readBooleanRefusesAValueThatIsNotABoolean(): void {
    assertJsonError(() => ProtocolReader.fromValue({ a: "true" }).readBoolean("a"), "$.a", "Expected a boolean.");
  }

  @TestMethod
  public readIntegerReadsAWholeNumberAtEitherBound(): void {
    Assert.areEqual(1, ProtocolReader.fromValue({ a: 1 }).readInteger("a", 1, 5));
    Assert.areEqual(5, ProtocolReader.fromValue({ a: 5 }).readInteger("a", 1, 5));
  }

  @TestMethod
  public readIntegerRefusesANumberBelowTheMinimum(): void {
    assertJsonError(() => ProtocolReader.fromValue({ a: 0 }).readInteger("a", 1, 5), "$.a", "Expected a whole number from 1 to 5.");
  }

  @TestMethod
  public readIntegerRefusesANumberAboveTheMaximum(): void {
    assertJsonError(() => ProtocolReader.fromValue({ a: 6 }).readInteger("a", 1, 5), "$.a", "Expected a whole number from 1 to 5.");
  }

  @TestMethod
  public readIntegerRefuses2ToThe53rdAndItsNegativeWhichArentSafeIntegers(): void {
    for (const value of [2 ** 53, -(2 ** 53)])
      assertJsonError(() => ProtocolReader.fromValue({ a: value }).readInteger("a", -(2 ** 54), 2 ** 54), "$.a",
        `Expected a whole number from ${-(2 ** 54)} to ${2 ** 54}.`);
  }

  @TestMethod
  public readIntegerRefusesAFractionAndAStringWithContextsMessages(): void {
    assertJsonError(() => ProtocolReader.fromValue({ a: 1.5 }).readInteger("a", 1, 5), "$.a", "Expected an integer.");
    assertJsonError(() => ProtocolReader.fromValue({ a: "1" }).readInteger("a", 1, 5), "$.a", "Expected a number.");
    assertJsonError(() => ProtocolReader.fromValue({ a: null }).readInteger("a", 1, 5), "$.a", "Null is not an accepted value here.");
  }

  @TestMethod
  public readNullableIntegerReadsNullAsNull(): void {
    Assert.areEqual(null, ProtocolReader.fromValue({ a: null }).readNullableInteger("a", 1, 5));
  }

  @TestMethod
  public readNullableIntegerReadsAWholeNumber(): void {
    Assert.areEqual(3, ProtocolReader.fromValue({ a: 3 }).readNullableInteger("a", 1, 5));
  }

  @TestMethod
  public readNullableIntegerNamesAMissingField(): void {
    assertJsonError(() => ProtocolReader.fromValue({}).readNullableInteger("a", 1, 5), "$.a", "The field is required.");
  }

  @TestMethod
  public readNullableNonBlankStringReadsNullAsNull(): void {
    Assert.areEqual(null, ProtocolReader.fromValue({ a: null }).readNullableNonBlankString("a", 5));
  }

  @TestMethod
  public readNullableNonBlankStringReadsANonBlankString(): void {
    Assert.areEqual("abc", ProtocolReader.fromValue({ a: "abc" }).readNullableNonBlankString("a", 5));
  }

  @TestMethod
  public readNullableNonBlankStringRefusesABlankString(): void {
    assertJsonError(() => ProtocolReader.fromValue({ a: " " }).readNullableNonBlankString("a", 5), "$.a", "Expected a string that is not blank.");
  }

  @TestMethod
  public readOptionalNullableStringReadsAnAbsentFieldAndAJSONNullAsNullAndAPresentStringAsItself(): void {
    Expect.same([null, null, "abc"], [ProtocolReader.fromValue({}).readOptionalNullableString("a", 5), ProtocolReader.fromValue({ a: null }).readOptionalNullableString("a", 5),
      ProtocolReader.fromValue({ a: "abc" }).readOptionalNullableString("a", 5)]);
  }

  @TestMethod
  public readOptionalNullableStringRefusesAnotherTypeOrALongerString(): void {
    assertJsonError(() => ProtocolReader.fromValue({ a: 1 }).readOptionalNullableString("a", 5), "$.a", "Expected a string.");
    assertJsonError(() => ProtocolReader.fromValue({ a: "abcdef" }).readOptionalNullableString("a", 5), "$.a", "Expected at most 5 characters.");
  }

  @TestMethod
  public readOptionalStringReadsAnAbsentFieldAsUndefined(): void {
    Assert.areEqual(undefined, ProtocolReader.fromValue({}).readOptionalString("a", 5));
  }

  @TestMethod
  public readOptionalStringReadsAPresentString(): void {
    Assert.areEqual("abc", ProtocolReader.fromValue({ a: "abc" }).readOptionalString("a", 5));
  }

  @TestMethod
  public readOptionalStringRefusesAJSONNullRatherThanReadingItAsAbsent(): void {
    assertJsonError(() => ProtocolReader.fromValue({ a: null }).readOptionalString("a", 5), "$.a", "Null is not an accepted value here.");
  }

  @TestMethod
  public readOptionalIntegerReadsAnAbsentFieldAsUndefined(): void {
    Assert.areEqual(undefined, ProtocolReader.fromValue({}).readOptionalInteger("a", 1, 5));
  }

  @TestMethod
  public readOptionalIntegerReadsAPresentWholeNumber(): void {
    Assert.areEqual(5, ProtocolReader.fromValue({ a: 5 }).readOptionalInteger("a", 1, 5));
  }

  @TestMethod
  public readOptionalIntegerRefusesAPresentNumberOutOfRange(): void {
    assertJsonError(() => ProtocolReader.fromValue({ a: 6 }).readOptionalInteger("a", 1, 5), "$.a", "Expected a whole number from 1 to 5.");
  }

  @TestMethod
  public readOptionalBooleanReadsAnAbsentFieldAsUndefined(): void {
    Assert.areEqual(undefined, ProtocolReader.fromValue({}).readOptionalBoolean("a"));
  }

  @TestMethod
  public readOptionalBooleanReadsAPresentBoolean(): void {
    Assert.areEqual(false, ProtocolReader.fromValue({ a: false }).readOptionalBoolean("a"));
  }

  @TestMethod
  public readOptionalBooleanRefusesAPresentValueThatIsNotABoolean(): void {
    assertJsonError(() => ProtocolReader.fromValue({ a: null }).readOptionalBoolean("a"), "$.a", "Null is not an accepted value here.");
  }

  @TestMethod
  public readOneOfReadsOneOfTheGivenValues(): void {
    Assert.areEqual("y", ProtocolReader.fromValue({ a: "y" }).readOneOf("a", ["x", "y"]));
  }

  @TestMethod
  public readOneOfRefusesAnotherValue(): void {
    assertJsonError(() => ProtocolReader.fromValue({ a: "z" }).readOneOf("a", ["x", "y"]), "$.a", "Expected one of x, y.");
  }

  @TestMethod
  public readOneOfArrayReadsEachItemInOrderAndAnEmptyArray(): void {
    Expect.same(["y", "x", "y"], ProtocolReader.fromValue({ a: ["y", "x", "y"] }).readOneOfArray("a", ["x", "y"]));
    Expect.same([], ProtocolReader.fromValue({ a: [] }).readOneOfArray("a", ["x"]));
  }

  @TestMethod
  public readOneOfArrayRefusesAValueThatIsNotAnArrayAndAnItemThatIsntOneOfTheValuesNamingItsIndex(): void {
    assertJsonError(() => ProtocolReader.fromValue({ a: "x" }).readOneOfArray("a", ["x"]), "$.a", "Expected an array.");
    assertJsonError(() => ProtocolReader.fromValue({ a: ["x", "z"] }).readOneOfArray("a", ["x", "y"]), "$.a.1", "Expected one of x, y.");
    assertJsonError(() => ProtocolReader.fromValue({}).readOneOfArray("a", ["x"]), "$.a", "The field is required.");
  }

  @TestMethod
  public readOptionalOneOfArrayReadsAnAbsentFieldAsAnEmptyArrayAndAPresentOneAsReadOneOfArrayDoes(): void {
    Expect.same([], ProtocolReader.fromValue({}).readOptionalOneOfArray("a", ["x"]));
    Expect.same(["x"], ProtocolReader.fromValue({ a: ["x"] }).readOptionalOneOfArray("a", ["x", "y"]));
    assertJsonError(() => ProtocolReader.fromValue({ a: ["z"] }).readOptionalOneOfArray("a", ["x"]), "$.a.0", "Expected one of x.");
  }

  @TestMethod
  public readObjectReadsANestedObjectWithItsPath(): void {
    const reader: ProtocolReader = ProtocolReader.fromValue({ a: { b: "c" } }).readObject("a");

    Assert.areEqual("$.a", reader.path);
    Assert.areEqual("c", reader.readString("b", 1));
  }

  @TestMethod
  public readObjectRefusesAValueThatIsNotAnObject(): void {
    assertJsonError(() => ProtocolReader.fromValue({ a: [] }).readObject("a"), "$.a", "Expected an object.");
  }

  @TestMethod
  public readNullableObjectReadsNullAsNull(): void {
    Assert.areEqual(null, ProtocolReader.fromValue({ a: null }).readNullableObject("a"));
  }

  @TestMethod
  public readNullableObjectReadsANestedObject(): void {
    Assert.areEqual("$.a", ProtocolReader.fromValue({ a: {} }).readNullableObject("a")?.path);
  }

  @TestMethod
  public readStringRecordReadsAnObjectOfStringsAnOwnProtoFieldIncluded(): void {
    const record: Readonly<Record<string, string>> = ProtocolReader.fromValue(JSON.parse("{\"a\":{\"X\":\"1\",\"__proto__\":\"2\"}}")).readStringRecord("a", 3);

    Expect.same([["X", "1"], ["__proto__", "2"]], Object.entries(record));
    Assert.areEqual(Object.prototype, Object.getPrototypeOf(record));
    Expect.same({}, ProtocolReader.fromValue({ a: {} }).readStringRecord("a", 3));
  }

  @TestMethod
  public readStringRecordNamesTheFieldThatIsntAStringOrIsTooLongNeverItsValue(): void {
    assertJsonError(() => ProtocolReader.fromValue({ a: { X: 1 } }).readStringRecord("a", 3), "$.a.X", "Expected a string.");
    assertJsonError(() => ProtocolReader.fromValue({ a: { X: "secret" } }).readStringRecord("a", 3), "$.a.X", "Expected at most 3 characters.");
    assertJsonError(() => ProtocolReader.fromValue({ a: [] }).readStringRecord("a", 3), "$.a", "Expected an object.");
    assertJsonError(() => ProtocolReader.fromValue({}).readStringRecord("a", 3), "$.a", "The field is required.");
  }

  @TestMethod
  public readObjectArrayReadsEachObjectWithItsIndexPath(): void {
    const readers: readonly ProtocolReader[] = ProtocolReader.fromValue({ a: [{}, {}] }).readObjectArray("a");

    Expect.same(["$.a.0", "$.a.1"], readers.map(t => t.path));
  }

  @TestMethod
  public readObjectArrayRefusesAValueThatIsNotAnArray(): void {
    assertJsonError(() => ProtocolReader.fromValue({ a: {} }).readObjectArray("a"), "$.a", "Expected an array.");
  }

  @TestMethod
  public readObjectArrayNamesAnItemThatIsNotAnObject(): void {
    assertJsonError(() => ProtocolReader.fromValue({ a: [{}, 1] }).readObjectArray("a"), "$.a.1", "Expected an object.");
  }

  @TestMethod
  public readNonBlankStringArrayReadsTheStringsInOrderUpToTheMostAllowed(): void {
    Expect.same(["ls", " x "], ProtocolReader.fromValue({ a: ["ls", " x "] }).readNonBlankStringArray("a", 3, 2));
    Expect.same([], ProtocolReader.fromValue({ a: [] }).readNonBlankStringArray("a", 3, 0));
  }

  @TestMethod
  public readNonBlankStringArrayRefusesAMissingFieldAValueThatIsNotAnArrayAndTooManyItems(): void {
    assertJsonError(() => ProtocolReader.fromValue({}).readNonBlankStringArray("a", 3, 2), "$.a", "The field is required.");
    assertJsonError(() => ProtocolReader.fromValue({ a: "ls" }).readNonBlankStringArray("a", 3, 2), "$.a", "Expected an array.");
    assertJsonError(() => ProtocolReader.fromValue({ a: ["a", "b", "c"] }).readNonBlankStringArray("a", 3, 2), "$.a", "Expected at most 2 items.");
  }

  @TestMethod
  public readNonBlankStringArrayNamesAnItemThatIsNotAStringIsTooLongOrIsBlank(): void {
    assertJsonError(() => ProtocolReader.fromValue({ a: ["ls", 1] }).readNonBlankStringArray("a", 3, 2), "$.a.1", "Expected a string.");
    assertJsonError(() => ProtocolReader.fromValue({ a: ["abcd"] }).readNonBlankStringArray("a", 3, 2), "$.a.0", "Expected at most 3 characters.");
    assertJsonError(() => ProtocolReader.fromValue({ a: ["ls", " "] }).readNonBlankStringArray("a", 3, 2), "$.a.1", "The item must not be blank.");
  }
}
