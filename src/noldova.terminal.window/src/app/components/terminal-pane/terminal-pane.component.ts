/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { LiveAnnouncer } from "@angular/cdk/a11y";
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  EnvironmentInjector,
  ErrorHandler,
  inject,
  Injector,
  input,
  output,
  signal,
  untracked,
  viewChild,
  ViewEncapsulation,
  type InputSignal,
  type OutputEmitterRef,
  type Signal,
  type WritableSignal
} from "@angular/core";
import { KeepsCtrlKeysDirective, LinkPlace, WindowPartTokens, type ILinkOpenOptions, type IWindowPartContext } from "@noldova/desktop.window";
import type { JsonValue } from "@noldova/context.json";
import {
  Resources as ProtocolResources,
  TerminalCompleteParams,
  TerminalCompletion,
  TerminalFindCommandsParams,
  TerminalInputEdge,
  TerminalMissingCommands,
  TerminalNames,
  TerminalSize,
  type TerminalInputStart,
  type WindowsPty
} from "@noldova/terminal.protocol";
import { ButtonComponent, ButtonVariant, ClipboardWriter, LinkOpenEvent, type LinkGesture } from "@noldova/ui.components.angular";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal, type IBuffer } from "@xterm/xterm";

import { Resources } from "../../../resources.ts";
import type { ISizedPane } from "../../interfaces/i-sized-pane.ts";
import type { ITerminalSink } from "../../interfaces/i-terminal-sink.ts";
import { EndedPane } from "../../models/ended-pane.ts";
import type { TerminalAppearance } from "../../models/terminal-appearance.ts";
import { CommandColoring } from "../../services/command-coloring.ts";
import { CommandSuggestion } from "../../services/command-suggestion.ts";
import { CompletionList } from "../../services/completion-list.ts";
import { KeyRouter } from "../../services/key-router.ts";
import { LinkPolicy } from "../../services/link-policy.ts";
import { PaneFitter } from "../../services/pane-fitter.ts";
import { PaneScrollbar } from "../../services/pane-scrollbar.ts";
import { PasteFilter } from "../../services/paste-filter.ts";
import { RendererSwitch } from "../../services/renderer-switch.ts";
import { SessionSizing } from "../../services/session-sizing.ts";
import { TerminalConnection } from "../../services/terminal-connection.ts";
import { TerminalFocus } from "../../services/terminal-focus.ts";
import { TerminalPager } from "../../services/terminal-pager.ts";
import { TerminalThemeReader } from "../../services/terminal-theme-reader.ts";
import { UrlLinkProvider } from "../../services/url-link-provider.ts";

@Component({
  selector: "nol-terminal-pane",
  templateUrl: "./terminal-pane.component.html",
  styleUrls: ["../../../../../../node_modules/@xterm/xterm/css/xterm.css", "./terminal-pane.component.css"],
  encapsulation: ViewEncapsulation.None,
  imports: [ButtonComponent, KeepsCtrlKeysDirective],
  host: { "[attr.title]": "linkTarget()" }
})
export class TerminalPaneComponent {
  private readonly drawn: WritableSignal<number> = signal<number>(1);
  private readonly height: WritableSignal<number> = signal<number>(0);
  private readonly fullScreen: WritableSignal<boolean> = signal<boolean>(false);
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly shown: Signal<boolean> = inject(WindowPartTokens.shown);
  private readonly clipboard: ClipboardWriter = inject(ClipboardWriter);
  private readonly announcer: LiveAnnouncer = inject(LiveAnnouncer);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly report: (error: unknown) => void = this.errors.handleError.bind(this.errors);
  private readonly injector: Injector = inject(Injector);
  private readonly environmentInjector: EnvironmentInjector = inject(EnvironmentInjector);
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly screen: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("screen");
  private readonly scrollbar: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("scrollbar");
  private readonly isMac: boolean = navigator.platform.startsWith(Resources.macPlatformPrefix);
  private readonly keys: KeyRouter = new KeyRouter(this.isMac, navigator.platform.startsWith(Resources.windowsPlatformPrefix));
  private readonly cleanups: (() => void)[] = [];
  private isDestroyed: boolean = false;
  private isLookStale: boolean = false;
  private background: string | undefined = undefined;
  private terminal: Terminal | undefined = undefined;
  private fontSize: number = Resources.defaultFontSize;
  private restyleTerminal: (() => void) | undefined = undefined;
  private isSuggesting: boolean = true;
  private suggestion: CommandSuggestion | undefined = undefined;
  private isColoring: boolean = false;
  private coloring: CommandColoring | undefined = undefined;
  private isCompleting: boolean = true;
  private completions: CompletionList | undefined = undefined;
  private isFocusWanted: boolean = false;

