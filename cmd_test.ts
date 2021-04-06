import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { cli, Cmd, Command, Flag } from "./cmd.ts";

export function makeCmd(v: Partial<Cmd>, debug = false): Cmd {
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
  const root = cli("test");
  const hello = root.addCommand(makeCmd({ use: "hello" }));
  const world = hello.addCommand(makeCmd({ use: "world" }));
  world.addFlag({ name: "A", type: "boolean" });
  world.addFlag({ name: "all", type: "boolean" });
  world.addFlag({ name: "x", default: 12 });

  root.addCommand(world);
  const code = await root.execute([
    "hello",
    "world",
    "-A",
    "--all",
    "-x=12",
  ]);

  assertEquals(root.results.cmd.name, "world");
  assertEquals(root.results.args.length, 0);
  assertEquals(root.results.cmd.getFlag("A")!.value, true);
  assertEquals(root.results.cmd.getFlag("all")!.value, true);
  assertEquals(root.results.cmd.getFlag("x")!.value, 12);
});
