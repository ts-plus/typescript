export interface Service {
    (): void
}

/**
 * @tsplus type TargetOps
 */
export interface Ops {}

export const target: Ops = {}

/**
 * @tsplus static TargetOps Service
 */
export declare const Service: Service

export const t = target.Service