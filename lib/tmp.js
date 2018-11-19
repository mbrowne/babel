const code = `
  class Demo {
    var x = 1;
  }`;

const parsed = require("./lib").parse(code, {
  sourceType: "module",
  plugins: ["classes-1.1"]
});

console.log('parsed: ', JSON.stringify(parsed.program.body, undefined, 2));