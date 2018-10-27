import { types as tt } from "../tokenizer/types";

export default superClass =>
  class extends superClass {
    parseClassInstanceVariable(node) {
      this.expectPlugin("classes1.1");
      // This only affects properties, not methods.
      if (this.isNonstaticConstructor(node)) {
        this.raise(
          node.key.start,
          "Classes may not have an instance variable named 'constructor'",
        );
      }
      return this.finishNode(node, "ClassInstanceVariableDeclarator");
    }

    // ==================================
    // Overrides
    // ==================================

    parseClassMember(classBody, member, state) {
      // console.log('this.state.type', this.state.type);
      if (this.match(tt._var)) {
        // parseVarStatement() does almost exactly what we want, so call it first
        // and then modify the result...
        const node = this.startNode();
        this.parseVarStatement(node, this.state.type); // eats 'var'
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
      if (this.eat(tt.thinArrow)) {
        const node = this.startNodeAt(startPos, startLoc);
        node.object = base;
        node.property = this.parseIdentifier(true);
        node.computed = false;
        if (state.optionalChainMember) {
          node.optional = false;
          return this.finishNode(node, "OptionalMemberExpression");
        }
        return this.finishNode(node, "MemberExpression");
      }
      return super.parseSubscript(base, startPos, startLoc, noCalls, state);
    }
  };
