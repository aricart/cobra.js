# cobra.js

A lightweight, type-safe CLI framework for Deno and Node.js. Heavily inspired by
the excellent [Cobra](https://github.com/spf13/cobra) library from Go. The
framework uses [minimist](https://github.com/minimistjs/minimist) for argument
parsing.

The foundation of a good CLI is good help. Most of the complexity in cobra.js is
dedicated to auto-generating usage information. Cobra.js automatically generates
help from your command configurations.

All CLIs in cobra.js use commands and flags with full TypeScript type safety.

## Installation

**Deno** (via JSR):

```typescript
import { cli } from "jsr:@aricart/cobra";
```

**Node.js** (via JSR):

```bash
npx jsr add @aricart/cobra
```

```typescript
import { cli } from "@aricart/cobra";
```

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
Deno.exit(await root.execute());
```

The return of the command is a `Promise<number>` which is a number you can use
to provide to the `Deno.exit(n)` function.

## Flags

The second component is flags. While parsing arguments can easily be done with
utils such as [`parse`](https://deno.land/std/flags), when creating CLI tools,
you'll also want to provide long/short flag names, the type of data you expect,
and usage information:

```typescript
export type FlagValue = string | boolean | number;

export type Flag = {
  type: "string" | "boolean" | "number";
  name: string;
  usage: string;
  short: string;
  required: boolean;
  persistent: boolean;
  default: null | FlagValue | FlagValue[];
};
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
  use: "goodbye --name string [--strong]",
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

## Running your commands

Once you build your command tree and flags, simply call the root command's
`execute()` with an optional list of arguments. If not provided, it will
automatically get them from `Deno.args` or `process.argv.slice(2)`:

```typescript
// Execute with auto-detected args
await root.execute();

// Or with explicit args
await root.execute(["hello", "--name", "world"]);

// Use with Deno or Node
Deno.exit(await root.execute());
// or
process.exit(await root.execute());
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
