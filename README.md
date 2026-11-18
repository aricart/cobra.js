# cobra.js

A lightweight, type-safe CLI framework for Deno, Node.js and Bun. Heavily
inspired by the excellent [Cobra](https://github.com/spf13/cobra) library from
Go. It has no dependencies: arguments are parsed with `parseArgs` from
`node:util`, which Deno, Node.js and Bun all provide.

The foundation of a good CLI is good help. Most of the complexity in cobra.js is
dedicated to auto-generating usage information. Cobra.js automatically generates
help from your command configurations.

All CLIs in cobra.js use commands and flags with full TypeScript type safety.

## Installation

**Deno** (JSR):

```typescript
import { cli } from "jsr:@aricart/cobra";
```

**Node.js** (22 or newer) and **Bun** (npm):

```bash
npm install @aricart/cobra
```

```typescript
import { cli } from "@aricart/cobra";
// or, from commonjs
const { cli } = require("@aricart/cobra");
```

The npm package has ES module and CommonJS builds, both with type declarations.

## Commands

The basic configuration for a command specifies the following:

```typescript
export type Cmd = {
  use: string; // name and usage
  short?: string; // short description shown in help
  long?: string; // long help (shown with --help)
  run?: Run; // command handler
};

// Command handler signature
export type Run = (
  cmd: Command,
  args: string[],
  flags: Flags,
) => Promise<number>;
```

```typescript
// import the library
import { cli } from "jsr:@aricart/cobra";

// create the root command
const root = cli({
  use: "greeting",
  short: "says hello or goodbye",
});
root.addFlag({
  short: "s",
  name: "strong",
  type: "boolean",
  usage: "say message strongly",
  persistent: true,
});
// add a subcommand
const hello = root.addCommand({
  use: "hello",
  short: "says hello",
  // this is the handler for the command, you get
  // the command being executed, any args following a `--`
  // and an object to let you access relevant flags.
  run: (cmd, args, flags): Promise<number> => {
    const strong = flags.value<boolean>("strong") ? "!!!" : "";
    let n = flags.value<string>("name");
    n = n === "" ? "mystery person" : n;
    cmd.stdout(`hello ${n}${strong}\n`);
    return Promise.resolve(0);
  },
});
```

To execute the cli, simply `root.execute()` with arguments:

```typescript
root.exit(await root.execute());
```

The return of the command is a `Promise<number>`, the exit code to pass to
`root.exit(n)` (or `Deno.exit(n)`, `process.exit(n)`).

## Flags

The second component is flags. While parsing arguments can easily be done with
utils such as [`parse`](https://deno.land/std/flags), when creating CLI tools,
you'll also want to provide long/short flag names, the type of data you expect,
and usage information:

```typescript
// fields every flag has; a flag needs a name, a short name, or both
interface FlagInputBase {
  name?: string; // --name
  short?: string; // -n, a single character
  usage?: string; // shown in help
  required?: boolean; // the command fails without it
  persistent?: boolean; // inherited by subcommands
}

// `type` picks the kind of flag and the type of its default
type FlagInput =
  | FlagInputBase & { type: "string"; default?: string | string[] | null }
  | FlagInputBase & { type: "boolean"; default?: boolean | null }
  | FlagInputBase & { type: "number"; default?: number | number[] | null };
```

Adding flags to the command above:

```typescript
hello.addFlag({
  short: "n",
  name: "name",
  type: "string",
  usage: "name to say hello to",
});
hello.addFlag({
  short: "s",
  name: "strong",
  type: "boolean",
  usage: "say hello strongly",
});

// add goodbye command
const goodbye = root.addCommand({
  use: "goodbye",
  short: "says goodbye",
  run: (cmd, args, flags): Promise<number> => {
    const strong = flags.value<boolean>("strong") ? "!!!" : "";
    let n = flags.value<string>("name");
    n = n === "" ? "mystery person" : n;
    cmd.stdout(`goodbye ${n}${strong}\n`);
    return Promise.resolve(0);
  },
});
goodbye.addFlag({
  short: "n",
  name: "name",
  type: "string",
  usage: "name to say goodbye to",
});
```

Processing flags is straightforward with full type safety:

```typescript
const n = flags.value<string>("name");
const strong = flags.value<boolean>("strong");
const count = flags.value<number>("count");
```

The `value<T>()` method is type-safe and constrained to `FlagValue` types
(string, boolean, or number). The value returned will be the one entered by the
user, or the specified default, or the type's default value (`""` for strings,
`false` for booleans, `0` for numbers).

Flags marked as `persistent` can be associated with a container command and are
available to all subcommands, reducing code duplication.

### Parsing rules

- Values: `--name value`, `--name=value`, `-n value` and `-n=value`.
- Booleans: `--strong`, `--strong=true`, `--strong=false` and `--no-strong`. A
  boolean never takes the next argument as its value, so
  `greeting --strong
  hello` runs `hello`.
- Persistent flags can come before or after the subcommand.
- Unknown flags are an error, as are values of a `number` flag that aren't
  numbers. Negative numbers work as values (`--offset -5`).
- A flag given more than once keeps every value: `value()` returns the first,
  `values()` returns all of them.
- `required` flags are checked before the handler runs.
- Arguments after `--` are passed to the handler as they are.

Errors are printed to stderr and `execute()` returns 1 without running the
handler.

## Running your commands

Once you build your command tree and flags, simply call the root command's
`execute()` with an optional list of arguments. If not provided, it uses the
process arguments (`process.argv.slice(2)`, which is `Deno.args` in Deno):

```typescript
// Execute with auto-detected args
await root.execute();

// Or with explicit args
await root.execute(["hello", "--name", "world"]);

// exit with the command's exit code (Deno, Node.js or Bun)
root.exit(await root.execute());
```

The `execute()` method returns a `Promise<number>` representing the exit code (0
for success, non-zero for errors).

## Help is built-in

Help is implemented as a persistent flag on the root command. Simply pass `-h`
or `--help` to any command to display context-sensitive help. Container commands
list their subcommands and persistent flags. Leaf commands show usage, flags,
and inherited persistent flags.

This results in help that looks like this:

```bash
> deno run examples/main.ts
says hello or goodbye

Usage:
  greeting [command]

Available Commands:
  goodbye     says goodbye
  hello       says hello

Flags:
  -h, --help     help for greeting
  -s, --strong   say message strongly

Use "greeting [command] --help" for more information about a command.
```

```bash
> deno run examples/main.ts hello -h
says hello

Usage:
  greeting hello [flags]

Flags:
  -h, --help          help for hello
  -n, --name string   name to say hello to

Global Flags:
  -s, --strong   say message strongly
```

The layout follows Go's cobra:

- The first line is the command's `long` text, or `short` if it has no `long`.
- The Usage line is built from `use`: the parent commands, `use`, then
  `[flags]`. A command with subcommands also gets a `<path> [command]` line, and
  a footer saying how to get help on one. So `use` only needs the command's name
  and arguments, like `"get <bucket> <key>"`.
- "Flags" are the command's own, "Global Flags" the persistent ones it inherits.
  Flags that take a value show its type (`--name string`), and defaults that
  aren't the zero value are shown as `(default "x")`.
- Usage errors (an unknown flag, a missing value, a value that isn't a number, a
  required flag that wasn't given) print `Error: ...` followed by the usage, and
  `execute()` returns 1.

## TypeScript Support

cobra.js is written in TypeScript and provides full type safety:

- **Type-safe flag values**: The `FlagValue` type constrains flag values to
  `string | boolean | number`
- **Generic constraints**: Methods like `value<T>()` and `values<T>()` use
  `T extends FlagValue` to ensure type safety
- **Proper null handling**: All nullable fields are explicitly typed (e.g.,
  `Command | null`)
- **Strong interface contracts**: All public APIs have well-defined types

Example with full type safety:

```typescript
import { cli, type Command, type Flags } from "jsr:@aricart/cobra";

const root = cli({
  use: "myapp",
  run: async (cmd: Command, args: string[], flags: Flags): Promise<number> => {
    // TypeScript knows these are the correct types
    const name = flags.value<string>("name"); // string
    const verbose = flags.value<boolean>("verbose"); // boolean
    const port = flags.value<number>("port"); // number

    // Return exit code
    return 0;
  },
});
```

## Upgrading from 0.1

0.2 parses arguments with `node:util` `parseArgs` instead of minimist, and is
stricter:

- Unknown flags are an error instead of being ignored.
- A `number` flag with a value that isn't a number is an error instead of
  passing the string through.
- `required` flags are enforced by `execute()`; before, only `checkRequired()`
  did.
- `changed` is true whenever the user gave the flag, even with the default
  value.
- Arguments after `--` are passed to the handler; before, they were dropped.
- A flag needs a `name` or a `short` name, and `short` is a single character.
- Help is laid out like Go's cobra (see above). `use` should now be just the
  command's name and arguments: help adds the parent commands, `[flags]`, the
  `[command]` line and the flag lists. A `use` that spelled those out shows them
  twice.
- Flag defaults are printed in help (`(default 8080)`), so remove defaults
  written into `usage` text.
- The help flag reads `help for <command>`.
- Usage errors print `Error: ...` and the usage, with cobra's messages (e.g.
  `unknown flag: --nope`, `required flag(s) "config" not set`).
- `calcPad()` and `flagHelp()` are gone; `usage()` returns the usage text.
- `cli()` takes a `Cmd`, so `use` is required by the types too.
- `addCommand()` takes a `Cmd` (a `Command` still works), so editors suggest
  only `use`, `short`, `long` and `run` in its object.
- Internals are private: `cmd`, `checkFlags()`, `matchCmd()` and the root's
  `_help` no longer show up in completions or the API.
- `@aricart/runtime` is no longer a dependency: output and exit go through
  `node:process`, and `cmd.stdout()`, `cmd.stderr()` and `cmd.exit()` work
  before `execute()`.
