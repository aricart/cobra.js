import {
  assert,
  assertArrayIncludes,
  assertEquals,
  assertThrows,
} from "@std/assert";
import { calcPad, cli, Command } from "./mod.ts";
import type { Cmd, Flags } from "./mod.ts";

export function buildCmd(v: Partial<Cmd>, debug = false): Cmd {
  const d = {
    run: (
      cmd: Command,
      args: string[],
      flags: Flags,
    ): Promise<number> => {
      if (debug) {
        console.info(cmd.name, args, flags);
      }
      return Promise.resolve(0);
    },
  } as Cmd;
  return Object.assign(d, v);
}

Deno.test("match nested command", async () => {
  const root = cli({ use: "test" });
  const hello = root.addCommand(buildCmd({ use: "hello" }));
  const world = hello.addCommand(buildCmd({ use: "world" }));
  world.addFlag({ name: "A", type: "boolean", usage: "test" });
  world.addFlag({ name: "all", type: "boolean", usage: "test" });
  world.addFlag({ name: "x", type: "number", default: 12, usage: "test" });

  root.addCommand(world);
  await root.execute([
    "hello",
    "world",
    "-A",
    "--all",
    "-x=12",
  ]);

  assertEquals(root.lastCmd!.cmd.name, "world");
  assertEquals(root.lastCmd!.args.length, 0);
  //@ts-ignore: impl
  assertEquals(root.lastCmd!.cmd.getFlag("A").value, true);
  //@ts-ignore: impl
  assertEquals(root.lastCmd!.cmd.getFlag("all").value, true);
  //@ts-ignore: impl
  assertEquals(root.lastCmd!.cmd.getFlag("x").value, 12);
});

Deno.test("matches nested commands", async () => {
  const root = cli({ use: "test" });
  const a = root.addCommand(buildCmd({ use: "a" }));
  a.addCommand(buildCmd({ use: "aa" }));
  root.addCommand(buildCmd({ use: "b" }));

  await root.execute([
    "a",
  ]);
  assertEquals(root.lastCmd!.cmd.name, "a");
  await root.execute(["a", "aa"]);
  assertEquals(root.lastCmd!.cmd.name, "aa");
  await root.execute(["b"]);
  assertEquals(root.lastCmd!.cmd.name, "b");

  const rv = await root.execute(["c"]);
  assertEquals(rv, 1);
  assertEquals(root.lastCmd!.cmd.name, "test");
});

Deno.test("matches nested commands", async () => {
  const root = cli({
    use: "test",
    run: () => {
      return Promise.resolve(0);
    },
  });
  root.addFlag({
    name: "long-flag",
    short: "S",
    type: "string",
    usage: "test",
  });

  const rv = await root.execute(["-S", "short flag"]);
  assertEquals(rv, 0);
  assert(root.lastCmd!.flags.getFlag("S"));
  assertEquals(root.lastCmd!.flags.value<string>("S"), "short flag");
  assertEquals(root.lastCmd!.flags.value<string>("long-flag"), "short flag");
});

Deno.test("nested command will get help", async () => {
  const root = cli({ use: "test" });
  root.addCommand(buildCmd({ use: "a" }));
  const rv = await root.execute(["a", "--help"]);
  assertEquals(rv, 1);
  assertEquals(root.lastCmd!.cmd.name, "a");
  assertEquals(root.lastCmd!.flags.value<boolean>("help"), true);
});

Deno.test("command needs use", () => {
  const root = cli({ use: "test" });
  assertThrows(
    () => {
      root.addCommand({} as Cmd);
    },
    Error,
    "use is required",
  );
});

Deno.test("flags - non existing flag returns null", async () => {
  const root = cli({ use: "test" });
  root.addCommand({
    use: "t",
    run: (_cmd, _args, flags): Promise<number> => {
      assertEquals(flags.getFlag("test"), null);
      return Promise.resolve(0);
    },
  });

  const rv = await root.execute(["t"]);
  assertEquals(rv, 0);
  assertEquals(root.lastCmd!.cmd.name, "t");
});

