import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {setTimeout as delay} from 'node:timers/promises';
import pDebounce from './index.js';

const fixture = Symbol('fixture');

test('single call', async () => {
	const debounced = pDebounce(async value => value, 100);
	const result = await debounced(fixture);
	assert.equal(result, fixture);
});

test('multiple calls', async () => {
	let count = 0;
	const start = Date.now();

	const debounced = pDebounce(async value => {
		count++;
		await delay(50);
		return value;
	}, 100);

	const results = await Promise.all([1, 2, 3, 4, 5].map(value => debounced(value)));
	const elapsed = Date.now() - start;

	assert.deepEqual(results, [5, 5, 5, 5, 5]);
	assert.equal(count, 1);
	assert.ok(elapsed >= 130 && elapsed <= 170);

	await delay(200);
	assert.equal(await debounced(6), 6);
});

test('.promise()', async () => {
	let count = 0;

	const debounced = pDebounce.promise(async () => {
		await delay(50);
		count++;
		return count;
	});

	const results = await Promise.all([1, 2, 3, 4, 5].map(value => debounced(value)));
	assert.deepEqual(results, [1, 1, 1, 1, 1]);
	assert.equal(await debounced(), 2);
});

test('.promise() - concurrent calls return same promise', async () => {
	let callCount = 0;
	const calls = [];

	const debounced = pDebounce.promise(async value => {
		callCount++;
		calls.push(value);
		await delay(50);
		return value;
	});

	// Make multiple calls while first is executing
	const p1 = debounced('first');
	const p2 = debounced('second');
	await delay(10); // During execution
	const p3 = debounced('third');

	const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

	// All should get result of first execution
	assert.equal(r1, 'first');
	assert.equal(r2, 'first');
	assert.equal(r3, 'first');

	// Wait to ensure no background execution
	await delay(60);

	// Should have been called only once with 'first'
	assert.equal(callCount, 1);
	assert.deepEqual(calls, ['first']);
});

test('before option', async () => {
	let count = 0;

	const debounced = pDebounce(async value => {
		count++;
		await delay(50);
		return value;
	}, 100, {before: true});

	const results = await Promise.all([1, 2, 3, 4].map(value => debounced(value)));

	assert.deepEqual(results, [1, 1, 1, 1]);
	assert.equal(count, 1);

	await delay(200);
	assert.equal(await debounced(5), 5);
	assert.equal(await debounced(6), 5);
});

test('before option - does not call input function after timeout', async () => {
	let count = 0;

	const debounced = pDebounce(async () => {
		count++;
	}, 100, {before: true});

	await delay(300);
	await debounced();

	assert.equal(count, 1);
});

test('fn takes longer than wait', async () => {
	let count = 0;

	const debounced = pDebounce(async value => {
		count++;
		await delay(200);
		return value;
	}, 100);

	const setOne = [1, 2, 3];
	const setTwo = [4, 5, 6];

	const promiseSetOne = setOne.map(value => debounced(value));
	await delay(101);
	const promiseSetTwo = setTwo.map(value => debounced(value));

	const results = await Promise.all([...promiseSetOne, ...promiseSetTwo]);

	assert.deepEqual(results, [3, 3, 3, 6, 6, 6]);
	assert.equal(count, 2);
});

// Factory to create a separate class for each test
const createFixtureClass = () => class {
	constructor() {
		this._foo = fixture;
	}

	foo() {
		return this._foo;
	}

	getThis() {
		return this;
	}
};

test('`this` is preserved in pDebounce() fn', async () => {
	const FixtureClass = createFixtureClass();
	FixtureClass.prototype.foo = pDebounce(FixtureClass.prototype.foo, 10);
	FixtureClass.prototype.getThis = pDebounce(FixtureClass.prototype.getThis, 10);

	const thisFixture = new FixtureClass();

	assert.equal(await thisFixture.getThis(), thisFixture);
	assert.doesNotThrow(async () => thisFixture.foo());
	assert.equal(await thisFixture.foo(), fixture);
});

