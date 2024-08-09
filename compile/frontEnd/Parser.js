import { TokenTag, ExprTag } from "../utils/Enums.js";
import {
  Token,
  NumericLiteral,
  SelectorLiteral,
  StringLiteral,
  VaniCmdLiteral,
  Word,
  Type,
  ExecuteSubcommand
} from "./Token.js";
import { Lexer } from "./Lexer.js";
import {
  ASTNode,
  Stmt,
  If,
  Else,
  While,
  Do,
  Seq,
  Break,
  DelayH,
  Delete,
  ExecuteStmt,
  Expr,
  Reference,
  Id,
  Temp,
  Op,
  Arith,
  GetScore,
  Unary,
  Constant,
  AssignExpr,
  CompoundAssignExpr,
  Prefix,
  Postfix,
  Selector,
  Logical,
  Or,
  And,
  Not,
  Rel,
  VanillaCmdNoTag,
  VanillaCmdTag
} from "./SyntaxTree.js";
import { EntityLayer, SymbolTable } from "../utils/Env.js";
import {
  TAC,
  TACAssign,
  TACBaseBlock,
  TACDelayH,
  TACGoto,
  TACInst,
  TACLabel,
  TACVanilla
} from "../backEnd/TAC.js";
import { CompileContext } from "../utils/Context.js";
import { CompileError, SimpleCompileErrorType, DynamicCompileErrorType } from "../utils/CompileErrors.js";

class Parser {
  constructor(str) {
    this.input = str.replace(/\r\n?/g, "\n"); // Normalize line feeding
    this.lexer = new Lexer(this.input);
    this.look = null; // Lexer unit
    this.used = 0; // Uid of variable
    this.top = new SymbolTable(null); // Current symbol table
    this.topEL = EntityLayer.Initial;
    this.done = !1;
    this.result = "";
    this.resultObj = void 0;
    this.modules = [];
    this.context = null;
    this.move();
  }

  appendTAC(a) { this.resultObj.push(a) }

  move() {
    var r = this.lexer.scan();
    this.look = r.token;
    this.look.context = new CompileContext(this.input, r.range, this.lexer, this);
  }

  error(s, ...arg) { throw s.createWithContext(this.look.context, ...arg) }

  errorUnexp(t) { this.error(CompileError.BuiltIn.unexpectedToken, t ? t : this.look + '') }

  match(t) {
    if (this.look.tag == t) this.move();
    else this.errorUnexp();
  }

  test(t) {
    for (var e of t)
      if (e == this.look.tag)
        return true;
    return false
  }

  /**
   * CBLDL Program
   */
  Program() {
    if (this.done) return;
    while (this.look.tag == TokenTag.BASIC)
      this.VariableStatement(true);

    while (this.look.tag != TokenTag.EOF) {
      var s = this.Module()
        , begin = s.newlabel()
        , after = s.newlabel();
      s.emitlabel(begin);
      s.gen(begin, after, EntityLayer.Initial);
      s.emitlabel(after);
      // Remove unused label and
      // Cut into base blocks
      var r = new TAC(this.resultObj.mode), c = 1, d = 0, e = 0, f = null;
      // c: label counter, d: baseblock counter, 
      // e: counter of inst except label in current bb
      // f: current bb's first label
      for (var a of this.resultObj) {
        var rd = (r[d] ? r[d] : (r[d] = new TACBaseBlock(d)));
        if (a.type == "delayh")
          r.totalDelay += a.delay;
        if (a.type == "label")
          /* If label is used */
          a.onUse.length && (
            (e ? (
              /* And if this isn't a new baseblock */
              /* i.e. there's other inst except label */
              a.label = c++, e = 0, a.baseblock = r[++d] = new TACBaseBlock(d)
              /* Then create a new baseblock */
              /* And push this label in it */
            ).push(a) : (
              /* If this is a new baseblock */
              /* i.e. no inst except label */
              a.label = c++, (a.baseblock = rd).push(a)
              /* Just add the label into the baseblock */
            ))
          );
        else if (a.type == "if" || a.type == "iffalse" || a.type == "goto") rd.push(a), d++, e = 0, f = null;
        else rd.push(a), e++, f = null;
      }
      this.modules.push(r);
    }

    this.done = true;
  }