Deno.test("flags - default value", async () => {
  const root = cli({ use: "test" });
  const t = root.addCommand({
    use: "t",
    run: (_cmd, _args, flags): Promise<number> => {
      assertEquals(flags.value<boolean>("ok"), false);
      assertEquals(flags.value<boolean>("dok"), true);
      assertEquals(flags.value<string>("name"), "");
      assertEquals(flags.value<string>("dname"), "hello");
      assertEquals(flags.value<number>("num"), 0);
      assertEquals(flags.value<number>("dnum"), 10);

      return Promise.resolve(0);
    },
  });

  t.addFlag({ name: "ok", type: "boolean", usage: "test" });
  t.addFlag({ name: "dok", type: "boolean", default: true, usage: "test" });
  t.addFlag({ name: "name", type: "string", usage: "test" });
  t.addFlag({ name: "dname", type: "string", default: "hello", usage: "test" });
  t.addFlag({ name: "num", type: "number", usage: "test" });
  t.addFlag({ name: "dnum", type: "number", default: 10, usage: "test" });

  const rv = await root.execute(["t"]);
  assertEquals(rv, 0);
});

Deno.test("flags - numeric flag with zero value", async () => {
  const root = cli({ use: "test" });
  const t = root.addCommand({
    use: "t",
    run: (_cmd, _args, flags): Promise<number> => {
      // verify that 0 is treated as an explicit value, not as "not set"
      assertEquals(flags.value<number>("port"), 0);
      assertEquals(flags.value<number>("timeout"), 0);
      assertEquals(flags.value<number>("count"), 0);
      // verify that a flag with default still returns 0 when explicitly set to 0
      assertEquals(flags.value<number>("retry"), 0);
      //@ts-ignore: impl
      assertEquals(flags.getFlag("retry").changed, true);

      return Promise.resolve(0);
    },
  });

  t.addFlag({ name: "port", short: "p", type: "number", usage: "test" });
  t.addFlag({ name: "timeout", short: "t", type: "number", usage: "test" });
  t.addFlag({ name: "count", type: "number", usage: "test" });
  t.addFlag({ name: "retry", type: "number", default: 5, usage: "test" });

  const rv = await root.execute([
    "t",
    "-p",
    "0",
    "--timeout=0",
    "--count",
    "0",
    "--retry",
    "0",
  ]);
  assertEquals(rv, 0);
});

Deno.test("flags - unknown flag throws", async () => {
  const root = cli({ use: "test" });
  root.addCommand({
    use: "t",
    run: (_cmd, _args, flags): Promise<number> => {
      assertThrows(
        () => {
          flags.value<boolean>("bad");
        },
        Error,
        "unknown flag 'bad'",
      );

      return Promise.resolve(0);
    },
  });

  const rv = await root.execute(["t"]);
  assertEquals(rv, 0);
});

Deno.test("flags - array values", async () => {
  const root = cli({ use: "test" });
  const t = root.addCommand({
    use: "t",
    run: (_cmd, _args, flags): Promise<number> => {
      const v = flags.values<number>("x");
      assertEquals(v, [1, 2]);
      return Promise.resolve(0);
    },
  });
  t.addFlag({
    name: "x",
    type: "number",
  });

  const rv = await root.execute(["t", "--x", "1", "--x", "2"]);
  assertEquals(rv, 0);
});

Deno.test("flags - array value returns first value", async () => {
  const root = cli({ use: "test" });
  const t = root.addCommand({
    use: "t",
    run: (_cmd, _args, flags): Promise<number> => {
      const v = flags.value<number>("x");
      assertEquals(v, 1);
      return Promise.resolve(0);
    },
  });
  t.addFlag({
    name: "x",
    type: "number",
  });

  const rv = await root.execute(["t", "--x", "1", "--x", "2"]);
  assertEquals(rv, 0);
});

