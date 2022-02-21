import { op1 } from "./type-driven-overloads/op1.js";
import { op2 } from "./type-driven-overloads/op2.js";
import { T } from "./type-driven-overloads/T.js";

T.make("A").op("A")
T.make(1).op(0);

pipe(
  T.make(1),
  op1("A")
)

pipe(
  T.make("A"),
  op2(1)
)