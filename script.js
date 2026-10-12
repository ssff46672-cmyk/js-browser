
"use strict";

/* ==========================================
   JS Browser - Application
   ========================================== */

const $ = (id) => document.getElementById(id);

const editorElement = $("editor");
const fileListElement = $("fileList");
const currentTabElement = $("currentTab");
const saveStatusElement = $("saveStatus");
const languageLabelElement = $("languageLabel");
const previewElement = $("preview");
const consoleOutputElement = $("consoleOutput");

const STORAGE_KEY = "jsBrowserProjectV1";
const MESSAGE_SOURCE = "JS_BROWSER_CONSOLE";

let editor = null;
let activeFile = "index.html";
let files = {};
let activePanel = "preview";
let saveTimer = null;

const defaultFiles = {
    "index.html": `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Website</title>
</head>
<body>
    <h1>Hello, JS Browser!</h1>
    <p>Start writing your code here.</p>
    <button id="helloBtn">Click me</button>
</body>
</html>`,
    "style.css": `body {
    font-family: Arial, sans-serif;
    padding: 30px;
    background: #f4f4f4;
    color: #222;
}

h1 {
    color: #6c63ff;
}`,
    "script.js": `console.log("Welcome to JS Browser!");

document.getElementById("helloBtn")?.addEventListener("click", () => {
    alert("Hello!");
});`
};

/* ==========================================
   Status and local storage
   ========================================== */

function setStatus(message) {
    if (saveStatusElement) {
        saveStatusElement.textContent = message;
    }
}

function loadProject() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved) {
            const project = JSON.parse(saved);

            if (
                project &&
                project.files &&
                typeof project.files === "object" &&
                Object.keys(project.files).length > 0
            ) {
                files = project.files;
                activeFile = files[project.activeFile]
                    !== undefined
                    ? project.activeFile
                    : Object.keys(files)[0];

                return;
            }
        }
    } catch (error) {
        console.warn("Could not load the saved project:", error);
    }

    files = { ...defaultFiles };
    activeFile = "index.html";
}

function saveProject(showMessage = true) {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                files,
                activeFile
            })
        );

        if (showMessage) setStatus("Saved");

        return true;
    } catch (error) {
        setStatus("Save failed");
        console.error("Could not save project:", error);
        return false;
    }
}

function scheduleSave() {
    setStatus("Unsaved changes");

    clearTimeout(saveTimer);

    saveTimer = setTimeout(() => {
        saveProject();
    }, 500);
}

function saveCurrentFile() {
    if (editor) {
        files[activeFile] = editor.getValue();
    }

    saveProject();
}

/* ==========================================
   Editor and language modes
   ========================================== */

function getMode(filename) {
    const name = filename.toLowerCase();

    if (name.endsWith(".html") || name.endsWith(".htm")) {
        return "htmlmixed";
    }

    if (name.endsWith(".css")) {
        return "css";
    }

    if (
        name.endsWith(".js") ||
        name.endsWith(".mjs") ||
        name.endsWith(".cjs")
    ) {
        return "javascript";
    }

    if (name.endsWith(".json")) {
        return { name: "javascript", json: true };
    }

    if (name.endsWith(".xml")) {
        return "xml";
    }

    return "text";
}

function getLanguage(filename) {
    const name = filename.toLowerCase();

    if (name.endsWith(".html") || name.endsWith(".htm")) {
        return "HTML";
    }

    if (name.endsWith(".css")) return "CSS";

    if (
        name.endsWith(".js") ||
        name.endsWith(".mjs") ||
        name.endsWith(".cjs")
    ) {
        return "JavaScript";
    }

    if (name.endsWith(".json")) return "JSON";

    return "Text";
}

function updateLanguage() {
    if (!editor) return;

    editor.setOption("mode", getMode(activeFile));

    if (currentTabElement) {
        currentTabElement.textContent = activeFile;
    }

    if (languageLabelElement) {
        languageLabelElement.textContent = getLanguage(activeFile);
    }
}

