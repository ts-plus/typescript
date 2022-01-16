import { constant } from "@tsplus/stdlib/data/Function";

Maybe.some('foo').fold(constant('good-bye'),  identity)
Maybe.some('foo').fold('good-bye',  identity)