  /**
   * Single module
   * @returns {Stmt}
   */
  Module() {
    switch (this.look.tag) {
      case TokenTag.CHAIN:
        this.move();
        if (this.look.tag == TokenTag.PULSE) {
          // <ChainPulseModule> : chain pulse <Block>
          this.move();
          this.resultObj = new TAC(TAC.Mode.CP);
          return this.Block(TAC.Mode.CP);
        } else if (this.look.tag == TokenTag.REPEATING) {
          // <ChainRepeatingModule> : chain repeating <Block>
          this.move();
          this.resultObj = new TAC(TAC.Mode.CR);
          return this.Block(TAC.Mode.CR);
        } else if (this.look.tag == "{") {
          // <ChainPulseModule> : chain <Block>
          this.resultObj = new TAC(TAC.Mode.CP);
          return this.Block(TAC.Mode.CP);
        } else
          this.errorUnexp();

      case TokenTag.MODULE:
        // <CombinedModule> : module <BlockNoDelayHard>
        this.move();
        if (this.look.tag == "{") {
          this.resultObj = new TAC(TAC.Mode.M);
          return this.Block(TAC.Mode.M);
        } else
          this.errorUnexp();

      default:
        this.errorUnexp();
    }
  }

  /**
   * Variable or constant declaration statement
   * @param {Boolean} toplevel - Top level declarations, only constant or variable without init
   * @returns {Stmt}
   */
  VariableStatement(toplevel) {
    // <VariableStatement> : <VariableTypes> <VariableDeclarationList> ;
    var p = this.VariableTypes(), s;
    s = this.VariableDeclarationList(p, toplevel);
    this.match(";");
    return s
  }

  /**
   * Variable or constant declaration list
   * @param {Type} p - Identifier type
   * @param {Boolean} toplevel - True if top level declarations, only constant or variable without init
   * @returns {Stmt}
   */
  VariableDeclarationList(p, toplevel) {
    // <VariableDeclarationList> : <VariableDeclarationList> , <VariableDeclaration>
    // <VariableDeclarationList> : <VariableDeclaration>
    var tok = this.look, id, s, expr;
    this.match(TokenTag.ID);
    id = new Id(tok.context, tok, void 0, this.used, p.isConst());
    this.top.put(tok, id);
    this.used++;

    // <VariableDeclaration> : <Identifier>
    if (this.test([",", ";"])) {
      if (p.isConst())
        this.error(CompileError.BuiltIn.missingInitializer);
      id.setType(Type.Int);
      s = toplevel ? Stmt.Null : new AssignExpr(tok.context, id, Constant.from(0));
      return this.look == ';' ? s : (this.move(), new Seq(this.look.context, s, this.VariableDeclarationList(p, toplevel)));
    }

    // <VariableDeclaration> : <Identifier> <Initialiser>
    if (toplevel && this.test(["="]) && !p.isConst())
      this.error(CompileError.BuiltIn.invalidInitializer);

    // <Initialiser> : = <AssignmentExpression>
    this.match("=");

    expr = this.AssignmentExpression();
    if (p.isConst())
      id.setValue(expr), s = Stmt.Null;
    else {
      if (expr.type == Type.Bool || expr.type == Type.Int)
        id.setType(expr.type), s = new AssignExpr(tok.context, id, expr);
      else
        id.setType(Type.Int), s = new AssignExpr(tok.context, id, expr);
    }

    if (this.test([",", ";"]))
      return this.look == ';' ? s : (this.move(), new Seq(this.look.context, s, this.VariableDeclarationList(p, toplevel)));

    this.errorUnexp();
  }

