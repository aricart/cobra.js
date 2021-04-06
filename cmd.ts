import { parse } from "https://deno.land/std/flags/mod.ts";
import { sprintf } from "https://deno.land/std/fmt/printf.ts";

export type Run = (
  cmd: Command,
  args: string[],
  flags: Map<string, Flag>,
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

function flagMap(flags: Flag[]): Map<string, Flag> {
  const m = new Map<string, Flag>();
  flags.forEach((f) => {
    if (f.name) {
      m.set(f.name, f);
    }
    if (f.short) {
      m.set(f.short, f);
    }
  });
  return m;
}

export class Command implements Cmd {
  cmd: Cmd;
  commands!: Command[];
  parent!: Command;
  flags!: Flag[];

  constructor(cmd = {} as Cmd) {
    if (!cmd.use) throw new Error("use is required");
    if (!cmd.run) {
      cmd.run = (): Promise<number> => {
        this.help();
        return Promise.resolve(1);
      };
    }
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

  help(): void {
    // usage for the parent
    console.log(`${this.use}\n`);
    console.log("Usage:");
    if (!this.commands) {
      console.log(`  ${this.use}`);
    } else {
      console.log(`  ${this.name} [commands]\n`);
      // summary of child commands
      this.commands.sort((a, b): number => {
        return a.use.localeCompare(b.use);
      });
      console.log("Available Commands:");
      const lens = this.commands.map((cmd): number => {
        return cmd.name.length;
      });
      const max = lens.reduce((a, v) => {
        return Math.max(a, v);
      });
      this.commands.forEach((cmd) => {
        const n = cmd.name.padEnd(max, " ");
        console.log(`  ${n}   ${cmd.short}`);
      });
    }
    const flags = this.getFlags();
    if (flags) {
      console.log("\nFlags:");
      flags.sort((a, b): number => {
        return a.name.localeCompare(b.name);
      });
      const args = flags.map((f): [string, string] => {
        return [f.short, f.name];
      });
      const pad = calcPad(args);
      flags.forEach((f) => {
        console.log(`  ${flagHelp(f, pad)}`);
      });
    }
  }

  checkFlags(flag: Flag): boolean {
    this.flags = this.flags ?? [];
    const f = this.flags.filter((v) => {
      const sn = flag.name !== "" && v.name !== "" && flag.name === v.name;
      const sh = flag.short !== "" && v.short !== "" && flag.short === v.short;
      return sn || sh;
    });
    if (f.length > 0) {
      return true;
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
    if (this.checkFlags(pf)) {
      throw new Error(`flag ${pf.name} already exists`);
    }
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

  run(cmd: Command, args: string[], flags: Map<string, Flag>): Promise<number> {
    return this.cmd.run(cmd, args, flags);
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
  results!: { cmd: Command; args: string[]; flags: Flag[] };
  _help: Flag;
  constructor(name: string) {
    super({
      use: name,
      run: (cmd: Command): Promise<number> => {
        cmd.help();
        return Promise.resolve(1);
      },
    });

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
    // console.dir(argv);

    // find the target command
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
      }
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
    }
    return [cmd, a];
  }

  execute(args: string[] = Deno.args): Promise<number> {
    const [cmd, a] = this.matchCmd(args);
    const opts = cmd.getFlags();

    // deno-lint-ignore no-explicit-any
    const parseOpts = { "--": true } as any;
    opts.forEach((f) => {
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

    const cf: Flag[] = [];
    opts.forEach((f) => {
      const key = f.short.length ? f.short : f.name;
      if (argv[key]) {
        f.value = argv[key];
        if (parseOpts.default && parseOpts.default[key]) {
          f.changed = argv[key] !== parseOpts.default[key];
        } else {
          f.changed = true;
        }
        cf.push(f);
      }
    });

    if (this._help.value) {
      cmd.help();
      return Promise.resolve(1);
    }

    this.results = { cmd, args: a, flags: cf };
    return cmd.run(cmd, a, flagMap(cf));
  }
}

export function cli(name: string): RootCommand {
  return new RootCommand(name);
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

export function argNames(f: Partial<Flag>): [string?, string?] {
  return [f.short, f.name];
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
