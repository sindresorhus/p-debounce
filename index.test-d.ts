import {expectType} from 'tsd-check';
import pDebounce from '.';

const expensiveCall = async (input: number) => input;

expectType<(input: number) => Promise<number>>(pDebounce(expensiveCall, 200));
expectType<(input: number) => Promise<number>>(
	pDebounce(expensiveCall, 200, {leading: true})
);
