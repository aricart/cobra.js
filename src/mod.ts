import process from "node:process";
import { parseArgs } from "node:util";

/**
 * Valid flag value types
 */
export type FlagValue = string | boolean | number;

/**
 * Fields shared by every flag. A flag needs a `name`, a `short` name, or both.
 */
export interface FlagInputBase {
  /**
   * Long name: the user types `--port`. Read it in `run` with
   * `flags.value("port")`.
   */
  name?: string;
  /**
   * One letter: the user types `-p`. Optional alias for `name`.
   */
  short?: string;
  /**
   * What the flag does, in a few words. Shown next to the flag in `--help`.
   */
  usage?: string;
  /**
   * The command refuses to run without this flag and prints
   * `--port is required`.
   */
  required?: boolean;
  /**
   * Also accept the flag on every subcommand, e.g. a global `--server`.
   */
  persistent?: boolean;
}

/**
 * A flag that takes a string value, e.g. `--output file.txt`.
 */
export interface StringFlagInput extends FlagInputBase {
  /**
   * Takes text: `--output out.json`. Read with `flags.value<string>()`.
   */
  type: "string";
  /**
   * Value when the flag is not provided. Defaults to `""`.
   */
  default?: string | string[] | null;
}

/**
 * A flag that is on or off, e.g. `--verbose`. `--no-verbose` turns it off.
 */
export interface BooleanFlagInput extends FlagInputBase {
  /**
   * A switch: `--verbose` turns it on, `--no-verbose` off. Read with
   * `flags.value<boolean>()`.
   */
  type: "boolean";
  /**
   * Value when the flag is not provided. Defaults to `false`.
   */
  default?: boolean | null;
}

/**
 * A flag that takes a number, e.g. `--port 8080`. Values that aren't numbers
 * are an error.
 */
export interface NumberFlagInput extends FlagInputBase {
  /**
   * Takes a number: `--port 8080`. Anything else is an error. Read with
   * `flags.value<number>()`.
   */
  type: "number";
  /**
   * Value when the flag is not provided. Defaults to `0`.
   */
  default?: number | number[] | null;
}

/**
 * Input for adding a flag to a command. `type` selects the kind of flag and
 * the type of its `default`.
 *
 * @example
 * ```typescript
 * // flag with long name only
 * cmd.addFlag({ type: "string", name: "output", usage: "output file" });
 *
 * // flag with short name only
 * cmd.addFlag({ type: "boolean", short: "v", usage: "verbose" });
 *
 * // flag with both
 * cmd.addFlag({ type: "number", name: "port", short: "p", default: 8080 });
 * ```
 */
export type FlagInput = StringFlagInput | BooleanFlagInput | NumberFlagInput;

/**
 * A flag as registered on a command, as returned by `addFlag()` and
 * `flags.getFlag()`. Same fields as the input, with the defaults filled in.
 */
export type Flag = {
  /**
   * What the flag takes: text, a switch, or a number.
   */
  type: "string" | "boolean" | "number";
  /**
   * Long name (`--name`), or `""` for a flag with only a short name.
   */
  name: string;
  /**
   * Help text shown next to the flag.
   */
  usage: string;
  /**
   * One letter (`-n`), or `""` if the flag has none.
   */
  short: string;
  /**
   * Whether the command refuses to run without it.
   */
  required: boolean;
  /**
   * Whether subcommands accept it too.
   */
  persistent: boolean;
  /**
   * Value used when the user doesn't give the flag.
   */
  default: null | FlagValue | FlagValue[];
};

type FlagState = {
  /**
   * Set to true if the value of the flag was modified
   */
  changed: boolean;
  /**
   * The root's --help flag, shown on every command as "help for <name>"
   */
  isHelp?: boolean;
  value: null | FlagValue | FlagValue[];
} & Flag;

/**
 * Interface for accessing and validating command-line flags within a command handler.
 */
