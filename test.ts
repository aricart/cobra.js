import {
  assert,
  assertEquals,
  assertThrows,
} from "https://deno.land/std/testing/asserts.ts";
import { cli, Cmd, Command, Flag } from "./mod.ts";

export function buildCmd(v: Partial<Cmd>, debug = false): Cmd {
  const d = {
    run: (
      cmd: Command,
      args: string[],
      flags: Map<string, Flag>,
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
  assert(root.lastCmd.flags.get("S"));
  assertEquals(root.lastCmd.flags.get("S")!.value, "short flag");
  assertEquals(root.lastCmd.flags.get("long-flag")!.value, "short flag");
});

Deno.test("nested command will get help", async () => {
  const root = cli({ use: "test" });
  root.addCommand(buildCmd({ use: "a" }));
  const rv = await root.execute(["a", "--help"]);
  assertEquals(rv, 1);
  assertEquals(root.lastCmd.cmd.name, "a");
  assertEquals(root.lastCmd.flags.get("help")!.value, true);
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