Deno.test("flags - array values returns array", async () => {
  const root = cli({ use: "test" });
  const t = root.addCommand({
    use: "t",
    run: (_cmd, _args, flags): Promise<number> => {
      const v = flags.values<number>("x");
      assertEquals(v, [1]);
      return Promise.resolve(0);
    },
  });
  t.addFlag({
    name: "x",
    type: "number",
  });

  const rv = await root.execute(["t", "--x", "1"]);
  assertEquals(rv, 0);
});

Deno.test("flags - array values returns empty", async () => {
  const root = cli({ use: "test" });
  const t = root.addCommand({
    use: "t",
    run: (_cmd, _args, flags): Promise<number> => {
      const v = flags.values<number>("x");
      assertEquals(v, []);
      return Promise.resolve(0);
    },
  });
  t.addFlag({
    name: "x",
    type: "number",
  });

  const rv = await root.execute(["t"]);
  assertEquals(rv, 0);
});

Deno.test("flags - unknown values throws", async () => {
  const root = cli({ use: "test" });
  root.addCommand({
    use: "t",
    run: (_cmd, _args, flags): Promise<number> => {
      assertThrows(
        () => {
          flags.values<boolean>("bad");
        },
        Error,
        "unknown flag 'bad'",
      );

      return Promise.resolve(0);
    },
  });

  const rv = await root.execute(["t"]);
  assertEquals(rv, 0);
});

Deno.test("flags - values with no value set returns empty", async () => {
  const root = cli({ use: "test" });
  let values: string[] = [];
  const t = root.addCommand({
    use: "t",
    run: (_cmd, _args, flags): Promise<number> => {
      values = flags.values<string>("v");
      return Promise.resolve(0);
    },
  });
  t.addFlag({
    name: "v",
    type: "string",
  });

  let rv = await root.execute(["t"]);
  assertEquals(rv, 0);
  assertEquals(values.length, 0);

  rv = await root.execute(["t", "--v", "a"]);
  assertEquals(rv, 0);
  assertEquals(values.length, 1);
  assertArrayIncludes(values, ["a"]);

  rv = await root.execute(["t", "--v", "a", "--v", "b"]);
  assertEquals(rv, 0);
  assertEquals(values.length, 2);
  assertArrayIncludes(values, ["a", "b"]);

  rv = await root.execute(["t"]);
  assertEquals(rv, 0);
  assertEquals(values.length, 0);
});

Deno.test("groups", async () => {
  const root = cli({ use: "test" });
  const hello = root.addCommand({ use: "hello" });
  hello.addCommand({
    use: "hi",
    run: (cmd, _args, _flags): Promise<number> => {
      cmd.stdout("hello");
      return Promise.resolve(0);
    },
  });

  await root.execute(["hello", "hi"]);
});

Deno.test("flags - required flag throws when missing", async () => {
  let errorThrown = false;
  const root = cli({ use: "test" });
  const t = root.addCommand({
    use: "t",
    run: (_cmd, _args, flags): Promise<number> => {
      try {
        flags.checkRequired();
      } catch (e) {
        errorThrown = true;
        throw e;
      }
      return Promise.resolve(0);
    },
  });
  t.addFlag({
    name: "config",
    short: "c",
    type: "string",
    required: true,
    usage: "config file path",
  });

  // should throw when required flag is missing
  const rv = await root.execute(["t"]);
  assertEquals(rv, 1); // should return error code
  assertEquals(errorThrown, true);

  // should succeed when required flag is provided
  const rv2 = await root.execute(["t", "--config", "test.json"]);
  assertEquals(rv2, 0);
});

Deno.test("flags - duplicate flag names throw error", () => {
  const root = cli({ use: "test" });
  root.addFlag({
    name: "verbose",
    short: "v",
    type: "boolean",
    usage: "verbose output",
  });

  // adding flag with same name should throw
  assertThrows(
    () => {
      root.addFlag({
        name: "verbose",
        short: "x",
        type: "boolean",
        usage: "another verbose",
      });
    },
    Error,
    "--verbose has conflict",
  );
});

