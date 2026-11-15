/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IFolderAccess } from "../../src/interfaces/i-folder-access.ts";
import type { FakeFileSystemWriter } from "./fake-file-system-writer.fixture.ts";

export class FakeFolderAccess implements IFolderAccess {
  public readonly restricted: [string, number][] = [];
  public failure: Error | null = null;
  private readonly writer: FakeFileSystemWriter;

  public constructor(writer: FakeFileSystemWriter) {
    this.writer = writer;
  }

  public async restrictAsync(folder: string): Promise<void> {
    this.restricted.push([folder, this.writer.files.size]);
    if (this.failure !== null)
      throw this.failure;
  }
}
