const htmlCode = document.querySelector("#htmlCode");

const cssCode = document.querySelector("#cssCode");

const jsCode = document.querySelector("#jsCode");

const preview = document.querySelector("#preview");

const consoleBox = document.querySelector("#console");

const run = document.querySelector("#run");

const clear = document.querySelector("#clear");


run.addEventListener("click", function () {

    consoleBox.textContent = "";

    const html = htmlCode.value;
    const css = cssCode.value;
    const js = jsCode.value;

    const page = `
<!DOCTYPE html>

<html>

<head>

<style>

${css}

</style>

</head>

<body>

${html}

<script>

const oldLog = console.log;

console.log = function(...messages) {

    window.parent.postMessage({
        type: "console",
        message: messages.join(" ")
    }, "*");

    oldLog.apply(console, messages);

};

try {

${js}

} catch(error) {

    window.parent.postMessage({
        type: "error",
        message: error.message
    }, "*");

}

<\/script>

</body>

</html>
`;

    preview.srcdoc = page;

});


window.addEventListener("message", function(event) {

    if (event.data.type === "console") {

        consoleBox.textContent +=
            event.data.message + "\n";

    }

    if (event.data.type === "error") {

        consoleBox.textContent +=
            "Error: " +
            event.data.message +
            "\n";

    }

});


clear.addEventListener("click", function() {

    htmlCode.value = "";

    cssCode.value = "";

    jsCode.value = "";

    consoleBox.textContent = "";

    preview.srcdoc = "";

});
