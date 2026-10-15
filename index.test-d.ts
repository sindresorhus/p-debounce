import {expectType, expectError} from 'tsd';
import pDebounce from './index.js';

const expensiveCall = async (input: number) => input;

// Test basic return type
expectType<(input: number) => Promise<number>>(pDebounce(expensiveCall, 200));

// Test with signal option
const controller = new AbortController();
expectType<(input: number) => Promise<number>>(pDebounce(expensiveCall, 200, {signal: controller.signal}));

// Test with before option
expectType<(input: number) => Promise<number>>(pDebounce(expensiveCall, 200, {before: true}));

// Test promise method
expectType<(input: number) => Promise<number>>(pDebounce.promise(expensiveCall));

// Test explicit resolved return type arguments
expectType<(input: number) => Promise<number>>(pDebounce<unknown, [number], number>(expensiveCall, 200));
expectType<(input: number) => Promise<number>>(pDebounce.promise<unknown, [number], number>(expensiveCall));
expectError(pDebounce<unknown, [number], string>(expensiveCall, 200));
expectError(pDebounce.promise<unknown, [number], string>(expensiveCall));

// Test function that returns a promise or a plain value
const promiseOrValue = (isCached: boolean): Promise<number> | 'cached' => (isCached ? 'cached' : Promise.resolve(1));
expectType<(isCached: boolean) => Promise<number | 'cached'>>(pDebounce(promiseOrValue, 200));
expectType<(isCached: boolean) => Promise<number | 'cached'>>(pDebounce.promise(promiseOrValue));

// Test promise method with after option
expectType<(input: number) => Promise<number>>(pDebounce.promise(expensiveCall, {after: true}));

// Test `this` is preserved
type Context = {multiplier: number};
const withThis = async function (this: Context, input: number) {
	return input * this.multiplier;
};

expectType<(this: Context, input: number) => Promise<number>>(pDebounce(withThis, 200));
expectType<(this: Context, input: number) => Promise<number>>(pDebounce.promise(withThis));

// Test synchronous function
expectType<(input: string) => Promise<string>>(pDebounce((input: string) => input, 200));

expectError(pDebounce(expensiveCall, 200, {before: 'yes'}));

expectError(pDebounce.promise(expensiveCall, {after: 1}));

// Test function that returns promises with different value types
const promiseOfEither = async (isNumber: boolean): Promise<number | string> => (isNumber ? 1 : 'x');
// eslint-disable-next-line @typescript-eslint/promise-function-async
const eitherPromise = (isNumber: boolean): Promise<number> | Promise<string> => (isNumber ? Promise.resolve(1) : Promise.resolve('x'));
expectType<(isNumber: boolean) => Promise<number | string>>(pDebounce(promiseOfEither, 200));
expectType<(isNumber: boolean) => Promise<number | string>>(pDebounce.promise(eitherPromise));

// Test nested promise is flattened like at runtime
declare const nestedPromise: () => Promise<Promise<number>>;
expectType<() => Promise<number>>(pDebounce(nestedPromise, 200));
