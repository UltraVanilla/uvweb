console.log("Loaded main script");

import jsPanel from "jspanel4/dist/jspanel";
import jQueryType from "jquery";
import React from "jsx-dom";

import roleColors from "../../role-colors";
import { DynmapPing, AccountInfo, CancelCoreprotectCommandResult, isStaff } from "../../auth/auth-api";

import { decode, decodeJustTimestamp } from "../../codecs/dynmap-update-ping";
import { deferredPromise, merge } from "../../util";
import Module, { BaseModuleConfiguration } from "./Module";
import { waitForDynmap, getCenterCoords } from "./utils";

interface FrontendConfig {
    modules: { [name: string]: BaseModuleConfiguration & any };
}

const globalConfig: FrontendConfig = {
    modules: {},
};

declare global {
    interface Window {
        jQuery: typeof jQueryType;
        $: typeof jQueryType;
        dynmap: any;
        map: any;
    }
}

const ONE_WEEK = 60 * 60 * 24 * 7;

let dynmap = window.dynmap;
let map = window.map;
const $ = window.$;

console.log("Hooked to Dynmap objects");

(window as any).dynUpdate = async function dynUpdate(
    url: string,
    cb: (ping: DynmapPing) => void = () => {},
): Promise<DynmapPing> {
    const res = await fetch(url.replace("up/", "up-binary/"));

    // try again on fail
    if (!res.ok) return dynUpdate(url, cb);

    const bin = new Uint8Array(await res.arrayBuffer());

    const time = decodeJustTimestamp(bin);
    const dictionary = await getDictionary(Math.floor(time / ONE_WEEK) * ONE_WEEK);

    const decoded = decode(bin, dictionary);
    cb(decoded);
    return decoded;
};

let dicts: { [time: number]: string[] } = {};
async function getDictionary(time: number): Promise<string[]> {
    if (dicts[time] != null) return dicts[time];
    const res = await fetch(`/up-dictionary/world/world/${time}`);

    if (!res.ok) return getDictionary(time);
    const dict = await res.json();
    dicts[time] = dict;
    return dict;
}

