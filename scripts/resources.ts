/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class Resources {
  public static readonly posixSeparator: string = "/";
  public static readonly windowsSeparator: string = "\\";
  public static readonly lineFeed: string = "\n";
  public static readonly versionSeparator: string = ".";
  public static readonly textEncoding: BufferEncoding = "utf8";
  public static readonly headerEncoding: BufferEncoding = "latin1";
  public static readonly jsonIndent: number = 2;
  public static readonly windowsPlatform: string = "win32";
  public static readonly pathVariable: string = "PATH";
  public static readonly npmPathVariable: string = "npm_execpath";
  public static readonly npmCommand: string = "npm";
  public static readonly ignoredStdio: "ignore" = "ignore";
  public static readonly pipedStdio: "pipe" = "pipe";
  public static readonly inheritedStdio: "inherit" = "inherit";
  public static readonly outputLimit: number = 16 * 1024 * 1024;
  public static readonly signalExitCode: number = 128;
  public static readonly gitCommand: string = "git";
  public static readonly gitTimeout: number = 60_000;
  public static readonly gitSuccessCodes: readonly number[] = [0];
  public static readonly notExecutableCodes: readonly string[] = ["ENOENT", "ENOTDIR", "EACCES"];
  public static readonly npmTimeout: number = 600_000;
  public static readonly npmUnavailable: string = "npm_execpath is not set; run this through npm, such as npm run build or npm test.";
  public static readonly modulesFolder: string = "node_modules";
  public static readonly sourceFolder: string = "src";
  public static readonly apiFolder: string = "api";
  public static readonly moduleFolder: string = "src/noldova.terminal";
  public static readonly protocolFolder: string = "src/noldova.terminal.protocol";
  public static readonly windowFolder: string = "src/noldova.terminal.window";
  public static readonly cliFolder: string = "src/noldova.terminal.cli";
  public static readonly packageFolders: readonly string[] = [Resources.protocolFolder, Resources.windowFolder, Resources.moduleFolder];
  public static readonly archivesFolder: string = "_packages";
  public static readonly workSegments: readonly string[] = ["_build", "packages"];
  public static readonly compiledSegments: readonly string[] = ["_build", "compiled"];
  public static readonly gitFolder: string = ".git";
  public static readonly manifestFile: string = "package.json";
  public static readonly moduleFile: string = "module.json";
  public static readonly versionFile: string = "version.json";
  public static readonly licenseFile: string = "LICENSE";
  public static readonly readmeFile: string = "README.md";
  public static readonly projectFile: string = "tsconfig.json";
  public static readonly specProjectFile: string = "tsconfig.spec.json";
  public static readonly moduleFiles: readonly string[] = [Resources.moduleFile, "settings.json", "menus.json", "cli.json", "webViews.json"];
  public static readonly windowEntry: string = "window.ts";
  public static readonly sourceExtension: string = ".ts";
  public static readonly declarationExtension: string = ".d.ts";
  public static readonly scriptExtension: string = ".js";
  public static readonly archiveExtension: string = ".tgz";
  public static readonly entryDeclaration: string = `index${Resources.declarationExtension}`;
  public static readonly manifestExport: string = `./${Resources.manifestFile}`;
  public static readonly fileExports: readonly string[] = [Resources.manifestExport, "./menus.json"];
  public static readonly declarationImportPattern: RegExp = /(from\s+"\.{1,2}\/[^"]*)\.d\.ts"/g;
  public static readonly declarationImportReplacement: string = `$1${Resources.scriptExtension}"`;
  public static readonly scope: string = "@noldova";
  public static readonly modulePackageName: string = "@noldova/terminal";
  public static readonly ownPackagePrefix: string = `${Resources.modulePackageName}.`;
  public static readonly protocolPackageName: string = "@noldova/terminal.protocol";
  public static readonly angularPrefix: string = "@angular/";
  public static readonly desktopPrefix: string = "@noldova/desktop.";
  public static readonly contextPrefix: string = "@noldova/context.";
  public static readonly noldovaScope: string = "@noldova/";
  public static readonly rangedPrefixes: readonly string[] = [Resources.desktopPrefix, Resources.contextPrefix];
  public static readonly peerPrefixes: readonly string[] = [Resources.angularPrefix, ...Resources.rangedPrefixes];
  public static readonly uiKitNames: readonly string[] = ["@noldova/ui.components.angular"];
  public static readonly ownPin: string = "*";
  public static readonly versionPlaceholder: string = "__VERSION__";
  public static readonly idField: string = "id";
  public static readonly nameField: string = "name";
  public static readonly versionField: string = "version";
  public static readonly displayNameField: string = "displayName";
  public static readonly descriptionField: string = "description";
  public static readonly partsField: string = "parts";
  public static readonly pseudoTerminalsField: string = "pseudoTerminals";
  public static readonly dependenciesField: string = "dependencies";
  public static readonly devDependenciesField: string = "devDependencies";
  public static readonly optionalDependenciesField: string = "optionalDependencies";
  public static readonly peersField: string = "peerDependencies";
  public static readonly peersMetaField: string = "peerDependenciesMeta";
  public static readonly optionalField: string = "optional";
  public static readonly desktopCoreField: string = "noldovaDesktop";
  public static readonly contributesField: string = "contributes";
  public static readonly exportsField: string = "exports";
  public static readonly privateField: string = "private";
  public static readonly commitField: string = "gitHead";
  public static readonly moduleFields: readonly string[] = [
    Resources.idField,
    Resources.versionField,
    Resources.displayNameField,
    Resources.descriptionField,
    Resources.partsField,
    Resources.pseudoTerminalsField,
    Resources.dependenciesField,
    Resources.desktopCoreField,
    Resources.contributesField
  ];
  public static readonly textFields: readonly string[] = [Resources.displayNameField, Resources.descriptionField];
  public static readonly dependencyFields: readonly string[] = [Resources.dependenciesField, Resources.devDependenciesField, Resources.optionalDependenciesField, Resources.peersField];
  public static readonly partPinFields: readonly string[] = [Resources.dependenciesField, Resources.devDependenciesField, Resources.optionalDependenciesField];
  public static readonly pinFields: readonly string[] = [Resources.dependenciesField, Resources.peersField, Resources.optionalDependenciesField];
  public static readonly partFolders: ReadonlyMap<string, string> = new Map<string, string>([
    ["runtime", `${Resources.moduleFolder}/${Resources.sourceFolder}`],
    ["window", Resources.windowFolder],
    ["cli", Resources.cliFolder]
  ]);
  public static readonly toolsKind: string = "tools";
  public static readonly contributionKinds: readonly string[] = [
    "methods", "events", "commands", "notifications", "views", "documents", "statusBarItems", "topBarActions", "menus", "themes", "settings", "settingScopes",
    "cliCommands", Resources.toolsKind
  ];
  public static readonly reservedModuleId: string = "desktop";
  public static readonly moduleIdSeparator: string = "-";
  public static readonly toolNameSeparator: string = "_";
  public static readonly idPattern: RegExp = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
  public static readonly versionPattern: RegExp = /^(?:0|[1-9][0-9]{0,8})\.(?:0|[1-9][0-9]{0,8})\.(?:0|[1-9][0-9]{0,8})$/;
  public static readonly namePattern: RegExp = /^[a-z][a-zA-Z0-9]*$/;
  public static readonly toolPattern: RegExp = /^[a-z][a-z0-9_]{0,63}$/;
  public static readonly declarationPinPattern: RegExp = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/;
  public static readonly archivePinPattern: RegExp = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;
  public static readonly rangePattern: RegExp = /^>=((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)) <((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/;
  public static readonly scopePattern: RegExp = /^@([^/]+)\/(.+)$/;
  public static readonly scopeReplacement: string = "$1-$2";
  public static readonly packageManifest: string = "The package's manifest";
  public static readonly windowPackageManifest: string = "The window package's manifest";
  public static readonly rootManifest: string = "The root manifest";
  public static readonly moduleIdInvalid: string = "module.json's id must be lowercase kebab-case and not \"desktop\".";
  public static readonly moduleVersionInvalid: string = "module.json's version must be <major>.<minor>.<patch>, three whole numbers of up to nine digits without leading zeros.";
  public static readonly pseudoTerminalsRequired: string = "module.json's pseudoTerminals must be true, since the runtime part starts its shells in Noldova Desktop's pseudo-terminals.";
  public static readonly moduleDependenciesInvalid: string = "module.json's dependencies must be an object from module ids to exact versions.";
  public static readonly moduleContributesInvalid: string = "module.json's contributes must be an object.";
  public static readonly moduleFieldsInvalid: string = `module.json must have exactly the fields ${Resources.moduleFields.join(", ")}.`;
  public static readonly packageNameRequired: string = `The package's manifest must name it ${Resources.modulePackageName}.`;
  public static readonly packageVersionRequired: string = `The package's manifest must write its version as ${Resources.versionPlaceholder}, which packing sets to version.json's.`;
  public static readonly packagePeersInvalid: string = `The package's manifest's ${Resources.peersField} must be an object.`;
  public static readonly packagePrivate: string = "The package's manifest must not be private: the module ships as published packages.";
  public static readonly desktopCoreInvalid: string = "module.json's noldovaDesktop must be >=<lowest> <first refused>, from the Noldova Desktop version the module builds against to the next minor below 1.0, or the next major from 1.0.";
  public static readonly rangeAlternative: string = " or a range of the form >=<lowest> <first refused>, where the first refused is the next minor below 1.0 and the next major from 1.0";
  public static readonly peerRangeAlternative: string = ", or a range of the form >=<lowest> <first refused>, where the first refused is the next minor below 1.0 and the next major from 1.0,";
  public static readonly angularForm: string = "a range of the form >=<the Angular it builds with> <the next major>";
  public static readonly nothingText: string = "nothing";
  public static readonly missingText: string = "missing";
  public static readonly archiveFolder: string = "package";
  public static readonly manifestEntryName: string = `${Resources.archiveFolder}/${Resources.manifestFile}`;
  public static readonly moduleEntryName: string = `${Resources.archiveFolder}/${Resources.moduleFile}`;
  public static readonly partExports: readonly string[] = ["./runtime", "./window"];
  public static readonly windowSuffix: string = ".window";
  public static readonly archiveBlock: number = 512;
  public static readonly nodeArgumentCodePrefix: string = "ERR_";
  public static readonly archiveNameEnd: number = 100;
  public static readonly archiveSizeStart: number = 124;
  public static readonly archiveSizeEnd: number = 136;
  public static readonly archiveTypeAt: number = 156;
  public static readonly archivePrefixStart: number = 345;
  public static readonly archivePrefixEnd: number = 500;
  public static readonly archiveSizeRadix: number = 8;
  public static readonly archiveFileTypes: readonly string[] = ["0", "\0"];
  public static readonly archiveExtendedType: string = "x";
  public static readonly archivePathRecord: RegExp = /^\d+ path=(.*)$/m;
  public static readonly archiveFieldEnd: RegExp = /\0.*$/s;
  public static readonly packageImportPattern: RegExp = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(["'])((?:@[^/"']+\/)?[^/"'.][^/"']*)(?:\/[^"']*)?\1/g;
  public static readonly quotes: readonly string[] = ["\"", "'", "`"];
  public static readonly escapeCharacter: string = "\\";
  public static readonly commentSlash: string = "/";
  public static readonly commentStar: string = "*";
  public static readonly blockCommentStart: string = "/*";
  public static readonly blockCommentEnd: string = "*/";
  public static readonly packArguments: readonly string[] = ["pack", "--ignore-scripts", "--loglevel=error", "--pack-destination"];
  public static readonly statusArguments: readonly string[] = ["status", "--porcelain"];
  public static readonly commitArguments: readonly string[] = ["rev-parse", "HEAD"];
  public static readonly listCopiesOption: string = "--list-copies";
  public static readonly endOfCopies: string = "end of copies\n";
  public static readonly runThroughNpmRunBuild: string = "Run it with npm run build, which installs the dependencies through npm.";
  public static readonly installingPackages: string = "Installing npm packages…";
  public static readonly cleanInstallArguments: readonly string[] = ["ci", "--ignore-scripts", "--no-audit", "--no-fund"];
  public static readonly projectOption: string = "--project";
  public static readonly typeScriptCompiler: readonly string[] = [Resources.modulesFolder, "typescript", "bin", "tsc"];
  public static readonly protocolProject: string = `${Resources.protocolFolder}/${Resources.projectFile}`;
  public static readonly moduleProject: string = `${Resources.moduleFolder}/${Resources.projectFile}`;
  public static readonly compilerManifest: readonly string[] = [Resources.modulesFolder, "@angular", "compiler-cli", Resources.manifestFile];
  public static readonly compilerCommand: string = "ngc";
  public static readonly compilerProjectOption: string = "-p";
  public static readonly angularWorkPrefix: string = "noldova-angular-package-";
  public static readonly angularCompileTimeout: number = 300_000;
  public static readonly cdkPackage: string = "@angular/cdk";
  public static readonly cdkListArguments: readonly string[] = ["ls", Resources.cdkPackage, "--all", "--json", "--long"];
  public static readonly npmListDependencies: string = "dependencies";
  public static readonly npmListVersion: string = "version";
  public static readonly npmListPath: string = "path";
  public static readonly npmListError: string = "error";
  public static readonly npmListCode: string = "code";
  public static readonly npmListSummary: string = "summary";
  public static readonly npmListProblemsCode: string = "ELSPROBLEMS";
  public static readonly cdkOneCopyAdvice: string = "Install the version the UI kit pins, so npm keeps one copy.\n";
  public static readonly optionPrefix: string = "--";
  public static readonly skipTestDetails: string = "--skip-test-details";
  public static readonly skipCoverageDetails: string = "--skip-coverage-details";
  public static readonly testOptions: readonly string[] = [Resources.skipTestDetails, Resources.skipCoverageDetails];
  public static readonly dotReporter: string = "--reporter=dot";
  public static readonly skipFullCoverage: string = "--coverage.skipFull";
  public static readonly coverageMetrics: readonly string[] = ["statements", "branches", "functions", "lines"];
  public static readonly vitestArguments: readonly string[] = [`${Resources.modulesFolder}/vitest/vitest.mjs`, "run", "--coverage"];
  public static readonly typeScriptCompilerPath: string = Resources.typeScriptCompiler.join(Resources.posixSeparator);
  public static readonly testChecks: readonly (readonly string[])[] = [
    ["scripts/checks/archive-age-check.ts"],
    ["scripts/declarations/declaration-check.ts"],
    ["scripts/checks/test-wait-check.ts"],
    ["scripts/checks/api-declaration-check.ts"],
    ["scripts/checks/api-example-check.ts"],
    [Resources.typeScriptCompilerPath, Resources.projectOption, `scripts/${Resources.projectFile}`],
    [Resources.typeScriptCompilerPath, Resources.projectOption, `${Resources.windowFolder}/scripts/${Resources.projectFile}`],
    [Resources.typeScriptCompilerPath, Resources.projectOption, `${Resources.protocolFolder}/${Resources.specProjectFile}`],
    [Resources.typeScriptCompilerPath, Resources.projectOption, `${Resources.moduleFolder}/${Resources.specProjectFile}`]
  ];
  public static readonly lineEnd: string = "\n";
  public static readonly testWaitSourceFolders: readonly string[] = [Resources.sourceFolder, "scripts"];
  public static readonly testWaitSkippedFolders: ReadonlySet<string> = new Set([Resources.modulesFolder, Resources.gitFolder, "_build", "_packages", "dist", ".angular"]);
  public static readonly testWaitExtensions: ReadonlySet<string> = new Set([".ts", ".mts", ".cts", ".js", ".mjs", ".cjs"]);
  public static readonly testWaitTestFolders: ReadonlySet<string> = new Set(["tests", "e2e", "fixtures"]);
  public static readonly testWaitSpecSuffix: string = ".spec.ts";
  public static readonly testWaitListHeader: string = "| Test file | Why it pauses |";
  public static readonly testWaitListRow: RegExp = /^\| `([^`]+)` \| .+ \|$/;
  public static readonly testWaitTableRowPrefix: string = "|";
  public static readonly testWaitPauses: readonly RegExp[] = [
    /\bimport\s*(?:\{[^}]*\b(?:setTimeout|scheduler)\b[^}]*\}|\*\s*as\s+[\w$]+|[\w$]+)\s*from\s*["'](?:node:)?timers\/promises["']/g,
    /\bscheduler\.wait\s*\(/g,
    /\bAtomics\.wait(?:Async)?\s*\(/g,
    /\bwaitForTimeout\s*\(/g,
    /\brequestAnimationFrame\s*\(/g,
    /(?<![.\w$])setTimeout\(\s*[A-Za-z_$][\w$]*\s*,/g,
    /(?<![.\w$])setTimeout\([^\n]*,\s*\d[\d_]*\s*\)/g,
    /\bnew\s+Promise\b(?:<[^>\n]*>)?\(\s*\(?\s*[A-Za-z_$][\w$]*\s*\)?\s*=>\s*\{?\s*setTimeout\s*\(/g
  ];
  public static readonly testWaitQuotes: readonly string[] = ["\"", "'", "`"];
  public static readonly testWaitEscape: string = "\\";
  public static readonly testWaitWindowFolder: string = "src/noldova.terminal.window/";
  public static readonly testWaitLimitedCalls: RegExp = /\b(?:vi\.waitFor|expect\.poll)(?:<[^()]*>)?\(/g;
  public static readonly testWaitObjectStart: string = "{";
  public static readonly testWaitTimeoutProperty: RegExp = /^\s*(["']?)timeout\1\s*(?::|$)/u;
  public static readonly testWaitOpenings: string = "([{";
  public static readonly testWaitClosings: string = ")]}";
  public static readonly testWaitArgumentSeparator: string = ",";
  public static readonly testWaitRegexDelimiter: string = "/";
  public static readonly testWaitRegexStarts: string = "(,=:[!&|?{};>";
  public static readonly testWaitClassStart: string = "[";
  public static readonly testWaitClassEnd: string = "]";
  public static readonly runnerTempVariable: string = "RUNNER_TEMP";
  public static readonly nodeTypesPackage: string = "@types/node";
  public static readonly installedArchivePrefix: string = "noldova-terminal";
  public static readonly installedPeers: readonly string[] = ["@noldova/desktop.runtime", "@noldova/desktop.protocol", "@noldova/context.core",
    "@noldova/context.exceptions", "@noldova/context.json", "@noldova/context.text", "@noldova/context.collections"];
  public static readonly installedWorkPrefix: string = "noldova-terminal-fixture-";
  public static readonly installedAppFolder: string = "fixture-app";
  public static readonly installedPeersFolder: string = "fixture-peers";
  public static readonly installedOpenScript: string = "open-terminal.ts";
  public static readonly installedAppFiles: readonly string[] = [Resources.installedOpenScript, "open-terminal.resources.ts", "installed-part-failed.exception.ts"];
  public static readonly installedServiceModule: string = "read-owners-service.ts";
  public static readonly installedAppManifest: string = `${JSON.stringify({ name: "fixture-app", private: true, type: "module" }, null, 2)}\n`;
  public static readonly installedPackArguments: readonly string[] = ["pack", "--ignore-scripts", "--silent"];
  public static readonly installedInstallArguments: readonly string[] = ["install", "--no-audit", "--no-fund", "--ignore-scripts"];
  public static readonly installedCompileArguments: readonly string[] = ["--noEmit", "--strict", "--module", "nodenext", "--moduleResolution", "nodenext",
    "--target", "es2025", "--lib", "es2025,esnext.disposable", "--types", "node", "--allowImportingTsExtensions", "--verbatimModuleSyntax"];
  public static readonly installedServiceSource: string = [
    "import type { IRuntimePartContext } from \"@noldova/desktop.runtime\";",
    "import { RuntimeTerminalOwners } from \"@noldova/terminal.protocol\";",
    "",
    "export async function closeChatTerminalsAsync(context: IRuntimePartContext, chatId: string): Promise<void> {",
    "  await context.getService(\"terminal.owners\", RuntimeTerminalOwners).closeAsync(`example.chat/${chatId}`);",
    "}",
    ""
  ].join("\n");
  public static readonly installedArchivesMissing: string = "_packages must hold the module's three archives; run npm run build first.";
  public static readonly installedPeersMissing: string = "node_modules must hold Noldova Desktop's runtime and the packages it depends on; run npm ci first.";
  public static readonly installedNodeTypesMissing: string = "The root manifest's devDependencies must pin @types/node, which the fixture app installs to compile against the packages' declarations.";
  public static readonly installedCompiled: string = "Compiled a getService call for the owners service, and the fixture's own script, against the installed packages and their declarations.\n";
  public static readonly installedPackageTest: string = "scripts/tests/installed-package/install-and-open.ts";
  public static readonly vitestFiles: string = "testResults";
  public static readonly vitestTests: string = "assertionResults";
  public static readonly vitestName: string = "fullName";
  public static readonly vitestStatus: string = "status";
  public static readonly vitestPassed: string = "passed";
  public static readonly vitestFileName: string = "name";
  public static readonly vitestStartTime: string = "startTime";
  public static readonly vitestEndTime: string = "endTime";
  public static readonly unitFileBudget: number = 1_000;
  public static readonly vitestDuration: string = "duration";
  public static readonly timingRuns: number = 3;
  public static readonly timingMargin: number = 1.2;
  public static readonly specMedianBudget: number = 100;
  public static readonly slowComponentTest: number = 1_000;
  public static readonly timingFolder: readonly string[] = ["_build", "timing"];
  public static readonly unitTimingName: string = "unit";
  public static readonly specTimingName: string = "specs";
  public static readonly outputFileJsonOption: string = "--outputFile.json=";
  public static readonly unitTimingArguments: readonly string[] = [`${Resources.modulesFolder}/vitest/vitest.mjs`, "run", "--reporter=dot", "--reporter=json"];
  public static readonly specTimingArguments: readonly string[] = ["test", "--reporters=default", "--reporters=json", "--no-coverage", "--output-file"];
  public static readonly lookTimingName: string = "look";
  public static readonly lookTimingArguments: readonly string[] = ["run", "window:test-look", "--reporters=default", "--reporters=json", "--output-file"];
  public static readonly slowSpecListHeader: string = "| Spec file | Median test | Why |";
  public static readonly testTimesReport: string = "_build/test-times.json";
  public static readonly testTimeCheck: string = "scripts/checks/test-time-check.ts";
  public static readonly defaultReporter: string = "--reporter=default";
  public static readonly jsonReporter: readonly string[] = ["--reporter=json", `--outputFile.json=${Resources.testTimesReport}`];
  public static readonly slowFileListHeader: string = "| Test file | Time | Why |";
  public static readonly slowFileListRow: RegExp = /^\| `([^`]+)` \| [^|]+ \| .+ \|$/;
  public static readonly testTimeUsage: string = "Give the Vitest JSON report, such as: node scripts/checks/test-time-check.ts _build/test-times.json";
  public static readonly shellRunUsage: string = "Give the Vitest JSON report, then each shell whose tests must all pass, such as: node scripts/checks/shell-run-check.ts shells.json bash zsh fish";
  public static readonly windowSpecPrefix: string = `${Resources.windowFolder}/`;
  public static readonly lookSpecSuffix: string = "-look.spec.ts";
  public static readonly angularCompilerEntry: readonly string[] = [Resources.modulesFolder, "@angular", "compiler-cli", "bundles", "src", "bin", "ngc.js"];
  public static readonly angularCliEntry: readonly string[] = [Resources.modulesFolder, "@angular", "cli", "bin", "ng.js"];
  public static readonly playwrightEntry: readonly string[] = [Resources.modulesFolder, "playwright", "cli.js"];
  public static readonly windowTypeCheckArguments: readonly string[] = [Resources.projectOption, Resources.projectFile];
  public static readonly browserInstallArguments: readonly string[] = ["install", "--only-shell", "chromium"];
  public static readonly unitTestArguments: readonly string[] = ["test"];
  public static readonly lookTestArguments: readonly string[] = ["run", "window:test-look"];
  public static readonly noCoverageOption: string = "--coverage=false";
  public static readonly includeOption: string = "--include";

  public static formatAngularCompileFailed(sources: string, exitCode: number | null, output: string): string {
    return `Compiling ${sources} with the Angular compiler failed with exit code ${exitCode}:\n${output}`;
  }

  public static formatAngularCompileTimedOut(sources: string, timeout: number): string {
    return `Compiling ${sources} with the Angular compiler did not finish within ${timeout} ms.`;
  }

  public static formatAngularCompilerCommandMissing(manifest: string, command: string): string {
    return `${manifest} names no ${command} command.`;
  }

  public static formatAngularCompilerMissing(project: string): string {
    return `The Angular project in ${project} has no Angular compiler to run; npm ci installs one.`;
  }

  public static formatAngularEntriesMissing(entries: string): string {
    return `${entries} has no entry files to compile.`;
  }

  public static formatAngularPeerInvalid(archiveName: string, name: string, pin: unknown, field: string): string {
    return `${archiveName} names ${name} at ${String(pin)} in ${field}, not at ${Resources.angularForm}.`;
  }

  public static formatAngularPeerStart(archiveName: string, name: string, pin: unknown, field: string, built: unknown): string {
    return `${archiveName} names ${name} at ${String(pin)} in ${field}, which doesn't start at ${String(built)}, the ${name} the window part builds with.`;
  }

  public static formatArchiveDependencyDiffers(archiveName: string, dependency: string, range: string, version: string): string {
    return `${archiveName}: its dependency ${dependency} is "${range}", not exactly "${version}".`;
  }

  public static formatArchiveEntryMalformed(archive: string, offset: number): string {
    return `${archive} has a malformed or truncated entry at offset ${offset}.`;
  }

  public static formatArchiveEntryPath(prefix: string, name: string): string {
    return `${prefix}${Resources.posixSeparator}${name}`;
  }

  public static formatArchiveExportMissing(archiveName: string, subpath: string, target: string): string {
    return `${archiveName} exports ${subpath} as ${target}, which the archive lacks.`;
  }

  public static formatArchiveExportsNothing(archiveName: string): string {
    return `${archiveName} exports nothing.`;
  }

  public static formatArchiveFieldDiffers(archiveName: string, field: string, found: string, expected: string): string {
    return `${archiveName}: its ${field} is "${found}", not "${expected}".`;
  }

  public static formatArchiveFindings(findings: readonly string[]): string {
    return findings.join(Resources.lineFeed);
  }

  public static formatArchiveFolderMissing(folder: string): string {
    return `There is no folder ${folder} with the archives to release.`;
  }

  public static formatArchiveCommitDiffers(archiveName: string, found: unknown, commit: string): string {
    return `${archiveName}: its ${Resources.commitField} is ${found === undefined ? Resources.missingText : JSON.stringify(found)}, not "${commit}"; `
      + `a release builds its archives from a clean clone of the commit, which each records as its ${Resources.commitField}.`;
  }

  public static formatArchiveManifestContext(archiveName: string): string {
    return `${archiveName} ${Resources.manifestEntryName}`;
  }

  public static formatArchiveManifestMissing(archiveName: string): string {
    return `${archiveName} has no ${Resources.manifestEntryName}.`;
  }

  public static formatArchiveMarkedPrivate(archiveName: string): string {
    return `${archiveName}: is marked private, so npm would refuse to publish it.`;
  }

  public static formatArchiveMissing(folder: string, archiveName: string): string {
    return `${folder} lacks ${archiveName}.`;
  }

  public static formatArchiveModuleFileInvalid(archiveName: string): string {
    return `${archiveName}'s ${Resources.moduleEntryName} is not a JSON object.`;
  }

  public static formatArchiveModuleFileMissing(archiveName: string): string {
    return `${archiveName} exports the module's parts but lacks module.json at its root.`;
  }

  public static formatArchiveName(name: string, version: string): string {
    return `${name.replace(Resources.scopePattern, Resources.scopeReplacement)}-${version}${Resources.archiveExtension}`;
  }

  public static formatArchiveOutsideScope(archiveName: string, name: string, scope: string): string {
    return `${archiveName}: ${name} is outside the scope ${scope}.`;
  }

  public static formatArchivePeerNotOptional(archiveName: string, peer: string): string {
    return `${archiveName} doesn't mark its peer ${peer} optional, so an app's root install would take a second copy.`;
  }

  public static formatArchivePinInvalid(archiveName: string, name: string, pin: unknown, field: string, isRanged: boolean): string {
    return `${archiveName} names ${name} at ${String(pin)} in ${field}, not at one exact version${isRanged ? Resources.rangeAlternative : ''}.`;
  }

  public static formatArchiveUnexpected(folder: string, fileName: string, version: string): string {
    return `${folder} holds ${fileName}, which is not a package's archive at ${version}.`;
  }

  public static formatArchiveUnreadable(archive: string): string {
    return `${archive} could not be read as a gzipped archive.`;
  }

  public static formatCdkCopiesFound(folder: string, count: number): string {
    return `${folder}/ holds ${count} copies of ${Resources.cdkPackage}, so the UI kit's overlays and focus handling and the app's would run from different ones:\n`;
  }

  public static formatCdkCopy(version: string, folder: string): string {
    return `  ${version} at ${folder}\n`;
  }

  public static formatCdkCopyFound(folder: string): string {
    return `Found one copy of ${Resources.cdkPackage} in ${folder}/.\n`;
  }

  public static formatCdkCopyMissing(folder: string): string {
    return `npm ls found no ${Resources.cdkPackage} in ${folder}/, so the check read nothing.\n`;
  }

  public static formatCdkListFailed(folder: string, code: string, summary: string): string {
    return `"${Resources.npmCommand} ${Resources.cdkListArguments.join(" ")}" in ${folder}/ failed (${code}): ${summary}`;
  }

  public static formatCdkListUnreadable(folder: string, output: string): string {
    return `"${Resources.npmCommand} ${Resources.cdkListArguments.join(" ")}" in ${folder}/ gave no list to read: ${output}`;
  }

  public static formatCompiledMissing(folder: string): string {
    return `${folder} doesn't exist; the module's TypeScript build writes it.`;
  }

  public static formatCoreBuildOutsideRange(name: string, pin: string, desktopCore: string): string {
    return `The module builds against ${name} ${pin}, outside module.json's ${Resources.desktopCoreField} ${desktopCore}.`;
  }

  public static formatCorePeerDiffers(archiveName: string, name: string, pin: unknown, field: string, desktopCore: string): string {
    return `${archiveName} names ${name} at ${String(pin)} in ${field}, not at module.json's ${Resources.desktopCoreField}, ${desktopCore}.`;
  }

  public static formatDesktopCoreRangeInvalid(archiveName: string, found: unknown): string {
    return `${archiveName}'s ${Resources.moduleEntryName} names ${Resources.desktopCoreField} ${found === undefined ? Resources.nothingText : JSON.stringify(found)}, `
      + "not a range of the form >=<lowest> <first refused>.";
  }

  public static formatDesktopCoreRangesDiffer(ranges: readonly string[]): string {
    return `The archives' module.json files name different ${Resources.desktopCoreField} ranges, ${ranges.join(" and ")}; the repository's modules build against one.`;
  }

  public static formatExportSourceInvalid(file: string, subpath: string): string {
    return `${file}'s export ${subpath} must name a ${Resources.sourceExtension} source.`;
  }

  public static formatExportsInvalid(file: string): string {
    return `${file}'s ${Resources.exportsField} must map each subpath to a source.`;
  }

  public static formatFieldContext(context: string, key: string): string {
    return `${context}.${key}`;
  }

  public static formatFieldNotObject(owner: string, field: string): string {
    return `${owner}'s ${field} must be an object.`;
  }

  public static formatFirstMajorRefused(major: number): string {
    return `${major}.0.0`;
  }

  public static formatFirstMinorRefused(minor: number): string {
    return `0.${minor}.0`;
  }

  public static formatGitFailed(gitArguments: readonly string[], exitCode: number | null, errorOutput: string): string {
    return `"${Resources.gitCommand} ${gitArguments.join(" ")}" failed with exit code ${exitCode}: ${errorOutput}`;
  }

  public static formatGitHubObjectExpected(context: string): string {
    return `${context} must be an object.`;
  }

  public static formatGitHubTextExpected(context: string, key: string): string {
    return `${Resources.formatFieldContext(context, key)} must be text.`;
  }

  public static formatJsonObjectRequired(file: string): string {
    return `${file} must be a JSON object.`;
  }

  public static formatJsonObjectUnreadable(context: string): string {
    return `${context} is not a JSON object.`;
  }

  public static formatListedCopy(source: string, name: string, entry: string): string {
    return `${source}\t${name}\t${entry}\n`;
  }

  public static formatManifestOwnPinInvalid(description: string, name: string, field: string): string {
    return `${description} must name ${name} at ${Resources.ownPin} in ${field}, which packing sets to the module's version.`;
  }

  public static formatPartNoldovaPinned(folder: string, name: string, field: string): string {
    return `${folder}/${Resources.manifestFile} pins ${name} in ${field}; the root manifest pins every @noldova package the parts build and test against, once, so moving one to its newest version leaves no older copy under a part's folder.`;
  }

  public static formatManifestPinInvalid(description: string, name: string, field: string): string {
    return `${description} must pin ${name} at an exact version in ${field}.`;
  }

  public static formatModuleContributionInvalid(kind: string, name: string, id: string): string {
    return `module.json's ${kind} entry ${name} must have the form ${id}.<camelCaseName>.`;
  }

  public static formatModuleDependencyInvalid(dependency: string): string {
    return `module.json names an invalid dependency: ${dependency}.`;
  }

  public static formatModuleDependencyVersionInvalid(dependency: string): string {
    return `module.json must name ${dependency} at an exact version in dependencies.`;
  }

  public static formatModuleKindUnknown(kind: string): string {
    return `module.json contributes an unknown kind: ${kind}.`;
  }

  public static formatModuleListInvalid(field: string): string {
    return `module.json's ${field} must be a list of names.`;
  }

  public static formatModuleListRepeats(field: string): string {
    return `module.json's ${field} lists a name twice.`;
  }

  public static formatModulePartFolderMissing(part: string, folder: string): string {
    return `module.json's part ${part} has no folder at ${folder}.`;
  }

  public static formatModulePartUnknown(part: string): string {
    return `module.json names an unknown part: ${part}.`;
  }

  public static formatModuleTextBlank(field: string): string {
    return `module.json's ${field} must be text that is not blank.`;
  }

  public static formatModuleVersionDiffers(file: string, found: string, version: string): string {
    return `${file} has the version ${found}; the module's packages are at ${Resources.versionFile}'s version, ${version}.`;
  }

  public static formatNoCoverageGate(metric: string): string {
    return `--coverage.thresholds.${metric}=0`;
  }

  public static formatObjectRequired(path: string): string {
    return `${path} must hold a JSON object.`;
  }

  public static formatOwnPinInvalid(file: string, name: string, pin: string): string {
    return `${file} pins ${name} at ${pin}; it names the module's own packages at ${Resources.ownPin}, which packing sets to the module's version.`;
  }

  public static formatPackFailed(packageName: string, exitCode: number | null, output: string): string {
    return `Packing ${packageName} failed with exit code ${exitCode}:\n${output}`;
  }

  public static formatCompileFailed(project: string, exitCode: number): string {
    return `Compiling ${project} failed with exit code ${exitCode}.`;
  }

  public static formatArchiveInstallFailed(exitCode: number | null, output: string): string {
    return `Installing the packed archives from ${Resources.archivesFolder} failed with exit code ${exitCode}:\n${output}`;
  }

  public static formatPackageCorePeerDiffers(name: string, desktopCore: string): string {
    return `The package's manifest must name ${name} at module.json's ${Resources.desktopCoreField}, ${desktopCore}, in ${Resources.peersField}.`;
  }

  public static formatPackageNameMissing(file: string): string {
    return `${file} has no name.`;
  }

  public static formatPackagePeerPinInvalid(name: string, isRanged: boolean): string {
    return `The package's manifest must pin ${name} at an exact version${isRanged ? Resources.peerRangeAlternative : ''} in ${Resources.peersField}.`;
  }

  public static formatPackagePrivate(file: string): string {
    return `${file} is private, so it can't be packed for publishing.`;
  }

  public static formatPeerUndeclared(name: string, file: string): string {
    return `The window part imports ${name}, which ${file} doesn't declare as a peer.`;
  }

  public static formatPinMissing(name: string, file: string): string {
    return `The window part imports ${name}, which ${file} doesn't pin.`;
  }

  public static formatProcessNotStarted(command: string): string {
    return `"${command}" could not start.`;
  }

  public static formatProcessOutputTooLong(command: string, limit: number): string {
    return `"${command}" wrote more than ${limit} bytes.`;
  }

  public static formatProcessTimedOut(command: string, timeout: number): string {
    return `"${command}" did not finish within ${timeout} ms.`;
  }

  public static formatRange(lowest: string, refused: string): string {
    return `>=${lowest} <${refused}`;
  }

  public static formatReadFailed(path: string, error: unknown): string {
    return `Could not read ${path}: ${String(error)}`;
  }

  public static formatPartPinNotAtRoot(description: string, name: string, pin: string): string {
    return `${description} pins ${name} at ${pin}, but the root manifest's devDependencies don't pin it at that version; the root installs every package the parts build with.`;
  }

  public static formatRootDependencyPinned(name: string): string {
    return `${name} is pinned in the root manifest's dependencies; the package that runs with it pins it, and the root pins only its tools.`;
  }

  public static formatTakesNoOtherOption(option: string): string {
    return `${option} takes no other option.`;
  }

  public static formatTestOptionsRefused(unknown: readonly string[]): string {
    return `npm test takes ${Resources.testOptions.join(" and ")}, then any test files, not ${unknown.join(", ")}.`;
  }

  public static formatNodeTypes(version: string): string {
    return `${Resources.nodeTypesPackage}@${version}`;
  }

  public static formatShellTag(shell: string): string {
    return `[${shell}]`;
  }

  public static formatShellTestNotPassed(shell: string, name: string, status: string): string {
    return `${shell}: "${name}" is ${status}; this job installs ${shell}, so each test tagged ${Resources.formatShellTag(shell)} runs and passes.`;
  }

  public static formatShellUntested(shell: string): string {
    return `${shell}: no test tagged ${Resources.formatShellTag(shell)} passed; this job installs ${shell} to test it.`;
  }

  public static formatTimingReport(name: string, run: number): string {
    return `${name}-run-${run}.json`;
  }

  public static formatSpecMedian(file: string, median: number, tests: number, isOver: boolean, isAccepted: boolean): string {
    const over: string = isAccepted
      ? `, over the ${Resources.specMedianBudget} ms the bar sets, which README.md accepts`
      : `, over the ${Resources.specMedianBudget} ms the bar sets, with its margin; make it faster, or have a maintainer accept it in README.md, Spec files over a 100 ms median test`;
    return `${!isOver ? "ok" : isAccepted ? "accepted" : "OVER"} ${file}: median test ${median.toFixed(1)} ms over ${tests} tests${isOver ? over : ""}.`;
  }

  public static formatNothingTimed(report: string): string {
    return `The timing report ${report} names no test file with its times, so the check measured nothing; Vitest's JSON report form may have changed.`;
  }

  public static formatTimingListMissing(header: string): string {
    return `README.md has no table headed "${header}", so the check can't tell which slow files are accepted.`;
  }

  public static formatSlowComponentTest(file: string, title: string, duration: number): string {
    return `  slow: ${file} "${title}" took ${Math.round(duration)} ms; README.md, Component tests over 1 second, gives its spec's cause.`;
  }

  public static formatUnitFileTiming(file: string, time: number, isAccepted: boolean): string {
    return `${isAccepted ? "accepted" : "OVER"} ${file}: ${Math.round(time)} ms, over the ${Resources.unitFileBudget} ms a unit test file may take${isAccepted ? ", which README.md accepts" : "; make it faster, or have a maintainer accept it in README.md, Test files over 1 second"}.`;
  }

  public static formatTimingSummary(slowFiles: number, slowSpecs: number): string {
    return `Timing check: ${slowFiles} unit test files over ${Resources.unitFileBudget} ms and not accepted, ${slowSpecs} spec files over a ${Resources.specMedianBudget} ms median test. Each time is the median of ${Resources.timingRuns} runs, so one run slowed by a busy machine doesn't decide it, and a time counts as over only past the bar plus ${Math.round((Resources.timingMargin - 1) * 100)}%, for the jitter of a quiet test machine; this check is apart from npm test, since its pass condition is a time.`;
  }

  public static formatTestFileSlow(file: string, time: number): string {
    return `${file}: ${Math.round(time)} ms, over the ${Resources.unitFileBudget} ms a unit test file may take; npm run test:timing decides, from the median of several runs.`;
  }

  public static formatTestTimesChecked(files: number, over: number, accepted: number): string {
    return `Timed ${files} test files: ${over} took over ${Resources.unitFileBudget} ms in this run, ${accepted} of them accepted in README.md; this run reports times only, and npm run test:timing checks them.`;
  }

  public static formatShellTested(shell: string, tests: number): string {
    return `${shell}: ${tests} tests passed.`;
  }

  public static formatArchiveAgeChecked(packages: number): string {
    return `Checked that the archives of ${packages} packages are newer than what they pack.`;
  }

  public static formatArchiveAgeMissing(archive: string): string {
    return `${archive} is missing; run npm run build, since the tests use the installed archives.`;
  }

  public static formatArchiveAgeStale(archive: string, file: string): string {
    return `${file} changed after ${archive} was packed; run npm run build, since the tests use the installed archives.`;
  }

  public static formatArchiveAgeVersionMissing(file: string): string {
    return `${file} has no version, so the archives to check can't be named.`;
  }

  public static formatArchiveAgeNameMissing(file: string): string {
    return `${file} has no name, so its archive can't be named.`;
  }

  public static formatTestWaitChecked(testFiles: number, listed: number): string {
    return `Checked ${testFiles} test files for fixed pauses; ${listed} may pause.`;
  }

  public static formatTestWaitPause(file: string, line: number): string {
    return `${file}:${line}: pauses for a fixed time; wait for the event or the promise instead, or list the file in ${Resources.readmeFile}, Fixed pauses, with its reason.`;
  }

  public static formatTestWaitDefaultLimit(file: string, line: number): string {
    return `${file}:${line}: waits on its 1-second default; pass a limit, such as { timeout: SpecWait.milliseconds }.`;
  }

  public static formatTestWaitStale(line: number, file: string): string {
    return `${Resources.readmeFile}:${line}: lists ${file}, which no longer pauses for a fixed time; remove its row.`;
  }

  public static formatToolNameInvalid(name: string, prefix: string): string {
    return `module.json's tools entry ${name} must be a snake_case name of at most 64 characters starting with ${prefix}.`;
  }

  public static formatToolPrefix(id: string): string {
    return `${id.replaceAll(Resources.moduleIdSeparator, Resources.toolNameSeparator)}${Resources.toolNameSeparator}`;
  }

  public static formatVersionMissing(file: string): string {
    return `${file} has no version.`;
  }

  public static formatVersionPlaceholderMissing(file: string, found: string): string {
    return `${file} has the version ${found}; it writes ${Resources.versionPlaceholder}, which packing sets to ${Resources.versionFile}'s version.`;
  }

  public static readonly peerInstallArguments: readonly string[] = ["install", "--no-save", "--ignore-scripts", "--no-audit", "--no-fund", "--loglevel=error"];
  public static readonly peerViewCommand: string = "view";
  public static readonly peerVersionsField: string = "versions";
  public static readonly peerJsonOption: string = "--json";
  public static readonly peerScopePrefix: string = `${Resources.scope}${Resources.posixSeparator}`;
  public static readonly missingCode: string = "ENOENT";
  public static readonly rootPinFields: readonly string[] = [Resources.dependenciesField, Resources.devDependenciesField];
  public static readonly rootManifestContext: string = "The root package.json";

  public static formatPackageSpec(name: string, version: string): string {
    return `${name}@${version}`;
  }

  public static formatPeerMoved(packageName: string, version: string): string {
    return `Moved ${packageName} to ${version}, the newest published version inside the packages' peer ranges.`;
  }

  public static formatPeerMoveFailed(exitCode: number | null, output: string): string {
    return `Installing the newest peers inside their ranges at the root failed with exit code ${exitCode}:\n${output}`;
  }

  public static formatPeerNotMoved(packageName: string, installed: string, version: string): string {
    return `The root's node_modules holds ${packageName} ${installed} after the move, not ${version}.`;
  }

  public static formatPeerVersionsUnread(packageName: string, exitCode: number | null, output: string): string {
    return `npm view ${packageName} versions failed with exit code ${exitCode}:\n${output}`;
  }

  public static formatPeerVersionsNotJson(packageName: string, output: string): string {
    return `npm view ${packageName} versions gave output that is not JSON:\n${output}`;
  }

  public static formatPeerManifestUnreadable(packageName: string, file: string): string {
    return `The root's node_modules holds no readable manifest of ${packageName} after the move: ${file} is missing or not JSON.`;
  }

  public static formatPeerNoVersion(packageName: string, ranges: readonly string[]): string {
    return `npm view gives no published version of ${packageName} inside ${ranges.join(" and ")}.`;
  }

  public static formatPeerRangeInvalid(file: string, packageName: string, taken: string): string {
    return `${file} takes the peer ${packageName} at ${taken}, not ">=<lowest version> <first version refused>" with the lowest version below the first refused.`;
  }
}
