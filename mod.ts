import parseArgs from "minimist";
import { sprintf } from "@std/fmt/printf";
import { getRuntime } from "@aricart/runtime";

/**
 * The `Flag` type represents a command-line argument or option that can be used in various
 * applications. This type includes properties that define the behavior, identity,
 * and requirements of the flag.
 */
/**
 * Valid flag value types
 */
export type FlagValue = string | boolean | number;

/**
 * Input type for adding a flag to a command. Requires `type` and at least one of `name` or `short`.
 *
 * @example
 * ```typescript
 * // Flag with long name only
 * cmd.addFlag({ type: "string", name: "output", usage: "output file" });
 *
 * // Flag with short name only
 * cmd.addFlag({ type: "boolean", short: "v", usage: "verbose" });
 *
 * // Flag with both
 * cmd.addFlag({ type: "number", name: "port", short: "p", usage: "port number" });
 * ```
 */
export type FlagInput =
  & {
    /**
     * The data type of the flag value.
     */
    type: "string" | "boolean" | "number";
    /**
     * Description shown in help text. Defaults to empty string.
     */
    usage?: string;
    /**
     * If true, the flag must be provided or an error is thrown. Defaults to false.
     */
    required?: boolean;
    /**
     * If true, the flag is inherited by all subcommands. Defaults to false.
     */
    persistent?: boolean;
    /**
     * Default value when the flag is not provided. Defaults to null.
     */
    default?: null | FlagValue | FlagValue[];
  }
  & (
    | { name: string; short?: string }
    | { name?: string; short: string }
  );

export type Flag = {
  /**
   * Represents a variable that can hold values of type string, boolean, or number.
   *
   * The `type` can be one of the following:
   * - "string": for textual data.
   * - "boolean": for true/false values.
   * - "number": for numeric values.
   *
   * This variable type can be useful for scenarios where the value can be one of the multiple data types.
   */
  type: "string" | "boolean" | "number";
  /**
   * The name of the flag - this is the name that is used to access the value associated with the flag.
   */
  name: string;
  /**
   * The usage of the flag - used in the auto-generated help.
   */
  usage: string;
  /**
   * A single character name for the flag.
   */
  short: string;
  /**
   * Sets whether a particular flag is mandatory. When set to true, the framework
   * will error usages of the command that don't specify the flag.
   */
  required: boolean;
  /**
   * When set, the flag will be available to any sub-commands.
   */
  persistent: boolean;
  /**
   * Default value for the flag
   */
  default: null | FlagValue | FlagValue[];
};