test('`this` is preserved in pDebounce.promise() fn', async () => {
	const FixtureClass = createFixtureClass();
	FixtureClass.prototype.foo = pDebounce.promise(FixtureClass.prototype.foo, 10);
	FixtureClass.prototype.getThis = pDebounce.promise(FixtureClass.prototype.getThis, 10);

	const thisFixture = new FixtureClass();

	assert.equal(await thisFixture.getThis(), thisFixture);
	assert.doesNotThrow(async () => thisFixture.foo());
	assert.equal(await thisFixture.foo(), fixture);
});

test('AbortSignal cancels debounced calls', async () => {
	let callCount = 0;
	const controller = new AbortController();

	const debounced = pDebounce(async value => {
		callCount++;
		await delay(50);
		return value;
	}, 100, {
		signal: controller.signal,
	});

	const promise = debounced(1);

	controller.abort();

	await assert.rejects(promise, error => {
		assert.equal(error.name, 'AbortError');
		return true;
	});

	assert.equal(callCount, 0);
});

test('already aborted signal prevents execution', async () => {
	const controller = new AbortController();
	controller.abort();

	const debounced = pDebounce(async value => value, 100, {
		signal: controller.signal,
	});

	const promise = debounced(1);

	await assert.rejects(promise, error => {
		assert.equal(error.name, 'AbortError');
		return true;
	});
});

test('AbortSignal works with before option', async () => {
	let callCount = 0;
	const controller = new AbortController();

	const debounced = pDebounce(async value => {
		callCount++;
		await delay(50);
		return value;
	}, 100, {before: true, signal: controller.signal});

	// First call executes immediately
	const promise1 = debounced(1);
	const result1 = await promise1;
	assert.equal(result1, 1);
	assert.equal(callCount, 1);

	// Second call is pending
	const promise2 = debounced(2);

	// Abort before timeout
	controller.abort();

	await assert.rejects(promise2, error => {
		assert.equal(error.name, 'AbortError');
		return true;
	});

	// Call count should still be 1 (only first call executed)
	assert.equal(callCount, 1);
});

test('multiple promises are cancelled together with AbortSignal', async () => {
	let callCount = 0;
	const controller = new AbortController();

	const debounced = pDebounce(async value => {
		callCount++;
		return value;
	}, 100, {
		signal: controller.signal,
	});

	const promise1 = debounced(1);
	const promise2 = debounced(2);
	const promise3 = debounced(3);

	controller.abort();

	await assert.rejects(promise1, {name: 'AbortError'});
	await assert.rejects(promise2, {name: 'AbortError'});
	await assert.rejects(promise3, {name: 'AbortError'});

	assert.equal(callCount, 0);
});

test('function still works after AbortSignal cancellation', async () => {
	const controller1 = new AbortController();
	const debounced = pDebounce(async value => value, 100, {
		signal: controller1.signal,
	});

	// Cancel initial call
	const promise1 = debounced(1);
	controller1.abort();
	await assert.rejects(promise1);

	// Should work normally with new signal after cancellation
	const controller2 = new AbortController();
	const debounced2 = pDebounce(async value => value, 100, {
		signal: controller2.signal,
	});
	const result = await debounced2(2);
	assert.equal(result, 2);
});

test('abort listener is cleaned up after normal completion', async () => {
	const controller = new AbortController();
	const {signal} = controller;

	// Track listener count
	const initialListenerCount = signal.eventNames?.()?.length ?? 0;

	const debounced = pDebounce(async value => value, 100, {signal});

	// Call the function
	const promise = debounced(1);

	// Wait for completion
	const result = await promise;
	assert.equal(result, 1);

	// Give time for cleanup
	await delay(10);

	// Check that listeners are cleaned up
	const finalListenerCount = signal.eventNames?.()?.length ?? 0;
	assert.equal(finalListenerCount, initialListenerCount, 'Abort listener should be removed after completion');
});

test('multiple abort signals are handled correctly without leaks', async () => {
	// Test with multiple signals to ensure no leaks
	const promises = [];
	for (let index = 0; index < 5; index++) {
		const controller = new AbortController();
		const debounced = pDebounce(async value => value, 50, {
			signal: controller.signal,
		});

		promises.push(debounced(index));
	}

	await Promise.all(promises);

	// If this test completes without memory issues, listeners are being cleaned up
	assert.ok(true);
});

