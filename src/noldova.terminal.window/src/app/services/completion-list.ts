/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ApplicationRef, createComponent, type ComponentRef, type EnvironmentInjector } from "@angular/core";
import { Resources as ProtocolResources, type TerminalCompletion, type TerminalCompletionItem } from "@noldova/terminal.protocol";
import { CompletionChoice, CompletionListComponent } from "@noldova/ui.components.angular";
import type { IBuffer, IDisposable, Terminal } from "@xterm/xterm";

import { Resources } from "../../resources.ts";
import type { CommandSuggestion } from "./command-suggestion.ts";

export class CompletionList {
  private readonly terminal: Terminal;
  private readonly container: HTMLElement;
  private readonly suggestion: CommandSuggestion;
  private readonly log: (message: string) => void;
  private readonly injector: EnvironmentInjector;
  private readonly subscriptions: readonly IDisposable[];
  private readonly listId: string = crypto.randomUUID();
  private completer: ((line: string, cursor: number) => Promise<TerminalCompletion>) | null = null;
  private isEnabled: boolean = true;
  private asked: number = 0;
  private isAsking: boolean = false;
  private prefix: string = "";
  private items: readonly TerminalCompletionItem[] = [];
  private shown: readonly TerminalCompletionItem[] = [];
  private active: number = 0;
  private list: ComponentRef<CompletionListComponent> | null = null;
  private choices: readonly CompletionChoice[] = [];

  public constructor(terminal: Terminal, container: HTMLElement, suggestion: CommandSuggestion, log: (message: string) => void,
    injector: EnvironmentInjector) {
    this.terminal = terminal;
    this.container = container;
    this.suggestion = suggestion;
    this.log = log;
    this.injector = injector;
    const close = (): void => this.close();
    terminal.textarea?.addEventListener(Resources.blurEvent, close);
    this.subscriptions = [
      terminal.onWriteParsed(() => this.narrow()),
      terminal.onCursorMove(() => this.narrow()),
      terminal.onResize(close),
      terminal.onScroll(close),
      { dispose: () => terminal.textarea?.removeEventListener(Resources.blurEvent, close) }
    ];
  }

  public enable(isEnabled: boolean): void {
    this.isEnabled = isEnabled;
    if (!isEnabled)
      this.close();
  }

  public setCompleter(completer: (line: string, cursor: number) => Promise<TerminalCompletion>): void {
    this.completer = completer;
    this.close();
  }

  public take(event: KeyboardEvent): boolean {
    if (event.isComposing || event.key === Resources.composingKey)
      return false;
    const isPlain: boolean = !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
    const isDown: boolean = event.type === Resources.keyDownEvent;
    const isTab: boolean = isPlain && event.key === Resources.completeKey;
    if (isDown && this.isAsking && !isTab && !Resources.modifierKeys.includes(event.key))
      this.close();
    if (this.list !== null) {
      if (isPlain && (Resources.completionMoveKeys.includes(event.key) || Resources.completionInsertKeys.includes(event.key)
        || event.key === Resources.completionCloseKey)) {
        event.preventDefault();
        if (isDown)
          this.press(event.key);
        return true;
      }
      if (isDown && !CompletionList.isTyping(event))
        this.close();
      return false;
    }
    if (!isTab || !this.isEnabled || this.completer === null)
      return false;
    const line: string | null = this.suggestion.readLine();
    if (line === null || line.length > ProtocolResources.maximumSuggestionLength)
      return false;
    event.preventDefault();
    if (isDown && !this.isAsking)
      void this.askAsync(this.completer, line);
    return true;
  }

  public close(): void {
    this.asked++;
    this.isAsking = false;
    this.items = [];
    this.shown = [];
    for (const name of [Resources.activeDescendantAttribute, Resources.controlsAttribute, Resources.expandedAttribute, Resources.autocompleteAttribute])
      this.terminal.textarea?.removeAttribute(name);
    const element: HTMLElement | undefined = this.list?.location.nativeElement;
    this.list?.destroy();
    this.list = null;
    element?.remove();
  }

  public dispose(): void {
    for (const subscription of this.subscriptions)
      subscription.dispose();
    this.close();
  }

  private async askAsync(completer: (line: string, cursor: number) => Promise<TerminalCompletion>, line: string): Promise<void> {
    const asked: number = ++this.asked;
    this.isAsking = true;
    let completion: TerminalCompletion | null = null;
    try {
      completion = await completer(line, line.length);
    }
    catch (error) {
      this.log(Resources.formatCompletionFailed(error));
    }
    if (asked !== this.asked)
      return;
    this.isAsking = false;
    if (completion?.isShellTab === true || this.suggestion.readLine() !== line)
      return;
    if (completion === null || completion.items.length === 0) {
      this.terminal.input(Resources.tabInput);
      return;
    }
    this.prefix = line.slice(0, completion.replaceFrom);
    this.items = completion.items;
    this.active = 0;
    this.narrow();
  }