function initEditor() {
    if (!editorElement) {
        console.error("Editor element not found.");
        return;
    }

    if (typeof CodeMirror === "undefined") {
        console.error("CodeMirror could not load. Check your internet connection.");
        return;
    }

    editor = CodeMirror.fromTextArea(editorElement, {
        mode: getMode(activeFile),
        theme: "dracula",
        lineNumbers: true,
        lineWrapping: false,
        indentUnit: 4,
        tabSize: 4,
        indentWithTabs: false,
        autoCloseBrackets: true,
        matchBrackets: true,
        extraKeys: {
            "Ctrl-S": () => saveCurrentFile(),
            "Cmd-S": () => saveCurrentFile(),
            "Ctrl-Space": (cm) => openAutocomplete(cm),
            "Tab": (cm) => {
                if (cm.somethingSelected()) {
                    cm.indentSelection("add");
                } else {
                    cm.replaceSelection("    ", "end");
                }
            }
        }
    });

    editor.on("change", () => {
        files[activeFile] = editor.getValue();
        scheduleSave();
    });

    editor.on("inputRead", (cm, change) => {
        if (!change.text || !change.text.length) return;

        const typed = change.text.join("");
        const line = cm.getLine(cm.getCursor().line);
        const before = line.slice(0, cm.getCursor().ch);

        if (
            /[\w$.-]/.test(typed) &&
            getCurrentWord(before).length >= 2
        ) {
            openAutocomplete(cm, true);
        } else if (typed.includes("<") &&
                   activeFile.toLowerCase().endsWith(".html")) {
            openAutocomplete(cm, true);
        }
    });

    updateLanguage();
    editor.setValue(files[activeFile] || "");
}

/* ==========================================
   Autocomplete dictionaries
   ========================================== */

const htmlTags = [
    "html", "head", "body", "title", "meta", "link",
    "script", "style", "header", "nav", "main", "section",
    "article", "aside", "footer", "div", "span", "p",
    "h1", "h2", "h3", "h4", "h5", "h6", "a", "img",
    "picture", "video", "audio", "source", "iframe",
    "ul", "ol", "li", "table", "thead", "tbody", "tfoot",
    "tr", "th", "td", "form", "label", "input", "textarea",
    "button", "select", "option", "fieldset", "legend",
    "details", "summary", "dialog", "canvas", "progress",
    "meter", "strong", "em", "small", "code", "pre",
    "blockquote", "br", "hr", "figure", "figcaption"
];

const htmlAttributes = [
    "id", "class", "href", "src", "alt", "title", "target",
    "rel", "type", "name", "value", "placeholder", "required",
    "disabled", "checked", "selected", "for", "action", "method",
    "width", "height", "style", "role", "aria-label", "loading",
    "tabindex", "autocomplete", "maxlength", "minlength"
];

const cssProperties = [
    "color", "background", "background-color", "background-image",
    "font-size", "font-family", "font-weight", "font-style",
    "text-align", "text-decoration", "text-transform",
    "text-shadow", "line-height", "letter-spacing", "word-spacing",
    "width", "height", "min-width", "max-width", "min-height",
    "max-height", "margin", "margin-top", "margin-right",
    "margin-bottom", "margin-left", "padding", "padding-top",
    "padding-right", "padding-bottom", "padding-left", "border",
    "border-radius", "border-color", "border-width", "box-shadow",
    "box-sizing", "display", "position", "top", "right", "bottom",
    "left", "z-index", "overflow", "opacity", "visibility",
    "float", "clear", "flex", "flex-direction", "flex-wrap",
    "flex-basis", "flex-grow", "flex-shrink", "justify-content",
    "align-items", "align-content", "align-self", "gap", "grid",
    "grid-template-columns", "grid-template-rows", "place-items",
    "transition", "transform", "animation", "cursor", "outline",
    "object-fit", "list-style", "white-space", "word-break"
];

const cssValues = [
    "flex", "grid", "block", "inline", "inline-block", "none",
    "hidden", "visible", "relative", "absolute", "fixed", "sticky",
    "center", "left", "right", "space-between", "space-around",
    "space-evenly", "column", "row", "wrap", "nowrap", "auto",
    "inherit", "initial", "unset", "transparent", "pointer",
    "border-box", "content-box", "cover", "contain", "bold",
    "normal", "uppercase", "lowercase", "capitalize"
];

