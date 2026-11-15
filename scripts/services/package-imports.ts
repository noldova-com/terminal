/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { PeerUndeclaredException } from "../exceptions/peer-undeclared.exception.ts";
import { PinMissingException } from "../exceptions/pin-missing.exception.ts";
import { Resources } from "../resources.ts";

export class PackageImports {
  public static async resolveAsync(folder: string, pins: ReadonlyMap<string, string>, peerRanges: ReadonlyMap<string, string>, version: string,
    file: string): Promise<[ReadonlyMap<string, string>, ReadonlyMap<string, string>]> {
    const dependencies = new Map<string, string>();
    const peers = new Map<string, string>();
    for (const name of await PackageImports.listAsync(folder)) {
      if (PackageImports.isPeer(name)) {
        const range = peerRanges.get(name);
        if (range === undefined)
          throw new PeerUndeclaredException(name, file);
        peers.set(name, range);
        continue;
      }
      const pin = name.startsWith(Resources.ownPackagePrefix) ? version : pins.get(name);
      if (pin === undefined)
        throw new PinMissingException(name, file);
      dependencies.set(name, pin);
    }
    return [dependencies, peers];
  }

  private static async listAsync(folder: string): Promise<readonly string[]> {
    const names = new Set<string>();
    for (const file of await readdir(folder, { recursive: true })) {
      const isDeclaration = file.endsWith(Resources.declarationExtension);
      if (!isDeclaration && !file.endsWith(Resources.scriptExtension))
        continue;
      const text = await readFile(path.join(folder, file), Resources.textEncoding);
      for (const match of (isDeclaration ? PackageImports.withoutComments(text) : text).matchAll(Resources.packageImportPattern))
        names.add(String(match[2]));
    }
    return [...names].sort();
  }

  private static withoutComments(text: string): string {
    let code = "";
    let quote: string | null = null;
    for (let index = 0; index < text.length; index++) {
      const character: string = text.charAt(index);
      const next: string = text.charAt(index + 1);
      if (quote !== null) {
        code += character;
        if (character === Resources.escapeCharacter) {
          code += next;
          index++;
        }
        else if (character === quote)
          quote = null;
      }
      else if (character === Resources.commentSlash && next === Resources.commentSlash) {
        const end: number = text.indexOf(Resources.lineFeed, index);
        index = end === -1 ? text.length : end - 1;
      }
      else if (character === Resources.commentSlash && next === Resources.commentStar) {
        const end: number = text.indexOf(Resources.blockCommentEnd, index + Resources.blockCommentStart.length);
        index = end === -1 ? text.length : end + 1;
      }
      else {
        if (Resources.quotes.includes(character))
          quote = character;
        code += character;
      }
    }
    return code;
  }

  private static isPeer(name: string): boolean {
    return Resources.peerPrefixes.some(t => name.startsWith(t)) || Resources.uiKitNames.includes(name);
  }
}
