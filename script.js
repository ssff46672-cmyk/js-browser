
"use strict";

const STORAGE_KEY = "jsBrowserWorkspaceV2";

const defaultFiles = {
    "index.html": `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My First Website</title>
</head>
<body>
    <h1>Hello World!</h1>
    <p>Welcome to JS Browser.</p>
    <button onclick="sayHello()">Click Me</button>
</body>
</html>`,

    "style.css": `body {
    font-family: Arial, sans-serif;
    text-align: center;
    padding: 40px;
    background: #f0f4f8;
}
h1 {
    color: #007acc;
    font-size: 36px;
}
p {
    color: #333;
    font-size: 18px;
}
button {
    padding: 12px 22px;
    color: white;
    background: #007acc;
    border: none;
    border-radius: 6px;
    cursor: pointer;
}
button:hover {
    background: #005a9e;
}`,

    "script.js": `function sayHello() {
    alert("Hello from JS Browser!");
}

console.log("JavaScript is working!");`
};

const $ = id => document.getElementById(id);

const editorElement = $("editor");
const preview = $("preview");
const fileList = $("fileList");
const currentTab = $("currentTab");
const saveStatus = $("saveStatus");
const languageLabel = $("languageLabel");
const consoleOutput = $("consoleOutput");

let editor = null;
let activeFile = "index.html";
let files = loadWorkspace();

function loadWorkspace() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved) {
            const data = JSON.parse(saved);

            if (data && data.files && typeof data.files === "object") {
                const result = {};

                for (const [name, content] of Object.entries(data.files)) {
                    if (
                        /\.(html|css|js)$/i.test(name) &&
                        !name.includes("/") &&
                        !name.includes("\\") &&
                        typeof content === "string"
                    ) {
                        result[name] = content;
                    }
                }

                if (Object.keys(result).some(name => /\.html$/i.test(name))) {
                    return result;
                }
            }
        }
    } catch (error) {
        console.error("Workspace loading error:", error);
    }

    return { ...defaultFiles };
}

function getEditorValue() {
    return editor ? editor.getValue() : editorElement.value;
}

function setEditorValue(value) {
    if (editor) {
        editor.setValue(value);
    } else {
        editorElement.value = value;
    }
}

function setEditorMode(filename) {
    const ext = filename.split(".").pop().toLowerCase();
    const mode = ext === "html" ? "htmlmixed"
        : ext === "css" ? "css"
        : "javascript";

    if (editor) editor.setOption("mode", mode);
}

function refreshEditor() {
    if (editor) editor.refresh();
}

function saveCurrentEditor() {
    if (activeFile && editorElement) {
        files[activeFile] = getEditorValue();
    }
}

function saveWorkspace() {
    saveCurrentEditor();

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ files }));
        saveStatus.textContent = "Saved ✓";
    } catch (error) {
        saveStatus.textContent = "Save failed";
        console.error("Save error:", error);
    }
}

function getMode(filename) {
    const ext = filename.split(".").pop().toLowerCase();
    return ext === "html" ? "htmlmixed"
        : ext === "css" ? "css"
        : "javascript";
}

function renderFiles() {
    fileList.innerHTML = "";

    Object.keys(files).forEach(filename => {
        const button = document.createElement("button");
        const ext = filename.split(".").pop().toLowerCase();
        const icon = ext === "html" ? "🌐"
            : ext === "css" ? "🎨"
            : ext === "js" ? "🟨" : "📄";

        button.className = "file" +
            (filename === activeFile ? " active" : "");
        button.textContent = icon + " " + filename;
        button.title = filename;
        button.addEventListener("click", () => openFile(filename));

        fileList.appendChild(button);
    });
}

function openFile(filename) {
    if (!Object.prototype.hasOwnProperty.call(files, filename)) return;

    if (editor || editorElement) saveCurrentEditor();

    activeFile = filename;
    setEditorValue(files[filename]);
    setEditorMode(filename);

    currentTab.textContent = filename;
    languageLabel.textContent =
        filename.split(".").pop().toUpperCase();
    saveStatus.textContent = "Ready";

    renderFiles();
    refreshEditor();
}

