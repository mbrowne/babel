"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _helperPluginUtils = require("@babel/helper-plugin-utils");

var _default = (0, _helperPluginUtils.declare)((api, {
  proposal
}) => {
  return {
    name: "syntax-pattern-matching",

    manipulateOptions(opts, parserOpts) {
      parserOpts.plugins.push(["patternMatching", {
        proposal
      }]);
    }

  };
});

exports.default = _default;