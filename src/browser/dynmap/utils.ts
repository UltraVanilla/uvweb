import jQueryType from "jquery";

declare global {
    interface Window {
        jQuery: typeof jQueryType;
        $: typeof jQueryType;
        dynmap: any;
        map: any;
    }
}

export function getCenterCoords() {
    let coords = { x: 0, y: 64, z: 0, world: window.dynmap.world };
    coords = window.dynmap.maptype.getProjection().fromLatLngToLocation(window.map.getBounds().getCenter(), 64);

    coords.x = Math.round(coords.x);
    coords.z = Math.round(coords.z);
    coords.world = window.dynmap.world;

    return coords;
}

export function waitForDynmap() {
    return new Promise((resolve) => {
        if (window.dynmap != null) resolve(window.dynmap);
        // yup
        const loop = () =>
            requestAnimationFrame(() => {
                if (window.dynmap != null) {
                    resolve(window.dynmap);
                } else {
                    loop();
                }
            });
        loop();
    });
}
