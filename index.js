const pDebounce = (functionToDebounce, wait, options = {}) => {
	if (!Number.isFinite(wait)) {
		throw new TypeError('Expected `wait` to be a finite number');
	}

	// `setTimeout` treats a larger delay as 1ms
	if (wait > 2_147_483_647) {
		throw new RangeError('Expected `wait` to be at most 2147483647 milliseconds');
	}

	let leadingCall;
	let timeout;
	let promiseHandlers = []; // Single array of {resolve, reject}

	const onAbort = () => {
		clearTimeout(timeout);
		timeout = undefined;

		// The cleared timeout would otherwise have released it
		leadingCall = undefined;

		for (const {reject} of promiseHandlers) {
			reject(options.signal.reason);
		}

		promiseHandlers = [];
	};

	return function (...arguments_) {
		return new Promise((resolve, reject) => {
			// Check if already aborted
			if (options.signal?.aborted) {
				reject(options.signal.reason);
				return;
			}

			const shouldCallNow = options.before && !timeout;

			clearTimeout(timeout);

			timeout = setTimeout(async () => {
				timeout = undefined;

				// Capture the current handlers for this execution
				const currentHandlers = promiseHandlers;

				// Clear handlers for next cycle (new calls during execution will add to new list)
				promiseHandlers = [];

				// Remove abort listener
				options.signal?.removeEventListener('abort', onAbort);

				// Capture this window's leading call before a new window can replace it, and clear it so its value is not retained
				const currentLeadingCall = leadingCall;
				leadingCall = undefined;

				try {
					// The leading call can still be pending when the function is slower than `wait`.
					const result = options.before ? await currentLeadingCall : await functionToDebounce.apply(this, arguments_);

					for (const {resolve: resolveFunction} of currentHandlers) {
						resolveFunction(result);
					}
				} catch (error) {
					for (const {reject: rejectFunction} of currentHandlers) {
						rejectFunction(error);
					}
				}
			}, wait);

			if (shouldCallNow) {
				// Execute immediately for leading edge.
				// `leadingCall` resolves with the leading value (or `undefined` if the call fails) and never rejects, so the trailing callers can always await it.
				leadingCall = (async () => {
					let leadingValue;

					try {
						leadingValue = await functionToDebounce.apply(this, arguments_);
					} catch (error) {
						reject(error);
						return;
					}

					resolve(leadingValue);
					return leadingValue;
				})();
			} else {
				// Add to handlers for later resolution
				promiseHandlers.push({resolve, reject});

				// Set up abort listener (only once per batch)
				if (options.signal && promiseHandlers.length === 1) {
					options.signal.addEventListener('abort', onAbort, {once: true});
				}
			}
		});
	};
};

pDebounce.promise = (function_, options = {}) => {
	let currentPromise;
	let queuedCall;

	const run = (context, arguments_) => {
		const {promise, resolve} = Promise.withResolvers();

		// Mark as busy before calling `function_`, so a synchronous re-entrant call does not start a concurrent execution.
		currentPromise = promise;

		resolve((async () => {
			try {
				return await function_.apply(context, arguments_);
			} finally {
				// Stay busy while the queued call runs, so calls never overlap, but settle this call's callers right away instead of after the whole queue.
				if (queuedCall) {
					const call = queuedCall;
					queuedCall = undefined;
					call.resolve(run(call.context, call.arguments));
				} else {
					currentPromise = undefined;
				}
			}
		})());

		return promise;
	};

	return function (...arguments_) {
		if (!currentPromise) {
			return run(this, arguments_);
		}

		if (!options.after) {
			return currentPromise;
		}

		// Queue the latest call (replacing the arguments of any queued call). All queued callers share its result.
		queuedCall ??= Promise.withResolvers();
		queuedCall.arguments = arguments_;
		queuedCall.context = this;
		return queuedCall.promise;
	};
};

export default pDebounce;
