/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { posix } from "node:path";

import type { IEnvironmentSource } from "../interfaces/i-environment-source.ts";
import type { ILineProcess } from "../interfaces/i-line-process.ts";
import type { ILineProcessStarter } from "../interfaces/i-line-process-starter.ts";
import { Resources } from "../resources.ts";
import { FileSystemReader } from "./file-system.reader.ts";

export class MacEnvironment implements IEnvironmentSource {
  private readonly environment: Readonly<Record<string, string | undefined>>;
  private readonly starter: ILineProcessStarter;
  private readonly fallbackLocale: string;
  private readonly hasLocaleAsync: (name: string) => Promise<boolean>;
  private reading: Promise<Readonly<Record<string, string | undefined>>> | null = null;
  private process: ILineProcess | null = null;
  private answer: ((locale: string) => void) | null = null;
  private timer: NodeJS.Timeout | undefined;

  public constructor(environment: Readonly<Record<string, string | undefined>>, starter: ILineProcessStarter, fallbackLocale: string,
    hasLocaleAsync: (name: string) => Promise<boolean>) {
    this.environment = environment;
    this.starter = starter;
    this.fallbackLocale = fallbackLocale;
    this.hasLocaleAsync = hasLocaleAsync;
  }

  public static hasSystemLocaleAsync(name: string): Promise<boolean> {
    return new FileSystemReader().isFileAsync(posix.join(Resources.localeFolder, name, Resources.characterTypeVariable));
  }

  public start(): void {
    void this.readAsync().catch(() => undefined);
  }

  public readAsync(): Promise<Readonly<Record<string, string | undefined>>> {
    this.reading ??= Resources.localeVariables.some(t => (this.environment[t] ?? "") !== "")
      ? Promise.resolve(this.environment)
      : this.readLocaleAsync().then(t => this.withUtf8LocaleAsync(t)).catch((error: unknown) => {
        this.reading = null;
        throw error;
      });
    return this.reading;
  }

  public end(): void {
    this.stop();
  }

  private readLocaleAsync(): Promise<string> {
    return new Promise<string>(resolve => {
      this.answer = resolve;
      this.timer = setTimeout(() => this.stop(), Resources.appleLocaleReadMilliseconds);
      this.process = this.starter.start(Resources.defaultsFile, Resources.appleLocaleArguments, {
        onLine: line => this.finish(MacEnvironment.toLocale(line) ?? this.fallbackLocale),
        onExit: () => this.finish(this.fallbackLocale)
      });
    });
  }

  private stop(): void {
    this.process?.kill();
    this.finish(this.fallbackLocale);
  }

  private finish(locale: string): void {
    clearTimeout(this.timer);
    this.process = null;
    this.answer?.(locale);
    this.answer = null;
  }

  private async withUtf8LocaleAsync(locale: string): Promise<Readonly<Record<string, string | undefined>>> {
    const maximized: Intl.Locale = new Intl.Locale(locale).maximize();
    const name: string | null = Object.isUndefined(maximized.region) ? null : Resources.formatUtf8Locale(maximized.language, maximized.region);
    return !Object.isNull(name) && await this.hasLocaleAsync(name)
      ? { ...this.environment, [Resources.languageVariable]: name }
      : { ...this.environment, [Resources.characterTypeVariable]: Resources.utf8Locale };
  }

  private static toLocale(line: string): string | null {
    try {
      return new Intl.Locale(line.replace(Resources.macEnvironmentLocaleModifier, "").replaceAll(Resources.macEnvironmentLocaleSeparator, Resources.macEnvironmentLanguageTagSeparator)).toString();
    }
    catch (error: unknown) {
      if (error instanceof RangeError)
        return null;
      throw error;
    }
  }
}
