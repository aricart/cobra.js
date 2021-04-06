# cobra.js

A small cli framework for Deno. This is heavily inspired on the excellent
[Cobra](https://github.com/spf13/cobra). The framework relies on the Deno's
built-in [`flags`](https://deno.land/std/flags) library for the parsing of
arguments.

The foundation to a good cli is good help. Most of the complexity in Cobra.js is
to auto-generate usage information. Cobra.js self-generates help from a
command's configuration.

All clis in cobra.js will use commands and flags.

## Commands

The basic configuration for a command, specifies the following:

```typescript
export interface Cmd {
  use: string; // name and usage
  short?: string; // short description shown in help
  long?: string; // long help (cmd action --help)
  run: Run;
}
```

```typescript
// import the library
import { cli } from "https://deno.land/x/cobra/mod.ts";

// create a root command
const root = cli({ use: "greeting" });
// add a subcommand
const hello = root.addCommand({
  use: "hello --name string [--strong]",
  short: "says hello",
  // this is the handler for the command, you get
  // the command being executed, any args following a `--`
  // and a map of flag names to flags.
  run: (cmd, args, flags): Promise<number> => {
    const strong = (flags.get("strong")?.value ?? false) ? "!!!" : "";
    const n = flags.get("name")?.value ?? "mystery person";
    console.log(`hello ${n}${strong}`);
    return Promise.resolve(0);
  },
});
```

The return of the command is a `Promise<number>` which is a number you can use
to provide to the `Deno.exit(n)` function.

## Flags

The second component is flags. While parsing arguments can easily be one with
utils such as [`parse`](from https://deno.land/std/flags) when creating cli
tools, you'll also want to provide long/short flag names, the type of the data
that you expect, and usage:

```typescript
export interface Flag {
  type: "string" | "boolean" | "number";
  name: string;
  usage: string;
  short: string;
  required: boolean;
  persistent: boolean;
  changed: boolean;
  default: null | unknown | unknown[];
  value: null | unknown | unknown[];
}
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
```

## Running your commands

Once you build your command tree and related, flags, you simply call the root
command's `execute()` with a list of arguments:

```typescript
Deno.exit(await root.execute(Deno.args));
```

## Help is built-in

Help is implemented as a persistent flag on the root command, simply passing
`-h` or `--help` to any command, will display help. The help you get will be
context sensitive. Container commands will list possible subcommands, and their
persistent flags. A leaf command will show usage, flags and persistent flags.

This results in help that looks like this:

```bash
> deno run main.ts
greeting

Usage:
  greeting [commands]

Available Commands:
  goodbye   says goodbye
  hello     says hello

Flags:
  -h, --help   display greeting's help
```

```bash
> deno run main.ts hello -h
hello --name string [--strong]

Usage:
  hello --name string [--strong]

Flags:
  -h, --help     display greeting's help
  -n, --name     name to say hello to
  -s, --strong   say hello strongly
```
