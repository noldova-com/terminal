/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ArgumentProblem, ArgumentValidator } from "@noldova/terminal.protocol";

import { Expect } from "../support/expect.ts";

function assertArgumentError(action: () => void, parameterName: string, reason: string): void {
  Assert.isTrue(reason.startsWith(`${parameterName} `));
  const error: ArgumentException = Assert.throws(action, ArgumentException);
  Assert.areEqual(parameterName, error.parameterName);
  Assert.areEqual(`The value${reason.slice(parameterName.length)} (Parameter '${parameterName}')`, error.message);
}

@TestClass
export class ArgumentValidatorTests {
  @TestMethod
  public requireIdentifierAcceptsAnIdentifierOfUpTo200Characters(): void {
    ArgumentValidator.requireIdentifier("id", "a".repeat(200));
  }

  @TestMethod
  public requireIdentifierRefusesALongerIdentifier(): void {
    assertArgumentError(() => ArgumentValidator.requireIdentifier("id", "a".repeat(201)), "id", "id must have at most 200 characters.");
  }

  @TestMethod
  public requireIdentifierRefusesABlankIdentifier(): void {
    assertArgumentError(() => ArgumentValidator.requireIdentifier("id", " "), "id", "id must not be blank.");
  }

  @TestMethod
  public requireAbsolutePathAcceptsAPathFromTheUnixRootAWindowsDriveOrAWindowsShare(): void {
    for (const path of ["/", "/work/project", "C:\\", "c:/work", "\\\\server\\share"])
      ArgumentValidator.requireAbsolutePath("folder", path);
  }

  @TestMethod
  public requireAbsolutePathRefusesARelativePathADrivesRelativePathAndARootedPathWithoutADrive(): void {
    for (const path of ["work", "./work", "C:work", "\\work"])
      assertArgumentError(() => ArgumentValidator.requireAbsolutePath("folder", path), "folder", "folder must be an absolute path.");
  }

  @TestMethod
  public requireAbsolutePathRefusesABlankOrOverLongPath(): void {
    assertArgumentError(() => ArgumentValidator.requireAbsolutePath("folder", " "), "folder", "folder must not be blank.");
    assertArgumentError(() => ArgumentValidator.requireAbsolutePath("folder", `/${"a".repeat(4_096)}`), "folder", "folder must have at most 4096 characters.");
  }

  @TestMethod
  public requireNonBlankAcceptsTextUpToItsMaximumLength(): void {
    ArgumentValidator.requireNonBlank("name", "abc", 3);
  }

  @TestMethod
  public requireNonBlankRefusesAnEmptyString(): void {
    assertArgumentError(() => ArgumentValidator.requireNonBlank("name", "", 3), "name", "name must not be blank.");
  }

  @TestMethod
  public requireScriptAcceptsSeveralLinesEndedByALineFeedOrACarriageReturnAndLineFeedWithTabsUpTo16384Characters(): void {
    ArgumentValidator.requireScript("command", "npm install\r\nnpm test\n\techo done");
    ArgumentValidator.requireScript("command", "c".repeat(16_384));
  }

  @TestMethod
  public requireScriptRefusesBlankOrOverLongCommands(): void {
    assertArgumentError(() => ArgumentValidator.requireScript("command", " \n "), "command", "command must not be blank.");
    assertArgumentError(() => ArgumentValidator.requireScript("command", "c".repeat(16_385)), "command", "command must have at most 16384 characters.");
  }

  @TestMethod
  public requireScriptRefusesALoneCarriageReturnAndEveryOtherControlCharacter(): void {
    for (const command of ["a\rb", "a\r", "a\u001b", "a\u0000", "a\u000b", "a\u000c", "a\u007f", "a\u0085"])
      assertArgumentError(() => ArgumentValidator.requireScript("command", command), "command",
        "command must not hold a control character other than a line break or a tab.");
  }