type FlagState = {
  /**
   * Set to true if the value of the flag was modified
   */
  changed: boolean;
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
 * The callback for a command.
 *
 * @callback Run
 * @param {Command} cmd - The command to be executed.
 * @param {string[]} args - The arguments to be passed to the command.
 * @param {Flags} flags - Access to the flags context.
 * @returns {Promise<number>} A promise that resolves with the exit code of the command.
 */
export type Run = (
  cmd: Command,
  args: string[],
  flags: Flags,
) => Promise<number>;

/**
 * Configuration object for creating a command. Commands can have subcommands
 * and flags, forming a hierarchical CLI structure.
 *
 * @example
 * ```typescript
 * const cmd: Cmd = {
 *   use: "serve [port]",
 *   short: "Start the web server",
 *   long: "Starts the web server on the specified port. Defaults to 8080.",
 *   run: async (cmd, args, flags) => {
 *     const port = flags.value<number>("port");
 *     console.log(`Starting server on port ${port}`);
 *     return 0;
 *   }
 * };
 * ```
 */
export type Cmd = {
  /**
   * Usage string for the command. The first word should be the command name,
   * followed by optional arguments or flags. Shown in help text.
   *
   * @example "serve [port]" or "deploy --env production"
   */
  use: string;
  /**
   * Short one-line description of the command. Shown in parent command's help.
   */
  short?: string;
  /**
   * Detailed multi-line description. Shown when command is run with --help.
   */
  long?: string;
  /**
   * Handler function executed when the command is run. If omitted, the command
   * will display help when executed.
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
  const v = t as Command;
  return v.cmd !== undefined;
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
    this.m.forEach((f) => {
      if (f.required && f.default === f.value) {
        throw new Error(`--${f.name} is required`);
      }
    });
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
  cmd: Cmd;
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
    if (!cmd.run) {
      cmd.run = (): Promise<number> => {
        this.help();
        return Promise.resolve(1);
      };
    }
    this.showHelp = false;
    this.cmd = cmd;
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

  stdout(_: string) {
    throw new Error("runtime is not set");
  }

  stderr(_: string) {
    throw new Error("runtime is not set");
  }

  exit(_: number): void {
    throw new Error("runtime is not set");
  }

  /**
   * Prints help information for this command to stderr. Shows usage, available subcommands,
   * and flags (both local and inherited persistent flags).
   *
   * @param long - If true, displays the long description. If false, shows short description.
   */
  help(long = false): void {
    // usage for the parent
    if (long) {
      this.stderr(`${this.long ?? this.short ?? this.use}\n`);
    } else {
      this.stderr(`${this.short ?? this.use}\n`);
    }
    this.stderr("\nUsage:\n");
    if (this.commands.length === 0) {
      this.stderr(`  ${this.use}\n`);
    } else {
      this.stderr(`  ${this.name} [commands]\n`);
      // summary of child commands
      this.commands.sort((a, b): number => {
        return a.use.localeCompare(b.use);
      });
      this.stderr("\nAvailable Commands:\n");
      const lens = this.commands.map((cmd): number => {
        return cmd.name.length;
      });
      const max = lens.reduce((a, v) => {
        return Math.max(a, v);
      });
      this.commands.forEach((cmd) => {
        const n = cmd.name.padEnd(max, " ");
        this.stderr(`  ${n}   ${cmd.short ?? ""}\n`);
      });
    }
    const flags = this.getFlags();
    if (flags.length) {
      this.stderr("\nFlags:\n");
      flags.sort((a, b): number => {
        return a.name.localeCompare(b.name);
      });
      const args = flags.map((f): [string, string] => {
        return [f.short, f.name];
      });
      const pad = calcPad(args);
      flags.forEach((f) => {
        this.stderr(`  ${flagHelp(f, pad)}\n`);
      });
    }
  }

  checkFlags(flag: Flag): boolean {
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
    const flags: FlagState[] = this.flags;
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
      const exit = await this.cmd.run!(cmd, args, flags);
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
  addCommand(cmd: Cmd | Command): Command {
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
 * Deno.exit(await root.execute());
 * ```
 */
export class RootCommand extends Command implements Execute {
  lastCmd: {
    cmd: Command;
    args: string[];
    flags: Flags;
    helped?: boolean;
  } | null;
  _help: FlagState;
  constructor(cmd: Cmd) {
    super(cmd);

    this.lastCmd = null;
    this._help = this.addFlag({
      name: "help",
      usage: `display ${this.name.split(" ")[0]}'s help`,
      short: "h",
      persistent: true,
      type: "boolean",
    }) as FlagState;
  }
  matchCmd(args: string[]): [Command, string[]] {
    const argv = parseArgs(args, { "--": true });
    let cmd = this as Command;
    const a = (argv._ ?? []).map((v: unknown) => {
      return `${v}`;
    });

    while (true) {
      const verb = a.shift();
      if (verb === undefined) {
        break;
      }
      let match: Command[] = [];
      if (cmd.commands) {
        match = cmd.commands.filter((c) => {
          return c.name === verb;
        });

        if (match.length > 1) {
          throw new Error(`ambiguous command ${verb}`);
        }

        if (match.length === 0) {
          // not found, put the arg back
          a.unshift(verb);
          break;
        }
        if (match.length === 1) {
          cmd = match[0];
        }
      } else {
        break;
      }
    }
    return [cmd, a];
  }

  /**
   * Executes the CLI application. Parses arguments, matches commands, processes flags,
   * and invokes the appropriate command handler.
   *
   * @param args - Arguments to parse. If null, automatically uses Deno.args or process.argv
   * @returns Exit code (0 for success, non-zero for error)
   *
   * @example
   * ```typescript
   * // Auto-detect runtime args
   * await root.execute();
   *
   * // Explicit args
   * await root.execute(["serve", "--port", "3000"]);
   * ```
   */
  async execute(args: string[] | null = null): Promise<number> {
    const runtime = await getRuntime();
    this.stdout = runtime.stdout;
    this.stderr = runtime.stderr;
    this.exit = runtime.exit;

    const stack: Command[] = [];
    if (this.commands) {
      stack.push(...this.commands);
    }
    while (stack.length) {
      const c = stack.pop()!;
      c.stdout = runtime.stdout;
      c.stderr = runtime.stderr;
      c.exit = runtime.exit;
      if (c.commands?.length) {
        stack.push(...c.commands);
      }
    }
    if (args === null) {
      args = runtime.args();
    }
    const [cmd, a] = this.matchCmd(args);
    const flags = cmd.getFlags();

    // deno-lint-ignore no-explicit-any
    const parseOpts = { "--": true } as any;
    flags.forEach((f) => {
      f.value = null;
      const key = f.short.length ? f.short : f.name;

      if (f.short && f.name) {
        parseOpts.alias = parseOpts.alias ?? {};
        parseOpts.alias[key] = [f.name];
      }
      if (f.default) {
        parseOpts.default = parseOpts.default ?? {};
        parseOpts.default[key] = f.default;
      }
      if (f.type === "boolean") {
        parseOpts.boolean = parseOpts.boolean ?? [];
        parseOpts.boolean.push(key);
      } else if (f.type === "string") {
        parseOpts.string = parseOpts.string ?? [];
        parseOpts.string.push(key);
      }
    });

    const argv = parseArgs(args, parseOpts);
    argv._ = a;

    flags.forEach((f) => {
      f.changed = false;
      const key = f.short.length ? f.short : f.name;
      if (key in argv) {
        f.value = argv[key];
        if (parseOpts.default && parseOpts.default[key]) {
          f.changed = argv[key] !== parseOpts.default[key];
        } else {
          f.changed = true;
        }
      }
    });

    const fm = new FlagsImpl(flags);
    this.lastCmd = { cmd: cmd, args: a, flags: fm };

    if (this._help.value) {
      cmd.help(true);
      this.lastCmd.helped = true;
      return Promise.resolve(1);
    }
    return cmd.run(cmd, a, fm);
  }
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
 * Deno.exit(await root.execute());
 * ```
 */
export function cli(opts: Partial<Cmd>): RootCommand {
  opts = opts ?? {};
  if (!opts.use) {
    throw new Error("use is required");
  }
  if (opts.run) {
    const orig = opts.run;
    opts.run = (cmd, args, flags): Promise<number> => {
      const h = flags.getFlag("help") as FlagState;
      if (h && h.value) {
        cmd.help();
        return Promise.resolve(1);
      }
      return orig(cmd, args, flags);
    };
  }
  const d = {
    run: (cmd: Command): Promise<number> => {
      cmd.help();
      return Promise.resolve(1);
    },
  } as Partial<Cmd>;

  opts = Object.assign(d, opts);
  return new RootCommand(opts as Cmd);
}

function max(s1?: string, s2?: string): string {
  s1 = s1 ?? "";
  s2 = s2 ?? "";
  return s1.length > s2.length ? s1 : s2;
}

/**
 * Calculates the padding needed for aligning flag help text. Used internally
 * by the help system to format flag output.
 *
 * @param flags - Array of [short, long] flag name pairs
 * @returns Object with short and long padding lengths
 */
export function calcPad(
  flags: [string?, string?][],
): { short: number; long: number } {
  const s = flags.reduce((a, b) => {
    const s1 = max(a[0], b[0]);
    const s2 = max(a[1], b[1]);
    return [s1, s2];
  });

  s[0] = s[0] ?? "";
  s[1] = s[1] ?? "";
  return { short: s[0].length, long: s[1].length };
}

/**
 * Formats a flag for display in help text with proper alignment. Used internally
 * by the help system.
 *
 * @param f - The flag to format
 * @param pad - Padding lengths for alignment
 * @returns Formatted help string for the flag
 *
 * @example
 * Returns strings like: "-p, --port   Port number"
 */
export function flagHelp(
  f: Partial<Flag>,
  pad: { short: number; long: number },
): string {
  let { short, long } = pad;
  if (short) {
    short += 3; // dash+short.len+comma+space
  }
  if (long) {
    long += 2; // dash+dash+name.len+space+space+space
  }
  let sf = f.short ?? "";
  let lf = f.name ?? "";

  if (sf) {
    sf = f.name ? `-${sf}, ` : `-${sf}  `;
  }
  sf = sf.padEnd(short, " ");

  if (lf) {
    lf = `--${f.name}`;
  }
  lf = lf.padEnd(long, " ");

  const t = `%${short}s%${long}s`;
  const prefix = sprintf(t, sf, lf);
  return `${prefix}   ${f.usage ?? ""}`;
}
