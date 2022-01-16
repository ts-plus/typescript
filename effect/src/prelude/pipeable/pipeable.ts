import { bind_ } from "../operations/bind";
import { chain_ } from "../operations/flatMap";

export const chain = Pipeable(chain_);

export const bind = Pipeable(bind_);