test('before option - all calls in window resolve to same leading value', async () => {
	let callCount = 0;

	const debounced = pDebounce(async value => {
		callCount++;
		return value;
	}, 100, {before: true});

	// Multiple calls in quick succession
	const promises = [
		debounced(1),
		debounced(2),
		debounced(3),
		debounced(4),
	];

	const results = await Promise.all(promises);

	// All should resolve to the first value
	assert.deepEqual(results, [1, 1, 1, 1], 'All calls should resolve to the first value');
	assert.equal(callCount, 1, 'Function should only be called once');
});

test('abort rejects all pending callers with consistent AbortError', async () => {
	const controller = new AbortController();

	const debounced = pDebounce(async value => {
		await delay(50);
		return value;
	}, 100, {signal: controller.signal});

	// Queue multiple calls
	const promise1 = debounced(1);
	const promise2 = debounced(2);
	const promise3 = debounced(3);

	// Abort after a short delay
	await delay(10);
	controller.abort();

	// All should reject with AbortError
	const results = await Promise.allSettled([promise1, promise2, promise3]);
	const errors = results
		.filter(result => result.status === 'rejected')
		.map(result => result.reason);

	// All errors should be AbortError
	assert.equal(errors.length, 3);
	for (const error of errors) {
		assert.equal(error.name, 'AbortError');
	}
});

test('this context is preserved in non-before mode', async () => {
	const object = {
		value: 42,
		async getValue() {
			return this.value;
		},
	};

	object.getValue = pDebounce(object.getValue, 50);

	const result = await object.getValue();
	assert.equal(result, 42, 'this context should be preserved');
});

test('handles synchronous errors correctly', async () => {
	const errorMessage = 'Sync error';
	const debounced = pDebounce(() => {
		throw new Error(errorMessage);
	}, 50);

	await assert.rejects(debounced(), error => {
		assert.equal(error.message, errorMessage);
		return true;
	});
});

test('handles synchronous errors with before option', async () => {
	const errorMessage = 'Sync error in before mode';
	const debounced = pDebounce(() => {
		throw new Error(errorMessage);
	}, 50, {before: true});

	await assert.rejects(debounced(), error => {
		assert.equal(error.message, errorMessage);
		return true;
	});
});

test('handles rejected promises correctly', async () => {
	const errorMessage = 'Async rejection';
	const debounced = pDebounce(async () => {
		throw new Error(errorMessage);
	}, 50);

	await assert.rejects(debounced(), error => {
		assert.equal(error.message, errorMessage);
		return true;
	});
});

test('multiple callers all receive the same rejection', async () => {
	const errorMessage = 'Shared rejection';
	const debounced = pDebounce(async () => {
		await delay(10);
		throw new Error(errorMessage);
	}, 50);

	const promises = [
		debounced(1),
		debounced(2),
		debounced(3),
	];

	const results = await Promise.allSettled(promises);

	// All should be rejected with the same error
	assert.equal(results.length, 3);
	for (const result of results) {
		assert.equal(result.status, 'rejected');
		assert.equal(result.reason.message, errorMessage);
	}
});

test('handles undefined and null arguments', async () => {
	const debounced = pDebounce(async (...arguments_) => arguments_, 50);

	const result1 = await debounced(undefined);
	assert.deepEqual(result1, [undefined]);

	const result2 = await debounced(null);
	assert.deepEqual(result2, [null]);

	const result3 = await debounced();
	assert.deepEqual(result3, []);
});

test('rapid abort signals do not cause memory leaks', async () => {
	// Create and abort many signals in rapid succession
	const promises = [];

	for (let index = 0; index < 100; index++) {
		const controller = new AbortController();
		const debounced = pDebounce(async value => value, 50, {
			signal: controller.signal,
		});

		const promise = debounced(index);
		controller.abort();
		// eslint-disable-next-line promise/prefer-await-to-then
		promises.push(promise.catch(() => {})); // Ignore rejections
	}

	await Promise.all(promises);
	assert.ok(true, 'Rapid aborts handled without issues');
});