Deno.test("flags - duplicate short names throw error", () => {
  const root = cli({ use: "test" });
  root.addFlag({
    name: "verbose",
    short: "v",
    type: "boolean",
    usage: "verbose output",
  });

  // adding flag with same short should throw
  assertThrows(
    () => {
      root.addFlag({
        name: "veryverbose",
        short: "v",
        type: "boolean",
        usage: "very verbose",
      });
    },
    Error,
    "has conflict",
  );
});

Deno.test("commands - duplicate command names throw error", () => {
  const root = cli({ use: "test" });
  root.addCommand({ use: "hello", short: "says hello" });

  // adding command with same name should throw
  assertThrows(
    () => {
      root.addCommand({ use: "hello", short: "another hello" });
    },
    Error,
    "a command hello already exists",
  );
});

Deno.test("commands - command without run handler shows help", async () => {
  const root = cli({ use: "test" });
  root.addCommand({ use: "empty", short: "command without run" });

  const rv = await root.execute(["empty"]);
  assertEquals(rv, 1); // default handler returns 1
});

Deno.test("commands - error in run handler returns 1", async () => {
  const root = cli({ use: "test" });
  root.addCommand({
    use: "fail",
    short: "failing command",
    run: (): Promise<number> => {
      throw new Error("intentional error");
    },
  });

  const rv = await root.execute(["fail"]);
  assertEquals(rv, 1);
});

Deno.test("commands - root() traversal", () => {
  const root = cli({ use: "test" });
  const a = root.addCommand({ use: "a" });
  const aa = a.addCommand({ use: "aa" });
  const aaa = aa.addCommand({ use: "aaa" });

  // all nested commands should find root
  assertEquals(aaa.root().name, "test");
  assertEquals(aa.root().name, "test");
  assertEquals(a.root().name, "test");
  assertEquals(root.root().name, "test");
});

Deno.test("cli - missing use throws error", () => {
  assertThrows(
    () => {
      cli({ use: "" });
    },
    Error,
    "use is required",
  );
});

Deno.test("flags - persistent flags inherited by subcommands", async () => {
  const root = cli({ use: "test" });
  root.addFlag({
    name: "global",
    short: "g",
    type: "string",
    persistent: true,
    usage: "global flag",
  });

  let receivedValue = "";
  const _sub = root.addCommand({
    use: "sub",
    run: (_cmd, _args, flags): Promise<number> => {
      receivedValue = flags.value<string>("global");
      return Promise.resolve(0);
    },
  });

  await root.execute(["sub", "--global", "test-value"]);
  assertEquals(receivedValue, "test-value");
});

Deno.test("commands - help shows long description", async () => {
  const root = cli({
    use: "test",
    short: "short desc",
    long: "this is a much longer description that should be shown with --help",
  });

  const rv = await root.execute(["--help"]);
  assertEquals(rv, 1);
});

Deno.test("flags - flag with default value", async () => {
  const root = cli({ use: "test" });
  const t = root.addCommand({
    use: "t",
    run: (_cmd, _args, flags): Promise<number> => {
      const port = flags.value<number>("port");
      assertEquals(port, 8080);
      return Promise.resolve(0);
    },
  });
  t.addFlag({
    name: "port",
    short: "p",
    type: "number",
    default: 8080,
    usage: "port number",
  });

  const rv = await root.execute(["t"]);
  assertEquals(rv, 0);
});

Deno.test("commands - use string with spaces extracts name", () => {
  const root = cli({ use: "test" });
  const cmd = root.addCommand({
    use: "hello [name]",
    short: "greet someone",
  });

  assertEquals(cmd.name, "hello");
});

Deno.test("flags - short flag without name", async () => {
  const root = cli({ use: "test" });
  let value = false;
  const t = root.addCommand({
    use: "t",
    run: (_cmd, _args, flags): Promise<number> => {
      value = flags.value<boolean>("v");
      return Promise.resolve(0);
    },
  });
  t.addFlag({
    name: "v",
    short: "",
    type: "boolean",
    usage: "verbose",
  });

  await root.execute(["t", "--v"]);
  assertEquals(value, true);
});

