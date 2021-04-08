import { cli } from "./mod.ts";

// create the root command
const root = cli({ use: "greeting (hello|goodbye) [--name name] [--strong]" });
// add a subcommand
const hello = root.addCommand({
  use: "hello --name string [--strong]",
  short: "says hello",
  // this is the handler for the command, you get
  // the command being executed, any args following a `--`
  // and an object to let you access relevant flags.
  run: (cmd, args, flags): Promise<number> => {
    const strong = (flags.value<boolean>("strong") ?? false) ? "!!!" : "";
    const n = flags.value<string>("name") ?? "mystery person";
    cmd.stdout(`hello ${n}${strong}`);
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
    const strong = flags.value<boolean>("strong") ? "!!!" : "";
    const n = flags.value<string>("name") ?? "mystery person";
    cmd.stdout(`goodbye ${n}${strong}`);
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