export type Flags = {
  /**
   * Returns the value of the specified flag. If the flag was provided multiple times,
   * returns the first value. Returns the default value if the flag was not provided.
   *
   * @param n - The name or short name of the flag
   * @returns The flag value cast to type T
   * @throws Error if the flag name doesn't exist
   *
   * @example
   * ```typescript
   * const port = flags.value<number>("port"); // returns number
   * const name = flags.value<string>("name"); // returns string
   * ```
   */
  value<T extends FlagValue = FlagValue>(n: string): T;

  /**
   * Returns all values for the specified flag as an array. Useful when a flag
   * can be provided multiple times (e.g., `-v file1 -v file2`).
   *
   * @param n - The name or short name of the flag
   * @returns Array of all flag values
   * @throws Error if the flag name doesn't exist
   *
   * @example
   * ```typescript
   * const files = flags.values<string>("file"); // returns string[]
   * ```
   */
  values<T extends FlagValue = FlagValue>(n: string): T[];

  /**
   * Returns the configuration metadata for the specified flag, or null if not found.
   *
   * @param n - The name or short name of the flag
   * @returns The flag configuration or null
   */
  getFlag(n: string): Flag | null;

  /**
   * Validates that all required flags have been provided by the user.
   * Throws an error if any required flag is missing.
   *
   * @throws Error with message "--flagname is required"
   */
  checkRequired(): void;
};

/**
 * A command's handler.
 *
 * - `cmd`: the command being run; use `cmd.stdout()` and `cmd.stderr()` for
 *   output.
 * - `args`: the positional arguments, without the command names and flags.
 * - `flags`: read flag values with `flags.value()`.
 *
 * Resolves to the exit code: 0 for success.
 */
export type Run = (
  cmd: Command,
  args: string[],
  flags: Flags,
) => Promise<number>;

/**
 * A command: what the user types, what help says about it, and what it does.
 *
 * @example
 * ```typescript
 * root.addCommand({
 *   use: "serve [dir]",
 *   short: "serve files over http",
 *   long: "Serves the files in dir (default: the current directory).",
 *   run: (cmd, args, flags) => {
 *     const dir = args[0] ?? ".";
 *     cmd.stdout(`serving ${dir} on ${flags.value<number>("port")}\n`);
 *     return Promise.resolve(0);
 *   },
 * });
 * ```
 *
 * `serve -h` then prints:
 *
 * ```
 * Serves the files in dir (default: the current directory).
 *
 * Usage:
 *   serve [dir]
 *
 * Flags:
 *   -h, --help   ...
 *   -p, --port   ...
 * ```
 */
export type Cmd = {
  /**
   * The command's name, then its arguments, like Go cobra's `Use`:
   * `"serve [dir]"`. The first word is what the user types. Help builds the
   * Usage line from it: the parent commands, then this, then `[flags]`
   * (`app serve [dir] [flags]`); a command with subcommands also shows
   * `app serve [command]`. Flags and subcommands are listed by help, so leave
   * them out.
   */
  use: string;
  /**
   * One line saying what the command does. Shown next to its name in the
   * parent's command list.
   */
  short?: string;
  /**
   * A fuller description, shown at the top of this command's `--help`. Falls
   * back to `short`.
   */
  long?: string;
  /**
   * What the command does. Gets the command, the positional arguments and the
   * flags, and resolves to the exit code. Without it, the command prints its
   * help, which suits a command that only groups subcommands.
   */
  run?: Run;
};

/**
 * Type guard to check if an object is a Command instance or just a Cmd configuration.
 *
 * @param t - Object to check
 * @returns true if t is a Command instance
 */
export function isCommand(t: Command | Cmd): t is Command {
  return t instanceof Command;
}

function flag(f: Partial<FlagState>): FlagState {
  const d = {} as FlagState;
  d.usage = "";
  d.type = "number";
  d.required = false;
  d.persistent = false;
  d.changed = false;
  d.default = null;
  d.value = null;

  return Object.assign(d, f);
}

export class FlagsImpl implements Flags {
  m: Map<string, FlagState>;

  constructor(flags: FlagState[]) {
    this.m = new Map<string, FlagState>();
    flags.forEach((f) => {
      if (f.name) {
        this.m.set(f.name, f);
      }
      if (f.short) {
        this.m.set(f.short, f);
      }
    });
  }