  /**
   * Declaration type
   * @returns {Type}
   */
  VariableTypes() {
    // <VariableTypes> : var
    // <VariableTypes> : const
    var p = this.look;
    this.match(TokenTag.BASIC);
    return p;
  }

  /**
   * Block statement
   * @param {Number} m - Block type
   * @returns {Stmt}
   */
  Block(m) {
    // <Block> : { <StatementList> }
    // <Block> : { }
    this.match("{");
    var savedSymbolTable = this.top;
    this.top = new SymbolTable(this.top);
    var s = this.Stmts(m);
    this.match("}");
    this.top = savedSymbolTable;
    return s
  }

  /**
   * Statement
   * @param {Number} m - Block type
   * @returns {Stmt}
   */
  Stmts(m) {
    // <StatementList> :
    //   <Statement>
    //   <StatementList> <Statement>
    var f = [this.CPStmt, this.CPStmt, this.MStmt];
    if (this.look.tag == '}') return Stmt.Null;
    else if (this.look.tag == TokenTag.EOF) return Stmt.Null;
    else return new Seq(this.look.context, f[m].call(this), this.Stmts(m))
  }

  /** 
   * Single statement
   * @returns {Stmt}
   */
  CPStmt() {
    // <ChainStatement>
    var x, s1, s2, savedEL, tok;
    switch (this.look.tag) {
      case ';':
        // <EmptyStatement> : ;
        this.move();
        return Stmt.Null;

      case TokenTag.IF:
        // <IfStatement> : if ( <Expression> ) <Statement>
        tok = this.look;
        this.match(TokenTag.IF), this.match("("), x = this.AssignmentExpression(), this.match(")");
        s1 = this.CPStmt();
        if (this.look.tag != TokenTag.ELSE) return new If(tok.context, x, s1);
        // <IfStatement> : if ( <Expression> ) <Statement> else <Statement>
        tok = this.look;
        this.match(TokenTag.ELSE);
        s2 = this.CPStmt();
        return new Else(tok.context, x, s1, s2);

      case TokenTag.EXECUTE:
        tok = this.look;
        this.match(TokenTag.EXECUTE);
        savedEL = this.topEL;
        this.match('(');
        this.topEL = this.executeSubcommands();
        this.match(')');
        s1 = new ExecuteStmt(tok.context, this.topEL, this.CPStmt());
        this.topEL = savedEL;
        return s1

      case "{":
        // <Block> : { [<StatementList>] }
        return this.Block(TAC.Mode.CP);

      case TokenTag.BASIC:
        // <VariableStatement> : <VariableTypes> <VariableDeclarationList> ;
        return this.VariableStatement();

      case TokenTag.VANICMD:
      case TokenTag.ID:
      case TokenTag.VANICMDHEAD:
      case TokenTag.NUM:
      case TokenTag.STRING:
      case TokenTag.SELECTOR:
      case "++":
      case "--":
      case '(':
        x = this.AssignmentExpression();
        // <ExecuteStatement> : <PrimaryExpression> => <Statement>
        if (this.look.tag == TokenTag.AE) {
          tok = this.look;
          this.match(TokenTag.AE);
          savedEL = this.topEL;
          this.topEL = ExecuteStmt.createArrowExecuteEL(x, this.topEL);
          s1 = new ExecuteStmt(tok.context, this.topEL, this.CPStmt());
          this.topEL = savedEL;
          return s1;
        } else
          // <ExpressionStatement> : <Expression> ;
          this.match(';');
        return x;

      case TokenTag.INITIAL:
        // <ExecuteStatement> : <PrimaryExpression> => <Statement>
        this.move();
        tok = this.look;
        this.match(TokenTag.AE);
        savedEL = this.topEL;
        this.topEL = EntityLayer.Initial;
        s1 = new ExecuteStmt(tok.context, this.topEL, this.CPStmt());
        this.topEL = savedEL;
        return s1;

      case TokenTag.DELAYH:
        // <DelayHardStatement> : <PrimaryExpression>
        tok = this.look;
        this.move();
        x = this.PrimaryExpression();
        this.match(";");
        return new DelayH(tok.context, x);

      case TokenTag.DELETE:
        this.move();
        x = this.GetScoreExpression();
        tok = this.look;
        this.match(";");
        return new Delete(tok.context, x);

      default:
        this.errorUnexp()
    }
  }