  @TestMethod
  public requireScriptRefusesEveryFormatOrDefaultIgnorableCharacterNamingItAndTakesTheCharactersBesideThem(): void {
    const refusal = (code: number): string =>
      `command holds U+${code.toString(16).toUpperCase().padStart(4, "0")}, a format or default-ignorable character, which would make it read differently from what runs.`;
    for (const code of [0x00ad, 0x034f, 0x0600, 0x061c, 0x115f, 0x1160, 0x17b4, 0x180b, 0x180f, 0x200b, 0x200d, 0x200f, 0x202a, 0x202e, 0x2060,
      0x2064, 0x2066, 0x2069, 0x206a, 0x206f, 0x3164, 0xfe00, 0xfe0f, 0xfeff, 0xffa0, 0xfff0, 0xfff9, 0x1bca0, 0x1d173, 0xe0001, 0xe0041,
      0xe007f, 0xe0100, 0xe01ef, 0xe0fff])
      assertArgumentError(() => ArgumentValidator.requireScript("command", `echo "a${String.fromCodePoint(code)}b"`), "command", refusal(code));
    for (const code of [0x00ac, 0x034e, 0x061b, 0x115e, 0x200a, 0x2010, 0x2029, 0x202f, 0x205f, 0x2070, 0x3165, 0xfe10, 0xfefc, 0xffa1, 0xe1000])
      ArgumentValidator.requireScript("command", `echo "a${String.fromCodePoint(code)}b"`);
  }

  @TestMethod
  public requireScriptTakesEmojiTheirJoinersVariationSelectorsAndTagsIncludedButRefusesAHiddenCharacterBesideOne(): void {
    const family: string = String.fromCodePoint(0x1f468, 0x200d, 0x1f469, 0x200d, 0x1f467);
    const england: string = String.fromCodePoint(0x1f3f4, 0xe0067, 0xe0062, 0xe0065, 0xe006e, 0xe0067, 0xe007f);
    const heart: string = String.fromCodePoint(0x2764, 0xfe0f);
    const keycap: string = String.fromCodePoint(0x31, 0xfe0f, 0x20e3);

    for (const emoji of [family, england, heart, keycap])
      ArgumentValidator.requireScript("command", `git commit -m "${emoji} done"`);
    assertArgumentError(() => ArgumentValidator.requireScript("command", `echo "${heart}${String.fromCodePoint(0x200b)}"`), "command",
      "command holds U+200B, a format or default-ignorable character, which would make it read differently from what runs.");
  }

  @TestMethod
  public requireCommandNamesAcceptsNoNamesAnd64NamesOfUpTo4096Characters(): void {
    ArgumentValidator.requireCommandNames("names", []);
    ArgumentValidator.requireCommandNames("names", Array.from({ length: 64 }, () => "x".repeat(4_096)));
  }

  @TestMethod
  public requireCommandNamesRefusesA65thNameABlankNameAndALongerName(): void {
    assertArgumentError(() => ArgumentValidator.requireCommandNames("names", Array.from({ length: 65 }, () => "ls")), "names",
      "names must hold at most 64 names.");
    assertArgumentError(() => ArgumentValidator.requireCommandNames("names", ["ls", " "]), "names", "names must not be blank.");
    assertArgumentError(() => ArgumentValidator.requireCommandNames("names", ["x".repeat(4_097)]), "names", "names must have at most 4096 characters.");
  }

  @TestMethod
  public requireMaximumLengthAcceptsAnEmptyString(): void {
    ArgumentValidator.requireMaximumLength("data", "", 3);
  }

  @TestMethod
  public requireMaximumLengthRefusesALongerString(): void {
    assertArgumentError(() => ArgumentValidator.requireMaximumLength("data", "abcd", 3), "data", "data must have at most 3 characters.");
  }

  @TestMethod
  public requireIntegerInRangeAcceptsEitherBound(): void {
    ArgumentValidator.requireIntegerInRange("rows", 1, 1, 5);
    ArgumentValidator.requireIntegerInRange("rows", 5, 1, 5);
  }

