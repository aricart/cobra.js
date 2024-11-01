# cobra.js

A small cli framework for Deno/Node. This is heavily inspired on the excellent
[Cobra](https://github.com/spf13/cobra). The framework relies on
[minimist](https://github.com/minimistjs/minimist) library for the parsing of
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
import { cli } from "jsr:@aricart/cobra";

// create the root command
const root = cli({ use: "greeting (hello|goodbye) [--name name] [--strong]" });
root.addFlag({
  short: "s",
  name: "strong",
  type: "boolean",
  usage: "say message strongly",
  persistent: true,
});
// add a subcommand
const hello = root.addCommand({
  use: "hello --name string [--strong]",
  short: "says hello",
  // this is the handler for the command, you get
  // the command being executed, any args following a `--`
  // and an object to let you access relevant flags.
  run: (cmd, args, flags): Promise<number> => {
    const strong = (flags.value<boolean>("strong") ?? false) ? "!!!" : "";
    let n = flags.value<string>("name");
    n = n === "" ? "mystery person" : n;
    cmd.stdout(`hello ${n}${strong}`);
    return Promise.resolve(0);
  },
});
```

To execute the cli, simply `root.execute()` with arguments:

```typescript
Deno.exit(await root.execute());
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

Processing flags is similarly trivial:

```typescript
const n = flags.value<string>("name");
```

The value returned will be the one entered by the user, or the specified default
in the configuration for the default value for the type - `""` or `false` or
`0`.

Flags marked as `persistent` can be associated with a container command and are
available to all subcommands, reducing code duplication.

## Running your commands

Once you build your command tree and related, flags, you simply call the root
command's `execute()` with an optinoal list of arguments. If not provided it
will try to get them from `Deno.args` or `process.argv.slice(2)`

```typescript
Deno.exit(await root.execute());
```

## Help is built-in

Help is implemented as a persistent flag on the root command, simply passing
`-h` or `--help` to any command, will display help. The help you get will be
context-sensitive. Container commands will list possible subcommands, and their
persistent flags. A leaf command will show usage, flags and persistent flags.

This results in help that looks like this:

```bash
> deno run main.ts
# or 
> node main.ts
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