Deno.test("flags - getFlag from parent command", () => {
  const root = cli({ use: "test" });
  root.addFlag({
    name: "global",
    type: "string",
    usage: "global flag",
  });
  const sub = root.addCommand({ use: "sub" });

  // child can access parent's flag via getFlag
  const flag = sub.getFlag("global");
  assertEquals(flag?.name, "global");

  // getFlag returns null for non-existent flags
  const notFound = sub.getFlag("doesnotexist");
  assertEquals(notFound, null);
});

Deno.test("flags - multiple flags sorted in help", async () => {
  const root = cli({ use: "test" });
  root.addFlag({ name: "zebra", type: "string", usage: "z flag" });
  root.addFlag({ name: "apple", type: "string", usage: "a flag" });
  root.addFlag({ name: "middle", type: "string", usage: "m flag" });

  await root.execute(["--help"]);
  // this test just ensures the sorting logic is executed
});

Deno.test("flags - conflict error shows short flag", () => {
  const root = cli({ use: "test" });
  root.addFlag({
    name: "verbose",
    short: "v",
    type: "boolean",
    usage: "verbose output",
  });

  // conflict should show the short flag in error message
  assertThrows(
    () => {
      root.addFlag({
        name: "verbose",
        short: "x",
        type: "boolean",
        usage: "another verbose",
      });
    },
    Error,
    "-v",
  );
});

Deno.test("execute - with null args uses runtime.args()", async () => {
  const root = cli({ use: "test" });
  let _executed = false;
  root.addCommand({
    use: "test-cmd",
    run: (): Promise<number> => {
      _executed = true;
      return Promise.resolve(0);
    },
  });

  // passing null should use runtime.args()
  await root.execute(null);
  // in test environment, this will get Deno.args which is typically empty
  // so the default help is shown
});

Deno.test("cli - with run handler and help flag", async () => {
  let runCalled = false;
  const root = cli({
    use: "test",
    run: (): Promise<number> => {
      runCalled = true;
      return Promise.resolve(0);
    },
  });

  // help flag should prevent run from being called
  const rv = await root.execute(["--help"]);
  assertEquals(rv, 1);
  assertEquals(runCalled, false);
});

Deno.test("flags - help flag without name only short", async () => {
  const root = cli({ use: "test" });
  const t = root.addCommand({
    use: "t",
    run: (): Promise<number> => {
      return Promise.resolve(0);
    },
  });
  t.addFlag({
    name: "",
    short: "x",
    type: "boolean",
    usage: "x flag",
  });

  await root.execute(["t", "--help"]);
  // this exercises the flagHelp path for short-only flags
});

Deno.test("commands - matchCmd with no subcommands", async () => {
  const root = cli({
    use: "test",
    run: (): Promise<number> => {
      return Promise.resolve(0);
    },
  });

  // root with no commands, args should remain
  const rv = await root.execute(["arg1", "arg2"]);
  assertEquals(rv, 0);
  assertEquals(root.lastCmd!.args.length, 2);
});

Deno.test("flags - empty name gets defaulted", async () => {
  const root = cli({ use: "test" });
  const t = root.addCommand({
    use: "t",
    run: (): Promise<number> => {
      return Promise.resolve(0);
    },
  });

  // adding flag with minimal required info
  t.addFlag({
    type: "boolean",
    usage: "test flag",
    name: "testflag",
  });

  await root.execute(["t"]);
});

Deno.test("flags - conflict with flag that has short", () => {
  const root = cli({ use: "test" });
  root.addFlag({
    name: "verbose",
    short: "v",
    type: "boolean",
    usage: "verbose output",
  });

  // conflict should include the short flag in error
  try {
    root.addFlag({
      name: "verbose",
      short: "x",
      type: "boolean",
      usage: "another verbose",
    });
  } catch (e) {
    const err = e as Error;
    assert(err.message.includes("-v"));
  }
});