  @TestMethod
  public requireIntegerInRangeRefusesANumberOutsideTheRangeAFractionNaNAndInfinity(): void {
    for (const value of [0, 6, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      assertArgumentError(() => ArgumentValidator.requireIntegerInRange("rows", value, 1, 5), "rows", "rows must be a whole number from 1 to 5.");
      Assert.isTrue(Object.is(Assert.throws(() => ArgumentValidator.requireIntegerInRange("rows", value, 1, 5), ArgumentOutOfRangeException).actualValue, value));
    }
  }

  @TestMethod
  public requireEnvironmentAcceptsNoVariables256PortableNamesValuesOf32767CharactersAnd131072CharactersOfNamesAndValuesInAll(): void {
    ArgumentValidator.requireEnvironment("environment", {});
    ArgumentValidator.requireEnvironment("environment", Object.fromEntries(Array.from({ length: 256 }, (_, t) => [`_V${String(t).padStart(3, "0")}`, "v".repeat(507)])));
    ArgumentValidator.requireEnvironment("environment", { A: "v".repeat(32_767), B: "v".repeat(32_767), C: "v".repeat(32_767), D: "v".repeat(32_767) });
    ArgumentValidator.requireEnvironment("environment", { ["N".repeat(256)]: "", path_2: "x", TERMINAL: "x", NOLDOVA_TERMINALS: "x" });
  }

  @TestMethod
  public requireEnvironmentRefusesA257thVariable(): void {
    assertArgumentError(() => ArgumentValidator.requireEnvironment("environment", Object.fromEntries(Array.from({ length: 257 }, (_, t) => [`V${t}`, ""]))),
      "environment", "environment must have at most 256 variables.");
  }

  @TestMethod
  public requireEnvironmentRefusesNamesThatArentPortableWithoutRepeatingThem(): void {
    for (const name of ["", "1A", "A-B", "A B", "A=B", "Ä","N".repeat(257)])
      assertArgumentError(() => ArgumentValidator.requireEnvironment("environment", { [name]: "x" }), "environment",
        "environment holds a name that isn't a portable variable name: a letter or _, then letters, digits or _.");
  }

  @TestMethod
  public requireEnvironmentRefusesTheNamesTheTerminalSetsItself(): void {
    for (const name of ["TERM", "term", "COLORTERM", "ZDOTDIR", "zdotdir", "NOLDOVA_TERMINAL_NONCE", "noldova_terminal_login", "NOLDOVA_TERMINAL_"])
      assertArgumentError(() => ArgumentValidator.requireEnvironment("environment", { [name]: "secret-value" }), `environment.${name}`,
        `environment.${name} is set by the terminal itself, so it can't be given.`);
  }

  @TestMethod
  public requireEnvironmentRefusesNamesAndValuesOfMoreThan131072CharactersInAllNeverRepeatingThem(): void {
    assertArgumentError(() => ArgumentValidator.requireEnvironment("environment", { A: "s".repeat(32_767), B: "s".repeat(32_767), C: "s".repeat(32_767),
      D: "s".repeat(32_767), E: "" }), "environment", "environment must have at most 131072 characters of names and values in all.");
  }

  @TestMethod
  public requireEnvironmentRefusesTwoNamesThatDifferOnlyInCase(): void {
    assertArgumentError(() => ArgumentValidator.requireEnvironment("environment", { Path: "a", PATH: "b" }), "environment.PATH",
      "environment.PATH and environment.Path differ only in case, which Windows reads as one variable.");
  }

  @TestMethod
  public requireEnvironmentRefusesAValueThatIsntAStringIsTooLongOrHoldsANullCharacterAndNeverRepeatsIt(): void {
    assertArgumentError(() => ArgumentValidator.requireEnvironment("environment", { TOKEN: 42 } as unknown as Record<string, string>),
      "environment.TOKEN", "environment.TOKEN must be a string.");
    assertArgumentError(() => ArgumentValidator.requireEnvironment("environment", { TOKEN: "s".repeat(32_768) }), "environment.TOKEN",
      "environment.TOKEN must have at most 32767 characters.");
    assertArgumentError(() => ArgumentValidator.requireEnvironment("environment", { TOKEN: "sec\u0000ret" }), "environment.TOKEN",
      "environment.TOKEN must not hold a null character.");
  }

  @TestMethod
  public requireOneOfAcceptsAValueAllowedAndRefusesAnotherListingTheValues(): void {
    ArgumentValidator.requireOneOf("whenBusy", "Refuse", ["Refuse", "Interrupt"]);
    assertArgumentError(() => ArgumentValidator.requireOneOf("whenBusy", "Wait", ["Refuse", "Interrupt"]), "whenBusy",
      "whenBusy must be one of Refuse, Interrupt.");
  }

  @TestMethod
  public requireEachOneOfAcceptsNoItemsAndItemsAllowedAndRefusesTheFirstOtherItemByItsIndex(): void {
    ArgumentValidator.requireEachOneOf("shellKinds", [], ["Bash", "Zsh"]);
    ArgumentValidator.requireEachOneOf("shellKinds", ["Zsh", "Bash"], ["Bash", "Zsh"]);
    assertArgumentError(() => ArgumentValidator.requireEachOneOf("shellKinds", ["Bash", "Csh", "Tcsh"], ["Bash", "Zsh"]), "shellKinds.1",
      "shellKinds.1 must be one of Bash, Zsh.");
  }

  @TestMethod
  public findProblemGivesEachRefusalAsAReasonWithoutASuffixWhichTheRequireFormThrowsWithContextsSuffix(): void {
    const cases: readonly (readonly [string, () => ArgumentProblem | null, () => void, string, string])[] = [
      ["an identifier", () => ArgumentValidator.findIdentifierProblem("id", " "), () => ArgumentValidator.requireIdentifier("id", " "), "id", "id must not be blank."],
      ["a non-blank string", () => ArgumentValidator.findNonBlankProblem("notice", "abcd", 3), () => ArgumentValidator.requireNonBlank("notice", "abcd", 3),
        "notice", "notice must have at most 3 characters."],
      ["an absolute path", () => ArgumentValidator.findAbsolutePathProblem("folder", "work"), () => ArgumentValidator.requireAbsolutePath("folder", "work"),
        "folder", "folder must be an absolute path."],
      ["a maximum length", () => ArgumentValidator.findMaximumLengthProblem("title", "abc", 2), () => ArgumentValidator.requireMaximumLength("title", "abc", 2),
        "title", "title must have at most 2 characters."],
      ["an environment", () => ArgumentValidator.findEnvironmentProblem("environment", { TERM: "secret-value" }),
        () => ArgumentValidator.requireEnvironment("environment", { TERM: "secret-value" }), "environment.TERM",
        "environment.TERM is set by the terminal itself, so it can't be given."],
      ["command names", () => ArgumentValidator.findCommandNamesProblem("names", ["git", " "]), () => ArgumentValidator.requireCommandNames("names", ["git", " "]),
        "names", "names must not be blank."],
      ["a command", () => ArgumentValidator.findCommandProblem("command", "ls\n"), () => ArgumentValidator.requireCommand("command", "ls\n"), "command",
        "command must not hold a control character, such as a line break, since the terminal types it as one line and enters it."],
      ["a script", () => ArgumentValidator.findScriptProblem("command", "ls\u0007"), () => ArgumentValidator.requireScript("command", "ls\u0007"), "command",
        "command must not hold a control character other than a line break or a tab."],
      ["an integer in range", () => ArgumentValidator.findIntegerInRangeProblem("rows", 0, 1, 5), () => ArgumentValidator.requireIntegerInRange("rows", 0, 1, 5),
        "rows", "rows must be a whole number from 1 to 5."],
      ["one of", () => ArgumentValidator.findOneOfProblem("whenBusy", "Wait", ["Refuse"]), () => ArgumentValidator.requireOneOf("whenBusy", "Wait", ["Refuse"]),
        "whenBusy", "whenBusy must be one of Refuse."],
      ["each one of", () => ArgumentValidator.findEachOneOfProblem("shellKinds", ["Csh"], ["Bash"]), () => ArgumentValidator.requireEachOneOf("shellKinds", ["Csh"], ["Bash"]),
        "shellKinds.0", "shellKinds.0 must be one of Bash."]
    ];

    for (const [what, find, require, parameterName, reason] of cases) {
      const problem: ArgumentProblem | null = find();

      Assert.isTrue(problem instanceof ArgumentProblem, `${what} gave no problem.`);
      Expect.same([parameterName, reason, `The value${reason.slice(parameterName.length)}`], [problem?.parameterName, problem?.reason, problem?.message]);
      Assert.isTrue(problem?.reason.includes("(Parameter") === false);
      assertArgumentError(require, parameterName, reason);
    }
  }

  @TestMethod
  public findProblemGivesNullForAnAcceptedValueAndThrowIfProblemThenThrowsNothing(): void {
    const problems: readonly (ArgumentProblem | null)[] = [
      ArgumentValidator.findIdentifierProblem("id", "session-1"),
      ArgumentValidator.findNonBlankProblem("notice", "abc", 3),
      ArgumentValidator.findAbsolutePathProblem("folder", "/work"),
      ArgumentValidator.findMaximumLengthProblem("title", "", 2),
      ArgumentValidator.findEnvironmentProblem("environment", { API_URL: "https://example.com" }),
      ArgumentValidator.findCommandNamesProblem("names", ["git"]),
      ArgumentValidator.findCommandProblem("command", "ls"),
      ArgumentValidator.findScriptProblem("command", "ls\nnpm test"),
      ArgumentValidator.findIntegerInRangeProblem("rows", 5, 1, 5),
      ArgumentValidator.findOneOfProblem("whenBusy", "Refuse", ["Refuse"]),
      ArgumentValidator.findEachOneOfProblem("shellKinds", ["Bash"], ["Bash"])
    ];

    Expect.same(problems.map(() => null), problems);
    ArgumentValidator.throwIfProblem(null);
  }

  @TestMethod
  public findProblemThrowsAProblemAsAnArgumentExceptionWithItsMessageAndParameter(): void {
    assertArgumentError(() => ArgumentValidator.throwIfProblem(new ArgumentProblem("folder", "folder must be an absolute path.", "The value must be an absolute path.")),
      "folder", "folder must be an absolute path.");
  }
}
