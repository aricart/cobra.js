import { parse } from "https://deno.land/std/flags/mod.ts";
import { sprintf } from "https://deno.land/std/fmt/printf.ts";

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

export interface Flags {
  value<T>(n: string): T;
  values<T>(n: string): T[];
  getFlag(n: string): Flag | null;
  checkRequired(): void;
}

export type Run = (
  cmd: Command,
  args: string[],
  flags: Flags,
) => Promise<number>;

export interface Cmd {
  use: string; // one line usage - first word is name of cmd
  short?: string; // short description shown in help
  long?: string; // long help (cmd action --help)
  run: Run;
}

export function isCommand(t: Command | Cmd): t is Command {
  const v = t as Command;
  return v.cmd !== undefined;
}

function flag(f: Partial<Flag>): Flag {
  const d = {} as Flag;
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
  m: Map<string, Flag>;

  constructor(flags: Flag[]) {
    this.m = new Map<string, Flag>();
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

  defaultValue<T = unknown>(f: Flag): T {
    let t;
    if (f.type === "string") {
      t = "";
    } else if (f.type === "boolean") {
      t = false;
    } else if (f.type === "number") {
      t = 0;
    }
    return t as unknown as T;
  }

  value<T = unknown>(n: string): T {
    const f = this.m.get(n);
    if (!f) {
      throw new Error(`unknown flag ${n}`);
    }
    let v = f.value ?? f.default ?? this.defaultValue(f);
    if (Array.isArray(v)) {
      v = v[0];
    }
    return v as T;
  }

  values<T = unknown>(n: string): T[] {
    const f = this.m.get(n);
    if (!f) {
      throw new Error(`unknown flag ${n}`);
    }
    let v = f.value ?? f.default ?? this.defaultValue(f);
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

export class Command implements Cmd {
  cmd: Cmd;
  commands!: Command[];
  parent!: Command;
  flags!: Flag[];
  showHelp: false;

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
  }

  get use() {
    return this.cmd.use;
  }

  get long() {
    return this.cmd.long;
  }

  get short() {
    return this.cmd.short;
  }

  stdout(s: string) {
    Deno.stdout.writeSync(new TextEncoder().encode(s));
  }

  stderr(s: string) {
    Deno.stderr.writeSync(new TextEncoder().encode(s));
  }

  help(long = false): void {
    // usage for the parent
    if (long) {
      this.stderr(`${this.long ?? this.short ?? this.use}\n`);
    } else {
      this.stderr(`${this.short ?? this.use}\n`);
    }
    this.stderr("\nUsage:\n");
    if (!this.commands) {
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
        this.stderr(`  ${n}   ${cmd.short}\n`);
      });
    }
    const flags = this.getFlags();
    if (flags) {
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
    if (this.flags) {
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

  addFlag(f: Partial<Flag>): Flag {
    const pf = flag(f);
    pf.name = pf.name ?? "";
    pf.short = pf.short ?? "";
    this.flags = this.flags ?? [];
    this.checkFlags(pf);
    this.flags.push(pf);
    return pf;
  }

  getFlags(): Flag[] {
    const flags: Flag[] = this.flags ?? [];
    let cmd = this.parent;
    while (cmd) {
      if (cmd.flags) {
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
    if (this.flags) {
      const m = this.flags.filter((f) => {
        return f.name === name;
      });
      if (m && m.length > 0) {
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
      const exit = await this.cmd.run(cmd, args, flags);
      if (exit > 0 && this.showHelp) {
        cmd.help();
      }
      return exit;
    } catch (err) {
      cmd.stderr(`${err.message}\n`);
      if (cmd.showHelp) {
        cmd.help();
      }
      return 1;
    }
  }

  addCommand(cmd: Cmd | Command): Command {
    if (isCommand(cmd)) {
      cmd = cmd.cmd;
    }
    const ci = new Command(cmd);
    ci.parent = this;
    this.commands = this.commands ?? [];
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

  get name(): string {
    let name = this.cmd.use;
    const idx = name.indexOf(" ");
    if (idx > 0) {
      name = name.slice(0, idx);
    }
    return name;
  }

  root(): Command {
    if (this.parent) {
      return this.parent.root();
    }
    return this;
  }
}

export interface Execute {
  execute(): void;
}

export class RootCommand extends Command implements Execute {
  lastCmd!: {
    cmd: Command;
    args: string[];
    flags: Flags;
    helped?: boolean;
  };
  _help: Flag;
  constructor(cmd: Cmd) {
    super(cmd);

    this._help = this.addFlag({
      name: "help",
      usage: `display ${this.name.split(" ")[0]}'s help`,
      short: "h",
      persistent: true,
      type: "boolean",
    });
  }
  matchCmd(args: string[]): [Command, string[]] {
    const argv = parse(args, { "--": true });
    let cmd = this as Command;
    const a = (argv._ ?? []).map((v) => {
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

  execute(args: string[] = Deno.args): Promise<number> {
    const [cmd, a] = this.matchCmd(args);
    const flags = cmd.getFlags();

    // deno-lint-ignore no-explicit-any
    const parseOpts = { "--": true } as any;
    flags.forEach((f) => {
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

    const argv = parse(args, parseOpts);
    argv._ = a;

    flags.forEach((f) => {
      f.changed = false;
      const key = f.short.length ? f.short : f.name;
      if (argv[key]) {
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

export function cli(opts: Partial<Cmd>): RootCommand {
  opts = opts ?? {};
  if (!opts.use) {
    throw new Error("use is required");
  }
  if (opts.run) {
    const orig = opts.run;
    opts.run = (cmd, args, flags): Promise<number> => {
      const h = flags.getFlag("help");
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
