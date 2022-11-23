import resolve from "@rollup/plugin-node-resolve";
import babel from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { terser } from "rollup-plugin-terser";
import nodePolyfills from "rollup-plugin-polyfill-node";
import gzip from "rollup-plugin-gzip";

const production = process.env.NODE_ENV === "production";

const extensions = [".js", ".ts", ".tsx"];

export default [
    {
        input: {
            logger: "src/browser/logger.ts",
            dynmap: "src/browser/dynmap/index.tsx",
            "coreprotect-tools": "src/browser/coreprotect-tools/index.tsx",
        },
        output: {
            dir: "assets",
            format: "es",
            sourcemap: true,
            chunkFileNames: "common-[hash]-[name].js",
        },
        preserveEntrySignatures: false,
        plugins: [
            nodePolyfills(),
            resolve({
                extensions,
            }),
            commonjs({
                include: /node_modules/,
            }),
            json(),
            babel({
                extensions,
                include: [/src/],
                babelrc: false,
                babelHelpers: "inline",
                presets: ["@babel/preset-react", "@babel/preset-typescript"],
                plugins: ["@babel/plugin-proposal-class-properties"],
                inputSourceMap: true,
            }),
            // production ? terser() : undefined,
            terser({
                ecma: "2016",
            }),
        ],
    },
    {
        input: {
            logger: "src/browser/logger.ts",
            dynmap: "src/browser/dynmap/index.tsx",
            "coreprotect-tools": "src/browser/coreprotect-tools/index.tsx",
        },
        output: {
            dir: "assets/system",
            format: "system",
            sourcemap: true,
            chunkFileNames: "common-[hash]-[name].js",
        },
        preserveEntrySignatures: false,
        plugins: [
            nodePolyfills(),
            resolve({
                extensions,
            }),
            commonjs({
                include: /node_modules/,
            }),
            json(),
            babel({
                extensions,
                include: ["src/**", "node_modules/jsx-dom/**"],
                babelrc: false,
                babelHelpers: "inline",
                presets: [
                    "@babel/preset-react",
                    "@babel/preset-typescript",
                    [
                        "@babel/preset-env",
                        {
                            targets: {
                                chrome: "20",
                                firefox: "35",
                            },
                            useBuiltIns: "entry",
                            corejs: "3.26",
                        },
                    ],
                ],
                plugins: ["@babel/plugin-proposal-class-properties"],
                inputSourceMap: true,
            }),
            terser({
                ecma: 5,
                safari10: true,
            }),
        ],
    },

    // Minified bundle

    {
        input: {
            logger: "src/browser/logger.ts",
            dynmap: "src/browser/dynmap/index.tsx",
            "coreprotect-tools": "src/browser/coreprotect-tools/index.tsx",
        },
        output: {
            dir: "assets/min",
            format: "es",
            sourcemap: true,
            chunkFileNames: "common-[hash]-[name].js",
        },
        preserveEntrySignatures: false,
        plugins: [
            nodePolyfills(),
            resolve({
                extensions,
            }),
            commonjs({
                include: /node_modules/,
            }),
            json(),
            babel({
                extensions,
                include: [/src/],
                babelrc: false,
                babelHelpers: "inline",
                presets: ["@babel/preset-react", "@babel/preset-typescript"],
                plugins: ["@babel/plugin-proposal-class-properties"],
                inputSourceMap: true,
            }),
            terser({
                ecma: "2016",
            }),
            gzip(),
        ],
    },
];