function addConsoleMessage(level, args) {
    const hint = consoleOutput.querySelector(".console-hint");
    if (hint) hint.remove();

    const line = document.createElement("p");
    line.className = "console-line " + level;
    line.textContent = args.map(value => {
        if (typeof value === "string") return value;
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }).join(" ");

    consoleOutput.appendChild(line);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function clearConsole() {
    consoleOutput.innerHTML = "";
}

function findMainFile() {
    if (files["index.html"]) return "index.html";
    return Object.keys(files).find(name => /\.html$/i.test(name));
}

function injectIntoHTML(html, css, js) {
    // Remove local CSS links because their contents are inserted below.
    html = html.replace(/<link\b[^>]*>/gi, tag => {
        const match = tag.match(/\bhref\s*=\s*(["'])(.*?)\1/i);
        if (!match) return tag;

        const href = match[2].split(/[?#]/)[0];
        const isExternal = /^(https?:)?\/\//i.test(href) ||
            /^(data:|blob:)/i.test(href);

        if (isExternal) return tag;

        const filename = href.split("/").pop();
        if (/\.css$/i.test(filename) && files[filename] !== undefined) {
            return "";
        }

        return tag;
    });

    // Remove local script.js references to avoid a second 404 request.
    html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, tag => {
        const match = tag.match(/\bsrc\s*=\s*(["'])(.*?)\1/i);
        if (!match) return tag;

        const src = match[2].split(/[?#]/)[0];
        const isExternal = /^(https?:)?\/\//i.test(src) ||
            /^(data:|blob:)/i.test(src);

        if (isExternal) return tag;

        const filename = src.split("/").pop();
        if (/\.js$/i.test(filename) && files[filename] !== undefined) {
            return "";
        }

        return tag;
    });

    const styleTag = "<style>\n" + css + "\n</style>";
    const safeJS = js.replace(/<\/script/gi, "<\\/script");

    const runtime = `
(function () {
    function printable(value) {
        if (typeof value === "string") return value;
        try { return JSON.stringify(value); }
        catch (error) { return String(value); }
    }

    ["log", "info", "warn", "error"].forEach(function (level) {
        const original = console[level].bind(console);
        console[level] = function () {
            const args = Array.from(arguments);
            original.apply(console, args);
            window.parent.postMessage({
                source: "js-browser-console",
                level: level,
                args: args.map(printable)
            }, "*");
        };
    });

    window.addEventListener("error", function (event) {
        window.parent.postMessage({
            source: "js-browser-console",
            level: "error",
            args: [event.message || "JavaScript error"]
        }, "*");
    });

    window.addEventListener("unhandledrejection", function (event) {
        window.parent.postMessage({
            source: "js-browser-console",
            level: "error",
            args: ["Promise error: " + printable(event.reason)]
        }, "*");
    });
})();
`;

    const scriptTag =
        "<scr" + "ipt>\n" + runtime + "\n" +
        safeJS + "\n" + "</scr" + "ipt>";

    if (/<\/head\s*>/i.test(html)) {
        html = html.replace(/<\/head\s*>/i, styleTag + "\n</head>");
    } else if (/<html\b[^>]*>/i.test(html)) {
        html = html.replace(/<html\b[^>]*>/i, match =>
            match + "\n<head>" + styleTag + "</head>"
        );
    } else {
        html = "<head>" + styleTag + "</head>\n" + html;
    }

    if (/<\/body\s*>/i.test(html)) {
        html = html.replace(/<\/body\s*>/i, scriptTag + "\n</body>");
    } else {
        html += "\n" + scriptTag;
    }

    return html;
}

function runCode() {
    saveCurrentEditor();
    clearConsole();

    const htmlFilename = findMainFile();

    if (!htmlFilename) {
        addConsoleMessage("error", [
            "Create an HTML file before running the project."
        ]);
        return;
    }

    const html = files[htmlFilename];
    const css = files["style.css"] || "";
    const js = files["script.js"] || "";

    // CSS and JS are inserted directly from the editor workspace.
    preview.srcdoc = injectIntoHTML(html, css, js);

    document.querySelectorAll(".panel-tab").forEach(button => {
        button.classList.toggle("active", button.dataset.panel === "preview");
    });

    $("previewPanel").classList.remove("hidden");
    $("consolePanel").classList.add("hidden");
    saveStatus.textContent = "Preview updated";
}

function createFile() {
    const filename = prompt(
        "Enter a filename (example: about.html, app.css, test.js):"
    );

    if (filename === null) return;

    const cleanName = filename.trim();

    if (!/^[a-zA-Z0-9_-]+\.(html|css|js)$/i.test(cleanName)) {
        alert("Use a filename ending in .html, .css or .js");
        return;
    }

    if (Object.prototype.hasOwnProperty.call(files, cleanName)) {
        alert("This file already exists.");
        return;
    }

    files[cleanName] = "";
    saveWorkspace();
    openFile(cleanName);
}

function deleteFile() {
    if (Object.keys(files).length <= 1) {
        alert("You must keep at least one file.");
        return;
    }

    if (!confirm("Delete " + activeFile + "?")) return;

    delete files[activeFile];

    const nextFile = Object.keys(files)[0];
    activeFile = nextFile;
    saveWorkspace();
    openFile(nextFile);
}

async function exportProject() {
    saveCurrentEditor();

    if (typeof JSZip === "undefined") {
        alert("ZIP library could not load. Check your internet connection.");
        return;
    }

    try {
        const zip = new JSZip();

        Object.entries(files).forEach(([name, content]) => {
            zip.file(name, content);
        });

        saveStatus.textContent = "Preparing ZIP...";

        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = "js-browser-project.zip";
        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(url), 1000);
        saveStatus.textContent = "ZIP exported ✓";
    } catch (error) {
        saveStatus.textContent = "Export failed";
        console.error(error);
        alert("Could not export the project.");
    }
}

// Use CodeMirror when available; otherwise keep a usable text editor.
if (typeof CodeMirror !== "undefined") {
    editor = CodeMirror.fromTextArea(editorElement, {
        mode: "htmlmixed",
        theme: "dracula",
        lineNumbers: true,
        lineWrapping: false,
        indentUnit: 4,
        tabSize: 4,
        autofocus: true
    });

    editor.on("change", () => {
        saveCurrentEditor();
        saveStatus.textContent = "Unsaved changes";
    });
} else {
    editorElement.style.width = "100%";
    editorElement.style.height = "100%";
    editorElement.style.minHeight = "300px";
    editorElement.style.boxSizing = "border-box";
    editorElement.style.background = "#282a36";
    editorElement.style.color = "#f8f8f2";
    editorElement.style.fontFamily = "monospace";
    editorElement.style.fontSize = "14px";

    editorElement.addEventListener("input", () => {
        saveCurrentEditor();
        saveStatus.textContent = "Unsaved changes";
    });
}

window.addEventListener("message", event => {
    if (event.source !== preview.contentWindow) return;

    const data = event.data;
    if (!data || data.source !== "js-browser-console" ||
        !Array.isArray(data.args)) return;

    addConsoleMessage(
        ["log", "info", "warn", "error"].includes(data.level)
            ? data.level : "log",
        data.args
    );
});

$("runBtn").addEventListener("click", runCode);
$("refreshBtn").addEventListener("click", runCode);
$("saveBtn").addEventListener("click", saveWorkspace);
$("newFileBtn").addEventListener("click", createFile);
$("sidebarNewBtn").addEventListener("click", createFile);
$("deleteFileBtn").addEventListener("click", deleteFile);
$("exportBtn").addEventListener("click", exportProject);
$("clearConsoleBtn").addEventListener("click", clearConsole);

document.querySelectorAll(".panel-tab").forEach(button => {
    button.addEventListener("click", () => {
        const panel = button.dataset.panel;

        document.querySelectorAll(".panel-tab").forEach(tab => {
            tab.classList.toggle("active", tab === button);
        });

        $("previewPanel").classList.toggle("hidden", panel !== "preview");
        $("consolePanel").classList.toggle("hidden", panel !== "console");

        if (panel === "preview") runCode();
    });
});

if (editor) {
    editor.addKeyMap({
        "Ctrl-S": saveWorkspace,
        "Cmd-S": saveWorkspace
    });
} else {
    editorElement.addEventListener("keydown", event => {
        if ((event.ctrlKey || event.metaKey) &&
            event.key.toLowerCase() === "s") {
            event.preventDefault();
            saveWorkspace();
        }
    });
}

renderFiles();
openFile(
    files["index.html"] !== undefined
        ? "index.html"
        : Object.keys(files)[0]
);
runCode();
