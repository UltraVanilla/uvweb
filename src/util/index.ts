export function sleep(timeout: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, timeout);
    });
}

export class DeferredPromise<T> {
    promise: Promise<T>;
    resolve!: (value: T) => void;
    reject!: (reason?: any) => void;

    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this.reject = reject;
            this.resolve = resolve;
        });
    }
}

export function deferredPromise<T>(): {
    resolve: (value: T) => void;
    reject: (reason?: any) => void;
    promise: Promise<T>;
} {
    let resolve!: (value: T) => void;
    let reject!: (reason?: any) => void;

    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });

    return {
        resolve,
        reject,
        promise,
    };
}
