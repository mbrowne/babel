"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.parse = parse;
exports.parseExpression = parseExpression;
Object.defineProperty(exports, "tokTypes", {
  enumerable: true,
  get: function () {
    return _types.types;
  }
});

var _pluginUtils = require("./plugin-utils");

var _parser = _interopRequireDefault(require("./parser"));

var _types = require("./tokenizer/types");

require("./tokenizer/context");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function parse(input, options) {
  if (options && options.sourceType === "unambiguous") {
    options = Object.assign({}, options);

    try {
      options.sourceType = "module";
      const parser = getParser(options, input);
      const ast = parser.parse();
      if (!parser.sawUnambiguousESM) ast.program.sourceType = "script";
      return ast;
    } catch (moduleError) {
      try {
        options.sourceType = "script";
        return getParser(options, input).parse();
      } catch (scriptError) {}

      throw moduleError;
    }
  } else {
    return getParser(options, input).parse();
  }
}

function parseExpression(input, options) {
  const parser = getParser(options, input);

  if (parser.options.strictMode) {
    parser.state.strict = true;
  }

  return parser.getExpression();
}

function getParser(options, input) {
  let cls = _parser.default;

  if (options && options.plugins) {
    (0, _pluginUtils.validatePlugins)(options.plugins);
    cls = getParserClass(options.plugins);
  }

  return new cls(options, input);
}

const parserClassCache = {};

function getParserClass(pluginsFromOptions) {
  const pluginList = _pluginUtils.mixinPluginNames.filter(name => (0, _pluginUtils.hasPlugin)(pluginsFromOptions, name));

  const key = pluginList.join("/");
  let cls = parserClassCache[key];

  if (!cls) {
    cls = _parser.default;

    for (let _i = 0; _i < pluginList.length; _i++) {
      const plugin = pluginList[_i];
      cls = _pluginUtils.mixinPlugins[plugin](cls);
    }

    parserClassCache[key] = cls;
  }

  return cls;
}