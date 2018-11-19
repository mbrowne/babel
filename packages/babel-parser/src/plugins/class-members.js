import { types as tt } from "../tokenizer/types";

export default superClass =>
  class extends superClass {
    // Parse list of instance variable declarators
    // Adapted from parseVar()
    /* eslint-disable */
    parseInstanceVariableDeclarators(
      node /*: N.VariableDeclaration*/,
      kind /*: TokenType*/,
    ) /*: N.VariableDeclaration*/ {
      /* eslint-enable */
      const declarations = (node.declarations = []);
      // $FlowFixMe
      node.kind = kind.keyword;
      for (;;) {
        const decl = this.startNode();
        this.parseInstanceVarHead(decl);
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
          } else if (decl.key.type !== "Identifier") {
            this.unexpected();
          }
          decl.init = null;
        }
        declarations.push(this.parseInstanceVariable(decl));
        if (!this.eat(tt.comma)) break;
      }
      return node;
    }

    parseInstanceVarHead(decl) {
      let isStatic = false;
      if (this.state.value === "static") {
        isStatic = true;
        decl.key = this.parseIdentifier(true); // eats 'static'
      }
      decl.key = this.parseBindingAtom();
      decl.static = isStatic;
      this.checkLVal(
        decl.key,
        true,
        undefined,
        "class instance variable declaration",
      );
    }

    parseInstanceVariable(node) {
      this.expectPlugin("classMembers");
      if (
        !node.computed &&
        !node.static &&
        (node.key.name === "constructor" || // Identifier
          node.key.value === "constructor") // String literal
      ) {
        this.raise(
          node.key.start,
          "Classes may not have an instance variable named 'constructor'",
        );
      }
      return this.finishNode(node, "ClassInstanceVariableDeclarator");
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
        this.parseInstanceVariableDeclarators(node, type);
        this.semicolon();
        this.finishNode(node, "ClassInstanceVariableDeclaration");

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
