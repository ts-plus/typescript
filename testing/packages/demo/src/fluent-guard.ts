interface A {
  _tag: "A";
  a: number;
}
interface B {
  _tag: "B";
  b: string;
}
interface C {
  _tag: "C";
  c: symbol;
}
type ADT = A | B | C;

function adt(): ADT {
  return {
    _tag: "A",
    a: 0,
  };
}

declare const either: Either<string, number>;

if (either.isLeft()) {
  const x: string = either.left;
  console.log(x);
}

if (either.isRight()) {
  const x: number = either.right;
  console.log(x);
}

const matchEval = Match.tag(adt(), {
  A: (_) => Eval.succeed(_),
  B: (_) => Eval.succeed(_),
  C: (_) => Eval.succeed(_),
});

const result = matchEval.run;