test('before option with immediate abort', async () => {
	const controller = new AbortController();

	const debounced = pDebounce(async value => {
		await delay(50);
		return value;
	}, 100, {before: true, signal: controller.signal});

	const promise = debounced(1);
	controller.abort(); // Abort immediately after leading call

	// Leading call should still complete successfully
	const result = await promise;
	assert.equal(result, 1);
});

test('mixed successful and failed calls', async () => {
	let shouldFail = false;
	const debounced = pDebounce(async value => {
		if (shouldFail) {
			throw new Error('Failed');
		}

		return value;
	}, 50);

	// First batch succeeds
	const result1 = await debounced(1);
	assert.equal(result1, 1);

	// Second batch fails
	shouldFail = true;
	await assert.rejects(debounced(2), {message: 'Failed'});

	// Third batch succeeds again
	shouldFail = false;
	const result3 = await debounced(3);
	assert.equal(result3, 3);
});

test('error handling - documents behavior for issue #7', async () => {
	const errorMessage = 'Test error for issue #7';
	let callCount = 0;

	const debounced = pDebounce(async () => {
		callCount++;
		await delay(10);
		throw new Error(errorMessage);
	}, 50);

	// Make multiple calls that should all be debounced together
	const promise1 = debounced();
	const promise2 = debounced();
	const promise3 = debounced();

	// All promises should reject with the same error (issue #7 behavior)
	const results = await Promise.allSettled([promise1, promise2, promise3]);

	// Verify function was only called once due to debouncing
	assert.equal(callCount, 1);

	// Verify all calls were rejected with the same error
	for (const result of results) {
		assert.equal(result.status, 'rejected');
		assert.equal(result.reason.message, errorMessage);
	}
});

test('calls made during function execution resolve with correct values', async () => {
	let callCount = 0;

	const slowFunction = async value => {
		callCount++;
		await delay(100);
		return value;
	};

	const debounced = pDebounce(slowFunction, 50);

	// First call starts the debounce
	const promise1 = debounced('first');

	// Wait for debounce to trigger
	await delay(60);

	// Make calls while function is executing
	const promise2 = debounced('second');
	const promise3 = debounced('third');

	const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);

	// First call should resolve with its own result
	assert.equal(result1, 'first');

	// Calls made during execution should resolve with the latest argument
	assert.equal(result2, 'third');
	assert.equal(result3, 'third');

	// Function should execute twice
	assert.equal(callCount, 2);
});

test('concurrent debounced functions do not interfere', async () => {
	const calls1 = [];
	const calls2 = [];

	const debounced1 = pDebounce(async value => {
		calls1.push(value);
		await delay(50);
		return `fn1-${value}`;
	}, 30);

	const debounced2 = pDebounce(async value => {
		calls2.push(value);
		await delay(50);
		return `fn2-${value}`;
	}, 30);

	const [r1, r2, r3, r4] = await Promise.all([
		debounced1('a'),
		debounced2('x'),
		debounced1('b'),
		debounced2('y'),
	]);

	assert.equal(r1, 'fn1-b');
	assert.equal(r3, 'fn1-b');
	assert.equal(r2, 'fn2-y');
	assert.equal(r4, 'fn2-y');
	assert.deepEqual(calls1, ['b']);
	assert.deepEqual(calls2, ['y']);
});

test('extremely short wait time (0ms)', async () => {
	let callCount = 0;
	const debounced = pDebounce(async value => {
		callCount++;
		return value;
	}, 0);

	const p1 = debounced(1);
	const p2 = debounced(2);
	const p3 = debounced(3);

	const results = await Promise.all([p1, p2, p3]);

	assert.deepEqual(results, [3, 3, 3]);
	assert.equal(callCount, 1);
});

test('before option with synchronous function', async () => {
	const calls = [];
	const debounced = pDebounce(value => {
		calls.push(value);
		return value * 2;
	}, 50, {before: true});

	const results = await Promise.all([
		debounced(1),
		debounced(2),
		debounced(3),
	]);

	assert.deepEqual(results, [2, 2, 2]);
	assert.deepEqual(calls, [1]);
});

