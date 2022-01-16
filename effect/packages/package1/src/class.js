import * as tsplus_module_1 from "@tsplus-test/package1/class";
/**
 * @tsplus type IO
 * @tsplus companion IOOps
 */
export class IO {
    constructor(io) {
        this.io = io;
    }
}
/**
 * @tsplus static IOOps __call
 */
export function applyIO(f) {
    return new IO(f);
}
/**
 * @tsplus fluent IO map
 */
export function map(self, f) {
    return new IO(() => f(self.io()));
}
tsplus_module_1.map(new IO(() => 0), (n) => n + 1);
export class ExtendedIO extends IO {
    constructor(io) {
        super(io);
    }
}