  getFlag(n: string): Flag | null {
    const f = this.m.get(n);
    if (f === undefined) {
      return null;
    }
    return f;
  }

  defaultValue<T extends FlagValue = FlagValue>(f: Flag): T {
    let t: FlagValue;
    if (f.type === "string") {
      t = "";
    } else if (f.type === "boolean") {
      t = false;
    } else if (f.type === "number") {
      t = 0;
    } else {
      t = "";
    }
    return t as T;
  }

  value<T extends FlagValue = FlagValue>(n: string): T {
    const f = this.m.get(n);
    if (!f) {
      throw new Error(`unknown flag '${n}'`);
    }
    let v = f.value ?? f.default ?? this.defaultValue(f);
    if (Array.isArray(v)) {
      v = v[0];
    }
    return v as T;
  }

  values<T extends FlagValue = FlagValue>(n: string): T[] {
    const f = this.m.get(n);
    if (!f) {
      throw new Error(`unknown flag '${n}'`);
    }
    let v = f.value ?? [];
    if (!Array.isArray(v)) {
      v = [v];
    }
    return v as T[];
  }

  checkRequired() {
    const missing = [...new Set(this.m.values())]
      .filter((f) => f.required && !f.changed)
      .map((f) => `"${f.name || f.short}"`);
    if (missing.length) {
      throw new Error(`required flag(s) ${missing.join(", ")} not set`);
    }
  }
}

/**
 * Command represents a single command in the CLI hierarchy. Commands can have
 * subcommands, flags, and a run handler. Use the `cli()` function to create
 * a root command.
 *
 * @example
 * ```typescript
 * const root = cli({ use: "myapp" });
 * const serve = root.addCommand({
 *   use: "serve",
 *   short: "Start server",
 *   run: async (cmd, args, flags) => {
 *     console.log("Server starting...");
 *     return 0;
 *   }
 * });
 * ```
 */
export class Command implements Cmd {
  private cmd: Cmd;
  commands: Command[];
  parent: Command | null;
  flags: FlagState[];
  showHelp: false;

  /**
   * Creates a new Command instance.
   *
   * @param cmd - Command configuration
   * @throws Error if `use` field is not provided
   */
  constructor(cmd = {} as Cmd) {
    if (!cmd.use) throw new Error("use is required");
    this.showHelp = false;
    // a copy: without a run handler the command prints its help
    this.cmd = { ...cmd };
    this.commands = [];
    this.parent = null;
    this.flags = [];
  }

  /**
   * The usage string for this command. The first word is the command name.
   */
  get use(): string {
    return this.cmd.use;
  }

  /**
   * The detailed multi-line description for this command. Shown when run with --help.
   */
  get long(): string | undefined {
    return this.cmd.long;
  }

  /**
   * The short one-line description for this command. Shown in parent's help output.
   */
  get short(): string | undefined {
    return this.cmd.short;
  }

  /**
   * Writes to standard output. Override to capture a command's output.
   */
  stdout(s: string): void {
    process.stdout.write(s);
  }

  /**
   * Writes to standard error. Override to capture a command's errors and help.
   */
  stderr(s: string): void {
    process.stderr.write(s);
  }

  /**
   * Exits the process.
   */
  exit(code: number): void {
    process.exit(code);
  }

  /**
   * Prints this command's help to stderr, laid out like Go's cobra: the `long`
   * (or `short`) description, then the usage.
   *
   * @param _long - unused, kept for compatibility
   */
  help(_long = false): void {
    const about = (this.long ?? this.short ?? "").trimEnd();
    this.stderr(`${about ? `${about}\n\n` : ""}${this.usage()}`);
  }

  /**
   * The command's path from the root, e.g. `greeting hello`.
   */
  commandPath(): string {
    return this.parent
      ? `${this.parent.commandPath()} ${this.name}`
      : this.name;
  }