window.addEventListener("load", function () {
    console.log("Detected window load");
    // a way to handle multiple things loading to indicate it with only one spinner
    const loadAnimationController = {
        thingsLoading: new Set(),
        load(thing: string) {
            this.thingsLoading.add(thing);
            this.logo.setAttribute("src", "assets/load.gif");
        },
        finish(thing: string) {
            this.thingsLoading.delete(thing);
            if (this.thingsLoading.size === 0) {
                this.logo.setAttribute("src", this.originalSrc);
            }
        },
        logo: document.getElementsByClassName("uv-logo")[0],
        originalSrc: document.getElementsByClassName("uv-logo")[0].getAttribute("src") || "",
    };

    loadAnimationController.load("firstupdate");

    waitForDynmap().then(() => {
        console.log("Detected dynmap load");
        let loadConditionMarkers = false;
        let loadConditionUpdated = false;

        $(window.dynmap).one("markersupdated", (a) => {
            console.log("Detected first markers update");
            loadConditionMarkers = true;
            if (loadConditionMarkers && loadConditionUpdated) startLoad();
        });
        $(window.dynmap).one("worldupdating", (a) => {
            console.log("Detected first world update");
            loadConditionUpdated = true;
            if (loadConditionMarkers && loadConditionUpdated) startLoad();
        });

        function startLoad() {
            map = window.map;
            dynmap = window.dynmap;
            loadAnimationController.finish("firstupdate");
            // once dynmap starts, we can start our extensions
            loadUltraVanilla();
        }

        $(dynmap).bind("load-from-center", () => {
            loadAnimationController.load("tiles");
        });
        $(dynmap).bind("tile-queue-loaded", () => {
            loadAnimationController.finish("tiles");
        });
    });

    async function loadUltraVanilla() {
        console.log("Loading extensions...");
        jsPanel.defaults.theme = "dark";
        jsPanel.ziBase = 1000;

        const header = document.getElementsByClassName("header")[0];

        const modulesArray = [await import("./NetherPortals")];
        const modules: { [name: string]: Module } = {};
        const { resolve, promise: modulesPromise } = deferredPromise<typeof modules>();

        for (const { default: Module, defaultConfig } of modulesArray) {
            const config = globalConfig.modules[Module.name] || {};

            if (config.enabled == null || config.enabled) {
                globalConfig.modules[Module.name] = merge(defaultConfig, config);

                modules[Module.name] = new Module(modulesPromise, config, {
                    $,
                    dynmap,
                    map,
                });
            }
        }
        await Promise.all(Object.values(modules).map((module) => module.ready)).then(() => resolve(modules));

        // nether handling
        {
            if (dynmap.worlds["world_nether"] != null && dynmap.worlds["world_nether"].maps["nether_roof"] != null) {
                dynmap.worlds["world_nether"].defaultmap = dynmap.worlds["world_nether"].maps["nether_roof"];
            }

            const netherRoof = $(".leaflet-control-layers-overlays")
                .find("span:contains('NetherRoof')")
                .parent()
                .find("input");
            const netherMidLevel = $(".leaflet-control-layers-overlays")
                .find("span:contains('Nether Mid Level')")
                .parent()
                .find("input");
            const netherUpperLevel = $(".leaflet-control-layers-overlays")
                .find("span:contains('Nether Upper Level')")
                .parent()
                .find("input");
            const netherLowerLevel = $(".leaflet-control-layers-overlays")
                .find("span:contains('Nether Lower Level')")
                .parent()
                .find("input");

            if (
                netherRoof.length != 0 &&
                netherMidLevel.length != 0 &&
                netherUpperLevel.length != 0 &&
                netherLowerLevel.length != 0
            ) {
                $(dynmap).on("mapchanged", () => {
                    const curMap = `${dynmap.world.name}:${dynmap.maptype.options.name}`;
                    if (curMap === "world_nether:flat") {
                        if (netherRoof.is(":checked")) {
                            netherRoof.click();
                        }
                        if (!netherMidLevel.is(":checked")) {
                            netherMidLevel.click();
                        }
                        if (!netherUpperLevel.is(":checked")) {
                            netherUpperLevel.click();
                        }
                        if (!netherLowerLevel.is(":checked")) {
                            netherLowerLevel.click();
                        }
                    } else if (curMap === "world_nether:nether_roof") {
                        if (!netherRoof.is(":checked")) {
                            netherRoof.click();
                        }
                        if (netherMidLevel.is(":checked")) {
                            netherMidLevel.click();
                        }
                        if (netherUpperLevel.is(":checked")) {
                            netherUpperLevel.click();
                        }
                        if (netherLowerLevel.is(":checked")) {
                            netherLowerLevel.click();
                        }
                    }
                });
            }
        }

        // inject crosshairs
        $(
            <>
                <div className="xcrosshair crosshair"></div>
                <div className="ycrosshair crosshair"></div>
            </>,
        ).appendTo($(".dynmap"));

        // set up toggle checkboxes
        {
            const headerCheckbox = $(".header-checkbox");
            const crosshairCheckbox = $(".crosshair-checkbox");

            if (localStorage.enableHeader == null) {
                localStorage.enableHeader = true;
            }

            if (localStorage.enableCrosshair == null) {
                localStorage.enableCrosshair = false;
            }
            headerCheckbox.prop("checked", localStorage.enableHeader === "true");
            crosshairCheckbox.prop("checked", localStorage.enableCrosshair === "true");

            updateHeader();
            updateCrosshair();

            headerCheckbox.change(() => {
                localStorage.enableHeader = headerCheckbox.prop("checked");
                updateHeader();
            });

            crosshairCheckbox.change(() => {
                localStorage.enableCrosshair = crosshairCheckbox.prop("checked");
                updateCrosshair();
            });

            function updateHeader() {
                if (headerCheckbox.prop("checked")) {
                    header.classList.remove("header-disabled");
                } else {
                    header.classList.add("header-disabled");
                }
            }
            function updateCrosshair() {
                if (crosshairCheckbox.prop("checked")) {
                    $(".dynmap .crosshair").show();
                } else {
                    $(".dynmap .crosshair").hide();
                }
            }
        }

        // open source window
        {
            let numPressed = 0;
            $(".server-open-source").click(() => {
                numPressed++;
                if (numPressed > 10) {
                    jsPanel.create({
                        content: <h1>Stop fucking pressing this button</h1>,
                        headerTitle: "Wtf?",
                        position: "center",
                        panelSize: "560 150",
                    });
                    return;
                }

                const contents = $(
                    <div>
                        <p>UltraVanilla extensions for Dynmap made by lordpipe released into public domain</p>
                        <a className="link" href="https://github.com/lordofpipes/uvweb" target="blank" rel="noreferrer">
                            uvweb on GitHub
                        </a>

                        <p>Dynmap by Mikeprimm</p>
                        <a className="link" href="https://github.com/webbukkit/dynmap" target="blank" rel="noreferrer">
                            dynmap on GitHub
                        </a>

                        <h4>Server Plugins</h4>

                        <p>UltraVanilla plugin by lordpipe and Akoot_</p>
                        <a
                            className="link"
                            href="https://github.com/Akoot/UltraVanilla"
                            target="blank"
                            rel="noreferrer"
                        >
                            UltraVanilla on GitHub
                        </a>

                        <p>
                            ArmorStandTools, Brewery, Chairs, ClientDetector, CoreProtect, DiscordSRV, dynmap,
                            floodgate, FoundDiamonds, Geyser-Spigot, Insights, LessEntropy, LimitPillagers, LuckPerms,
                            OpenInv, SuperVanish, TimedRestart, UltraBlocks, UltraVanilla, Vault, VaultJwt,
                            ViaBackwards, ViaVersion, WorldEdit
                        </p>
                    </div>,
                );

                jsPanel.create({
                    content: contents[0],
                    headerTitle: "Open Source",
                    position: "center",
                    panelSize: "410 560",
                });
            });
        }

        // account panel
        {
            let panel: jsPanel.JsPanel | null;

            const contents = $(
                <div>
                    <h3>Account</h3>
                    <p>
                        Run <code>/token</code> ingame to log in
                    </p>
                    <p>
                        Logged in as: <strong className="account-logged-in-as">Not logged in</strong>
                    </p>
                    <p>
                        Mojang UUID: <strong className="account-logged-in-as-uuid">Not logged in</strong>
                    </p>
                    <a className="link" href="/logout" style="display:none;" rel="noreferrer">
                        Logout
                    </a>
                </div>,
            );

            (async () => {
                try {
                    const accountInfoRes = await fetch("/account-info");
                    if (accountInfoRes.status === 451) {
                        jsPanel.create({
                            content: (
                                <>
                                    <p>
                                        <strong>
                                            In order to prevent continued harassment of our members, users who are IP
                                            banned from the server may not view Dynmap.
                                        </strong>
                                    </p>
                                    <p>Contact Akoot_#4160 to appeal your ban from the server.</p>
                                    <p>Contact pipe#4348 to remove this dynmap ban if it was a mistake.</p>
                                </>
                            ),
                            headerTitle: "Banned",
                            position: "center",
                            panelSize: "560 200",
                        });
                        return;
                    }
                    const accountInfo: AccountInfo = await accountInfoRes.json();
                    contents.find(".account-logged-in-as").text(accountInfo.name);
                    contents.find(".account-logged-in-as-uuid").text(accountInfo.uuid);
                    contents.find(".link").show();

                    const button = $(".tools-account");

                    const capitalizedRoleName =
                        accountInfo.permissions.primaryGroup.charAt(0).toUpperCase() +
                        accountInfo.permissions.primaryGroup.slice(1);
                    const roleStyle = roleColors[accountInfo.permissions.primaryGroup.toLowerCase()] || {
                        color: "#ffffff",
                        name: capitalizedRoleName,
                    };

                    button.empty().append(
                        $(
                            <>
                                [<span style={`color:${roleStyle.color}`}>{roleStyle.name}</span>] {accountInfo.name}
                            </>,
                        ),
                    );

                    if (isStaff(accountInfo)) {
                        contents.append(
                            <>
                                <h4>Staff tools</h4>
                                <div className="link-container">
                                    <a className="link" href="/staff/coreprotect-tools" target="blank" rel="noreferrer">
                                        CoreProtect tools by lordpipe
                                    </a>
                                </div>
                                <div className="link-container">
                                    <a className="link" href="/staff/actions" target="blank" rel="noreferrer">
                                        Staff actions log
                                    </a>
                                </div>
                                <div className="link-container">
                                    <button className="link cancel-coreprotect-command">
                                        Cancel coreprotect command
                                    </button>
                                </div>
                                <div className="link-container">
                                    <button className="link power-controls">Server power controls</button>
                                </div>
                            </>,
                        );

                        contents.find(".power-controls").click(async () => {
                            const contents = $(
                                <div>
                                    <h3>Server power controls</h3>
                                    <div>
                                        <button className="link" data-signal="start">
                                            Start
                                        </button>
                                        <button className="link" data-signal="restart">
                                            Restart
                                        </button>
                                        <button className="link" data-signal="stop">
                                            Stop
                                        </button>
                                    </div>
                                    <h4>Do not use Kill unless you have waited 1 minute after Stop!</h4>
                                    <div className="link-container">
                                        <button className="link" data-signal="kill">
                                            Kill
                                        </button>
                                    </div>
                                </div>,
                            );
                            jsPanel.create({
                                content: contents[0],
                                headerTitle: "Server Power Controls",
                                position: "center",
                                panelSize: "440 260",
                            });

                            contents.find(".link").click(async (evt) => {
                                const signal = evt.target.dataset["signal"];
                                const res = await fetch(`/staff/power/${signal}`, {
                                    method: "POST",
                                });

                                const pterodactylRes = await res.text();
                                const panel = jsPanel.create({
                                    content: (
                                        <>
                                            <p>Attempted signal {signal}</p>
                                            <p>
                                                <strong>Pterodactyl result:</strong>{" "}
                                                {pterodactylRes[0] === "2" ? "Success" : "Failure"} ({pterodactylRes})
                                            </p>
                                        </>
                                    ),
                                    headerTitle: "Server Power Controls",
                                    position: "center",
                                    panelSize: "410 150",
                                });
                                setTimeout(() => {
                                    panel.close();
                                }, 3000);
                            });
                        });

                        contents.find(".cancel-coreprotect-command").click(async () => {
                            const cancelRes = await fetch("/staff/cancel-coreprotect-command", { method: "POST" });
                            const cancel: CancelCoreprotectCommandResult = await cancelRes.json();

                            const content = (
                                <>
                                    <h3>
                                        {cancel.commandExists
                                            ? "Successfully stopped command"
                                            : "There is no command running!"}
                                    </h3>
                                </>
                            );

                            if (cancel.commandExists) {
                                content.append(
                                    <>
                                        <p>
                                            <strong>State: </strong> <code>{cancel.state}</code>
                                        </p>
                                        <p>
                                            <strong>Command: </strong> <code>{cancel.command}</code>
                                        </p>
                                    </>,
                                );
                            }

                            jsPanel.create({
                                content,
                                headerTitle: "Cancel Coreprotect Command",
                                position: "left-bottom",
                                panelSize: "500 350",
                            });
                        });
                    }
                } catch (err) {
                    // fail silently
                }
            })();

            $(".tools-account").click(async () => {
                if (panel != null) {
                    panel.normalize();
                    panel.front();
                    return;
                }
                panel = jsPanel.create({
                    content: contents[0],
                    headerTitle: "Account",
                    position: "center",
                    panelSize: "430 490",
                    onclosed() {
                        panel = null;
                    },
                });
            });
        }

        // settings panel
        {
            let panel: jsPanel.JsPanel | null;

            $(".tools-settings").click(async () => {
                if (panel != null) {
                    panel.normalize();
                    panel.front();
                    return;
                }

                const contents = $(
                    <div>
                        <h3>Configure UI</h3>
                        <div>
                            <label htmlFor="settings-brightness">Brightness: </label>
                            <input id="settings-brightness" type="range" min="50" max="200" value="100" />
                        </div>
                        <div>
                            <label htmlFor="settings-contrast">Contrast: </label>
                            <input id="settings-contrast" type="range" min="50" max="200" value="100" />
                        </div>
                        <div className="settings-list-of-elements" />
                    </div>,
                );
                const mapTiles = $(".leaflet-map-pane");

                const contrastSlider = contents.find("#settings-contrast");
                const brightnessSlider = contents.find("#settings-brightness");

                function updateFilters() {
                    mapTiles.css("filter", `contrast(${contrastSlider.val()}%) brightness(${brightnessSlider.val()}%)`);
                }

                contents.find("#settings-contrast").on("input change", updateFilters);
                contents.find("#settings-brightness").on("input change", updateFilters);

                // generate a toggle checkbox for each thing that can be disabled
                $("[data-toggle]").each((_, elem) => {
                    const name = $(elem).data("toggle");
                    let enabled = localStorage[`elementEnabled.${name}`] !== "false";

                    const checkbox = $(
                        <div>
                            <input
                                type="checkbox"
                                id={`element-toggle-checkbox-${name}`}
                                className="element-toggle-checkbox"
                            />
                            <label htmlFor={`element-toggle-checkbox-${name}`}>Show this thing?</label>
                            <div className="element-toggle-preview" />
                        </div>,
                    );

                    // show a non-interactive copy of the element
                    const previewElem = $(elem)
                        .clone()
                        .show()
                        .css("float", "none")
                        .css("position", "static")
                        .css("pointerEvents", "none")
                        .removeAttr("data-toggle");

                    previewElem.find("*").unbind("click");

                    checkbox.find(".element-toggle-preview").append(previewElem);

                    const checkboxInput = checkbox.find("input");
                    checkboxInput.prop("checked", enabled);

                    checkboxInput.change(() => {
                        enabled = checkboxInput.prop("checked");
                        localStorage[`elementEnabled.${name}`] = enabled;
                        if (enabled) {
                            $(elem).show();
                        } else {
                            $(elem).hide();
                        }
                    });

                    contents.find(".settings-list-of-elements").append(checkbox);
                });

                panel = jsPanel.create({
                    content: contents[0],
                    headerTitle: "Settings",
                    position: "center",
                    panelSize: "340 95%",
                    onclosed() {
                        panel = null;
                    },
                });
            });
        }

        dynmap.worlds.world.humanName = "overworld";
        dynmap.worlds.world_the_end.humanName = "the end";
        dynmap.worlds.world_nether.humanName = "nether";

        let coords = { x: 0, y: 64, z: 0, world: dynmap.world };

        function getCenterCoords() {
            coords = dynmap.maptype.getProjection().fromLatLngToLocation(map.getBounds().getCenter(), 64);

            coords.x = Math.round(coords.x);
            coords.z = Math.round(coords.z);
            coords.world = dynmap.world;

            return coords;
        }

        getCenterCoords();

        // handle coordinates in URL hash
        {
            let avoidUpdating = false;

            map.on("moveend", () => {
                const coords = getCenterCoords();

                const newHash = [map._zoom, coords.x.toString(), coords.z.toString()];
                if (coords.world.name !== "world") newHash.push(coords.world.name);
                // do not allow the readUrlCoords handler to go off
                avoidUpdating = true;
                location.hash = "Z" + newHash.join(",");
            });

            window.addEventListener("hashchange", readUrlCoords);
            readUrlCoords();
            function readUrlCoords() {
                if (avoidUpdating) {
                    avoidUpdating = false;
                    return;
                }
                const parts = location.hash.slice(2).split(",");
                const zoom = parseFloat(parts[0]);
                const x = parseFloat(parts[1]);
                const z = parseFloat(parts[2]);

                if (isNaN(zoom) || isNaN(x) || isNaN(z)) return;

                let world = parts[3];

                if (world !== "world_nether" && world !== "world_the_end") world = "world";

                dynmap.panToLocation({
                    world: dynmap.worlds[world],
                    x,
                    z,
                    y: 64,
                });
                map.setZoom(zoom);
            }
        }

        // display crosshair location and distance from mouse, and logic for copying coordinates
        {
            $(".coord-control-label").text("Mouse Location:");
            $(".coord-control").attr("data-toggle", "mouse-location");
            $(".largeclock").attr("data-toggle", "large-clock");
            $(".leaflet-control-layers").attr("data-toggle", "layers-button");
            $(".leaflet-control-zoom").attr("data-toggle", "zoom-buttons");

            const centerCoords = $(
                <div className="coord-control coord-control-center leaflet-control" data-toggle="center-coords">
                    <div className="coord-control-label">Crosshair Location:</div>
                    <div className="coord-control-value">---,---,---</div>
                    <div>Click to copy to clipboard</div>
                </div>,
            );
            const distanceIndicator = $(
                <div className="coord-control leaflet-control" data-toggle="distance-indicator">
                    <div className="coord-control-label">Distance: </div>
                    <div className="coord-control-value">---</div>
                </div>,
            );

            distanceIndicator.appendTo($(".leaflet-top.leaflet-left"));
            centerCoords.appendTo($(".leaflet-top.leaflet-left"));

            const distanceValue = distanceIndicator.find(".coord-control-value");
            const centerCoordsValue = centerCoords.find(".coord-control-value");

            function updateCoords() {
                const coords = getCenterCoords();

                centerCoordsValue.text(`${coords.x},${coords.y},${coords.z}`);
            }

            updateCoords();
            map.on("move", updateCoords);
            map.on("mousemove", (event: any) => {
                const mouse = dynmap.getProjection().fromLatLngToLocation(event.latlng, 64);
                // calculate distance
                distanceValue.text(Math.floor(Math.sqrt((coords.x - mouse.x) ** 2 + (coords.z - mouse.z) ** 2)));
            });

            // coordinates copying
            centerCoords.click(async () => {
                const panel = getPanel();
                panel.normalize();
                panel.front();

                $(panel.content)
                    .find(`#copy-coordinates0`)
                    .val(`${coords.x}, ${coords.z} in ${coords.world.humanName}`);

                $(panel.content).find(`#copy-coordinates1`).val(`x${coords.x}/y${coords.y}/z${coords.z}`);

                $(panel.content)
                    .find(`#copy-coordinates2`)
                    .val(`/co tp ${coords.world.name} ${coords.x} ${coords.y} ${coords.z}`);

                $(panel.content).find(`#copy-coordinates3`).val(`${coords.x} ${coords.y} ${coords.z}`);

                $(panel.content).find(`#copy-coordinates4`).val(`${coords.x},${coords.y},${coords.z}`);

                $(panel.content).find(`#copy-coordinates5`).val(location.toString());

                // automatically copy to clipboard
                $(panel.content).find(`#copy-coordinates${localStorage.copyPreference}`).select();

                document.execCommand("copy");
            });

            let panel: jsPanel.JsPanel | null;

            function getPanel() {
                if (panel != null) return panel;
                const contents = $(
                    <div className="copy-coordinates-window">
                        <table>
                            <tr>
                                <td>
                                    <label htmlFor="copy-coordinates0">Human</label>
                                </td>
                                <td>
                                    <input type="text" id="copy-coordinates0" className="copy-coordinates" />
                                </td>
                                <td>
                                    <button data-option="0">Set as default</button>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <label htmlFor="copy-coordinates1">Human2</label>
                                </td>
                                <td>
                                    <input type="text" id="copy-coordinates1" className="copy-coordinates" />
                                </td>
                                <td>
                                    <button data-option="1">Set as default</button>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <label htmlFor="copy-coordinates2">Teleport</label>
                                </td>
                                <td>
                                    <input type="text" id="copy-coordinates2" className="copy-coordinates" />
                                </td>
                                <td>
                                    <button data-option="2">Set as default</button>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <label htmlFor="copy-coordinates3">Spaces</label>
                                </td>
                                <td>
                                    <input type="text" id="copy-coordinates3" className="copy-coordinates" />
                                </td>
                                <td>
                                    <button data-option="3">Set as default</button>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <label htmlFor="copy-coordinates4">Commas</label>
                                </td>
                                <td>
                                    <input type="text" id="copy-coordinates4" className="copy-coordinates" />
                                </td>
                                <td>
                                    <button data-option="4">Set as default</button>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <label htmlFor="copy-coordinates5">URL</label>
                                </td>
                                <td>
                                    <input type="text" id="copy-coordinates5" className="copy-coordinates" />
                                </td>
                                <td>
                                    <button data-option="5">Set as default</button>
                                </td>
                            </tr>
                        </table>
                    </div>,
                );

                if (localStorage.copyPreference == null) localStorage.copyPreference = "0";

                // save format preference
                contents
                    .find("button")
                    .show()
                    .click((evt) => {
                        contents.find("button").show();
                        const copyPreference = $(evt.currentTarget).attr("data-option");
                        localStorage.copyPreference = copyPreference;
                        contents.find(`button[data-option=${localStorage.copyPreference}]`).hide();
                    });
                contents.find(`button[data-option=${localStorage.copyPreference}]`).hide();

                panel = jsPanel.create({
                    content: contents[0],
                    headerTitle: "Copy Coordinates",
                    resizeit: false,
                    position: "left-bottom",
                    contentSize: "445 245",
                    headerControls: {
                        maximize: "remove",
                    },
                    onclosed() {
                        panel = null;
                    },
                });

                return panel;
            }
        }

        // a simple command to go to the same coordinates in the nether/end
        $(".tools-jump-to-old-spawn").click(() => {
            dynmap.panToLocation({
                world: dynmap.worlds.world,
                x: -1334,
                y: 64,
                z: -29,
            });
        });

        $(".tools-jump-to-new-spawn").click(() => {
            dynmap.panToLocation({
                world: dynmap.worlds.world,
                x: -2002407,
                y: 64,
                z: -1995441,
            });
        });

        $(".tools-jump-to-outpost").click(() => {
            dynmap.panToLocation({
                world: dynmap.worlds.world,
                x: -1890757,
                y: 64,
                z: -1894551,
            });
        });

        $(".tools-go-to-coordinates").click(async () => {
            const contents = $(
                <form>
                    <div>
                        <label htmlFor="input-coordinates">Coordinate string:</label>
                        <input type="text" id="input-coordinates" className="input-coordinates" />
                    </div>
                    <div>
                        <label htmlFor="input-coordinates-format">Format: </label>
                        <select id="input-coordinates-format" className="input-coordinates-format">
                            <option value="xyz" selected>
                                XYZ (Press F3+C ingame)
                            </option>
                            <option value="xzy">XZ (VoxelMap)</option>
                        </select>
                        <div>
                            <label htmlFor="input-coordinates-world">World: </label>
                            <select id="input-coordinates-world" className="input-coordinates-world">
                                <option value="world">Overworld</option>
                                <option value="world_nether">Nether</option>
                                <option value="world_the_end">End</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <div>
                            <label htmlFor="input-coordinates-x">X:</label>
                            <input type="number" id="input-coordinates-x" className="input-coordinates-x" step="any" />
                        </div>
                        <div>
                            <label htmlFor="input-coordinates-z">Z:</label>
                            <input type="number" id="input-coordinates-z" className="input-coordinates-z" step="any" />
                        </div>
                    </div>
                    <div>
                        <input type="submit" className="input-coordinates-go" value="Goto Location" />
                        <input type="submit" className="input-coordinates-ok" value="Goto Location and Dismiss" />
                    </div>
                </form>,
            );

            // avoid form submission to webserver
            contents.submit((event) => {
                event.preventDefault();
                return false;
            });

            const inputStringCoordinates = contents.find(".input-coordinates");
            const inputFormat = contents.find(".input-coordinates-format");

            const inputX = contents.find(".input-coordinates-x");
            const inputZ = contents.find(".input-coordinates-z");

            const inputWorld = contents.find(".input-coordinates-world");

            // default to currently selected world
            inputWorld.val(dynmap.world.name);

            // grab format preference from localStorage
            if (localStorage.formatPreference != null) {
                inputFormat.val(localStorage.formatPreference);
            }

            // write format preference to localStorage
            inputFormat.change(() => {
                localStorage.formatPreference = inputFormat.val();
            });

            inputStringCoordinates.change(() => {
                const str = inputStringCoordinates.val() as string;

                if (inputFormat.val() === "xyz") {
                    const matches = str.match(/[^\d.-]*([\d.-]+)[^\d\-.]+([\d.-]+)[^\d\-.]+([\d.-]+)/);
                    if (matches == null || matches.length < 4) return;
                    inputX.val(matches[1]);
                    inputZ.val(matches[3]);
                } else {
                    const matches = str.match(/[^\d.-]*([\d.-]+)[^\d\-.]+([\d.-]+)/);
                    if (matches == null || matches.length < 3) return;
                    inputX.val(matches[1]);
                    inputZ.val(matches[2]);
                }

                if (str.includes("nether")) inputWorld.val("world_nether");
                if (str.includes("the end")) inputWorld.val("world_the_end");
                if (str.includes("overworld")) inputWorld.val("world");
            });

            contents.find(".input-coordinates-go").click(() => {
                dynmap.panToLocation({
                    world: dynmap.worlds[inputWorld.val() as string],
                    x: parseFloat(inputX.val() as string),
                    z: parseFloat(inputZ.val() as string),
                    y: 64,
                });
            });

            contents.find(".input-coordinates-ok").click(() => {
                dynmap.panToLocation({
                    world: dynmap.worlds[inputWorld.val() as string],
                    x: parseFloat(inputX.val() as string),
                    z: parseFloat(inputZ.val() as string),
                    y: 64,
                });
                panel.close();
            });

            const panel = jsPanel.create({
                content: contents[0],
                headerTitle: "Go To Coordinates",
                resizeit: false,
                position: "center-bottom",
                contentSize: "380 210",
                headerControls: {
                    maximize: "remove",
                },
            });

            inputStringCoordinates.focus();
        });

        {
            // store the state of sidebar pinning
            const pinnedObserver = new MutationObserver((mutationsList) => {
                mutationsList.forEach((mutation) => {
                    if (mutation.attributeName === "class" && mutation.target instanceof HTMLElement) {
                        const isPinned = mutation.target.classList.contains("pinned");

                        if (isPinned) {
                            $(".tools-buttons").addClass("sidebar-pinned");
                        } else {
                            $(".tools-buttons").removeClass("sidebar-pinned");
                        }
                        localStorage.pinSidebar = isPinned;
                    }
                });
            });

            pinnedObserver.observe($(".dynmap .sidebar")[0], {
                attributes: true,
            });

            if (localStorage.pinSidebar === "true") $(".dynmap .sidebar").addClass("pinned");
        }
        console.log("Finished loading extensions");
    }

    {
        const pageObserver = new MutationObserver((_mutationsList) => {
            Object.entries(localStorage).forEach(([key, value]) => {
                const crumbs = key.split(".");
                if (crumbs[0] === "elementEnabled") {
                    const name = crumbs[1];

                    if (value === "false") {
                        $(`[data-toggle='${name}']`).hide();
                    }
                }
            });
        });

        pageObserver.observe($("body")[0], { subtree: true, childList: true });
    }
});