  /** StatementNoDelayH */
  MStmt() {
    var x, s1, s2, savedStmt;
    switch (this.look.tag) {
      case ';':
        this.move();
        return Stmt.Null;
      case TokenTag.IF:
        this.match(TokenTag.IF), this.match("("), x = this.AssignmentExpression(), this.match(")");
        s1 = this.MStmt();
        if (this.look.tag != TokenTag.ELSE) return new If(x, s1);
        this.match(TokenTag.ELSE);
        s2 = this.MStmt();
        return new Else(x, s1, s2);
      case TokenTag.WHILE:
        var whilenode = new While();
        savedStmt = Stmt.Enclosing, Stmt.Enclosing = whilenode;
        this.match(TokenTag.WHILE), this.match("("), x = this.AssignmentExpression(), this.match(")");
        s1 = this.MStmt();
        whilenode.init(x, s1);
        Stmt.Enclosing = savedStmt;
        return whilenode;
      case TokenTag.DO:
        var donode = new Do();
        savedStmt = Stmt.Enclosing, Stmt.Enclosing = donode;
        this.match(TokenTag.DO);
        s1 = this.MStmt();
        this.match(TokenTag.WHILE), this.match("("), x = this.AssignmentExpression(), this.match(")"), this.match(";");
        donode.init(s1, x);
        Stmt.Enclosing = savedStmt;
        return donode;
      case TokenTag.BREAK:
        this.match(TokenTag.BREAK), this.match(";");
        return new Break();
      case "{":
        return this.MBlock();
      case TokenTag.BASIC:
        return this.VariableStatement();
      case TokenTag.VANICMD: case TokenTag.VANICMDHEAD: case TokenTag.ID: case TokenTag.NUM: case TokenTag.STRING: case TokenTag.SELECTOR: case "++": case "--":
        x = this.AssignmentExpression();
        this.match(';');
        return x;
      default:
        this.errorUnexp()
    }
  }

  /**
   * Assignment expression
   * @returns {Expr}
   */
  AssignmentExpression() {
    // <AssignmentExpression> : 
    //   <LogicalORExpression>
    //   <LeftHandSideExpression> <AssignmentOperator> <AssignmentExpression>
    var x = this.LogicalORExpression(), tok = this.look;
    switch (tok.tag) {
      case "=":
        if (x.tag != ExprTag.REF && x.tag != ExprTag.GS)
          this.error(CompileError.BuiltIn.invalidAssign);
        this.match("=");
        return new AssignExpr(tok.context, x, this.AssignmentExpression());
      case "*=": case "/=": case "%=":
        if (x.tag != ExprTag.REF && x.tag != ExprTag.GS)
          this.error(CompileError.BuiltIn.invalidAssign);
      case "+=": case "-=":
        if (x.tag != ExprTag.ID && x.tag != ExprTag.GS && x.tag != ExprTag.SELECTOR)
          this.error(CompileError.BuiltIn.invalidAssign);
        this.move();
        return new CompoundAssignExpr(tok.context, x, this.AssignmentExpression(), tok);
      default:
        return x;
    }
  }

  /**
   * Logical or expression
   * @returns {Expr}
   */
  LogicalORExpression() {
    // <LogicalORExpression> :
    //   <LogicalANDExpression>
    //   <LogicalORExpression> || <LogicalANDExpression>
    var x = this.LogicalANDExpression(), tok;
    while (this.test([TokenTag.OR]))
      tok = this.look, this.move(), x = new Or(tok.context, tok, x, this.LogicalANDExpression());
    return x
  }

