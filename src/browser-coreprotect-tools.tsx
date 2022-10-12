import { processLogs, FilterOptions } from "./coreprotect-delta";
import React from "jsx-dom";

const optionsTextArea = document.getElementById("coreprotect-delta-options") as HTMLTextAreaElement;
const logsTextArea = document.getElementById("coreprotect-delta-logs") as HTMLTextAreaElement;
const deltaOutput = document.getElementById("coreprotect-delta-output") as HTMLPreElement;
const formattedContainer = document.getElementById("coreprotect-formatted") as HTMLDivElement;

const defaultOptions = `return {
    ignoreRolledBack: true,
    needSorting: false,
//     whitelistUsernames: [],
//     blacklistUsernames: [],
//     boundingBox: {
//         x: [-698, -492],
//         y: [0, 26],
//         z: [64, 314],
//         invert: false,
//     },
//     specialFilters: ["noDiamondsAdded", "expensiveItems"]
};`;

if (optionsTextArea.value.length === 0) optionsTextArea.value = defaultOptions;

document.getElementById("coreprotect-delta")!.onsubmit = () => {
    try {
        // eval this shit up
        const filterOptions = new Function(optionsTextArea.value)() as FilterOptions;

        const results = processLogs(logsTextArea.value, filterOptions);
        deltaOutput.innerText = JSON.stringify(results, null, 4);

        formattedContainer.innerText = "";

        for (const log of results.logs) {
            const formattedText = log.originalText
                .replace(/§./g, "")
                .replace(/.*\[CHAT\] /, "")
                .replace(/\n.*/, "");

            const elem = (
                <div className="coreprotect-log">
                    <p>
                        Estimated timestamp: <code>{log.timestamp.toISOString()}</code>
                    </p>
                    <p style={log.isRolledBack ? "text-decoration: line-through;" : ""}>
                        <code>{formattedText}</code>
                    </p>
                </div>
            );

            if (log.location != null) {
                const locationString = log.location.dim === "unknown" ? "world" : log.location.dim;
                const locationCopy = (
                    <div>
                        <a href="javascript:void(0);" className="link">
                            /co tp {locationString} {log.location.x} {log.location.y} {log.location.z}
                        </a>
                    </div>
                ) as HTMLAnchorElement;

                let phantomInput: HTMLInputElement;

                locationCopy.addEventListener("click", () => {
                    if (phantomInput == null) {
                        phantomInput = (<input type="text" value={locationCopy.innerText} />) as HTMLInputElement;
                        locationCopy.appendChild(phantomInput);
                    }
                    phantomInput.select();
                    document.execCommand("copy");
                });

                if (log.location.dim === "unknown") {
                    const warning = (
                        <p>
                            <div className="warning">
                                <strong>Warning:</strong> Dimension unknown!
                            </div>
                        </p>
                    ) as HTMLParagraphElement;
                    elem.appendChild(warning);
                }
                elem.appendChild(locationCopy);
            } else {
                const warning = (
                    <p>
                        <div className="warning">
                            <strong>Warning:</strong> Location unknown!
                        </div>
                    </p>
                ) as HTMLParagraphElement;
                elem.appendChild(warning);
            }

            formattedContainer.appendChild(elem);
        }
    } catch (err) {
        alert("Error occured, check javascript console");
        console.error(err);
    }
    return false;
};
