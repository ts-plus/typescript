/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */



/// <reference no-default-lib="true"/>


/// <reference lib="es5" />

declare type PipeableShift<A extends any[]> = A extends [infer X, ...infer Rest] ? Rest : never
declare type PipeableFirst<A extends any[]> = A extends [infer X, ...infer Rest] ? X : never

/**
 * @tsplus macro pipeable
 */
declare function Pipeable<F extends (self: any, ...rest: any) => any>(f: F): (...rest: PipeableShift<Parameters<F>>) => (self: PipeableFirst<Parameters<F>>) => ReturnType<F>

/**
 * @tsplus macro Derive
 */
declare function Derive<A>(explain?: "explain"): A

/**
 * @tsplus macro Do
 */
declare function Do<A>(f: (_: {
    /** @tsplus macro Bind */
    <X>(a: X): X
}) => A): A