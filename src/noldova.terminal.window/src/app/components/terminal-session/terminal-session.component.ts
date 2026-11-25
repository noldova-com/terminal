/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Component, computed, DestroyRef, effect, ElementRef, ErrorHandler, inject, input, signal, untracked, viewChild, type InputSignal, type Signal, type WritableSignal } from "@angular/core";
import { DockSide, WindowPartTokens, type IWindowPartContext } from "@noldova/desktop.window";
import { TerminalNames, type TerminalSize } from "@noldova/terminal.protocol";

import { Resources } from "../../../resources.ts";
import type { ITerminalFocusTarget } from "../../interfaces/i-terminal-focus-target.ts";
import type { ITerminalRestartTarget } from "../../interfaces/i-terminal-restart-target.ts";
import { TerminalDockGrowths } from "../../services/terminal-dock-growths.ts";
import { TerminalFocus } from "../../services/terminal-focus.ts";
import { TerminalRuntimeClient } from "../../services/terminal-runtime-client.ts";
import { TerminalRestartTargets } from "../../services/terminal-restart-targets.ts";
import { TerminalPaneComponent } from "../terminal-pane/terminal-pane.component.ts";

@Component({
  selector: "nol-terminal-session",
  templateUrl: "./terminal-session.component.html",
  styleUrl: "./terminal-session.component.css",
  imports: [TerminalPaneComponent],
  host: { "(focusin)": "enter($event)" }
})
export class TerminalSessionComponent implements ITerminalRestartTarget, ITerminalFocusTarget {
  private readonly isOwnTerminal: WritableSignal<boolean> = signal<boolean>(false);
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly client: TerminalRuntimeClient = new TerminalRuntimeClient(this.context);
  private readonly pane: Signal<TerminalPaneComponent | undefined> = viewChild(TerminalPaneComponent);
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private isRestarting: boolean = false;

  protected readonly isRestartable: WritableSignal<boolean> = signal<boolean>(true);

  public readonly instance: InputSignal<string> = input.required<string>();
  public readonly title: InputSignal<string> = input<string>(Resources.panelTitle);

  private readonly dock: Signal<Signal<DockSide | null>> = computed(() => this.context.viewDockOf(Resources.sessionView, this.instance()));

  public constructor() {
    effect(() => {
      const sessionId: string = this.instance();
      untracked(() => {
        this.isOwnTerminal.set(false);
        this.client.isAgentTerminalAsync(sessionId).then(t => {
          this.isRestartable.set(!t);
          this.isOwnTerminal.set(!t);
        }, (error: unknown) => {
          if (TerminalRuntimeClient.isRefusal(error))
            this.context.log(Resources.formatRequestFailed(TerminalNames.sessionsMethod, error));
          else
            this.errors.handleError(error);
        });
      });
    });
    effect(onCleanup => onCleanup(TerminalRestartTargets.add(Resources.sessionView, this.instance(), this)));
    effect(() => {
      const sessionId: string = this.instance();
      const pane: TerminalPaneComponent | undefined = this.pane();
      if (!Object.isUndefined(pane) && pane.rowHeight() > 0 && this.dock()() === DockSide.Bottom)
        untracked(() => TerminalDockGrowths.grow(sessionId, rows => this.context.growViewDock(Resources.sessionView,
          pane.heightFor(rows) / Number.parseFloat(getComputedStyle(document.documentElement).fontSize), sessionId)));
    });
    inject(DestroyRef).onDestroy(TerminalFocus.add(this));
  }

  public contains(element: Element | null): boolean {
    return this.host.contains(element);
  }

  public isFor(sessionId: string): boolean {
    return untracked(this.instance) === sessionId;
  }

  public async showAsync(): Promise<boolean> {
    await this.client.openTabsAsync([this.instance()]);
    this.pane()?.focusWhenShown();
    return true;
  }

  public hideDock(): void {
    this.context.hideViewDock(Resources.sessionView, untracked(this.instance));
  }

  public canRestart(): boolean {
    return untracked(this.isOwnTerminal) && !Object.isNull((this.pane()?.size ?? null));
  }

  public async restartAsync(): Promise<void> {
    const size: TerminalSize | null = this.pane()?.size ?? null;
    if (Object.isNull(size))
      return;
    await this.restartAtAsync(size);
    this.pane()?.focus();
  }

  protected enter(event: FocusEvent): void {
    TerminalFocus.enter(this, event.relatedTarget);
  }

  protected async restartAtAsync(size: TerminalSize): Promise<void> {
    if (this.isRestarting)
      return;
    this.isRestarting = true;
    try {
      const sessionId: string = await this.client.restartAsync(this.instance(), size);
      if (sessionId !== this.instance())
        await this.client.openTabsAsync([sessionId]);
    }
    catch (error) {
      if (TerminalRuntimeClient.isRefusal(error))
        this.context.log(Resources.formatOpenFailed(error));
      else
        this.errors.handleError(error);
    }
    finally {
      this.isRestarting = false;
    }
  }
}
