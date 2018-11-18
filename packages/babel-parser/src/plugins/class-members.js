import { types as tt } from "../tokenizer/types";

export default superClass =>
  class extends superClass {
    parseClassInstanceVariable(node) {
      this.expectPlugin("classMembers");
      // This only affects properties, not methods.
      if (this.isNonstaticConstructor(node)) {
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
      if (type === tt._var || type === tt._let || type === tt._const) {
        // parseVarStatement() does almost exactly what we want, so call it first
        // and then modify the result...
        const node = this.startNode();
        this.parseVarStatement(node, this.state.type); // eats let' or 'const'
        if (node.kind !== "let" && node.kind !== "const") {
          this.unexpected();
        }
        node.type = "ClassInstanceVariableDeclaration";

        node.declarations = node.declarations.map(({ id, ...decl }) => {
          const instanceVar = {
            ...decl,
            key: id,
          };
          this.parseClassInstanceVariable(instanceVar);
          return instanceVar;
        });

        classBody.body.push(node);
        return;
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