test('abort signal during different phases', async () => {
	const controller1 = new AbortController();
	const controller2 = new AbortController();
	const controller3 = new AbortController();

	const fn = async value => {
		await delay(100);
		return value;
	};

	const debounced1 = pDebounce(fn, 50, {signal: controller1.signal});
	const debounced2 = pDebounce(fn, 50, {signal: controller2.signal});
	const debounced3 = pDebounce(fn, 50, {signal: controller3.signal});

	// Abort before any call
	controller1.abort();
	await assert.rejects(debounced1(1), {name: 'AbortError'});

	// Abort during wait period
	const p2 = debounced2(2);
	await delay(25);
	controller2.abort();
	await assert.rejects(p2, {name: 'AbortError'});

	// Abort during execution
	const p3 = debounced3(3);
	await delay(60); // Let it start executing
	controller3.abort();
	const result = await p3; // Should still complete
	assert.equal(result, 3);
});

test('error propagation to all waiting promises', async () => {
	const error = new Error('Test error');
	let shouldThrow = true;

	const debounced = pDebounce(async value => {
		if (shouldThrow) {
			throw error;
		}

		return value;
	}, 50);

	const promises = Array.from({length: 10}, (_, i) => debounced(i));

	const results = await Promise.allSettled(promises);

	// All should be rejected with the same error
	for (const result of results) {
		assert.equal(result.status, 'rejected');
		assert.equal(result.reason, error);
	}

	// Subsequent calls should work
	shouldThrow = false;
	const result = await debounced(42);
	assert.equal(result, 42);
});

test('wait parameter validation', async () => {
	assert.throws(() => pDebounce(() => {}, Number.NaN), TypeError);
	assert.throws(() => pDebounce(() => {}, Number.POSITIVE_INFINITY), TypeError);
	assert.throws(() => pDebounce(() => {}, Number.NEGATIVE_INFINITY), TypeError);
	assert.throws(() => pDebounce(() => {}, 'not a number'), TypeError);

	// These should work
	assert.doesNotThrow(() => pDebounce(() => {}, 0));
	assert.doesNotThrow(() => pDebounce(() => {}, -100)); // Negative waits work like 0
	assert.doesNotThrow(() => pDebounce(() => {}, 1.5)); // Decimals are fine
});

test('before option with errors in leading call', async () => {
	const error = new Error('Leading error');
	let callCount = 0;
	const debounced = pDebounce(() => {
		callCount++;
		throw error;
	}, 50, {before: true});

	await assert.rejects(debounced(1), error);

	// Only called once due to before option
	assert.equal(callCount, 1);
});

test('complex argument passing', async () => {
	const debounced = pDebounce(async (...args) => args, 50);

	const object = {foo: 'bar'};
	const array = [1, 2, 3];
	const fn = () => {};

	const result = await debounced(object, array, fn, undefined, null, 42);

	assert.deepEqual(result[0], object);
	assert.deepEqual(result[1], array);
	assert.equal(result[2], fn);
	assert.equal(result[3], undefined);
	assert.equal(result[4], null);
	assert.equal(result[5], 42);
});

test('maintains proper promise resolution order', async () => {
	const executionOrder = [];
	let executionCount = 0;

	const debounced = pDebounce(async value => {
		executionCount++;
		const currentExecution = executionCount;
		await delay(value === 'slow' ? 150 : 50);
		executionOrder.push({value, execution: currentExecution});
		return value;
	}, 30);

	// First call - slow execution
	const p1 = debounced('slow');
	await delay(35); // Let it start

	// Calls during execution
	const p2 = debounced('fast1');
	const p3 = debounced('fast2');

	const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

	// First call gets its own result
	assert.equal(r1, 'slow');

	// Calls during execution get the latest argument
	assert.equal(r2, 'fast2');
	assert.equal(r3, 'fast2');

	// Should have executed twice
	assert.equal(executionCount, 2);
});

test('debounce with negative wait time', async () => {
	let callCount = 0;
	const debounced = pDebounce(async value => {
		callCount++;
		return value;
	}, -50); // Negative wait should work like 0

	const results = await Promise.all([
		debounced(1),
		debounced(2),
		debounced(3),
	]);

	assert.deepEqual(results, [3, 3, 3]);
	assert.equal(callCount, 1);
});

