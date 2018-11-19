"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _types = require("../tokenizer/types");

var _default = superClass => class extends superClass {
  parseInstanceVariableDeclarators(node, kind) {
    const declarations = node.declarations = [];
    node.kind = kind.keyword;

    for (;;) {
      const decl = this.startNode();
      this.parseInstanceVarHead(decl);

      if (this.eat(_types.types.eq)) {
        decl.init = this.parseMaybeAssign(false);
      } else {
        if (kind === _types.types._const) {
          this.unexpected();
        } else if (decl.key.type !== "Identifier") {
          this.unexpected();
        }

        decl.init = null;
      }

      declarations.push(this.parseInstanceVariable(decl));
      if (!this.eat(_types.types.comma)) break;
    }

    return node;
  }

  parseInstanceVarHead(decl) {
    let isStatic = false;

    if (this.state.value === "static") {
      isStatic = true;
      decl.key = this.parseIdentifier(true);
    }

    decl.key = this.parseBindingAtom();
    decl.static = isStatic;
    this.checkLVal(decl.key, true, undefined, "class instance variable declaration");
  }

  parseInstanceVariable(node) {
    this.expectPlugin("classMembers");

    if (!node.computed && !node.static && (node.key.name === "constructor" || node.key.value === "constructor")) {
        this.raise(node.key.start, "Classes may not have an instance variable named 'constructor'");
      }

    return this.finishNode(node, "ClassInstanceVariableDeclarator");
  }

  parseInstanceVariableName() {
    const node = this.startNode();
    node.id = this.parseIdentifier(true);
    return this.finishNode(node, "InstanceVariableName");
  }

  parseClassMember(classBody, member, state) {
    const {
      type
    } = this.state;

    if (type === _types.types._let || type === _types.types._const) {
      const node = this.startNode();
      this.next();
      this.parseInstanceVariableDeclarators(node, type);
      this.semicolon();
      this.finishNode(node, "ClassInstanceVariableDeclaration");
      classBody.body.push(node);
      return;
    } else if (type === _types.types._var) {
      this.unexpected();
    }

    return super.parseClassMember(classBody, member, state);
  }

  parseSubscript(base, startPos, startLoc, noCalls, state) {
    if (this.eat(_types.types.doubleColon)) {
      const node = this.startNodeAt(startPos, startLoc);
      node.object = base;
      node.property = this.parseInstanceVariableName();
      node.computed = false;

      if (state.optionalChainMember) {
        node.optional = false;
        return this.finishNode(node, "OptionalMemberExpression");
      }

      return this.finishNode(node, "MemberExpression");
    }

    return super.parseSubscript(base, startPos, startLoc, noCalls, state);
  }

  parseClassProperty(node) {
    if (!node.typeAnnotation) {
      this.expectPlugin("classMembers");
    }

    const oldInMethod = this.state.inMethod;
    this.state.inMethod = false;
    this.state.inClassProperty = true;

    if (this.match(_types.types.eq)) {
      this.expectPlugin("classMembers");
      this.next();
      node.value = this.parseMaybeAssign();
    } else {
      node.value = null;
    }

    this.semicolon();
    this.state.inClassProperty = false;
    this.state.inMethod = oldInMethod;
    return this.finishNode(node, "ClassProperty");
  }

};

exports.default = _default;