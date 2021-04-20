import {expectType} from 'tsd';
import pDebounce from './index.js';

const expensiveCall = async (input: number) => input;

expectType<(input: number) => Promise<number>>(pDebounce(expensiveCall, 200));
expectType<(input: number) => Promise<number>>(
	pDebounce(expensiveCall, 200, {before: true})
);
expectType<(input: number) => Promise<number>>(
	pDebounce.promise(expensiveCall)
);
