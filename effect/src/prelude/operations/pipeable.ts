import { bind_ } from "./bind";
import { chain_ } from "./flatMap";

export const chain = Pipeable(chain_);

export const bind = Pipeable(bind_);
