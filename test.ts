import {
  assert,
  assertArrayIncludes,
  assertEquals,
  assertThrows,
} from "https://deno.land/std/testing/asserts.ts";
import { cli, Cmd, Command, Flags } from "./mod.ts";

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
  world.addFlag({ name: "A", type: "boolean" });
  world.addFlag({ name: "all", type: "boolean" });
  world.addFlag({ name: "x", default: 12 });

  root.addCommand(world);
  await root.execute([
    "hello",
    "world",
    "-A",
    "--all",
    "-x=12",
  ]);

  assertEquals(root.lastCmd.cmd.name, "world");
  assertEquals(root.lastCmd.args.length, 0);
  assertEquals(root.lastCmd.cmd.getFlag("A")!.value, true);
  assertEquals(root.lastCmd.cmd.getFlag("all")!.value, true);
  assertEquals(root.lastCmd.cmd.getFlag("x")!.value, 12);
});

Deno.test("matches nested commands", async () => {
  const root = cli({ use: "test" });
  const a = root.addCommand(buildCmd({ use: "a" }));
  a.addCommand(buildCmd({ use: "aa" }));
  root.addCommand(buildCmd({ use: "b" }));

  await root.execute([
    "a",
  ]);
  assertEquals(root.lastCmd.cmd.name, "a");
  await root.execute(["a", "aa"]);
  assertEquals(root.lastCmd.cmd.name, "aa");
  await root.execute(["b"]);
  assertEquals(root.lastCmd.cmd.name, "b");

  const rv = await root.execute(["c"]);
  assertEquals(rv, 1);
  assertEquals(root.lastCmd.cmd.name, "test");
});

Deno.test("matches nested commands", async () => {
  const root = cli({
    use: "test",
    run: () => {
      return Promise.resolve(0);
    },
  });
  root.addFlag({ name: "long-flag", short: "S", type: "string" });

  const rv = await root.execute(["-S", "short flag"]);
  assertEquals(rv, 0);
  assert(root.lastCmd.flags.getFlag("S"));
  assertEquals(root.lastCmd.flags.value<string>("S"), "short flag");
  assertEquals(root.lastCmd.flags.value<string>("long-flag"), "short flag");
});

Deno.test("nested command will get help", async () => {
  const root = cli({ use: "test" });
  root.addCommand(buildCmd({ use: "a" }));
  const rv = await root.execute(["a", "--help"]);
  assertEquals(rv, 1);
  assertEquals(root.lastCmd.cmd.name, "a");
  assertEquals(root.lastCmd.flags.value<boolean>("help"), true);
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
  assertEquals(root.lastCmd.cmd.name, "t");
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

  t.addFlag({ name: "ok", type: "boolean" });
  t.addFlag({ name: "dok", type: "boolean", default: true });
  t.addFlag({ name: "name", type: "string" });
  t.addFlag({ name: "dname", type: "string", default: "hello" });
  t.addFlag({ name: "num", type: "number" });
  t.addFlag({ name: "dnum", type: "number", default: 10 });

  const rv = await root.execute(["t"]);
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
        "unknown flag bad",
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
        "unknown flag bad",
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
  console.log(values);
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