  /**
   * Logical and expression
   * @returns {Expr}
   */
  LogicalANDExpression() {
    // <LogicalANDExpression> :
    //   <EqualityExpression>
    //   <LogicalANDExpression> && <EqualityExpression>
    var x = this.EqualityExpression(), tok;
    while (this.test([TokenTag.AND]))
      tok = this.look, this.move(), x = new And(tok.context, tok, x, this.EqualityExpression());
    return x
  }

  /**
   * Equality expression
   * @returns {Expr}
   */
  EqualityExpression() {
    var x = this.RelationalExpression(), tok;
    while (this.test([TokenTag.EQ, TokenTag.NE])) {
      tok = this.look, this.move();
      // Change != to ==
      x = tok.tag == TokenTag.NE ?
        new Not(tok.context, new Rel(tok.context, Word.eq, x, this.RelationalExpression()))
        : new Rel(tok.context, Word.eq, x, this.RelationalExpression());
    }
    return x
  }

  /**
   * Relational expression
   * @returns {Expr}
   */
  RelationalExpression() {
    var x = this.AdditiveExpression(), tok;
    if (this.test(['<', TokenTag.LE, TokenTag.GE, '>']))
      tok = this.look, this.move(), x = new Rel(tok.context, tok, x, this.AdditiveExpression());
    return x
  }

  /**
   * Additive expression
   * @returns {Expr}
   */
  AdditiveExpression() {
    // <AdditiveExpression> :
    //   <MultiplicativeExpression>
    //   <AdditiveExpression> + <MultiplicativeExpression>
    //   <AdditiveExpression> - <MultiplicativeExpression>
    var x = this.MultiplicativeExpression(), tok;
    while (this.test(["+", "-"]))
      tok = this.look, this.move(), x = new Arith(tok.context, tok, x, this.MultiplicativeExpression());
    return x
  }

  /**
   * Multiplicative expression
   * @returns {Expr}
   */
  MultiplicativeExpression() {
    // <MultiplicativeExpression> :
    //   <UnaryExpression>
    //   <MultiplicativeExpression> * <UnaryExpression>
    //   <MultiplicativeExpression> / <UnaryExpression>
    //   <MultiplicativeExpression> % <UnaryExpression></UnaryExpression>
    var x = this.UnaryExpression(), tok;
    while (this.test(["*", "/", "%"]))
      tok = this.look, this.move(), x = new Arith(tok.context, tok, x, this.UnaryExpression());
    return x
  }

  /**
   * Unary expression
   * @returns {Expr}
   */
  UnaryExpression() {
    var tok = this.look;
    if (this.test(["-"])) {
      // <UnaryExpression> : - <UnaryExpression>
      this.move(); return new Unary(tok.context, Word.minus, this.UnaryExpression())
    } else if (this.test(["+"])) {
      // <UnaryExpression> : + <UnaryExpression>
      this.move(); return this.UnaryExpression()
    } else if (this.test(["!"])) {
      // <UnaryExpression> : ! <UnaryExpression>
      this.move(); return new Not(tok.context, tok, this.UnaryExpression())
    } else if (this.test(["++", "--"])) {
      // <UnaryExpression> : 
      //   ++ <UnaryExpression>
      //   -- <UnaryExpression>
      this.move();
      if (this.test([TokenTag.ID]))
        return new Prefix(tok.context, this.UnaryExpression(), tok);
      else
        this.error(CompileError.BuiltIn.invalidPrefix);
    } else
      // <UnaryExpression> : - <PostfixExpression>
      return this.PostfixExpression();
  }

  /**
   * Postfix expression
   * @returns {Expr}
   */
  PostfixExpression() {
    var x = this.GetScoreExpression(), tok;
    if (this.test(["++", "--"])) {
      // <PostfixExpression> : 
      //   <LeftHandSideExpression> ++
      //   <LeftHandSideExpression> --
      tok = this.look; this.move();
      if (x.op.tag == TokenTag.ID || x.op.tag == TokenTag.GS)
        return new Postfix(tok.context, x, tok);
      else
        this.error(CompileError.BuiltIn.invalidPostfix);
    } else
      // <PostfixExpression> : <LeftHandSideExpression>
      return x;
  }