  /**
   * The usage text, laid out like Go's cobra: the usage lines, subcommands,
   * the command's own flags, the flags it inherits (Global Flags), and a hint
   * to get help on a subcommand.
   *
   * @example
   * ```
   * Usage:
   *   greeting hello [flags]
   *
   * Flags:
   *   -h, --help          help for hello
   *   -n, --name string   name to say hello to
   *
   * Global Flags:
   *   -s, --strong   say message strongly
   * ```
   */
  usage(): string {
    const lines = ["Usage:"];
    if (this.cmd.run) {
      const path = this.parent
        ? `${this.parent.commandPath()} ${this.use}`
        : this.use;
      lines.push(`  ${path.includes("[flags]") ? path : `${path} [flags]`}`);
    }
    if (this.commands.length) {
      lines.push(`  ${this.commandPath()} [command]`);
      const commands = [...this.commands].sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      const pad = Math.max(11, ...commands.map((c) => c.name.length));
      lines.push("", "Available Commands:");
      for (const c of commands) {
        lines.push(`  ${c.name.padEnd(pad)} ${c.short ?? ""}`.trimEnd());
      }
    }
    const all = this.getFlags();
    const local = all.filter((f) => this.flags.includes(f) || f.isHelp);
    const inherited = all.filter((f) => !local.includes(f));
    if (local.length) {
      lines.push("", "Flags:", ...flagUsages(local, this.name));
    }
    if (inherited.length) {
      lines.push("", "Global Flags:", ...flagUsages(inherited, this.name));
    }
    if (this.commands.length) {
      lines.push(
        "",
        `Use "${this.commandPath()} [command] --help" for more information about a command.`,
      );
    }
    return lines.join("\n") + "\n";
  }

  private checkFlags(flag: Flag): boolean {
    if (this.flags.length) {
      const f = this.flags.filter((v) => {
        const sn = flag.name !== "" && v.name !== "" && flag.name === v.name;
        const sh = flag.short !== "" && v.short !== "" &&
          flag.short === v.short;
        return sn || sh;
      });
      if (f.length > 0) {
        throw new Error(
          `--${flag.name} has conflict with: --${f[0].name} ${
            f[0].short ? "-" + f[0].short : ""
          }`,
        );
      }
    }
    if (this.parent) {
      return this.parent.checkFlags(flag);
    }
    return false;
  }

  /**
   * Adds a flag to this command. The flag will be available when the command is executed.
   *
   * @param f - Flag configuration requiring at least `type` and one of `name` or `short`
   * @returns The created Flag object
   * @throws Error if a flag with the same name or short already exists in this command or parent
   *
   * @example
   * ```typescript
   * cmd.addFlag({
   *   type: "number",
   *   name: "port",
   *   short: "p",
   *   usage: "Port number",
   *   default: 8080
   * });
   * ```
   */
  addFlag(f: FlagInput): Flag {
    const pf = flag(f);
    pf.name = pf.name ?? "";
    pf.short = pf.short ?? "";
    if (!pf.name && !pf.short) {
      throw new Error("a flag needs a name or a short name");
    }
    if (pf.short.length > 1) {
      throw new Error(`short flag '${pf.short}' must be a single character`);
    }
    this.checkFlags(pf);
    this.flags.push(pf);
    return pf;
  }

  /**
   * Returns all flags available to this command, including inherited persistent flags from parent commands.
   *
   * @returns Array of all flags (own flags + persistent flags from parents)
   */
  getFlags(): FlagState[] {
    const flags: FlagState[] = [...this.flags];
    let cmd = this.parent;
    while (cmd) {
      if (cmd.flags.length) {
        const pf = cmd.flags.filter((f) => {
          return f.persistent;
        });
        pf.forEach((f) => {
          if (flags.indexOf(f) === -1) {
            flags.push(f);
          }
        });
      }
      cmd = cmd.parent;
    }
    return flags;
  }

  getFlag(name: string): Flag | null {
    if (this.flags.length) {
      const m = this.flags.filter((f) => {
        return f.name === name;
      });
      if (m.length > 0) {
        return m[0];
      }
    }
    if (!this.parent) {
      return null;
    }
    return this.parent.getFlag(name);
  }