const jsWords = [
    "const", "let", "var", "function", "return", "if", "else",
    "switch", "case", "break", "for", "while", "do", "of", "in",
    "try", "catch", "finally", "throw", "new", "class", "extends",
    "this", "super", "import", "export", "default", "from", "async",
    "await", "Promise", "true", "false", "null", "undefined",
    "typeof", "instanceof", "delete", "void", "yield",
    "console", "console.log", "console.error", "console.warn",
    "console.table", "document", "document.querySelector",
    "document.querySelectorAll", "document.getElementById",
    "document.createElement", "document.addEventListener",
    "window", "alert", "prompt", "confirm", "parseInt", "parseFloat",
    "Number", "String", "Boolean", "Array", "Object", "Math",
    "Math.random", "Math.floor", "Math.round", "JSON",
    "JSON.parse", "JSON.stringify", "Date", "setTimeout",
    "setInterval", "clearTimeout", "clearInterval", "fetch",
    "addEventListener", "localStorage", "sessionStorage",
    "innerHTML", "textContent", "classList", "preventDefault",
    "forEach", "map", "filter", "reduce", "find", "push", "pop",
    "includes", "startsWith", "endsWith", "toLowerCase", "toUpperCase"
];

function getCurrentWord(text) {
    const match = text.match(/[\w$.-]*$/);
    return match ? match[0] : "";
}

function getWordRange(cm) {
    const cursor = cm.getCursor();
    const line = cm.getLine(cursor.line);
    const before = line.slice(0, cursor.ch);
    const word = getCurrentWord(before);

    return {
        word,
        from: CodeMirror.Pos(cursor.line, cursor.ch - word.length),
        to: cursor
    };
}

function filterWords(words, prefix) {
    const lower = prefix.toLowerCase();

    return words
        .filter(word => word.toLowerCase().startsWith(lower))
        .map(word => ({
            text: word,
            displayText: word
        }));
}

