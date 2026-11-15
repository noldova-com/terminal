# @noldova/terminal.protocol

The messages the terminal module's runtime and window parts exchange, with their JSON forms and their checks, and `RuntimeTerminalOwners`, the contract of the runtime service `terminal.owners` that an app's runtime part checks the service against.

Each message reads its JSON form with `ProtocolReader`, which reads only through context's `JsonReader` and adds the protocol's limits and its refusal of unknown fields.
A member set to `undefined` counts as absent, as in context's `JsonReader` and as JSON drops it, so an optional field set to `undefined` reads as not given and a required one is refused.
A message read from JSON is built through `ProtocolReader.create`, so a field that breaks a rule only its constructor checks, such as a relative folder, is refused as a `JsonException` at the field's path, with the constructor's `ArgumentException` as its cause.
An array item outside its allowed values gets `Resources.formatExpectedOneOf`, which keeps context's text for a field, "Expected one of a, b.", since context doesn't export its texts.
`Resources`' members that `index.d.ts` doesn't declare are internal to the protocol and may change in any version.
The tests' `tsconfig.spec.json` keeps the `DOM` library beside Node's types, although the package runs no browser code: Vitest's own declarations reach `@vitest/browser`'s, which name DOM types, and the declarations are type-checked, since `skipLibCheck` is off.

Both parts of [`@noldova/terminal`](https://github.com/noldova-com/terminal/tree/main/src/noldova.terminal) import it by its name, and the module pins it at its own version.
[documents/ARCHITECTURE.md](https://github.com/noldova-com/terminal/blob/main/documents/ARCHITECTURE.md) says how the parts talk, and the [README](https://github.com/noldova-com/terminal#readme) how to build and test it.
It is licensed under the [MIT License](https://github.com/noldova-com/terminal/blob/main/LICENSE).
