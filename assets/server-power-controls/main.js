$(".link").click(async (evt) => {
    const signal = evt.target.dataset["signal"];
    const res = await fetch(`/staff/power/${signal}`, {
        method: "POST",
    });

    const pterodactylRes = await res.text();
    window.alert(
        `Attempted signal ${signal}\n\nPterodactyl result: ${
            pterodactylRes[0] === "2" ? "Success" : "Failure"
        } (${pterodactylRes})`,
    );
});