function autocompleteHint(cm) {
    const cursor = cm.getCursor();
    const line = cm.getLine(cursor.line);
    const before = line.slice(0, cursor.ch);
    const range = getWordRange(cm);
    const filename = activeFile.toLowerCase();

    let suggestions = [];

    if (filename.endsWith(".html") || filename.endsWith(".htm")) {
        const tagMatch = before.match(/<([a-zA-Z][\w-]*)?$/);

        if (tagMatch) {
            const prefix = tagMatch[1] || "";

            suggestions = htmlTags
                .filter(tag => tag.startsWith(prefix))
                .map(tag => ({
                    text: tag + ">",
                    displayText: "<" + tag + ">"
                }));

            const start = cursor.ch - prefix.length;

            return {
                list: suggestions,
                from: CodeMirror.Pos(cursor.line, start),
                to: cursor
            };
        }

        const attributeMatch = before.match(/<[\w-]+\s+([\w-]*)$/);

        if (attributeMatch) {
            suggestions = filterWords(htmlAttributes, attributeMatch[1]);
        } else {
            suggestions = filterWords(htmlTags, range.word);
        }
    } else if (filename.endsWith(".css")) {
        const afterColon = before.match(/:\s*([\w-]*)$/);
        const property = before.match(/(?:^|[;{]\s*)([\w-]*)$/);

        if (afterColon) {
            suggestions = filterWords(cssValues, afterColon[1]);
        } else if (property) {
            suggestions = filterWords(cssProperties, property[1]);
        } else {
            suggestions = filterWords(cssProperties, range.word);
        }
    } else if (
        filename.endsWith(".js") ||
        filename.endsWith(".mjs") ||
        filename.endsWith(".cjs")
    ) {
        suggestions = filterWords(jsWords, range.word);
    }

    return {
        list: suggestions,
        from: range.from,
        to: range.to
    };
}

function openAutocomplete(cm, automatic = false) {
    if (
        !cm ||
        typeof CodeMirror.showHint !== "function"
    ) {
        return;
    }

    const range = getWordRange(cm);
    const line = cm.getLine(cm.getCursor().line);
    const before = line.slice(0, cm.getCursor().ch);
    const isHtmlTagStart =
        activeFile.toLowerCase().endsWith(".html") &&
        before.endsWith("<");

    if (automatic && range.word.length < 2 && !isHtmlTagStart) {
        return;
    }

    CodeMirror.showHint(cm, autocompleteHint, {
        completeSingle: false,
        closeOnUnfocus: true,
        alignWithWord: true
    });
}

/* ==========================================
   File explorer
   ========================================== */


function renderFileList() {
    if (!fileListElement) return;

    fileListElement.replaceChildren();

    Object.keys(files).forEach(filename => {
        const button = document.createElement("button");
        const icon = document.createElement("span");
        const name = document.createElement("span");

        button.type = "button";
        button.className = "file-item";
        button.title = filename;

        const extension = filename.split(".").pop().toLowerCase();

        if (extension === "html") {
            icon.textContent = "5";
            icon.className = "file-icon html-icon";
        } else if (extension === "css") {
            icon.textContent = "#";
            icon.className = "file-icon css-icon";
        } else if (extension === "js") {
            icon.textContent = "JS";
            icon.className = "file-icon js-icon";
        } else {
            icon.textContent = "•";
            icon.className = "file-icon other-icon";
        }

        name.textContent = filename;
        name.className = "file-name";

        button.appendChild(icon);
        button.appendChild(name);

        if (filename === activeFile) {
            button.classList.add("active");
        }

        button.addEventListener("click", () => openFile(filename));

        fileListElement.appendChild(button);
    });
}


function openFile(filename) {
    if (!Object.prototype.hasOwnProperty.call(files, filename)) {
        return;
    }

    if (editor) {
        files[activeFile] = editor.getValue();
    }

    activeFile = filename;

    if (editor) {
        editor.setOption("mode", getMode(filename));
        editor.setValue(files[filename] || "");
        updateLanguage();
    }

    renderFileList();
    saveProject(false);
}

function createNewFile() {
    const filename = prompt(
        "Enter a filename, for example page.html, style.css or app.js:"
    );

    if (!filename) return;

    const cleanName = filename.trim();

    if (
        !cleanName ||
        /[<>:"/\\|?*\x00-\x1F]/.test(cleanName) ||
        !/\.(html?|css|js|mjs|json|txt)$/i.test(cleanName)
    ) {
        alert("Enter a valid filename, such as page.html or app.js.");
        return;
    }

    if (Object.prototype.hasOwnProperty.call(files, cleanName)) {
        alert("This file already exists.");
        return;
    }

    files[cleanName] = "";
    openFile(cleanName);
    setStatus("File created");
}

function deleteCurrentFile() {
    const names = Object.keys(files);

    if (names.length <= 1) {
        alert("You must keep at least one file in your project.");
        return;
    }

    if (!confirm("Delete " + activeFile + "?")) return;

    delete files[activeFile];

    activeFile = Object.keys(files)[0];

    if (editor) {
        editor.setOption("mode", getMode(activeFile));
        editor.setValue(files[activeFile] || "");
        updateLanguage();
    }

    renderFileList();
    saveProject();
}

/* ==========================================
   Preview and Console
   ========================================== */

function showConsoleMessage(type, args) {
    if (!consoleOutputElement) return;

    const row = document.createElement("div");
    row.className = "console-entry console-" + type;

    const text = args.map(value => {
        if (typeof value === "string") return value;

        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }).join(" ");

    row.textContent = "[" + type.toUpperCase() + "] " + text;
    consoleOutputElement.appendChild(row);
    consoleOutputElement.scrollTop = consoleOutputElement.scrollHeight;
}

function clearConsole() {
    if (consoleOutputElement) {
        consoleOutputElement.replaceChildren();
    }
}

function setPanel(panelName) {
    activePanel = panelName;

    const previewPanel = $("previewPanel");
    const consolePanel = $("consolePanel");

    if (previewPanel) {
        previewPanel.classList.toggle("hidden", panelName !== "preview");
    }

    if (consolePanel) {
        consolePanel.classList.toggle("hidden", panelName !== "console");
    }

    document.querySelectorAll(".panel-tab[data-panel]").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.panel === panelName
        );
    });
}

