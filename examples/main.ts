import { cli } from "../src/mod.ts";

// create the root command
const root = cli({
  use: "greeting",
  short: "says hello or goodbye",
});
root.addFlag({
  short: "s",
  name: "strong",
  type: "boolean",
  usage: "say message strongly",
  persistent: true,
});
// add a subcommand
const hello = root.addCommand({
  use: "hello",
  short: "says hello",
  // this is the handler for the command, you get
  // the command being executed, any args following a `--`
  // and an object to let you access relevant flags.
  run: (cmd, _args, flags): Promise<number> => {
    const strong = flags.value<boolean>("strong") ? "!!!" : "";
    let n = flags.value<string>("name");
    n = n === "" ? "mystery person" : n;
    cmd.stdout(`hello ${n}${strong}\n`);
    return Promise.resolve(0);
  },
});
hello.addFlag({
  short: "n",
  name: "name",
  type: "string",
  usage: "name to say hello to",
});

const goodbye = root.addCommand({
  use: "goodbye",
  short: "says goodbye",
  run: (cmd, _args, flags): Promise<number> => {
    const strong = flags.value<boolean>("strong") ? "!!!" : "";
    let n = flags.value<string>("name");
    n = n === "" ? "mystery person" : n;
    cmd.stdout(`goodbye ${n}${strong}\n`);
    return Promise.resolve(0);
  },
});
goodbye.addFlag({
  short: "n",
  name: "name",
  type: "string",
  usage: "name to say goodbye to",
});

root.exit(await root.execute());
