const pDebounce = (functionToDebounce, wait, options = {}) => {
	if (!Number.isFinite(wait)) {
		throw new TypeError('Expected `wait` to be a finite number');
	}

	let leadingValue;
	let timeout;
	let promiseHandlers = []; // Single array of {resolve, reject}

	const onAbort = () => {
		clearTimeout(timeout);
		timeout = undefined;

		try {
			options.signal?.throwIfAborted();
		} catch (error) {
			for (const {reject} of promiseHandlers) {
				reject(error);
			}

			promiseHandlers = [];
		}
	};

	return function (...arguments_) {
		return new Promise((resolve, reject) => {
			// Check if already aborted
			try {
				options.signal?.throwIfAborted();
			} catch (error) {
				reject(error);
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

				try {
					const result = options.before ? leadingValue : await functionToDebounce.apply(this, arguments_);

					for (const {resolve: resolveFunction} of currentHandlers) {
						resolveFunction(result);
					}
				} catch (error) {
					for (const {reject: rejectFunction} of currentHandlers) {
						rejectFunction(error);
					}
				}

				// Clear leading value for next cycle
				leadingValue = undefined;

				// Remove abort listener
				options.signal?.removeEventListener('abort', onAbort);
			}, wait);

			if (shouldCallNow) {
				// Execute immediately for leading edge
				(async () => {
					try {
						leadingValue = await functionToDebounce.apply(this, arguments_);
						resolve(leadingValue);
					} catch (error) {
						reject(error);
					}
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

	return async function (...arguments_) {
		if (currentPromise) {
			if (!options.after) {
				return currentPromise;
			}

			// Queue latest call (replacing any existing queue)
			queuedCall ??= {resolvers: []};
			queuedCall.arguments = arguments_;
			queuedCall.context = this;

			return new Promise((resolve, reject) => {
				queuedCall.resolvers.push({resolve, reject});
			});
		}

		currentPromise = (async () => {
			let result;
			let initialError;

			try {
				result = await function_.apply(this, arguments_);
			} catch (error) {
				initialError = error;
			}

			// Process queued calls regardless of initial result
			while (queuedCall) {
				const call = queuedCall;
				queuedCall = undefined;

				try {
					// eslint-disable-next-line no-await-in-loop
					const queuedResult = await function_.apply(call.context, call.arguments);
					for (const {resolve} of call.resolvers) {
						resolve(queuedResult);
					}
				} catch (error) {
					for (const {reject} of call.resolvers) {
						reject(error);
					}
				}
			}

			if (initialError) {
				throw initialError;
			}

			return result;
		})();

		try {
			return await currentPromise;
		} finally {
			currentPromise = undefined;
		}
	};
};

export default pDebounce;