function makePreviewHTML() {
    const htmlFile =
        Object.keys(files).find(name => /\.html?$/i.test(name)) ||
        "index.html";

    let html = files[htmlFile] || defaultFiles["index.html"];

    const css = Object.entries(files)
        .filter(([name]) => /\.css$/i.test(name))
        .map(([, content]) => content)
        .join("\n\n");

    const js = Object.entries(files)
        .filter(([name]) => /\.(js|mjs)$/i.test(name))
        .map(([, content]) => content)
        .join("\n\n");

    const consoleBridge = `
<script>
(function () {
    const send = (type, args) => {
        try {
            parent.postMessage({
                source: "${MESSAGE_SOURCE}",
                type: type,
                args: Array.from(args).map(item => {
                    if (item instanceof Error) return item.stack || item.message;
                    if (typeof item === "undefined") return "undefined";
                    try {
                        return typeof item === "object"
                            ? JSON.stringify(item)
                            : String(item);
                    } catch (_) {
                        return String(item);
                    }
                })
            }, "*");
        } catch (_) {}
    };

    ["log", "info", "warn", "error", "table"].forEach(type => {
        const original = console[type].bind(console);

        console[type] = function () {
            original.apply(console, arguments);
            send(type, arguments);
        };
    });

    window.addEventListener("error", function (event) {
        send("error", [event.message + " (line " + event.lineno + ")"]);
    });

    window.addEventListener("unhandledrejection", function (event) {
        send("error", ["Unhandled promise rejection:", event.reason]);
    });
})();
<\/script>`;

    const cssBlock = css
        ? "<style>\n" + css + "\n</style>"
        : "";

    const jsBlock = js
        ? "<script>\n" + js + "\n<\/script>"
        : "";

    if (/<\/head\s*>/i.test(html)) {
        html = html.replace(/<\/head\s*>/i, cssBlock + "\n</head>");
    } else {
        html = cssBlock + html;
    }

    if (/<\/body\s*>/i.test(html)) {
        html = html.replace(
            /<\/body\s*>/i,
            consoleBridge + "\n" + jsBlock + "\n</body>"
        );
    } else {
        html += consoleBridge + "\n" + jsBlock;
    }

    return html;
}

function runCode() {
    if (!previewElement) return;

    if (editor) {
        files[activeFile] = editor.getValue();
    }

    saveProject(false);
    clearConsole();

    showConsoleMessage("info", ["Running project..."]);

    previewElement.srcdoc = makePreviewHTML();
    setPanel("preview");
    setStatus("Running");
}

function handlePreviewMessage(event) {
    if (!event.data || event.data.source !== MESSAGE_SOURCE) {
        return;
    }

    const type = ["log", "info", "warn", "error", "table"]
        .includes(event.data.type)
        ? event.data.type
        : "log";

    showConsoleMessage(type, event.data.args || []);
}

/* ==========================================
   Export project as ZIP
   ========================================== */

async function exportProject() {
    if (editor) {
        files[activeFile] = editor.getValue();
    }

    if (typeof JSZip === "undefined") {
        alert("ZIP library did not load. Check your internet connection.");
        return;
    }

    try {
        const zip = new JSZip();

        Object.entries(files).forEach(([filename, content]) => {
            zip.file(filename, content);
        });

        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = "js-browser-project.zip";
        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(url), 1000);

        setStatus("ZIP exported");
    } catch (error) {
        console.error("ZIP export failed:", error);
        alert("Could not export the project.");
    }
}

/* ==========================================
   Example projects
   ========================================== */

