import { types as tt } from "../tokenizer/types";

export default superClass =>
  class extends superClass {
    // Parse list of class variable and instance variable declarators
    // Adapted from parseVar()
    /* eslint-disable */
    parseClassAndInstanceVarDeclarators(
      node /*: N.VariableDeclaration*/,
      kind /*: TokenType*/,
    ) /*: N.VariableDeclaration*/ {
      /* eslint-enable */
      this.expectPlugin("classMembers");
      const declarations = (node.declarations = []);
      // $FlowFixMe
      node.kind = kind.keyword;
      let isStatic = false;
      if (this.state.value === "static") {
        isStatic = true;
        this.parseIdentifier(true); // eats 'static'
      }
      for (;;) {
        const decl = this.startNode();
        this.parseClassOrInstanceVarHead(decl, isStatic);
        if (this.eat(tt.eq)) {
          decl.init = this.parseMaybeAssign(false);
        } else {
          if (kind === tt._const) {
            this.unexpected();
            // // `const` with no initializer is allowed in TypeScript.
            // // It could be a declaration like `const x: number;`.
            // if (!this.hasPlugin("typescript")) {
            //   this.unexpected();
            // }
          } else if (decl.id.type !== "Identifier") {
            this.unexpected();
          }
          decl.init = null;
        }
        declarations.push(
          isStatic
            ? this.parseClassVariable(decl)
            : this.parseInstanceVariable(decl),
        );
        if (!this.eat(tt.comma)) break;
      }
      this.semicolon();
      return this.finishNode(
        node,
        isStatic
          ? "ClassVariableDeclaration"
          : "ClassInstanceVariableDeclaration",
      );
    }

    parseClassOrInstanceVarHead(decl, isStatic) {
      decl.id = this.parseBindingAtom();
      this.checkLVal(
        decl.id,
        true,
        undefined,
        `${
          isStatic ? "class variable" : "class instance variable"
        } declaration`,
      );
    }

    parseInstanceVariable(node) {
      if (
        !node.computed &&
        !node.static &&
        (node.id.name === "constructor" || // Identifier
          node.id.value === "constructor") // String literal
      ) {
        this.raise(
          node.id.start,
          "Classes may not have an instance variable named 'constructor'",
        );
      }
      return this.finishNode(node, "ClassInstanceVariableDeclarator");
    }

    parseClassVariable(node) {
      if (
        !node.computed &&
        !node.static &&
        (node.id.name === "constructor" || // Identifier
          node.id.value === "constructor") // String literal
      ) {
        this.raise(
          node.id.start,
          "Classes may not have a private class variable named 'constructor'",
        );
      }
      return this.finishNode(node, "VariableDeclarator");
    }

    parseInstanceVariableName() {
      const node = this.startNode();
      node.id = this.parseIdentifier(true);
      return this.finishNode(node, "InstanceVariableName");
    }

    // ==================================
    // Overrides
    // ==================================

    parseClassMember(classBody, member, state) {
      // console.log('this.state.type', this.state.type);
      const { type } = this.state;
      if (type === tt._let || type === tt._const) {
        const node = this.startNode();
        this.next();
        // eats 'let' or 'const'
        this.parseClassAndInstanceVarDeclarators(node, type);

        classBody.body.push(node);
        return;
      } else if (type === tt._var) {
        this.unexpected();
      }
      return super.parseClassMember(classBody, member, state);
    }

    /* eslint-disable */
    parseSubscript(
      base,
      startPos,
      startLoc,
      noCalls,
      state,
    ) {
    /* eslint-enable */
      if (this.eat(tt.doubleColon)) {
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

    // parse public property
    parseClassProperty(node) {
      if (!node.typeAnnotation) {
        this.expectPlugin("classMembers");
      }

      const oldInMethod = this.state.inMethod;
      this.state.inMethod = false;
      this.state.inClassProperty = true;

      if (this.match(tt.eq)) {
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
