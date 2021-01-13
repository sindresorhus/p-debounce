import {expectType} from 'tsd';
import pDebounce = require('.');

const expensiveCall = async (input: number) => input;

expectType<(input: number) => Promise<number>>(pDebounce(expensiveCall, 200));
expectType<(input: number) => Promise<number>>(
	pDebounce(expensiveCall, 200, {leading: true})
);
expectType<(input: number) => Promise<number>>(
	pDebounce.promise(expensiveCall)
);
