/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { page } from "vitest/browser";

export class ScreenShot {
  public readonly step: number;
  private readonly box: DOMRect;
  private readonly width: number;
  private readonly pixels: Uint8ClampedArray;

  private constructor(box: DOMRect, width: number, pixels: Uint8ClampedArray) {
    this.box = box;
    this.width = width;
    this.pixels = pixels;
    this.step = box.width / width;
  }

  public readonly at = (x: number, y: number): string => {
    const index: number = (Math.floor((y - this.box.top) / this.step) * this.width + Math.floor((x - this.box.left) / this.step)) * 4;
    return `rgb(${this.pixels[index]}, ${this.pixels[index + 1]}, ${this.pixels[index + 2]})`;
  };

  public static async takeAsync(element: HTMLElement, path: string): Promise<ScreenShot> {
    const box: DOMRect = element.getBoundingClientRect();
    const shot: { base64: string } = await page.screenshot({ element, path, base64: true });
    const bitmap: ImageBitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${shot.base64}`)).blob());
    const canvas: OffscreenCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context: OffscreenCanvasRenderingContext2D | null = canvas.getContext("2d");
    if (Object.isNull(context))
      throw new Error(`The browser gave no 2d context to read the screenshot ${path}.`);
    context.drawImage(bitmap, 0, 0);
    return new ScreenShot(box, bitmap.width, context.getImageData(0, 0, bitmap.width, bitmap.height).data);
  }

  public inside(left: number, top: number, width: number, height: number): string[] {
    const pixels: string[] = [];
    for (let y: number = top + this.step; y < top + height - this.step; y += this.step)
      for (let x: number = left + this.step; x < left + width - this.step; x += this.step)
        pixels.push(this.at(x, y));
    return pixels;
  }
}
