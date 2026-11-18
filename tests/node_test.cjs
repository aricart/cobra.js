// smoke test of the commonjs build: node tests/node_test.cjs (after npm run build)
const assert = require("node:assert/strict");
const { cli } = require("../lib/mod.js");

let got = null;
const root = cli({ use: "app" });
root.addFlag({ name: "ws", type: "boolean", persistent: true });
const pub = root.addCommand({
  use: "pub <subject>",
  run: (_cmd, args, flags) => {
    got = { args, ws: flags.value("ws"), msgs: flags.value("msgs") };
    return Promise.resolve(0);
  },
});
pub.addFlag({ name: "msgs", type: "number", default: 100 });
pub.stderr = () => {};

(async () => {
  assert.equal(await root.execute(["--ws", "pub", "x", "--msgs", "5"]), 0);
  assert.deepEqual(got, { args: ["x"], ws: true, msgs: 5 });
  assert.equal(await root.execute(["pub", "x", "--nope"]), 1);
  console.log("cjs ok");
})();