test('abort signal removed after successful execution', async () => {
	const controller = new AbortController();
	const {signal} = controller;

	const debounced = pDebounce(async value => {
		await delay(50);
		return value;
	}, 100, {signal});

	// Make a call and let it complete
	const result = await debounced('test');
	assert.equal(result, 'test');

	// Abort after completion shouldn't affect new calls
	controller.abort();

	// New call with new controller should work
	const controller2 = new AbortController();
	const debounced2 = pDebounce(async value => value, 50, {signal: controller2.signal});
	const result2 = await debounced2('test2');
	assert.equal(result2, 'test2');
});

test('multiple debounced functions with before option', async () => {
	const calls = [];

	const d1 = pDebounce(v => {
		calls.push(`d1-${v}`);
		return `d1-${v}`;
	}, 50, {before: true});

	const d2 = pDebounce(v => {
		calls.push(`d2-${v}`);
		return `d2-${v}`;
	}, 50, {before: true});

	// Call both in quick succession
	const [r1, r2, r3, r4] = await Promise.all([
		d1('a'),
		d2('x'),
		d1('b'),
		d2('y'),
	]);

	assert.equal(r1, 'd1-a');
	assert.equal(r2, 'd2-x');
	assert.equal(r3, 'd1-a'); // Same as r1 due to before option
	assert.equal(r4, 'd2-x'); // Same as r2 due to before option
	assert.deepEqual(calls, ['d1-a', 'd2-x']);
});

test('debounce function returning undefined', async () => {
	let callCount = 0;
	const debounced = pDebounce(() => {
		callCount++;
		// Implicitly returns undefined
	}, 50);

	const results = await Promise.all([
		debounced(),
		debounced(),
		debounced(),
	]);

	assert.equal(callCount, 1);
	assert.deepEqual(results, [undefined, undefined, undefined]);
});

test('edge case: call during abort signal cleanup', async () => {
	const controller = new AbortController();
	let callCount = 0;

	const debounced = pDebounce(async value => {
		callCount++;
		await delay(100);
		return value;
	}, 50, {signal: controller.signal});

	const p1 = debounced(1);

	// Wait for function to start
	await delay(60);

	// Abort while function is executing
	controller.abort();

	// Make new call immediately - should be rejected because signal is aborted
	// eslint-disable-next-line promise/prefer-await-to-then
	const p2 = debounced(2).catch(() => {}); // Handle the rejection

	// First call should complete despite abort happening during execution
	const result1 = await p1;
	assert.equal(result1, 1);

	// Second call should have been rejected (handled above)
	await p2;
	assert.equal(callCount, 1);
});

test('callstack is preserved in debounced function', async () => {
	let capturedStack;

	const debounced = pDebounce(async () => {
		capturedStack = new Error('Stack trace').stack;
		return 'done';
	}, 50);

	async function namedFunction() {
		return debounced();
	}

	await namedFunction();

	// Stack trace should be captured
	assert.ok(capturedStack, 'Stack trace should be captured');
	assert.ok(capturedStack.includes('Error'), 'Stack trace should include Error');
});

test('zero timeout executes in next tick', async () => {
	const executionOrder = [];

	const debounced = pDebounce(async () => {
		executionOrder.push('debounced');
	}, 0);

	debounced();
	executionOrder.push('sync');

	await delay(1);

	assert.deepEqual(executionOrder, ['sync', 'debounced']);
});

test('debounce with AbortSignal.timeout', async () => {
	// Skip if AbortSignal.timeout is not available (Node 16+)
	if (typeof AbortSignal.timeout !== 'function') {
		return;
	}

	const debounced = pDebounce(async value => {
		await delay(200);
		return value;
	}, 150, {signal: AbortSignal.timeout(100)});

	const promise = debounced('test');

	// Should abort after 100ms timeout (during the debounce wait period)
	// Different Node versions may use different error names
	await assert.rejects(promise, error => error.name === 'TimeoutError' || error.name === 'AbortError');
});

test('before option with async error in leading call', async () => {
	const error = new Error('Async leading error');
	const debounced = pDebounce(async () => {
		await delay(10);
		throw error;
	}, 50, {before: true});

	const p1 = debounced(1);
	const p2 = debounced(2);

	// First call executes immediately and should reject
	await assert.rejects(p1, error);

	// Second call waits for timeout and resolves with cached leadingValue (undefined since first call errored)
	const result2 = await p2;
	assert.equal(result2, undefined);
});

