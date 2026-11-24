/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { LiveAnnouncer } from "@angular/cdk/a11y";
import { Component, DestroyRef, effect, ElementRef, ErrorHandler, inject, signal, untracked, viewChild, type Signal, type WritableSignal } from "@angular/core";
import { WindowPartTokens, type IWindowPartContext } from "@noldova/desktop.window";
import { TerminalSize } from "@noldova/terminal.protocol";
import { ButtonComponent, ButtonVariant } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources.ts";
import type { ITerminalFocusTarget } from "../../interfaces/i-terminal-focus-target.ts";
import type { ITerminalRestartTarget } from "../../interfaces/i-terminal-restart-target.ts";
import { TerminalFocus } from "../../services/terminal-focus.ts";
import { TerminalRuntimeClient } from "../../services/terminal-runtime-client.ts";
import { TerminalRestartTargets } from "../../services/terminal-restart-targets.ts";
import { TerminalPaneComponent } from "../terminal-pane/terminal-pane.component.ts";

@Component({
  selector: "nol-terminal-panel",
  templateUrl: "./terminal-panel.component.html",
  styleUrl: "./terminal-panel.component.css",
  imports: [ButtonComponent, TerminalPaneComponent],
  host: { "(focusin)": "enter($event)" }
})
export class TerminalPanelComponent implements ITerminalRestartTarget, ITerminalFocusTarget {
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly client: TerminalRuntimeClient = new TerminalRuntimeClient(this.context);
  private readonly pane: Signal<TerminalPaneComponent | undefined> = viewChild(TerminalPaneComponent);
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly shown: Signal<boolean> = inject(WindowPartTokens.shown);
  private readonly announcer: LiveAnnouncer = inject(LiveAnnouncer);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly report: (error: unknown) => void = this.errors.handleError.bind(this.errors);
  private hasStarted: boolean = false;
  private isRestarting: boolean = false;

  protected readonly resources: typeof Resources = Resources;
  protected readonly buttonVariant: typeof ButtonVariant = ButtonVariant;
  protected readonly sessionId: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly failure: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly openingSize: TerminalSize = new TerminalSize(Resources.openingColumns, Resources.openingRows);

  public constructor() {
    effect(() => {
      if (this.shown() && !this.hasStarted) {
        this.hasStarted = true;
        untracked(() => void this.runAsync(async () => await this.client.findPanelTerminalAsync() ?? await this.client.openAsync(null, null, true)));
      }
    });
    inject(DestroyRef).onDestroy(TerminalRestartTargets.add(Resources.panelView, null, this));
    inject(DestroyRef).onDestroy(TerminalFocus.add(this));
  }

  public contains(element: Element | null): boolean {
    return this.host.contains(element);
  }

  public isFor(sessionId: string): boolean {
    return untracked(this.sessionId) === sessionId;
  }

  public async showAsync(): Promise<boolean> {
    const pane: TerminalPaneComponent | undefined = this.pane();
    if (Object.isUndefined(pane))
      return false;
    if (!untracked(this.shown))
      this.context.showView(Resources.panelView);
    pane.focusWhenShown();
    return true;
  }

  public hideDock(): void {
    this.context.hideViewDock(Resources.panelView);
  }

  public canRestart(): boolean {
    return !Object.isNull(untracked(this.failure)) || !Object.isNull((this.pane()?.size ?? null));
  }

  public async restartAsync(): Promise<void> {
    await this.restartAtAsync(this.pane()?.size ?? this.openingSize);
    this.pane()?.focus();
  }

  protected enter(event: FocusEvent): void {
    TerminalFocus.enter(this, event.relatedTarget);
  }

  protected async restartAtAsync(size: TerminalSize): Promise<void> {
    if (this.isRestarting)
      return;
    this.isRestarting = true;
    const ended: string | null = this.sessionId();
    await this.runAsync(() => Object.isNull(ended) ? this.client.openAsync(null, null, true) : this.client.restartAsync(ended, size, true)).finally(() => {
      this.isRestarting = false;
    });
  }

  private async runAsync(start: () => Promise<string>): Promise<void> {
    try {
      this.sessionId.set(await start());
      this.failure.set(null);
    }
    catch (error) {
      if (!TerminalRuntimeClient.isRefusal(error)) {
        this.report(error);
        return;
      }
      const text: string = Resources.formatOpenFailed(error);
      this.context.log(text);
      this.failure.set(text);
      this.announcer.announce(text).catch(this.report);
    }
  }
}
