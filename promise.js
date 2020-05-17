let freeGlobal =
  typeof global === "object" && global && global.object === Object;

let root = freeGlobal || global;

const PENDING = "PENDING";
const FULFILLED = "FULFILLED";
const REJECTED = "REJECTED";
const QUEUE = Symbol("queue");
const HANDLERS = Symbol("handlers");
const STATE = Symbol("state");
const VALUE = Symbol("value");

class Promise {
  constructor(executor) {
    this[QUEUE] = [];
    this[HANDLERS] = new Handlers();
    this[STATE] = PENDING;
    this[VALUE] = null;

    if (typeof executor === "function") {
      tryFunction(this, executor);
    } else {
      throw new TypeError(`Promise resolver ${executor} is not a function`);
    }
  }

  then(onFulfilled, onRejected) {
    const promise2 = new Promise((resolve, reject) => {
      if (this[STATE] === FULFILLED && typeof onFulfilled !== "function") {
        resolve(this[VALUE]);
      } else if (this[STATE] === REJECTED && typeof onRejected !== "function") {
        reject(this[VALUE]);
      }
    });

    if (typeof onFulfilled === "function") {
      promise2[HANDLERS].onFulfilled = onFulfilled;
    }
    if (typeof onRejected === "function") {
      promise2[HANDLERS].onRejected = onRejected;
    }
    this[QUEUE].push(promise2);
    process(this);
    return promise2;
  }
}

class Handlers {
  constructor() {
    this.onFulfilled = null;
    this.onRejected = null;
  }
}
function tryFunction(promise, executor) {
  const resolve = (value) => {
    transition(promise, FULFILLED, value);
  };
  const reject = (reason) => {
    transition(promise, REJECTED, reason);
  };

  try {
    executor(resolve, reject);
  } catch (err) {
    reject(err);
  }
}

function transition(promise, state, value) {
  if (promise[STATE] === state || promise[STATE] !== PENDING) return;
  promise[STATE] = state;
  promise[VALUE] = value;
  process(promise);
}

function process(p) {
  if (p[STATE] === PENDING) return;
  nextTick(processNextTick, p);
  return p;
}

const nextTick = (() => {
  if (root.process && typeof root.process.nextTick === "function") {
    return root.process.nextTick;
  } else {
    return (f, p) => setTimeout(f.call(this.p));
  }
})();

function processNextTick(promise) {
  let handler;
  while (promise[QUEUE].length > 0) {
    const thenablePromise = promise[QUEUE].shift();

    if (promise[STATE] === FULFILLED) {
      handler = thenablePromise[HANDLERS].onFulfilled || ((v) => v);
    } else if (promise[STATE] === REJECTED) {
      handler =
        thenablePromise[HANDLERS].onRejected ||
        ((r) => {
          throw r;
        });
    }

    try {
      const x = handler(promise[VALUE]);
      resolvePromise(thenablePromise, x);
    } catch (error) {
      transition(thenablePromise, REJECTED, error);
    }
  }
}

function resolvePromise(promise, x) {
  if (promise === x) {
    throw new TypeError("TypeError: Chaining cycle detected for promise");
  }
  let called;

  if (x && (typeof x === "function" || typeof x === "object")) {
    try {
      const thenFunction = x.then;
      if (thenFunction && typeof thenFunction === "function") {
        const onFulfilled = (y) => {
          if (called) return;
          called = true;
          resolvePromise(promise, y);
        };
        const onRejected = (r) => {
          if (called) return;
          called = true;
          transition(promise, REJECTED, r);
        };
        thenFunction.call(x, onFulfilled, onRejected);
      } else {
        transition(promise, FULFILLED, x);
      }
    } catch (error) {
      if (called) return;
      called = true;
      transition(promise, REJECTED, error);
    }
  } else {
    transition(promise, FULFILLED, x);
  }
}

Promise.deferred = function () {
  let defer = {};
  defer.promise = new Promise((resolve, reject) => {
    defer.resolve = resolve;
    defer.reject = reject;
  });
  return defer;
};

module.exports = Promise;
