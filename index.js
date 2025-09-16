const pDebounce = (function_, wait, options = {}) => {
	if (!Number.isFinite(wait)) {
		throw new TypeError('Expected `wait` to be a finite number');
	}

	let leadingValue;
	let timeout;
	let promiseHandlers = []; // Single array of {resolve, reject}

	const onAbort = () => {
		clearTimeout(timeout);
		timeout = null;

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
				timeout = null;

				// Capture the current handlers for this execution
				const currentHandlers = promiseHandlers;

				// Clear handlers for next cycle (new calls during execution will add to new list)
				promiseHandlers = [];

				try {
					const result = options.before ? leadingValue : await function_.apply(this, arguments_);

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
						leadingValue = await function_.apply(this, arguments_);
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

pDebounce.promise = function_ => {
	let currentPromise;

	return async function (...arguments_) {
		if (currentPromise) {
			return currentPromise;
		}

		try {
			currentPromise = function_.apply(this, arguments_);
			return await currentPromise;
		} finally {
			currentPromise = undefined;
		}
	};
};

export default pDebounce;