test('promise resolution with null and undefined', async () => {
	const debounced = pDebounce(async value => value, 50);

	const [r1, r2, r3] = await Promise.all([
		debounced(null),
		debounced(undefined),
		debounced(),
	]);

	assert.equal(r1, undefined); // Last call had no arguments
	assert.equal(r2, undefined);
	assert.equal(r3, undefined);
});

test('multiple abort controllers on same debounced function', async () => {
	const controller1 = new AbortController();
	const controller2 = new AbortController();

	const fn = async value => {
		await delay(100);
		return value;
	};

	const debounced1 = pDebounce(fn, 50, {signal: controller1.signal});
	const debounced2 = pDebounce(fn, 50, {signal: controller2.signal});

	const p1 = debounced1(1);
	const p2 = debounced2(2);

	// Abort only the first one
	controller1.abort();

	await assert.rejects(p1, {name: 'AbortError'});

	// Second should complete normally
	const result2 = await p2;
	assert.equal(result2, 2);
});

test('debounce preserves promise rejection details', async () => {
	const customError = new TypeError('Custom type error');
	customError.code = 'CUSTOM_CODE';
	customError.details = {foo: 'bar'};

	const debounced = pDebounce(async () => {
		throw customError;
	}, 50);

	try {
		await debounced();
		assert.fail('Should have thrown');
	} catch (error) {
		assert.equal(error, customError);
		assert.equal(error.code, 'CUSTOM_CODE');
		assert.deepEqual(error.details, {foo: 'bar'});
	}
});

test('simultaneous before and non-before debounced functions', async () => {
	const calls = [];

	const debouncedBefore = pDebounce(value => {
		calls.push(`before-${value}`);
		return `before-${value}`;
	}, 50, {before: true});

	const debouncedAfter = pDebounce(value => {
		calls.push(`after-${value}`);
		return `after-${value}`;
	}, 50);

	const [r1, r2, r3, r4] = await Promise.all([
		debouncedBefore('a'),
		debouncedBefore('b'),
		debouncedAfter('x'),
		debouncedAfter('y'),
	]);

	assert.equal(r1, 'before-a');
	assert.equal(r2, 'before-a');
	assert.equal(r3, 'after-y');
	assert.equal(r4, 'after-y');
	assert.deepEqual(calls, ['before-a', 'after-y']);
});

test('nested debounced functions', async () => {
	const innerCalls = [];
	const outerCalls = [];

	const innerDebounced = pDebounce(async value => {
		innerCalls.push(value);
		return `inner-${value}`;
	}, 30);

	const outerDebounced = pDebounce(async value => {
		outerCalls.push(value);
		const innerResult = await innerDebounced(value);
		return `outer(${innerResult})`;
	}, 50);

	const result = await outerDebounced('test');

	assert.equal(result, 'outer(inner-test)');
	assert.deepEqual(outerCalls, ['test']);
	assert.deepEqual(innerCalls, ['test']);
});

test('race condition: new call right at timeout boundary', async () => {
	let callCount = 0;
	const results = [];

	const debounced = pDebounce(async value => {
		callCount++;
		results.push(value);
		return value;
	}, 50);

	const p1 = debounced(1);

	// Wait exactly the debounce time
	await delay(50);

	// Call right when timeout fires
	const p2 = debounced(2);

	const [r1, r2] = await Promise.all([p1, p2]);

	// Should have been called twice
	assert.equal(callCount, 2);
	assert.deepEqual(results, [1, 2]);
	assert.equal(r1, 1);
	assert.equal(r2, 2);
});

test('function with Symbol return value', async () => {
	const sym = Symbol('test');
	const debounced = pDebounce(async () => sym, 50);

	const result = await debounced();
	assert.equal(result, sym);
});

test('concurrent calls with different this contexts', async () => {
	const contexts = [];

	const debounced = pDebounce(async function (value) {
		contexts.push(this);
		return value;
	}, 50);

	const object1 = {name: 'object1', fn: debounced};
	const object2 = {name: 'object2', fn: debounced};

	const [r1, r2] = await Promise.all([
		object1.fn('a'),
		object2.fn('b'),
	]);

	// Both should use the last context
	assert.equal(contexts.length, 1);
	assert.equal(contexts[0], object2);
	assert.equal(r1, 'b');
	assert.equal(r2, 'b');
});

