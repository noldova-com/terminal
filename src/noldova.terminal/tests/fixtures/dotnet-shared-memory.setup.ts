/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const RUNTIME_FOLDER_VARIABLE: string = "XDG_RUNTIME_DIR";
const SHARED_MEMORY_FOLDER: readonly string[] = [".dotnet", "shm"];
const OWNER_ONLY: number = 0o700;

export async function setup(): Promise<void> {
  const runtimeFolder: string | undefined = process.env[RUNTIME_FOLDER_VARIABLE];
  if (process.platform !== "linux" || runtimeFolder === undefined || runtimeFolder === "")
    return;
  await mkdir(join(runtimeFolder, ...SHARED_MEMORY_FOLDER), { recursive: true, mode: OWNER_ONLY });
}