  async run(cmd: Command, args: string[], flags: Flags): Promise<number> {
    try {
      if (!this.cmd.run) {
        cmd.help();
        return 1;
      }
      const exit = await this.cmd.run(cmd, args, flags);
      if (exit > 0 && this.showHelp) {
        cmd.help();
      }
      return exit;
    } catch (err) {
      cmd.stderr(`${(err as Error).message}\n`);
      if (cmd.showHelp) {
        cmd.help();
      }
      return 1;
    }
  }

  /**
   * Adds a subcommand to this command. The subcommand will be available when executing the parent.
   *
   * @param cmd - Command configuration or Command instance
   * @returns The created Command instance
   * @throws Error if a sibling command with the same name already exists
   *
   * @example
   * ```typescript
   * const serve = root.addCommand({
   *   use: "serve [port]",
   *   short: "Start the server",
   *   run: async (cmd, args, flags) => {
   *     console.log("Server starting...");
   *     return 0;
   *   }
   * });
   * ```
   */
  // takes Cmd only (a Command is a Cmd too), so editors suggest the Cmd
  // fields here, not the members of Command
  addCommand(cmd: Cmd): Command {
    if (isCommand(cmd)) {
      cmd = cmd.cmd;
    }
    const ci = new Command(cmd);
    ci.parent = this;
    // make sure no sibling is named this
    const m = this.commands.filter((v) => {
      return ci.name === v.name;
    });
    if (m.length > 0) {
      throw new Error(`a command ${ci.name} already exists`);
    }
    this.commands.push(ci);
    return ci;
  }

  /**
   * The name of this command, extracted as the first word from the `use` field.
   *
   * @example
   * If `use` is "serve [port]", then `name` returns "serve"
   */
  get name(): string {
    let name = this.cmd.use;
    const idx = name.indexOf(" ");
    if (idx > 0) {
      name = name.slice(0, idx);
    }
    return name;
  }

  /**
   * Returns the root command by traversing up the parent chain.
   *
   * @returns The root command (the command with no parent)
   */
  root(): Command {
    if (this.parent) {
      return this.parent.root();
    }
    return this;
  }
}

/**
 * Interface for executing a command with arguments.
 */
export type Execute = {
  /**
   * Executes the command with the provided arguments.
   *
   * @param args - Command-line arguments to parse and execute
   * @returns Exit code (0 for success, non-zero for error)
   */
  execute(args: string[]): Promise<number>;
};

/**
 * The root command of a CLI application. Extends Command with execution capabilities.
 * Created via the `cli()` function. Automatically adds a `--help` flag.
 *
 * @example
 * ```typescript
 * const root = cli({ use: "myapp" });
 * root.exit(await root.execute());
 * ```
 */
export class RootCommand extends Command implements Execute {
  lastCmd: {
    cmd: Command;
    args: string[];
    flags: Flags;
    helped?: boolean;
  } | null;
  private _help: FlagState;
  constructor(cmd: Cmd) {
    super(cmd);

    this.lastCmd = null;
    this._help = this.addFlag({
      name: "help",
      usage: `help for ${this.name}`,
      short: "h",
      persistent: true,
      type: "boolean",
    }) as FlagState;
    this._help.isHelp = true;
  }
  /**
   * Finds the command named by the leading positional arguments.
   *
   * @param args - Command-line arguments
   * @returns The matched command and the remaining positional arguments
   */
  private matchCmd(args: string[]): [Command, string[]] {
    const { cmd, positionals } = this.split(args);
    return [cmd, positionals];
  }

