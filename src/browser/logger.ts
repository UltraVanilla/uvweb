import storage from "local-storage-fallback";

const nav: any = {};
for (var i in navigator) nav[i] = (navigator as any)[i];

function publish(type: string, args: any, trace?: string) {
    fetch("/log", {
        method: "POST",
        headers: {
            Accept: "application/json, text/plain, */*",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            type,
            message: Array.from(args),
            trace,
            time: Date.now(),
            elapsed: performance != null ? performance.now() : undefined,
            agent: nav,
        }),
    }).catch((err) => {
        //ignore
    });
}

const cl = console.log;
console.log = function (message: any) {
    cl.apply(this, arguments);
    publish("log", arguments);
};

const ctbl = console.table;
console.log = function (message: any) {
    ctbl.apply(this, arguments);
    publish("log", arguments);
};

const ci = console.info;
console.log = function (message: any) {
    ci.apply(this, arguments);
    publish("info", arguments);
};

const cw = console.warn;
console.warn = function (message: any) {
    cw.apply(this, arguments);
    publish("warn", arguments);
};

const ce = console.error;
console.error = function (message: any) {
    ce.apply(this, arguments);
    const dummyException = new Error();
    publish("error", arguments, dummyException.stack != null ? dummyException.stack : undefined);
};

const ct = console.trace;
console.trace = function (message: any) {
    ct.apply(this, arguments);

    const dummyException = new Error();
    publish("trace", arguments, dummyException.stack != null ? dummyException.stack : undefined);
};

window.onerror = function (msg, url, lineNo, columnNo, error) {
    publish(
        "error",
        [msg, { msg, url, lineNo, columnNo, error }],
        error != null && error.stack != null ? error.stack : undefined,
    );

    return false;
};