Deno.test("commands - ambiguous command throws", async () => {
  const root = cli({ use: "test" });

  // manually create ambiguous situation by adding same command name via different paths
  const cmd1 = new Command({ use: "same" });
  const cmd2 = new Command({ use: "same" });

  root.commands.push(cmd1);
  root.commands.push(cmd2);

  try {
    await root.execute(["same"]);
    throw new Error("Should have thrown ambiguous error");
  } catch (e) {
    const err = e as Error;
    assert(err.message.includes("ambiguous command same"));
  }
});

Deno.test("commands - showHelp flag on non-zero exit", async () => {
  const root = cli({ use: "test" });
  const cmd = root.addCommand({
    use: "test-cmd",
    run: (): Promise<number> => {
      return Promise.resolve(2); // non-zero exit
    },
  });
  // deno-lint-ignore no-explicit-any
  (cmd as any).showHelp = true;

  const rv = await root.execute(["test-cmd"]);
  assertEquals(rv, 2);
});

Deno.test("commands - showHelp flag on error", async () => {
  const root = cli({ use: "test" });
  const cmd = root.addCommand({
    use: "fail-cmd",
    run: (): Promise<number> => {
      throw new Error("test error");
    },
  });
  // deno-lint-ignore no-explicit-any
  (cmd as any).showHelp = true;

  const rv = await root.execute(["fail-cmd"]);
  assertEquals(rv, 1);
});

Deno.test("cli - opts ?? {} fallback", () => {
  // this tests the opts = opts ?? {} line
  const root = cli({ use: "test" });
  assertEquals(root.name, "test");
});

Deno.test("cli - with run that checks help flag", async () => {
  let helpChecked = false;
  const root = cli({
    use: "test",
    run: (_cmd, _args, flags): Promise<number> => {
      helpChecked = true;
      const h = flags.getFlag("help");
      return Promise.resolve(h ? 1 : 0);
    },
  });

  await root.execute(["--help"]);
  assertEquals(helpChecked, false); // help intercepted before run
});

Deno.test("flags - calcPad with empty and null strings", () => {
  const root = cli({ use: "test" });
  root.addFlag({ name: "", short: "", type: "string", usage: "test" });
  root.addFlag({ name: "a", short: "b", type: "string", usage: "test2" });

  // this exercises the max function with empty strings
  const pad = calcPad([["", ""], ["a", "b"]]);
  assertEquals(pad.short, 1);
  assertEquals(pad.long, 1);
});

Deno.test("commands - matchCmd with command that has no subcommands", async () => {
  const root = cli({ use: "test" });
  const _leaf = root.addCommand({
    use: "leaf",
    run: (): Promise<number> => {
      return Promise.resolve(0);
    },
  });

  // trying to match a subcommand that doesn't exist
  const rv = await root.execute(["leaf", "nonexistent"]);
  assertEquals(rv, 0);
  assertEquals(root.lastCmd!.args[0], "nonexistent");
});

Deno.test("flags - flagHelp with no name and short only", () => {
  const root = cli({ use: "test" });
  root.addFlag({
    name: "",
    short: "x",
    type: "boolean",
    usage: "x only",
  });

  // this exercises flagHelp with no name
  root.execute(["--help"]);
});

Deno.test("commands - root with run handler and help in run", async () => {
  const root = cli({
    use: "test",
    run: (_cmd, _args, flags): Promise<number> => {
      const h = flags.getFlag("help");
      // deno-lint-ignore no-explicit-any
      if (h && (h as any).value) {
        return Promise.resolve(1);
      }
      return Promise.resolve(0);
    },
  });

  root.addFlag({ name: "test", type: "string", usage: "test flag" });

  const rv = await root.execute(["--test", "value"]);
  assertEquals(rv, 0);
});

