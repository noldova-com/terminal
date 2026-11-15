/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IFlowControllerListener } from "../interfaces/i-flow-controller-listener.ts";
import { PaneProgress } from "../models/pane-progress.ts";
import { Resources } from "../resources.ts";

export class FlowController {
  private readonly listener: IFlowControllerListener;
  private readonly panes: Map<string, PaneProgress> = new Map<string, PaneProgress>();
  private producedOffset: number = 0;
  private mirrorOffset: number = 0;
  private storingBacklog: number = 0;
  private isProducerPaused: boolean = false;

  public constructor(listener: IFlowControllerListener) {
    this.listener = listener;
  }

  public get isPaused(): boolean {
    return this.isProducerPaused;
  }

  public produce(length: number): void {
    this.producedOffset += length;
    this.update();
  }

  public acknowledgeMirror(offset: number, storingBacklog: number): void {
    this.mirrorOffset = Math.max(this.mirrorOffset, offset);
    this.storingBacklog = storingBacklog;
    this.update();
  }

  public acknowledgeStoring(storingBacklog: number): void {
    this.storingBacklog = storingBacklog;
    this.update();
  }

  public attach(paneId: string, offset: number): void {
    this.detach(paneId);
    this.panes.set(paneId, new PaneProgress(offset));
    this.update();
  }

  public acknowledge(paneId: string, offset: number): void {
    const pane: PaneProgress | undefined = this.panes.get(paneId);
    if (pane === undefined)
      return;
    pane.offset = Math.max(pane.offset, Math.min(offset, this.producedOffset));
    this.update();
  }

  public setVisible(paneId: string, isVisible: boolean): void {
    const pane: PaneProgress | undefined = this.panes.get(paneId);
    if (pane === undefined)
      return;
    pane.isVisible = isVisible;
    this.update();
  }

  public detach(paneId: string): boolean {
    const pane: PaneProgress | undefined = this.panes.get(paneId);
    if (pane === undefined)
      return false;
    FlowController.stopStallTimer(pane);
    this.panes.delete(paneId);
    this.update();
    return true;
  }

  public dispose(): void {
    for (const pane of this.panes.values())
      FlowController.stopStallTimer(pane);
    this.panes.clear();
  }

  private update(): void {
    let lag: number = this.producedOffset - this.mirrorOffset + this.storingBacklog;
    for (const pane of this.panes.values())
      lag = Math.max(lag, this.lagOf(pane));
    if (!this.isProducerPaused && lag > Resources.highWatermark) {
      this.isProducerPaused = true;
      this.listener.onPause();
    }
    else if (this.isProducerPaused && lag <= Resources.lowWatermark) {
      this.isProducerPaused = false;
      this.listener.onResume();
    }
    const stallLag: number = this.isProducerPaused ? Resources.lowWatermark : Resources.highWatermark;
    for (const [paneId, pane] of this.panes) {
      if (this.lagOf(pane) > stallLag)
        pane.stallTimer ??= setTimeout(() => this.stall(paneId), Resources.stallMilliseconds);
      else
        FlowController.stopStallTimer(pane);
    }
  }

  private lagOf(pane: PaneProgress): number {
    return pane.isVisible ? this.producedOffset - pane.offset : 0;
  }

  private stall(paneId: string): void {
    this.detach(paneId);
    this.listener.onStalled(paneId);
  }

  private static stopStallTimer(pane: PaneProgress): void {
    if (pane.stallTimer === null)
      return;
    clearTimeout(pane.stallTimer);
    pane.stallTimer = null;
  }
}