  // walks args once: leading positionals that name subcommands select the
  // command, flags are rewritten as --key or --key=value using the flags known
  // at that point (so a boolean never takes the next arg as its value), and
  // everything else is a positional. args after `--` are positionals.
  private split(args: string[]): {
    cmd: Command;
    flagArgs: string[];
    positionals: string[];
  } {
    let cmd = this as Command;
    let matching = true;
    const flagArgs: string[] = [];
    const positionals: string[] = [];

    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === "--") {
        positionals.push(...args.slice(i + 1));
        break;
      }
      if (a.length > 1 && a.startsWith("-") && !isNumeric(a)) {
        const long = a.startsWith("--");
        const body = a.slice(long ? 2 : 1);
        const eq = body.indexOf("=");
        const key = eq === -1 ? body : body.slice(0, eq);
        // grouped (-abc) or inline (-p8080) short flags go to parseArgs as is
        const f = !long && key.length > 1
          ? undefined
          : findFlag(cmd.getFlags(), key, !long);
        if (!f) {
          // unknown flags and --no-x are reported or handled by parseArgs
          flagArgs.push(a);
          continue;
        }
        const k = optionKey(f);
        if (f.type === "boolean") {
          const v = eq === -1 ? "true" : body.slice(eq + 1);
          flagArgs.push(
            v === "true"
              ? `--${k}`
              : v === "false"
              ? `--no-${k}`
              : `--${k}=${v}`,
          );
          continue;
        }
        if (eq !== -1) {
          flagArgs.push(`--${k}=${body.slice(eq + 1)}`);
        } else if (i + 1 < args.length) {
          flagArgs.push(`--${k}=${args[++i]}`);
        } else {
          // missing value, parseArgs reports it
          flagArgs.push(`--${k}`);
        }
        continue;
      }
      if (matching) {
        const match = cmd.commands.filter((c) => c.name === a);
        if (match.length > 1) {
          throw new Error(`ambiguous command ${a}`);
        }
        if (match.length === 1) {
          cmd = match[0];
          continue;
        }
        matching = false;
      }
      positionals.push(a);
    }
    return { cmd, flagArgs, positionals };
  }

  /**
   * Executes the CLI application. Parses arguments, matches commands, processes flags,
   * and invokes the appropriate command handler. Unknown flags, flag values of the
   * wrong type and missing required flags print an error and return 1.
   *
   * @param args - Arguments to parse. If null, uses the process arguments
   * @returns Exit code (0 for success, non-zero for error)
   *
   * @example
   * ```typescript
   * // process arguments
   * await root.execute();
   *
   * // explicit args
   * await root.execute(["serve", "--port", "3000"]);
   * ```
   */
  async execute(args: string[] | null = null): Promise<number> {
    if (args === null) {
      args = process.argv.slice(2);
    }
    const { cmd, flagArgs, positionals } = this.split(args);
    const flags = cmd.getFlags();
    const fm = new FlagsImpl(flags);
    this.lastCmd = { cmd, args: positionals, flags: fm };

    // deno-lint-ignore no-explicit-any
    const options: Record<string, any> = {};
    for (const f of flags) {
      f.value = null;
      f.changed = false;
      const short = f.short || (f.name.length === 1 ? f.name : "");
      options[optionKey(f)] = {
        type: f.type === "boolean" ? "boolean" : "string",
        multiple: true,
        ...(short ? { short } : {}),
      };
    }

    let values: Record<string, unknown>;
    try {
      ({ values } = parseArgs({
        args: flagArgs,
        options,
        strict: true,
        allowPositionals: false,
        allowNegative: true,
      }));
    } catch (err) {
      return usageError(cmd, parseError(err));
    }

    for (const f of flags) {
      const raw = values[optionKey(f)] as (string | boolean)[] | undefined;
      if (raw === undefined) continue;
      let vals: FlagValue[] = raw;
      if (f.type === "number") {
        vals = [];
        for (const v of raw as string[]) {
          const n = Number(v);
          if (v.trim() === "" || Number.isNaN(n)) {
            const spelled = f.short && f.name
              ? `-${f.short}, --${f.name}`
              : flagLabel(f);
            return usageError(
              cmd,
              `invalid argument "${v}" for "${spelled}" flag: not a number`,
            );
          }
          vals.push(n);
        }
      }
      f.value = vals.length === 1 ? vals[0] : vals;
      f.changed = true;
    }

    if (this._help.value) {
      cmd.help(true);
      this.lastCmd.helped = true;
      return 1;
    }
    try {
      fm.checkRequired();
    } catch (err) {
      return usageError(cmd, firstLine(err));
    }
    return await cmd.run(cmd, positionals, fm);
  }
}

// the key a flag has in parseArgs options: its name, or its short name
function optionKey(f: Flag): string {
  return f.name || f.short;
}

// how a flag is written in messages
function flagLabel(f: Flag): string {
  return f.name ? `--${f.name}` : `-${f.short}`;
}