  protected readonly resources: typeof Resources = Resources;
  protected readonly buttonVariant: typeof ButtonVariant = ButtonVariant;
  protected readonly ended: WritableSignal<EndedPane | null> = signal<EndedPane | null>(null);
  protected readonly linkTarget: WritableSignal<string | null> = signal<string | null>(null);

  public readonly sessionId: InputSignal<string> = input.required<string>();
  public readonly isRestartable: InputSignal<boolean> = input<boolean>(true);
  public readonly fixedRows: InputSignal<number | null> = input<number | null>(null);
  public readonly isFocusedOnOpen: InputSignal<boolean> = input<boolean>(true);
  public readonly titleChanged: OutputEmitterRef<string> = output<string>();
  public readonly cwdChanged: OutputEmitterRef<string> = output<string>();
  public readonly restartRequested: OutputEmitterRef<TerminalSize> = output<TerminalSize>();
  public readonly hasEnded: Signal<boolean> = computed(() => this.ended() !== null);
  public readonly drawnRows: Signal<number> = this.drawn.asReadonly();
  public readonly rowHeight: Signal<number> = this.height.asReadonly();
  public readonly isFullScreen: Signal<boolean> = this.fullScreen.asReadonly();

  public constructor() {
    afterNextRender(() => this.createAsync().catch(this.report));
    const destroyRef: DestroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => this.dispose());
    this.followSetting(destroyRef, Resources.fontSizeSetting, t => this.chooseFontSize(t), t => Resources.formatFontSizeUnread(t));
    this.followSetting(destroyRef, ProtocolResources.suggestionsSetting, t => this.chooseSuggesting(t), t => Resources.formatSuggestionsUnread(t));
    this.followSetting(destroyRef, Resources.commandColorsSetting, t => this.chooseColoring(t), t => Resources.formatCommandColorsUnread(t));
    this.followSetting(destroyRef, Resources.completionListSetting, t => this.chooseCompleting(t), t => Resources.formatCompletionListUnread(t));
  }

  public get size(): TerminalSize | null {
    return this.terminal === undefined ? null : new TerminalSize(this.terminal.cols, this.terminal.rows);
  }

  public focus(): void {
    if (untracked(this.shown))
      this.terminal?.focus();
  }

  public focusWhenShown(): void {
    if (this.terminal !== undefined && untracked(this.shown))
      this.terminal.focus();
    else
      this.isFocusWanted = true;
  }

  public heightFor(rows: number): number {
    const screen: HTMLElement = this.screen().nativeElement;
    const style: CSSStyleDeclaration = getComputedStyle(screen);
    return this.host.clientHeight - screen.clientHeight + Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom) +
      rows * untracked(this.height);
  }

  private async createAsync(): Promise<void> {
    const appearance: TerminalAppearance = this.readAppearance();
    const isAsked: boolean = untracked(this.isFocusedOnOpen) && !TerminalFocus.takeUnasked(untracked(this.sessionId));
    const focused: Element | null = document.activeElement;
    await this.loadFontAsync(appearance);
    if (this.isDestroyed)
      return;

    const motion: MediaQueryList = matchMedia(Resources.reducedMotionQuery);
    const terminal: Terminal = new Terminal({
      fontFamily: appearance.fontFamily,
      fontSize: appearance.fontSize,
      theme: appearance.theme,
      overviewRuler: { width: appearance.scrollbarSize },
      lineHeight: Resources.lineHeight,
      minimumContrastRatio: Resources.minimumContrastRatio,
      scrollback: Resources.scrollback,
      cursorBlink: !motion.matches,
      reflowCursorLine: true,
      allowProposedApi: true,
      linkHandler: {
        activate: (event, url) => this.openLink(event, url),
        hover: (_event, url) => this.linkTarget.set(url),
        leave: () => this.linkTarget.set(null),
        allowNonHttpProtocols: true
      }
    });
    const fit: FitAddon = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(this.screen().nativeElement);
    this.terminal = terminal;
    for (const query of Resources.answeredQueries)
      terminal.parser.registerCsiHandler(query, () => true);
    terminal.parser.registerDcsHandler(Resources.answeredSettingQuery, () => true);
    terminal.registerLinkProvider(new UrlLinkProvider(terminal, (event, url) => this.openLink(event, url), t => this.linkTarget.set(t)));
    const suggestion: CommandSuggestion = new CommandSuggestion(terminal);
    suggestion.enable(this.isSuggesting);
    this.suggestion = suggestion;
    const coloring: CommandColoring = new CommandColoring(terminal, t => this.context.log(t));
    coloring.enable(this.isColoring);
    this.coloring = coloring;
    const completions: CompletionList = new CompletionList(terminal, this.screen().nativeElement, suggestion, t => this.context.log(t),
      this.environmentInjector);
    completions.enable(this.isCompleting);
    this.completions = completions;
    terminal.attachCustomKeyEventHandler(t => this.routeKey(terminal, t, suggestion, completions, text => pager.type(text)));
    const renderer: RendererSwitch = new RendererSwitch(terminal, t => this.context.log(t));
    const scrollbar: PaneScrollbar = new PaneScrollbar(terminal, this.scrollbar().nativeElement);

    let sessionId: string = untracked(this.sessionId);
    const sized: ISizedPane = {
      isShown: () => untracked(this.shown),
      hasFocus: () => this.host.contains(document.activeElement),
      follow: size => this.follow(terminal, size),
      lead: () => fitter.request()
    };
    const fitter: PaneFitter = new PaneFitter(terminal, fit, size => {
      SessionSizing.resized(sessionId, sized, size);
      this.resize(pager.connection, size);
    }, () => SessionSizing.isSizing(sessionId, sized), () => untracked(this.fixedRows), () => untracked(this.shown));
    const drawnScreens: NodeListOf<Element> = this.host.querySelectorAll(Resources.xtermScreenSelector);
    terminal.onRender(() => this.measure(terminal, drawnScreens));
    terminal.onWriteParsed(() => this.measure(terminal, drawnScreens));
    let pager: TerminalPager = this.connect(terminal, fitter, sessionId, suggestion, coloring, completions);
    let leave: () => void = SessionSizing.join(sessionId, sized);
    const claim = (): void => SessionSizing.claim(sessionId, sized);
    this.host.addEventListener(Resources.focusInEvent, claim);
    terminal.onData(t => pager.type(t));
    terminal.onBinary(t => pager.type(t));
    terminal.onScroll(t => pager.scroll(t));

    const paste = (event: ClipboardEvent): void => this.paste(pager, event);
    this.host.addEventListener(Resources.pasteEvent, paste, { capture: true });
    const removeSelection: () => void = this.context.registerSelectionSource(this.host,
      { hasSelection: () => terminal.hasSelection(), readSelection: () => terminal.getSelection() });
    const resizes: ResizeObserver = new ResizeObserver(() => {
      scrollbar.sync();
      this.measure(terminal, drawnScreens);
      this.refit(terminal, fitter);
    });
    resizes.observe(this.screen().nativeElement);
    const themes: MutationObserver = new MutationObserver(() => this.restyle(terminal, fitter));
    this.restyleTerminal = () => this.restyle(terminal, fitter);
    themes.observe(document.documentElement, { attributeFilter: [...Resources.themeObservedAttributes] });
    this.restyle(terminal, fitter);
    const blink = (): void => {
      terminal.options.cursorBlink = !motion.matches;
    };
    motion.addEventListener(Resources.changeEvent, blink);
    const contrast: MediaQueryList = matchMedia(Resources.forcedColorsQuery);
    const palette: MediaQueryList = matchMedia(Resources.darkPaletteQuery);
    const recolor = (): void => this.restyle(terminal, fitter);
    contrast.addEventListener(Resources.changeEvent, recolor);
    palette.addEventListener(Resources.changeEvent, recolor);
    this.cleanups.push(
      () => pager.connection.close(),
      () => leave(),
      () => this.host.removeEventListener(Resources.focusInEvent, claim),
      () => fitter.dispose(),
      () => renderer.hide(),
      () => resizes.disconnect(),
      () => themes.disconnect(),
      () => motion.removeEventListener(Resources.changeEvent, blink),
      () => contrast.removeEventListener(Resources.changeEvent, recolor),
      () => palette.removeEventListener(Resources.changeEvent, recolor),
      () => this.host.removeEventListener(Resources.pasteEvent, paste, { capture: true }),
      removeSelection,
      () => suggestion.dispose(),
      () => coloring.dispose(),
      () => completions.dispose(),
      () => scrollbar.dispose(),
      () => {
        this.terminal = undefined;
        this.restyleTerminal = undefined;
        this.suggestion = undefined;
        this.coloring = undefined;
        this.completions = undefined;
      },
      () => terminal.dispose());

    effect(() => {
      const next: string = this.sessionId();
      if (next === sessionId)
        return;
      sessionId = next;
      untracked(() => {
        pager.connection.close();
        leave();
        pager = this.connect(terminal, fitter, next, suggestion, coloring, completions);
        leave = SessionSizing.join(next, sized);
      });
    }, { injector: this.injector });
    effect(() => {
      this.fixedRows();
      untracked(() => fitter.request());
    }, { injector: this.injector });
    effect(() => {
      const isShown: boolean = this.shown();
      untracked(() => {
        SessionSizing.update(sessionId);
        if (isShown) {
          renderer.show();
          this.refit(terminal, fitter);
          if (this.isFocusWanted)
            afterNextRender(() => this.takeFocus(terminal), { injector: this.injector });
        }
        else
          renderer.hide();
        pager.connection.setVisible(isShown);
      });
    }, { injector: this.injector });
    if (untracked(this.shown) && (this.isFocusWanted || isAsked && (document.activeElement === focused || document.activeElement === document.body)))
      this.takeFocus(terminal);
  }

  private followSetting(destroyRef: DestroyRef, name: string, choose: (value: JsonValue) => void, unread: (error: unknown) => string): void {
    let isChanged: boolean = false;
    destroyRef.onDestroy(this.context.onSettingChanged(name, value => {
      isChanged = true;
      choose(value);
    }));
    this.context.readSettingAsync(name).then(
      t => {
        if (!isChanged)
          choose(t.value);
      },
      (error: unknown) => this.context.log(unread(error)));
  }

  private takeFocus(terminal: Terminal): void {
    this.isFocusWanted = false;
    terminal.focus();
  }

  private async loadFontAsync(appearance: TerminalAppearance): Promise<void> {
    try {
      await document.fonts.load(Resources.formatFont(appearance.fontSize, appearance.fontFamily));
    }
    catch (error) {
      this.context.log(Resources.formatFontFailed(error));
    }
  }

  private connect(terminal: Terminal, fitter: PaneFitter, sessionId: string, suggestion: CommandSuggestion, coloring: CommandColoring,
    completions: CompletionList): TerminalPager {
    suggestion.endInput();
    coloring.endInput();
    coloring.setFinder(async names => TerminalMissingCommands.fromJson(
      await this.context.requestAsync(TerminalNames.findCommandsMethod, new TerminalFindCommandsParams(sessionId, names).toJson())).names);
    completions.setCompleter(async (line, cursor) => TerminalCompletion.fromJson(
      await this.context.requestAsync(TerminalNames.completeMethod, new TerminalCompleteParams(sessionId, line, cursor, true).toJson())));
    const sink: ITerminalSink = {
      drawAsync: async attachment => {
        await pager.drawAsync(attachment);
        suggestion.setCommands(attachment.commands);
        coloring.resumeFinder();
        coloring.setShell(attachment.shellKind);
        terminal.write("", () => this.startInput(suggestion, coloring, attachment.input));
      },
      write: (data, written) => pager.write(data, written),
      addCommand: command => suggestion.remember(command),
      markInput: edge => {
        if (edge === TerminalInputEdge.RightPrompt) {
          suggestion.markRightPrompt();
          coloring.markRightPrompt();
        }
        else if (edge === TerminalInputEdge.Continuation) {
          if (pager.isLive)
            coloring.continueInput();
        }
        else if (edge === TerminalInputEdge.Start && pager.isLive) {
          suggestion.startInput();
          coloring.startInput();
        }
        else {
          suggestion.endInput();
          coloring.endInput();
        }
      },
      follow: stored => pager.follow(stored),
      showTitle: title => this.titleChanged.emit(title.slice(0, Resources.maximumTitleLength)),
      showCwd: cwd => this.cwdChanged.emit(cwd),
      showExit: exit => this.end(terminal, Resources.formatExit(exit.exitCode)),
      showRunning: () => this.run(terminal, connection),
      showLost: () => this.end(terminal, Resources.closed)
    };
    const connection: TerminalConnection = new TerminalConnection(this.context, sessionId, crypto.randomUUID(), sink);
    const pager: TerminalPager = new TerminalPager(terminal, connection, (size, windowsPty) => this.reset(terminal, fitter, size, windowsPty),
      this.context.log.bind(this.context), Resources.storedPages);
    this.ended.set(null);
    connection.openAsync().catch(this.report);
    connection.setVisible(untracked(this.shown));
    return pager;
  }

  private reset(terminal: Terminal, fitter: PaneFitter, size: TerminalSize, windowsPty: WindowsPty | null): void {
    terminal.reset();
    terminal.options.disableStdin = false;
    terminal.options.windowsPty = windowsPty === null ? {} : { backend: Resources.conptyBackend, buildNumber: windowsPty.buildNumber };
    terminal.resize(size.columns, size.rows);
    this.ended.set(null);
    fitter.requestReport();
  }

  private end(terminal: Terminal, text: string): void {
    terminal.options.disableStdin = true;
    this.ended.set(new EndedPane(text, terminal));
    this.announcer.announce(text).catch(this.report);
  }

  private run(terminal: Terminal, connection: TerminalConnection): void {
    terminal.options.disableStdin = false;
    // The ended strip goes, so a focus on its Restart moves to the shell rather than to the page.
    const active: Element | null = document.activeElement;
    if (this.host.contains(active) && !this.screen().nativeElement.contains(active))
      terminal.focus();
    this.ended.set(null);
    connection.resize(new TerminalSize(terminal.cols, terminal.rows));
  }

  private measure(terminal: Terminal, drawnScreens: NodeListOf<Element>): void {
    const buffer: IBuffer = terminal.buffer.active;
    const isFullScreen: boolean = buffer.type === Resources.alternateBuffer;
    this.fullScreen.set(isFullScreen);
    this.drawn.set(isFullScreen ? terminal.rows : Math.min(terminal.rows, buffer.baseY + buffer.cursorY + 1));
    for (const screen of drawnScreens) {
      const height: number = screen.getBoundingClientRect().height / terminal.rows;
      if (height > 0)
        this.height.set(height);
    }
  }

  private follow(terminal: Terminal, size: TerminalSize): void {
    terminal.resize(size.columns, size.rows);
  }

  private resize(connection: TerminalConnection, size: TerminalSize): void {
    if (this.ended() === null)
      connection.resize(size);
  }

  private restyle(terminal: Terminal, fitter: PaneFitter): void {
    this.isLookStale = !this.host.isConnected;
    if (this.isLookStale)
      return;
    const appearance: TerminalAppearance = this.readAppearance();
    this.background = TerminalThemeReader.readBackground(this.host);
    terminal.options.theme = appearance.theme;
    terminal.options.fontFamily = appearance.fontFamily;
    terminal.options.fontSize = appearance.fontSize;
    terminal.options.overviewRuler = { width: appearance.scrollbarSize };
    this.coloring?.setColors(TerminalThemeReader.readCommandColors(this.host));
    fitter.request();
  }

  private readAppearance(): TerminalAppearance {
    return TerminalThemeReader.read(this.host, this.fontSize);
  }

  private startInput(suggestion: CommandSuggestion, coloring: CommandColoring, input: TerminalInputStart | null): void {
    if (input === null) {
      suggestion.endInput();
      coloring.endInput();
    }
    else {
      suggestion.startInputAt(input.rowsAbove, input.column, input.rightPrompt);
      coloring.startInputAt(input.rowsAbove, input.column, input.rightPrompt);
    }
  }

  private chooseSuggesting(value: JsonValue): void {
    this.isSuggesting = value !== false;
    this.suggestion?.enable(this.isSuggesting);
  }

  private chooseColoring(value: JsonValue): void {
    this.isColoring = value === true;
    this.coloring?.enable(this.isColoring);
  }

  private chooseCompleting(value: JsonValue): void {
    this.isCompleting = value !== false;
    this.completions?.enable(this.isCompleting);
  }

  private chooseFontSize(value: JsonValue): void {
    this.fontSize = typeof value === "number" ? value : Resources.defaultFontSize;
    this.restyleTerminal?.();
  }

  private refit(terminal: Terminal, fitter: PaneFitter): void {
    if (this.isLookStale || (this.host.isConnected && TerminalThemeReader.readBackground(this.host) !== this.background))
      this.restyle(terminal, fitter);
    else
      fitter.request();
  }

  private routeKey(terminal: Terminal, event: KeyboardEvent, suggestion: CommandSuggestion, completions: CompletionList,
    type: (text: string) => void): boolean {
    if (completions.take(event))
      return false;
    const rest: string | null = suggestion.take(event);
    if (rest !== null) {
      event.preventDefault();
      type(rest);
      return false;
    }
    const hasSelection: boolean = terminal.hasSelection();
    if (event.type !== Resources.keyDownEvent || !this.keys.isCopy(event, hasSelection))
      return this.keys.isForShell(event, hasSelection, this.context.findWindowCommand(event));
    event.preventDefault();
    if (hasSelection)
      void this.copyAsync(terminal.getSelection());
    return false;
  }

  private async copyAsync(text: string): Promise<void> {
    try {
      if (!await this.clipboard.writeTextAsync(text))
        this.context.log(Resources.formatCopyFailed(Resources.copyRefused));
    }
    catch (error) {
      this.context.log(Resources.formatCopyFailed(error));
    }
  }

  private paste(pager: TerminalPager, event: ClipboardEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const text: string = event.clipboardData?.getData(Resources.plainTextType) ?? "";
    if (text !== "")
      pager.paste(PasteFilter.clean(text));
  }

  private openLink(event: MouseEvent, url: string): void {
    if (!LinkPolicy.isOpening(event, this.isMac) || !LinkPolicy.isAllowed(url))
      return;
    const gesture: LinkGesture = new LinkOpenEvent(url, event).gesture;
    const place: LinkPlace = this.context.readSetting(Resources.linkClickSetting) === LinkPlace.InApp ? LinkPlace.InApp : LinkPlace.System;
    const options: ILinkOpenOptions = { gesture, place };
    this.context.openLinkAsync(url, options).then(undefined, (error: unknown) => this.context.log(Resources.formatLinkFailed(error)));
  }

  private dispose(): void {
    this.isDestroyed = true;
    for (const cleanup of this.cleanups.splice(0))
      cleanup();
  }
}
