import Koa from "koa";

import cheerio from "cheerio";

export default async (ctx: Koa.BaseContext): Promise<void> => {
    let body;
    let loaded = false;
    let error;
    try {
        //TODO: reintroduce timeout
        const res = await fetch(process.env.DYNMAP_BACKEND!, {});
        body = await res.text();
        loaded = true;
    } catch (err) {
        // fallback page
        error = err;
        body = `
            <!doctype html>
            <html>
                <head>
                    <meta charset="utf8">
                    <title>UltraVanilla</title>
                </head>
                <body>
                    <style>
                    html, body {
                        box-sizing: border-box;
                        margin: 0;
                        padding: 0;
                        background: white url("./assets/windows-xp.jpg");
                        background-size: cover;
                        background-repeat: no-repeat;
                        background-attachment: fixed;
                        background-position: center;
                    }
                    *, *:before, *:after {
                        box-sizing: inherit;
                    }
                    .header {
                        display: block !important;
                    }

                    .dynmap-broke {
                        background-color: rgba(255, 255, 255, 0.5);
                        padding: 20px;
                        margin: 30px;
                        font-size: 20px;
                    }
                    </style>
                </body>
            <html>
        `;
    }

    // we use cheerio to modify the page in-transit
    const $ = cheerio.load(body);

    // allow caching
    $("script").each((i, elem) => {
        const src = $(elem).attr("src");
        if (src == null) return;
        $(elem).attr("src", src.split("?")[0]);
    });
    $("link").each((i, elem) => {
        const href = $(elem).attr("href");
        if (href == null) return;
        $(elem).attr("href", href.split("?")[0]);
    });

    const newContainer = $("<div class=box>");

    const newHeader = $("<header>").addClass("header");

    $("<div>").text("UltraVanilla").addClass("header-part uv-logo-name").appendTo(newHeader);

    $("<img>").attr("src", "assets/416.png").addClass("header-part uv-logo").appendTo(newHeader);

    $(`
        <span class='header-info-container'>
            <div class='header-part server-info'>
                <strong class='server-info-label'>server address: </strong> play.ultravanilla.world</div>
            <div class='header-part server-info server-info-version'>
                <strong class='server-info-label'>version: </strong> 1.19<span style='color:#979797'>.3</span></div>
        </span>
    `).appendTo(newHeader);

    $("<div>").addClass("header-separator").appendTo(newHeader);

    $("<div><a href='https://discord.gg/kU4dkzk' target='blank' rel='noreferrer'>discord</a>")
        .addClass("header-part server-social server-discord")
        .appendTo(newHeader);

    $("<div><a href='https://www.reddit.com/r/UltraVanilla/' target='blank' rel='noreferrer'>reddit</a>")
        .addClass("header-part server-social server-reddit")
        .appendTo(newHeader);

    $(
        "<div><a href='https://wiki.ultravanilla.world/wiki/Main_Page' target='blank' rel='noreferrer'>community wiki</a></div>",
    )
        .addClass("header-part server-social server-wiki")
        .appendTo(newHeader);
    $(
        "<div>\
            <p>UltraVanilla is a small-scale LGBT-friendly community Minecraft survival server with minimal enhancements to the core game. 30 player slots is a sweetspot for a server that is not crowded or discouraging production. Community Projects are suggested and discussed on the discord, anyone is free to contribute! The server usually updates fast, and is currently running on Paper 1.19.3. No resets!</p>\
            <div class='close'>x</div>\
        </div>",
    )
        .addClass("server-description")
        .appendTo(newHeader);
    
    $(".server-description div.close").click(function() {
        $(".server-description").hide();
    });

    newContainer.append(newHeader);

    // move the dynmap container element inside our container
    if (loaded) {
        $("body #mcmap").appendTo(newContainer);

        if (loaded)
            $(`
                <div class="tools-buttons">
                    <button class="tools-button tools-settings">Settings</button>
                    <button class="tools-button tools-account" data-toggle="login">Login</button>
                    <button class="tools-button tools-go-to-coordinates" data-toggle="go-to-coordinates">Go to coordinates</button>
                    <button class="tools-button tools-nether-portal" data-toggle="nether-portal">Go through nether portal</button>
                    <button class="tools-button tools-jump-to-old-spawn" data-toggle="jump-to-old-spawn">Jump to Old Spawn</button>
                    <button class="tools-button tools-jump-to-new-spawn" data-toggle="jump-to-new-spawn">Jump to Spawn</button>
                    <button class="tools-button tools-jump-to-outpost" data-toggle="jump-to-outpost">Jump to 1.18 Outpost</button>
                    <div class="toggles">
                        <div data-toggle="enable-header"><label for='header-checkbox'>Enable header? </label><input type='checkbox' id='header-checkbox' class='header-checkbox' checked></div>
                        <div data-toggle="enable-crosshair"><label for='crosshair-checkbox'>Enable crosshair? </label><input type='checkbox' id='crosshair-checkbox' class='crosshair-checkbox'></div>
                    </div>
                </div>
            `).appendTo($("body"));

        $("<script>")
            .attr("type", "application/javascript")
            .attr("src", "assets/logger.js")
            .attr("type", "module")
            .appendTo($("head"));
        $("<script>")
            .attr("type", "application/javascript")
            .attr("src", "assets/dynmap.js")
            .attr("type", "module")
            .appendTo($("head"));
        $("<script>")
            .attr("type", "application/javascript")
            .attr("src", "assets/s.min.js")
            .attr("nomodule", "")
            .appendTo($("head"));
        $("<script>")
            .attr("type", "application/javascript")
            .attr("src", "assets/system/logger.js")
            .attr("nomodule", "")
            .appendTo($("head"));
        $("<script>")
            .attr("type", "application/javascript")
            .attr("src", "assets/system/dynmap.js")
            .attr("nomodule", "")
            .appendTo($("head"));
    } else {
        $(`
            <div class="dynmap-broke">
                <h3>Dynmap broke lol</h3>
                <pre class="error-msg"></pre>
            </div>
        `)
            .appendTo(newContainer)
            .find(".error-msg")
            .text(error.stack);
    }
    newContainer.appendTo($("body"));

    $("<link>").attr("href", "assets/ultravanilla.css").attr("rel", "stylesheet").appendTo($("head"));

    $("<link>").attr("href", "assets/jspanel.min.css").attr("rel", "stylesheet").appendTo($("head"));

    $("title").text("UltraVanilla");
    $("meta[name='description']").attr(
        "content",
        "UltraVanilla is a small-scale LGBT-friendly community Minecraft survival server with minimal enhancements to the core game. 30 player slots is a sweetspot for a server that is not crowded or discouraging production. Community Projects are suggested and discussed on the discord, anyone is free to contribute! The server usually updates fast, and is currently running on Paper 1.19.3. No resets!",
    );
    $("meta[name='keywords']").attr(
        "content",
        "minecraft, map, vanilla, friendly server, lgbt friendly, no resets, old school, dynmap, brewery",
    );
    $("link[rel='shortcut icon']").remove();
    $("link[rel='mask-icon']").remove();
    $("meta[name='msapplication-TileColor']").attr("content", "#a6c7d0");
    $("meta[name='theme-color']").attr("content", "#a6c7d0");

    ctx.append("Link", "</account-info>; rel=prefetch; as=fetch; crossorigin=anonymous");
    ctx.append("Link", "</configuration>; rel=prefetch; as=fetch; crossorigin=anonymous");
    [
        "/tiles/_markers_/marker_world.json",
        "/tiles/_markers_/house.png",
        "/tiles/_markers_/dog.png",
        "/tiles/_markers_/lighthouse.png",
        "/tiles/_markers_/bighouse.png",
        "/tiles/_markers_/bricks.png",
        "/tiles/_markers_/star.png",
        "/tiles/_markers_/tree.png",
        "/tiles/_markers_/pirateflag.png",
        "/tiles/_markers_/default.png",
        "/tiles/_markers_/tower.png",
        "/tiles/_markers_/redflag.png",
        "/tiles/_markers_/temple.png",
        "/tiles/_markers_/cart.png",
        "/tiles/_markers_/orangeflag.png",
        "/tiles/_markers_/blueflag.png",
        "/tiles/_markers_/flower.png",
        "/tiles/_markers_/skull.png",
        "/tiles/_markers_/diamond.png",
        "/tiles/_markers_/world.png",
        "/tiles/_markers_/building.png",
        "/tiles/_markers_/anchor.png",
        "/tiles/_markers_/ruby.png",
    ].forEach((path) => {
        ctx.append("Link", `<${path}>; rel=prefetch; as=image`);
    });
    [
        "/js/markers.js",
        "/js/chat.js",
        "/js/chatballoon.js",
        "/js/chatbox.js",
        "/js/playermarkers.js",
        "/js/link.js",
        "/js/timeofdayclock.js",
        "/js/coord.js",
    ].forEach((path) => {
        ctx.append("Link", `<${path}>; rel=prefetch; as=script`);
    });

    ctx.body = $.root().html();
};