test('context preservation in pDebounce', async () => {
	const results = [];

	class TestClass {
		constructor(name) {
			this.name = name;
		}

		async method(value) {
			results.push({name: this.name, value});
			return `${this.name}-${value}`;
		}
	}

	const instance = new TestClass('test');
	instance.debouncedMethod = pDebounce(instance.method, 50);

	const result = await instance.debouncedMethod('hello');

	assert.equal(result, 'test-hello');
	assert.equal(results.length, 1);
	assert.equal(results[0].name, 'test');
	assert.equal(results[0].value, 'hello');
});

test('context preservation in pDebounce.promise', async () => {
	const results = [];

	class TestClass {
		constructor(name) {
			this.name = name;
		}

		async method(value) {
			results.push({name: this.name, value});
			return `${this.name}-${value}`;
		}
	}

	const instance = new TestClass('promise-test');
	instance.debouncedMethod = pDebounce.promise(instance.method);

	const result = await instance.debouncedMethod('world');

	assert.equal(result, 'promise-test-world');
	assert.equal(results.length, 1);
	assert.equal(results[0].name, 'promise-test');
	assert.equal(results[0].value, 'world');
});

test('arguments preservation in complex scenarios', async () => {
	const calls = [];

	const fn = pDebounce(async (...args) => {
		calls.push(args);
		return args;
	}, 50);

	const complexObject = {deep: {nested: 'value'}};
	const array = [1, 2, 3];
	const func = () => 'function';

	const result = await fn(complexObject, array, func, null, undefined, 42);

	assert.equal(calls.length, 1);
	assert.deepEqual(calls[0][0], complexObject);
	assert.deepEqual(calls[0][1], array);
	assert.equal(calls[0][2], func);
	assert.equal(calls[0][3], null);
	assert.equal(calls[0][4], undefined);
	assert.equal(calls[0][5], 42);
	assert.deepEqual(result, [complexObject, array, func, null, undefined, 42]);
});

test('abort signal during various execution phases', async () => {
	const controller1 = new AbortController();
	const controller2 = new AbortController();
	const controller3 = new AbortController();

	let executionStarted = false;

	const fn = async value => {
		executionStarted = true;
		await delay(100);
		return value;
	};

	// Test 1: Abort before any calls
	const debounced1 = pDebounce(fn, 50, {signal: controller1.signal});
	controller1.abort();
	await assert.rejects(debounced1(1), {name: 'AbortError'});

	// Test 2: Abort during wait period
	const debounced2 = pDebounce(fn, 200, {signal: controller2.signal});
	const p2 = debounced2(2);
	await delay(100); // Wait during debounce period
	controller2.abort();
	await assert.rejects(p2, {name: 'AbortError'});

	// Test 3: Abort during function execution (should complete)
	executionStarted = false;
	const debounced3 = pDebounce(fn, 50, {signal: controller3.signal});
	const p3 = debounced3(3);
	await delay(60); // Wait for function to start
	assert.ok(executionStarted, 'Function should have started');
	controller3.abort();
	const result3 = await p3; // Should complete despite abort
	assert.equal(result3, 3);
});

test('memory cleanup after abort', async () => {
	const controller = new AbortController();
	let calls = 0;

	const debounced = pDebounce(async () => {
		calls++;
		return 'result';
	}, 50, {signal: controller.signal});

	// Make multiple calls
	const promises = [];
	for (let index = 0; index < 5; index++) {
		const promise = debounced(index);
		// eslint-disable-next-line promise/prefer-await-to-then
		promises.push(promise.catch(() => {})); // Ignore rejections
	}

	// Abort all
	controller.abort();
	await Promise.all(promises);

	// Wait to ensure no delayed execution
	await delay(100);

	// Function should never have been called
	assert.equal(calls, 0);

	// New calls with same debounced function should still be rejected
	await assert.rejects(debounced('new'), {name: 'AbortError'});
});