const examples = {
    calculator: {
        "index.html": `<h1>Calculator</h1>
<input id="a" type="number" placeholder="First number">
<input id="b" type="number" placeholder="Second number">
<button id="add">Add</button>
<p id="result">Result: </p>`,
        "style.css": `body { font-family: Arial; padding: 25px; }
input, button { padding: 10px; margin: 5px; }
button { cursor: pointer; }`,
        "script.js": `document.getElementById("add").addEventListener("click", () => {
    const a = Number(document.getElementById("a").value);
    const b = Number(document.getElementById("b").value);
    document.getElementById("result").textContent = "Result: " + (a + b);
});`
    },

    todo: {
        "index.html": `<h1>To-Do List</h1>
<input id="task" placeholder="Enter a task">
<button id="add">Add task</button>
<ul id="tasks"></ul>`,
        "style.css": `body { font-family: Arial; padding: 25px; }
button, input { padding: 9px; }
li { margin: 10px 0; cursor: pointer; }`,
        "script.js": `const input = document.getElementById("task");
const list = document.getElementById("tasks");

document.getElementById("add").addEventListener("click", () => {
    const value = input.value.trim();
    if (!value) return;

    const item = document.createElement("li");
    item.textContent = value + " — click to delete";
    item.addEventListener("click", () => item.remove());
    list.appendChild(item);
    input.value = "";
});`
    },

    clock: {
        "index.html": `<h1>Digital Clock</h1>
<div id="clock"></div>`,
        "style.css": `body { text-align: center; padding: 40px; font-family: Arial; }
#clock { font-size: 48px; color: #6c63ff; }`,
        "script.js": `function updateClock() {
    document.getElementById("clock").textContent =
        new Date().toLocaleTimeString();
}
updateClock();
setInterval(updateClock, 1000);`
    },

    guess: {
        "index.html": `<h1>Guess the Number</h1>
<p>Guess a number between 1 and 10.</p>
<input id="guess" type="number" min="1" max="10">
<button id="check">Check</button>
<p id="message"></p>`,
        "style.css": `body { font-family: Arial; padding: 25px; }
input, button { padding: 10px; }`,
        "script.js": `const secret = Math.floor(Math.random() * 10) + 1;

document.getElementById("check").addEventListener("click", () => {
    const guess = Number(document.getElementById("guess").value);
    const message = document.getElementById("message");

    if (guess === secret) message.textContent = "Correct!";
    else if (guess < secret) message.textContent = "Try a higher number.";
    else message.textContent = "Try a lower number.";
});`
    },

    portfolio: {
        "index.html": `<header>
<h1>My Portfolio</h1>
<p>Web Developer in Training</p>
</header>
<main>
<h2>About Me</h2>
<p>I am learning HTML, CSS and JavaScript.</p>
<h2>My Skills</h2>
<p>HTML · CSS · JavaScript</p>
</main>`,
        "style.css": `body { margin: 0; font-family: Arial; color: #222; }
header { background: #171717; color: white; text-align: center; padding: 45px; }
main { max-width: 700px; margin: 30px auto; padding: 20px; }
h2 { color: #6c63ff; }`,
        "script.js": `console.log("Portfolio loaded successfully!");`
    }
};

function loadExample() {
    const select = $("examplesSelect");

    if (!select || !select.value) {
        alert("Please choose an example first.");
        return;
    }

    const example = examples[select.value];

    if (!example) return;

    if (!confirm("Load this example? Your current project files will be replaced.")) {
        return;
    }

    files = {};

    Object.entries(example).forEach(([filename, content]) => {
        files[filename] = content;
    });

    activeFile = "index.html";

    if (editor) {
        editor.setOption("mode", getMode(activeFile));
        editor.setValue(files[activeFile]);
        updateLanguage();
    }

    renderFileList();
    saveProject();
    runCode();
}

/* ==========================================
   Help dialog and interface buttons
   ========================================== */

function setupInterface() {
    $("newFileBtn")?.addEventListener("click", createNewFile);
    $("sidebarNewBtn")?.addEventListener("click", createNewFile);
    $("deleteFileBtn")?.addEventListener("click", deleteCurrentFile);
    $("saveBtn")?.addEventListener("click", saveCurrentFile);
    $("exportBtn")?.addEventListener("click", exportProject);
    $("runBtn")?.addEventListener("click", runCode);
    $("refreshBtn")?.addEventListener("click", runCode);
    $("clearConsoleBtn")?.addEventListener("click", clearConsole);
    $("loadExampleButton")?.addEventListener("click", loadExample);

    document.querySelectorAll(".panel-tab[data-panel]").forEach(button => {
        button.addEventListener("click", () => {
            setPanel(button.dataset.panel);
        });
    });

    const helpDialog = $("helpDialog");

    $("helpButton")?.addEventListener("click", () => {
        if (helpDialog && typeof helpDialog.showModal === "function") {
            helpDialog.showModal();
        } else if (helpDialog) {
            helpDialog.setAttribute("open", "");
        }
    });

    $("closeHelp")?.addEventListener("click", () => {
        if (helpDialog && typeof helpDialog.close === "function") {
            helpDialog.close();
        } else if (helpDialog) {
            helpDialog.removeAttribute("open");
        }
    });

    window.addEventListener("message", handlePreviewMessage);

    window.addEventListener("beforeunload", () => {
        if (editor) files[activeFile] = editor.getValue();
        saveProject(false);
    });
}

/* ==========================================
   Start the application
   ========================================== */

function startApp() {
    loadProject();
    initEditor();
    renderFileList();
    setupInterface();

    if (editor) {
        editor.refresh();
        editor.focus();
    }

    setStatus("Ready");
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startApp);
} else {
    startApp();
}
