import { cli } from "./mod.ts";

const root = cli("greeting");
const hello = root.addCommand({
  use: "hello --name string [--strong]",
  short: "says hello",
  run: (cmd, args, flags): Promise<number> => {
    const strong = (flags.get("strong")?.value ?? false) ? "!!!" : "";
    const n = flags.get("name")?.value ?? "mystery person";
    console.log(`hello ${n}${strong}`);
    return Promise.resolve(0);
  },
});

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

const goodbye = root.addCommand({
  use: "goodbye --name string [--strong]",
  short: "says goodbye",
  run: (cmd, args, flags): Promise<number> => {
    const strong = (flags.get("strong")?.value ?? false) ? "!!!" : "";
    const n = flags.get("name")?.value ?? "mystery person";
    console.log(`goodbye ${n}${strong}`);
    return Promise.resolve(0);
  },
});
goodbye.addFlag({
  short: "n",
  name: "name",
  type: "string",
  usage: "name to say goodbye to",
});
goodbye.addFlag({
  short: "s",
  name: "strong",
  type: "boolean",
  usage: "say goodbye strongly",
});

Deno.exit(await root.execute(Deno.args));