  private press(key: string): void {
    if (Resources.completionMoveKeys.includes(key)) {
      const step: number = key === Resources.completionMoveKeys[0] ? -1 : 1;
      this.active = (this.active + step + this.shown.length) % this.shown.length;
      this.render();
    }
    else if (Resources.completionInsertKeys.includes(key)) {
      for (const item of this.shown.slice(this.active, this.active + 1))
        this.insert(item);
    }
    else
      this.close();
  }

  private insert(item: TerminalCompletionItem): void {
    const line: string | null = this.suggestion.readLine();
    if (line === null)
      return;
    const word: string = line.slice(this.prefix.length);
    const text: string = item.text.startsWith(word) ? item.text.slice(word.length)
      : Resources.eraseInput.repeat([...word].length) + item.text;
    this.close();
    if (text.length > 0)
      this.terminal.input(text);
  }

  private narrow(): void {
    if (this.items.length === 0)
      return;
    const line: string | null = this.suggestion.readTyped();
    if (line === null || !line.startsWith(this.prefix)) {
      this.close();
      return;
    }
    const word: string = line.slice(this.prefix.length).toLocaleLowerCase();
    const current: TerminalCompletionItem | undefined = this.shown[this.active];
    const shown: readonly TerminalCompletionItem[] = this.items.filter(t => t.text.toLocaleLowerCase().startsWith(word));
    if (shown.length === 0) {
      this.close();
      return;
    }
    this.shown = shown;
    this.active = current === undefined ? 0 : Math.max(shown.indexOf(current), 0);
    this.render(line.length - this.prefix.length);
  }

  private render(wordLength: number | null = null): void {
    const list: ComponentRef<CompletionListComponent> = this.list ?? this.create();
    if (wordLength !== null) {
      this.choices = this.shown.map(t => new CompletionChoice(t.label, Resources.completionKinds[t.kind]));
      list.setInput(Resources.completionListInputs.choices, this.choices);
    }
    list.setInput(Resources.completionListInputs.active, this.active);
    list.changeDetectorRef.detectChanges();
    this.terminal.textarea?.setAttribute(Resources.activeDescendantAttribute, CompletionListComponent.optionId(this.listId, this.active));
    this.terminal.textarea?.setAttribute(Resources.controlsAttribute, this.listId);
    this.terminal.textarea?.setAttribute(Resources.expandedAttribute, String(true));
    this.terminal.textarea?.setAttribute(Resources.autocompleteAttribute, Resources.listAutocomplete);
    if (wordLength !== null)
      this.place(list, wordLength);
  }

  private create(): ComponentRef<CompletionListComponent> {
    const list: ComponentRef<CompletionListComponent> = createComponent(CompletionListComponent, { environmentInjector: this.injector });
    list.setInput(Resources.completionListInputs.listId, this.listId);
    list.setInput(Resources.completionListInputs.label, Resources.completionsLabel);
    list.setInput(Resources.completionListInputs.isCode, true);
    list.instance.chosen.subscribe(t => this.choose(t));
    this.injector.get(ApplicationRef).attachView(list.hostView);
    this.container.append(list.location.nativeElement);
    this.list = list;
    return list;
  }

  private choose(choice: CompletionChoice): void {
    const index: number = this.choices.indexOf(choice);
    for (const item of this.shown.slice(index, index + 1))
      this.insert(item);
  }

  private place(list: ComponentRef<CompletionListComponent>, wordLength: number): void {
    const element: HTMLElement = list.location.nativeElement;
    const buffer: IBuffer = this.terminal.buffer.active;
    const screen: Element | null = this.container.querySelector(Resources.xtermScreenSelector);
    if (screen === null)
      return;
    const box: DOMRect = this.container.getBoundingClientRect();
    const cells: DOMRect = screen.getBoundingClientRect();
    const cellWidth: number = cells.width / this.terminal.cols;
    const cellHeight: number = cells.height / this.terminal.rows;
    const left: number = cells.left - box.left + Math.max(buffer.cursorX - wordLength, 0) * cellWidth;
    const above: number = cells.top - box.top + buffer.cursorY * cellHeight;
    const below: number = above + cellHeight;
    const roomBelow: number = box.height - below;
    list.setInput(Resources.completionListInputs.maxHeight, Math.max(roomBelow, above));
    list.changeDetectorRef.detectChanges();
    const size: DOMRect = element.getBoundingClientRect();
    element.style.top = Resources.formatPixels(size.height <= roomBelow || roomBelow >= above ? below : above - size.height);
    element.style.left = Resources.formatPixels(Math.max(Math.min(left, box.width - size.width), 0));
  }

  private static isTyping(event: KeyboardEvent): boolean {
    return !event.altKey && !event.ctrlKey && !event.metaKey && ([...event.key].length === 1 || event.key === Resources.backspaceKey);
  }
}
