import {expectType} from 'tsd';
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
