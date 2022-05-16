const proposals = document.getElementsByClassName("proposal");
const usernameInput = document.getElementById("form-username");

for (const proposal of proposals) {
    const textarea = proposal.getElementsByTagName("textarea")[0];
    const preview = proposal.getElementsByClassName("preview")[0];
    const hidden = proposal.getElementsByClassName("hidden-until-comment")[0];

    const anonymousCheckbox = proposal.getElementsByClassName("anonymous-checkbox")[0];

    function update() {
        if (textarea.value === "") {
            hidden.style.display = "none";
        } else {
            hidden.style.display = "block";
        }

        const positionRadio = proposal.querySelector("input[type='radio']:checked");
        const position = positionRadio != null ? positionRadio.value : null;

        let username = "user";
        if (!anonymousCheckbox.checked) {
            username = usernameInput.value;
        }

        let emote = "";
        if (position === "yes") {
            emote = "✅";
            preview.style.backgroundColor = "#c4e2c4";
        } else if (position === "no") {
            emote = "❌";
            preview.style.backgroundColor = "#ffcec9";
        } else {
            emote = "ℹ️";
            preview.style.backgroundColor = "#d2dff6";
        }
        preview.innerText = `${emote} Comment submitted by ${username}`;

        const inner = document.createElement("div");

        inner.innerHTML = marked.parse(textarea.value);

        preview.appendChild(inner);
    }

    proposal.querySelectorAll("input,textarea").forEach((input) => {
        input.addEventListener("change", update);
        input.addEventListener("input", update);
    });

    update();
}
