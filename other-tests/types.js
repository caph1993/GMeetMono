
// Type declarations just for better IDE experience (copied and pasted)...
/** @typedef {Object} Elem */ /** @typedef {Object} Context */ /** @typedef {Object} Fragment */ /** @typedef {()=>(void|Promise<void>)} DismountEffect */
/** @namespace */
var preact = (() => { const any = /**@type {any} **/(null);
/** @template T @function @param {T|(()=>T)} initial @returns {[T, ((value:T)=>void)]} */ function useState(initial) { return any; };
/** @template T @function @param {()=>T} effect @param {any[]?} deps @returns {T} */ function useMemo(effect, deps) { return any; };
/** @template F @function @param {F} callback @param {any[]?} deps @returns {F} */ function useCallback(callback, deps) { return any; }; const useEffect = /** @type {(effect: (()=>(void|Promise<void>|DismountEffect)), deps?:any[])=>void}*/(any); const render = /** @type {(Elem, HTMLElement)=>void}*/(any); const createElement = /** @type {(tag:string, props?, ...children)=>Elem}  */(any); const createContext = /** @type {()=>Context} */(any); const Fragment = /** @type {Fragment} */(any); /** @lends preact */ let typed = {   useState, useMemo, useCallback, useEffect,   render, createElement, createContext, Fragment, }; typed = eval("window.preact"); return typed;
})();
/** @namespace */
var caph = (() => { const any = /**@type {any} **/(null);  /** @typedef {(props:Object)=>Elem} Component*/
/** @template T @param {T} value @param {string?} valueName  @returns {T extends undefined ? never : T} */
function assertDefined(value, valueName) {return any;}
/** @template T @param {T} condition @param {any} messages  @returns {T extends null ? never: T extends undefined ? never: T extends false ? never : T extends 0 ? never: void} */
function assert(condition, ...messages){ return any; }
const sleep = /** @type {(ms:number)=>Promise<void>}*/(any); const until = /** @type {(callback:()=>any)=>Promise<void>}*/(any); const parse = /** @type {(literals:TemplateStringsArray, ...values)=>Elem}*/(any); /** @lends caph */ let typed = {   assertDefined, assert, sleep, until,   parse, }; typed = eval("window.caph"); return typed; })();
var d3 = eval("window.d3");
