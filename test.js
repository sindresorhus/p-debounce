import test from 'ava';
import delay from 'delay';
import inRange from 'in-range';
import timeSpan from 'time-span';
import m from './';

const fixture = Symbol('fixture');

test('single call', async t => {
	const debounced = m(async val => val, 100);
	t.is(await debounced(fixture), fixture);
});

test('multiple calls', async t => {
	let count = 0;
	const end = timeSpan();

	const debounced = m(async val => {
		count++;
		await delay(50);
		return val;
	}, 100);

	const results = await Promise.all([1, 2, 3, 4, 5].map(debounced));

	t.deepEqual(results, [5, 5, 5, 5, 5]);
	t.is(count, 1);
	t.true(inRange(end(), 130, 170));

	await delay(200);
	t.is(await debounced(6), 6);
});

test('leading option', async t => {
	let count = 0;

	const debounced = m(async val => {
		count++;
		await delay(50);
		return val;
	}, 100, {leading: true});

	const results = await Promise.all([1, 2, 3, 4].map(debounced));

	t.deepEqual(results, [1, 1, 1, 1], 'value from the first promise is used without the timeout');
	t.is(count, 1);

	await delay(200);
	t.is(await debounced(5), 5);
	t.is(await debounced(6), 5);
});

test('leading option - does not call input function after timeout', async t => {
	let count = 0;

	const debounced = m(async () => {
		count++;
	}, 100, {leading: true});

	await delay(300);
	await debounced();

	t.is(count, 1);
});
