const htmlCode = document.querySelector("#htmlCode");
const cssCode = document.querySelector("#cssCode");
const jsCode = document.querySelector("#jsCode");

const preview = document.querySelector("#preview");
const consoleBox = document.querySelector("#console");

const run = document.querySelector("#run");
const clear = document.querySelector("#clear");

/* =========================
Run Code
========================= */

function runCode() {

```
consoleBox.textContent = "";

const html = htmlCode.value;
const css = cssCode.value;
const js = jsCode.value;


const page = `
```

<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

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

        message: messages
            .map(message => {
                try {
                    return typeof message === "object"
                        ? JSON.stringify(message)
                        : String(message);
                } catch {
                    return String(message);
                }
            })
            .join(" ")

    }, "*");

    oldLog.apply(console, messages);

};


const oldError = console.error;

console.error = function(...messages) {

    window.parent.postMessage({

        type: "error",

        message: messages.join(" ")

    }, "*");

    oldError.apply(console, messages);

};


window.onerror = function(message) {

    window.parent.postMessage({

        type: "error",

        message: String(message)

    }, "*");

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


    /* Save code */

    localStorage.setItem("jsbrowser-html", html);

    localStorage.setItem("jsbrowser-css", css);

    localStorage.setItem("jsbrowser-js", js);

}


/* =========================
   Run Button
========================= */

run.addEventListener("click", runCode);


/* =========================
   Console Messages
========================= */

window.addEventListener("message", function(event) {

    if (!event.data) {
        return;
    }


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


/* =========================
   Clear
========================= */

clear.addEventListener("click", function() {

    htmlCode.value = "";
    cssCode.value = "";
    jsCode.value = "";

    consoleBox.textContent = "";

    preview.srcdoc = "";

    localStorage.removeItem("jsbrowser-html");
    localStorage.removeItem("jsbrowser-css");
    localStorage.removeItem("jsbrowser-js");

});


/* =========================
   Load Saved Code
========================= */

const savedHTML =
    localStorage.getItem("jsbrowser-html");

const savedCSS =
    localStorage.getItem("jsbrowser-css");

const savedJS =
    localStorage.getItem("jsbrowser-js");


if (savedHTML !== null) {
    htmlCode.value = savedHTML;
}

if (savedCSS !== null) {
    cssCode.value = savedCSS;
}

if (savedJS !== null) {
    jsCode.value = savedJS;
}


/* =========================
   Ctrl + Enter
========================= */

document.addEventListener("keydown", function(event) {

    if (event.ctrlKey && event.key === "Enter") {

        event.preventDefault();

        runCode();

    }

});


/* =========================
   Run When Page Opens
========================= */

runCode();
