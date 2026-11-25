/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { ApplicationRef, computed, createComponent, effect, Injector, signal, type ComponentRef, type EnvironmentInjector, type Signal, type WritableSignal } from "@angular/core";
import { WindowPartTokens, type IWindowPartContext } from "@noldova/desktop.window";
import { Resources as ProtocolResources } from "@noldova/terminal.protocol";

import { Resources } from "../../resources.ts";
import { TerminalPaneComponent } from "../components/terminal-pane/terminal-pane.component.ts";
import { EmbeddedRowsRefusedException } from "../exceptions/embedded-rows-refused.exception.ts";
import { TerminalNotActiveException } from "../exceptions/terminal-not-active.exception.ts";
import { TerminalPart } from "./terminal-part.ts";

export class EmbeddedTerminal {
  private readonly shown: WritableSignal<boolean>;
  private readonly maximumRows: WritableSignal<number>;
  private readonly pane: ComponentRef<TerminalPaneComponent>;
  private readonly application: ApplicationRef;

  public readonly element: HTMLElement;
  public readonly rows: Signal<number>;
  public readonly isFullScreen: Signal<boolean>;
  public readonly hasEnded: Signal<boolean>;
  public readonly rowHeight: Signal<number>;

  private constructor(element: HTMLElement, shown: WritableSignal<boolean>, pane: ComponentRef<TerminalPaneComponent>, paneElement: HTMLElement,
    application: ApplicationRef, maximumRows: number) {
    this.element = element;
    this.shown = shown;
    this.maximumRows = signal<number>(maximumRows);
    this.pane = pane;
    this.application = application;
    const instance: TerminalPaneComponent = pane.instance;
    this.rows = computed(() => Math.min(instance.drawnRows(), this.maximumRows()));
    this.isFullScreen = instance.isFullScreen;
    this.hasEnded = instance.hasEnded;
    this.rowHeight = instance.rowHeight;
    effect(() => {
      const height: number = instance.rowHeight();
      const drawn: number = instance.drawnRows();
      const rows: number = this.rows();
      paneElement.style.blockSize = Resources.formatEmbeddedHeight(Math.max(drawn, this.maximumRows()) * height);
      paneElement.style.marginBlockStart = Resources.formatPixels(-(drawn - rows) * height);
      element.style.blockSize = Resources.formatEmbeddedHeight(rows * height);
    }, { injector: pane.injector });
  }

  public static open(sessionId: string, injector: EnvironmentInjector, maximumRows: number): EmbeddedTerminal {
    EmbeddedTerminal.check(maximumRows);
    const context: IWindowPartContext | null = TerminalPart.context;
    if (Object.isNull(context))
      throw new TerminalNotActiveException();
    const shown: WritableSignal<boolean> = signal<boolean>(true);
    const element: HTMLElement = document.createElement(Resources.embeddedTerminalTag);
    element.style.display = Resources.embeddedDisplay;
    element.style.overflow = Resources.embeddedOverflow;
    const paneElement: HTMLElement = document.createElement(Resources.terminalPaneTag);
    element.append(paneElement);
    const pane: ComponentRef<TerminalPaneComponent> = createComponent(TerminalPaneComponent, {
      environmentInjector: injector,
      hostElement: paneElement,
      elementInjector: Injector.create({
        providers: [
          { provide: WindowPartTokens.context, useValue: context },
          { provide: WindowPartTokens.shown, useValue: shown }
        ]
      })
    });
    pane.setInput(Resources.sessionIdInput, sessionId);
    pane.setInput(Resources.isRestartableInput, false);
    pane.setInput(Resources.fixedRowsInput, maximumRows);
    pane.setInput(Resources.isFocusedOnOpenInput, false);
    const application: ApplicationRef = injector.get(ApplicationRef);
    application.attachView(pane.hostView);
    return new EmbeddedTerminal(element, shown, pane, paneElement, application, maximumRows);
  }

  public setMaximumRows(rows: number): void {
    EmbeddedTerminal.check(rows);
    this.maximumRows.set(rows);
    this.pane.setInput(Resources.fixedRowsInput, rows);
  }

  public setShown(shown: boolean): void {
    this.shown.set(shown);
  }

  public focus(): void {
    this.pane.instance.focusWhenShown();
  }

  public dispose(): void {
    this.application.detachView(this.pane.hostView);
    this.pane.destroy();
    this.element.remove();
  }

  private static check(rows: number): void {
    if (!(Number.isInteger(rows) && rows >= ProtocolResources.minimumRows && rows <= ProtocolResources.maximumRows))
      throw new EmbeddedRowsRefusedException(rows, ProtocolResources.minimumRows, ProtocolResources.maximumRows);
  }
}