  /**
   * Get score expression
   * @returns {Expr}
   */
  GetScoreExpression() {
    var x = this.PrimaryExpression(), t, tok;
    if (this.test([TokenTag.GS])) {
      // <GetScoreExpression> : <PrimaryExpression> -> <PrimaryExpression>
      tok = this.look
      this.move();
      return new GetScore(tok.context, Word.gs, x, this.PrimaryExpression())
    } else if (this.test(["."])) {
      // <GetScoreExpression> : <PrimaryExpression> . <Identifier>
      tok = this.look
      this.move();
      if (this.test([TokenTag.ID])) {
        t = this.look.toString();
        this.move();
        return new GetScore(tok.context, Word.gs, x, Constant.from(t, Type.String))
      } else this.errorUnexp()
    } else
      // <GetScoreExpression> : <PrimaryExpression>
      return x
  }

  /**
   * Primary expression
   * @param {Boolean} c - Read id as literal if true
   * @returns {Expr}
   */
  PrimaryExpression(c) {
    var x = void 0;
    switch (this.look.tag) {
      // <PrimaryExpression> : ( <Expression> )
      case '(':
        this.move(), x = this.AssignmentExpression(), this.match(')');
        return x;

      // <PrimaryExpression> : <Literal>
      case TokenTag.NUM:
        x = new Constant(this.look.context, this.look, this.look.isInteger() ? Type.Int : Type.Float);
        this.move();
        return x;
      case TokenTag.TRUE:
        x = Constant.True;
        this.move();
        return x;
      case TokenTag.FALSE:
        x = Constant.False;
        this.move();
        return x;
      case TokenTag.VANICMD:
        x = this.look;
        this.move();
        return new VanillaCmdNoTag(x.context, x);
      case TokenTag.VANICMDHEAD:
        x = this.look;
        this.move();
        return new VanillaCmdTag(x.context, void 0, x, this.VanillaCommandWithTag());
      case TokenTag.STRING:
        x = this.look;
        this.move();
        return new Constant(x.context, x, Type.String);
      case TokenTag.SELECTOR:
        x = this.look;
        this.move();
        return new Selector(x.context, x);

      // <PrimaryExpression> : <Identifier>
      case TokenTag.ID:
        x = this.look.toString();
        if (c) { this.move(); return this.look; }
        var id = this.top.get(this.look);
        if (id == void 0)
          this.error(CompileError.BuiltIn.notDeclared, x)
        this.move();
        return id;

      default:
        this.errorUnexp();
    }
  }

  VanillaCommandWithTag() {
    var x = this.AssignmentExpression(), t = this.look;
    this.move();
    if (t.tag == TokenTag.VANICMDBODY)
      return new VanillaCmdTag(t.context, x, t, this.VanillaCommandWithTag());
    if (t.tag == TokenTag.VANICMDTAIL)
      return new VanillaCmdTag(t.context, x, t, void 0);
    this.errorUnexp();
  }

  executeSubcommands() {
    var t1 = this.look, t2 = this.topEL;
    while (this.look.tag !== ")") {
      this.match(TokenTag.ID);
      switch (t1.type) {
        case EntityLayer.Type.AS:
        case EntityLayer.Type.AT:
        case EntityLayer.Type.ANCHORED:
        case EntityLayer.Type.ALIGN:
        case EntityLayer.Type.IN:
          t2 = this.executeSimplePayload(t2, t1.type);
          break;
        default:
          this.errorUnexp();
      }
      this.move();
    }
    return t2
  }

  /** 
   * Parses subcommand with single param: 
   * 
   * Subcomands: as at anchored align in
   */
  executeSimplePayload(prev, type) { return new EntityLayer(prev, type, this.look) }

  executeFacing() { }

  executeCondition() { }
}

export { Parser };