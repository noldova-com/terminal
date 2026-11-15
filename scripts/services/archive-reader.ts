/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import zlib from "node:zlib";

import { ArchiveEntryMalformedException } from "../exceptions/archive-entry-malformed.exception.ts";
import { ArchiveUnreadableException } from "../exceptions/archive-unreadable.exception.ts";
import { Resources } from "../resources.ts";

export class ArchiveReader {
  public async readAsync(archive: string): Promise<ReadonlyMap<string, Buffer>> {
    let tar: Buffer;
    try {
      tar = zlib.gunzipSync(await readFile(archive));
    }
    catch (error) {
      if (!(error instanceof Error && "code" in error && typeof error.code === "string" && !error.code.startsWith(Resources.nodeArgumentCodePrefix)))
        throw error;
      throw new ArchiveUnreadableException(archive, error);
    }

    const files = new Map<string, Buffer>();
    let extendedName: string | null = null;
    for (let offset = 0; offset + Resources.archiveBlock <= tar.length && tar[offset] !== 0;) {
      const header = tar.subarray(offset, offset + Resources.archiveBlock);
      const size = Number.parseInt(ArchiveReader.readField(header, Resources.archiveSizeStart, Resources.archiveSizeEnd).trim(), Resources.archiveSizeRadix);
      if (!Number.isInteger(size) || offset + Resources.archiveBlock + size > tar.length)
        throw new ArchiveEntryMalformedException(archive, offset);
      const content = tar.subarray(offset + Resources.archiveBlock, offset + Resources.archiveBlock + size);
      const type = header.toString(Resources.headerEncoding, Resources.archiveTypeAt, Resources.archiveTypeAt + 1);
      if (type === Resources.archiveExtendedType)
        extendedName = Resources.archivePathRecord.exec(content.toString(Resources.textEncoding))?.[1] ?? null;
      else {
        if (Resources.archiveFileTypes.includes(type))
          files.set(extendedName ?? ArchiveReader.readName(header), Buffer.from(content));
        extendedName = null;
      }
      offset += Resources.archiveBlock * (1 + Math.ceil(size / Resources.archiveBlock));
    }
    return files;
  }

  private static readName(header: Buffer): string {
    const name = ArchiveReader.readField(header, 0, Resources.archiveNameEnd);
    const prefix = ArchiveReader.readField(header, Resources.archivePrefixStart, Resources.archivePrefixEnd);
    return prefix.length > 0 ? Resources.formatArchiveEntryPath(prefix, name) : name;
  }

  private static readField(header: Buffer, start: number, end: number): string {
    return header.toString(Resources.textEncoding, start, end).replace(Resources.archiveFieldEnd, "");
  }
}