// a flag by its long or short spelling; a one character name also works as -n
function findFlag(
  flags: FlagState[],
  key: string,
  short: boolean,
): FlagState | undefined {
  return flags.find((f) =>
    short
      ? f.short === key || (!f.short && f.name === key)
      : f.name === key || (!f.name && f.short === key)
  );
}

function isNumeric(s: string): boolean {
  return s.trim() !== "" && !Number.isNaN(Number(s));
}

function firstLine(err: unknown): string {
  return `${(err as Error).message ?? err}`.split("\n")[0];
}

// like cobra: the error, then the command's usage
function usageError(cmd: Command, msg: string): number {
  cmd.stderr(`Error: ${msg}\n${cmd.usage()}\n`);
  return 1;
}

// parseArgs errors in cobra's (pflag's) words
function parseError(err: unknown): string {
  const e = err as Error & { code?: string };
  const opt = /'([^']+)'/.exec(e.message ?? "")?.[1]?.split(" ")[0] ?? "";
  if (e.code === "ERR_PARSE_ARGS_UNKNOWN_OPTION") {
    return opt.startsWith("--")
      ? `unknown flag: ${opt}`
      : `unknown shorthand flag: '${opt.slice(1, 2)}' in ${opt}`;
  }
  if (e.code === "ERR_PARSE_ARGS_INVALID_OPTION_VALUE" && opt) {
    return `flag needs an argument: ${opt}`;
  }
  return firstLine(err);
}

// flag lines like pflag: `  -n, --name string   usage (default "x")`
function flagUsages(flags: FlagState[], cmdName: string): string[] {
  const rows = [...flags]
    .sort((a, b) => (a.name || a.short).localeCompare(b.name || b.short))
    .map((f) => {
      let left = f.short
        ? f.name ? `  -${f.short}, --${f.name}` : `  -${f.short}`
        : `      --${f.name}`;
      if (f.type !== "boolean") left += ` ${f.type}`;
      let usage = f.isHelp ? `help for ${cmdName}` : f.usage;
      const d = defaultText(f);
      if (d) usage = `${usage} (default ${d})`.trimStart();
      return [left, usage];
    });
  const width = Math.max(...rows.map(([left]) => left.length));
  return rows.map(([left, usage]) =>
    `${left.padEnd(width)}   ${usage}`.trimEnd()
  );
}

// the default as pflag shows it, or "" when it's the zero value
function defaultText(f: Flag): string {
  const d = f.default;
  if (d === null || d === undefined || d === "" || d === false || d === 0) {
    return "";
  }
  const one = (v: FlagValue) => f.type === "string" ? `"${v}"` : `${v}`;
  return Array.isArray(d) ? `[${d.map(one).join(",")}]` : one(d);
}

/**
 * Creates a new root command for a CLI application. This is the main entry point
 * for building a CLI with cobra.js. The root command automatically gets a `--help` flag.
 *
 * @param opts - Command configuration. The `use` field is required.
 * @returns A RootCommand instance ready to add subcommands and flags
 * @throws Error if `use` field is not provided
 *
 * @example
 * ```typescript
 * // Simple CLI
 * const root = cli({ use: "myapp" });
 *
 * // CLI with handler
 * const root = cli({
 *   use: "myapp [options]",
 *   short: "My application",
 *   run: async (cmd, args, flags) => {
 *     console.log("Running myapp");
 *     return 0;
 *   }
 * });
 *
 * // Add subcommands and execute
 * root.addCommand({ use: "serve", short: "Start server" });
 * root.exit(await root.execute());
 * ```
 */
export function cli(opts: Cmd): RootCommand {
  if (!opts?.use) {
    throw new Error("use is required");
  }
  if (opts.run) {
    const orig = opts.run;
    opts = { ...opts };
    opts.run = (cmd, args, flags): Promise<number> => {
      const h = flags.getFlag("help") as FlagState;
      if (h && h.value) {
        cmd.help();
        return Promise.resolve(1);
      }
      return orig(cmd, args, flags);
    };
  }
  return new RootCommand(opts);
}
