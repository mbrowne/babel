"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _assert = _interopRequireDefault(require("assert"));

var _helperPluginUtils = require("@babel/helper-plugin-utils");

var _pluginSyntaxPatternMatching = _interopRequireDefault(require("@babel/plugin-syntax-pattern-matching"));

var _babelCore = require("../../babel-core");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const exprT = _babelCore.template.expression;

const constStatement = (id, initializer) => _babelCore.types.variableDeclaration("const", [_babelCore.types.variableDeclarator(id, initializer)]);

class WhenRewriter {
  constructor({
    scope,
    outerLabel
  }) {
    this.stmts = undefined;
    this.scope = scope;
    this.outerLabel = outerLabel;
    this.innerLabel = scope.generateUidIdentifier("caseInner");
  }

  buildError(node, msg) {
    return this.scope.path.hub.buildError(node, msg);
  }

  bindConst(id, initializer) {
    this.stmts.push(constStatement(id, initializer));
  }

  failIf(testExpr) {
    this.stmts.push(_babelCore.types.ifStatement(testExpr, _babelCore.types.breakStatement(this.innerLabel)));
  }

  translate(node, valueId) {
    const {
      pattern,
      matchGuard,
      body
    } = node;
    this.stmts = [];
    this.translatePattern(pattern, valueId);

    if (matchGuard !== undefined) {
      this.failIf(_babelCore.types.unaryExpression("!", matchGuard));
    }

    this.stmts.push(body);
    this.stmts.push(_babelCore.types.breakStatement(this.outerLabel));
    return _babelCore.types.labeledStatement(this.innerLabel, _babelCore.types.blockStatement(this.stmts));
  }

  translatePattern(pattern, id) {
    (0, _assert.default)(id.type === "Identifier");
    const {
      scope
    } = this;

    switch (pattern.type) {
      case "NumericLiteral":
      case "StringLiteral":
      case "BooleanLiteral":
      case "NullLiteral":
        this.failIf(_babelCore.types.binaryExpression("!==", id, pattern));
        return;

      case "Identifier":
        this.bindConst(pattern, id);
        return;

      case "ObjectMatchPattern":
        {
          this.failIf(exprT`ID === null || typeof ID !== "object"`({
            ID: id
          }));
          const propertyIds = [];
          const lhsPatterns = [];

          for (let i = 0; i < pattern.properties.length; ++i) {
            const property = pattern.properties[i];
            const subId = scope.generateUidIdentifier();
            propertyIds.push(subId);

            if (_babelCore.types.isMatchRestElement(property)) {
              (0, _assert.default)(i === pattern.properties.length - 1);
              lhsPatterns.push(_babelCore.types.restElement(subId));
            } else if (property.initializer) {
              lhsPatterns.push(_babelCore.types.objectProperty(property.key, _babelCore.types.assignmentPattern(subId, property.initializer)));
            } else {
              lhsPatterns.push(_babelCore.types.objectProperty(property.key, subId));
            }
          }

          const lhs = _babelCore.types.ObjectPattern(lhsPatterns);

          this.bindConst(lhs, id);

          for (let i = 0; i < pattern.properties.length; ++i) {
            const subId = propertyIds[i];
            const property = pattern.properties[i];
            this.failIf(exprT`SUBID === void 0`({
              SUBID: subId
            }));
            const subPattern = _babelCore.types.isMatchRestElement(property) ? property.body : property.element || property.key;
            this.translatePattern(subPattern, subId);
          }

          return;
        }

      case "ArrayMatchPattern":
        {
          this.failIf(exprT`!Array.isArray(ID)`({
            ID: id
          }));
          const {
            elements
          } = pattern;

          if (elements.slice(0, -1).some(elt => elt.type === "MatchRestElement")) {
            throw this.buildError(pattern, "rest-pattern before end of array pattern");
          }

          const haveRest = elements.length > 0 && elements[elements.length - 1].type === "MatchRestElement";
          const numElements = elements.length - (haveRest ? 1 : 0);

          if (!haveRest || numElements > 0) {
            this.failIf(_babelCore.types.binaryExpression(haveRest ? "<" : "!==", _babelCore.types.memberExpression(id, _babelCore.types.identifier("length")), _babelCore.types.numericLiteral(numElements)));
          }

          elements.slice(0, numElements).forEach((element, index) => {
            const subId = scope.generateUidIdentifier(index);
            this.bindConst(subId, exprT`ID[INDEX]`({
              ID: id,
              INDEX: _babelCore.types.numericLiteral(index)
            }));
            this.failIf(exprT`typeof SUBID === "undefined"`({
              SUBID: subId
            }));
            this.translatePattern(element, subId);
          });

          if (haveRest) {
            const subId = scope.generateUidIdentifier("rest");
            this.bindConst(subId, exprT`ID.slice(START)`({
              ID: id,
              START: _babelCore.types.numericLiteral(numElements)
            }));
            this.translatePattern(elements[elements.length - 1].body, subId);
          }

          return;
        }

      case "RegExpLiteral":
      default:
        throw this.buildError(pattern, "Bad expression in pattern");
    }
  }

}

var _default = (0, _helperPluginUtils.declare)(api => {
  api.assertVersion(7);
  const caseVisitor = {
    CaseStatement(path) {
      const {
        scope
      } = path;
      const outerLabel = scope.generateUidIdentifier("caseOuter");
      const rewriter = new WhenRewriter({
        scope,
        outerLabel
      });
      const stmts = [];
      const {
        discriminant,
        cases
      } = path.node;
      const discriminantId = scope.generateUidIdentifier("caseVal");
      stmts.push(constStatement(discriminantId, discriminant));

      for (const whenNode of cases) {
        stmts.push(rewriter.translate(whenNode, discriminantId));
      }

      path.replaceWith(_babelCore.types.labeledStatement(outerLabel, _babelCore.types.blockStatement(stmts)));
    }

  };
  return {
    name: "proposal-pattern-matching",
    inherits: _pluginSyntaxPatternMatching.default,
    visitor: caseVisitor
  };
});

exports.default = _default;