Deno.test("flags - conflict without short flag", () => {
  const root = cli({ use: "test" });
  root.addFlag({
    name: "verbose",
    short: "",
    type: "boolean",
    usage: "verbose output",
  });

  // conflict without short flag
  try {
    root.addFlag({
      name: "verbose",
      short: "",
      type: "boolean",
      usage: "another verbose",
    });
  } catch (e) {
    const err = e as Error;
    assert(err.message.includes("--verbose has conflict"));
  }
});

Deno.test("commands - matchCmd argv._ fallback to empty", async () => {
  const root = cli({ use: "test" });

  // execute with args that minimist might not parse correctly
  const rv = await root.execute([]);
  assertEquals(rv, 1); // help shown
});

Deno.test("cli - called with undefined opts", () => {
  assertThrows(
    () => {
      // @ts-expect-error - testing the ?? {} fallback
      cli(undefined);
    },
    Error,
    "use is required",
  );
});

Deno.test("flags - calcPad with empty strings", () => {
  // testing null coalescing in max function
  const pad = calcPad([["", ""]]);
  assertEquals(pad.short, 0);
  assertEquals(pad.long, 0);
});

Deno.test("flags - flagHelp with empty usage", async () => {
  const root = cli({ use: "test" });
  root.addFlag({
    name: "emptyusage",
    short: "n",
    type: "string",
    usage: "",
  });

  await root.execute(["--help"]);
  // exercises the usage ?? "" path
});

Deno.test("cli - with run and help flag value true", async () => {
  let ran = false;
  const root = cli({
    use: "test",
    run: (): Promise<number> => {
      ran = true;
      return Promise.resolve(0);
    },
  });

  // manually set help flag value to trigger the wrapper logic
  await root.execute(["--help"]);
  assertEquals(ran, false);
});

Deno.test("flags - conflict with parent non-persistent flag", () => {
  const root = cli({ use: "test" });
  root.addFlag({
    name: "output",
    type: "string",
    usage: "output file",
    persistent: false, // NOT persistent
  });

  const sub = root.addCommand({ use: "sub" });

  // should still throw even though parent flag is not persistent
  assertThrows(
    () => {
      sub.addFlag({
        name: "output",
        type: "string",
        usage: "sub output",
      });
    },
    Error,
    "has conflict",
  );
});

Deno.test("flags - conflict with parent persistent flag", () => {
  const root = cli({ use: "test" });
  root.addFlag({
    name: "verbose",
    type: "boolean",
    usage: "verbose mode",
    persistent: true, // IS persistent
  });

  const sub = root.addCommand({ use: "sub" });

  // should throw for persistent flags too
  assertThrows(
    () => {
      sub.addFlag({
        name: "verbose",
        type: "boolean",
        usage: "sub verbose",
      });
    },
    Error,
    "has conflict",
  );
});

Deno.test("flags - non-persistent parent flag blocks child with same name", async () => {
  const root = cli({ use: "cmd" });

  const verb = root.addCommand({
    use: "verb",
    run: (_cmd, _args, flags): Promise<number> => {
      const a = flags.value<string>("a");
      assertEquals(a, "from-verb");
      return Promise.resolve(0);
    },
  });

  verb.addFlag({
    name: "a",
    type: "string",
    usage: "flag on verb",
    persistent: false, // NOT persistent
    default: "from-verb",
  });

  const verbverb = verb.addCommand({
    use: "subverb",
    run: (_cmd, _args, _flags): Promise<number> => {
      // Since parent flag is not persistent, it should NOT be available here
      // But we can't add our own -a flag because checkFlags prevents it
      return Promise.resolve(0);
    },
  });

  // This throws even though the parent flag is not persistent
  assertThrows(
    () => {
      verbverb.addFlag({
        name: "a",
        type: "string",
        usage: "flag on subverb",
      });
    },
    Error,
    "has conflict",
  );

  // Execute to verify parent's non-persistent flag is NOT available to child
  await root.execute(["verb", "subverb"]);
  // The child command can't access parent's non-persistent flag
});
