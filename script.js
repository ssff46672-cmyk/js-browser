const editorElement = document.getElementById("editor");
const preview = document.getElementById("preview");
const fileList = document.getElementById("fileList");
const currentTab = document.getElementById("currentTab");
const saveStatus = document.getElementById("saveStatus");
const languageLabel = document.getElementById("languageLabel");
const consoleOutput = document.getElementById("consoleOutput");

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

console.log("JavaScript is working!");
`
};

let files = loadWorkspace();
let activeFile = "index.html";

function loadWorkspace() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved) {
            const data = JSON.parse(saved);

            if (
                data &&
                data.files &&
                typeof data.files === "object" &&
                Object.keys(data.files).some(
                    name => name.endsWith(".html")
                )
            ) {
                const validFiles = {};

                for (const [name, content] of Object.entries(data.files)) {
                    if (
                        typeof content === "string" &&
                        /\.(html|css|js)$/i.test(name) &&
                        !name.includes("/") &&
                        !name.includes("\\")
                    ) {
                        validFiles[name] = content;
                    }
                }

                if (Object.keys(validFiles).length > 0) {
                    return validFiles;
                }
            }
        }
    } catch (error) {
        console.warn("Could not load workspace:", error);
    }

    return { ...defaultFiles };
}

function saveCurrentEditor() {
    if (activeFile && editor) {
        files[activeFile] = editor.getValue();
    }
}

function saveWorkspace() {
    saveCurrentEditor();

    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ files })
        );

        saveStatus.textContent = "Saved ✓";
    } catch (error) {
        saveStatus.textContent = "Save failed";
        console.error("Could not save:", error);
    }
}

function getMode(filename) {
    const extension = filename.split(".").pop().toLowerCase();

    if (extension === "html") {
        return "htmlmixed";
    }

    if (extension === "css") {
        return "css";
    }

    return "javascript";
}

function renderFiles() {
    fileList.innerHTML = "";

    Object.keys(files).forEach(filename => {
        const button = document.createElement("button");

        button.className =
            "file" + (filename === activeFile ? " active" : "");

        const extension = filename.split(".").pop().toLowerCase();

        const icon = {
            html: "🌐",
            css: "🎨",
            js: "🟨"
        }[extension] || "📄";

        button.textContent = icon + " " + filename;
        button.title = filename;

        button.addEventListener("click", () => {
            openFile(filename);
        });

        fileList.appendChild(button);
    });
}

function openFile(filename) {
    if (!Object.prototype.hasOwnProperty.call(files, filename)) {
        return;
    }

    saveCurrentEditor();

    activeFile = filename;
    editor.setValue(files[filename]);
    editor.setOption("mode", getMode(filename));

    currentTab.textContent = filename;
    languageLabel.textContent = filename.split(".").pop().toUpperCase();

    saveStatus.textContent = "Ready";

    renderFiles();
    editor.refresh();
}

function addConsoleMessage(level, args) {
    const hint = consoleOutput.querySelector(".console-hint");

    if (hint) {
        hint.remove();
    }

    const line = document.createElement("p");
    line.className = "console-line " + level;

    line.textContent = args.map(value => {
        if (typeof value === "string") {
            return value;
        }

        try {
            return JSON.stringify(value);
        } catch (error) {
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
    if (files["index.html"]) {
        return "index.html";
    }

    return Object.keys(files).find(
        name => name.toLowerCase().endsWith(".html")
    );
}

function injectIntoHTML(html, css, js) {
    const styleTag = "<style>\n" + css + "\n</style>";

    // Prevent user code from prematurely closing the script element.
    const safeJS = js.replace(/<\/script/gi, "<\\/script");

    const runtime = `
(function () {
    function printable(value) {
        if (typeof value === "string") return value;

        try {
            return JSON.stringify(value);
        } catch (error) {
            return String(value);
        }
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
            args: ["Unhandled promise rejection: " + printable(event.reason)]
        }, "*");
    });
})();
`;

    // The HTML parser must see the closing script tag, so build it in pieces.
    const scriptTag =
        "<scr" + "ipt>\n" +
        runtime + "\n" +
        safeJS + "\n" +
        "</scr" + "ipt>";

    if (/<\/head\s*>/i.test(html)) {
        html = html.replace(
            /<\/head\s*>/i,
            styleTag + "\n</head>"
        );
    } else {
        html = "<head>" + styleTag + "</head>\n" + html;
    }

    if (/<\/body\s*>/i.test(html)) {
        html = html.replace(
            /<\/body\s*>/i,
            scriptTag + "\n</body>"
        );
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
        addConsoleMessage(
            "error",
            ["Create an HTML file before running the project."]
        );
        return;
    }

    const html = files[htmlFilename];

    // Use the standard filenames, with sensible fallbacks.
    const css = files["style.css"] || "";
    const js = files["script.js"] || "";

    preview.srcdoc = injectIntoHTML(html, css, js);

    document.querySelectorAll(".panel-tab").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.panel === "preview"
        );
    });

    document.getElementById("previewPanel").classList.remove("hidden");
    document.getElementById("consolePanel").classList.add("hidden");

    saveStatus.textContent = "Preview updated";
}

function createFile() {
    const filename = prompt(
        "Enter a filename (example: about.html, app.css, test.js):"
    );

    if (filename === null) {
        return;
    }

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

    if (!confirm("Delete " + activeFile + "?")) {
        return;
    }

    delete files[activeFile];

    const nextFile = Object.keys(files)[0];

    saveWorkspace();
    openFile(nextFile);
}

async function exportProject() {
    saveCurrentEditor();

    if (typeof JSZip === "undefined") {
        alert(
            "ZIP library could not load. Check your internet connection and try again."
        );
        return;
    }

    const zip = new JSZip();

    Object.entries(files).forEach(([filename, content]) => {
        zip.file(filename, content);
    });

    try {
        saveStatus.textContent = "Preparing ZIP...";

        const blob = await zip.generateAsync({
            type: "blob"
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = "js-browser-project.zip";
        link.click();

        URL.revokeObjectURL(url);
        saveStatus.textContent = "ZIP exported ✓";
    } catch (error) {
        saveStatus.textContent = "Export failed";
        alert("Could not export the project.");
        console.error(error);
    }
}

if (typeof CodeMirror === "undefined") {
    saveStatus.textContent = "Editor library unavailable";
    editorElement.value = defaultFiles["index.html"];

    throw new Error(
        "CodeMirror failed to load. Check your internet connection."
    );
}

const editor = CodeMirror.fromTextArea(editorElement, {
    mode: "htmlmixed",
    theme: "dracula",
    lineNumbers: true,
    lineWrapping: false,
    indentUnit: 4,
    tabSize: 4,
    indentWithTabs: false,
    autofocus: true
});

editor.on("change", () => {
    saveCurrentEditor();
    saveStatus.textContent = "Unsaved changes";
});

window.addEventListener("message", event => {
    if (event.source !== preview.contentWindow) {
        return;
    }

    const data = event.data;

    if (
        !data ||
        data.source !== "js-browser-console" ||
        !Array.isArray(data.args)
    ) {
        return;
    }

    addConsoleMessage(
        ["log", "info", "warn", "error"].includes(data.level)
            ? data.level
            : "log",
        data.args
    );
});

document.getElementById("runBtn").addEventListener(
    "click",
    runCode
);

document.getElementById("refreshBtn").addEventListener(
    "click",
    runCode
);

document.getElementById("saveBtn").addEventListener(
    "click",
    saveWorkspace
);

document.getElementById("newFileBtn").addEventListener(
    "click",
    createFile
);

document.getElementById("sidebarNewBtn").addEventListener(
    "click",
    createFile
);

document.getElementById("deleteFileBtn").addEventListener(
    "click",
    deleteFile
);

document.getElementById("exportBtn").addEventListener(
    "click",
    exportProject
);

document.getElementById("clearConsoleBtn").addEventListener(
    "click",
    clearConsole
);

document.querySelectorAll(".panel-tab").forEach(button => {
    button.addEventListener("click", () => {
        const panel = button.dataset.panel;

        document.querySelectorAll(".panel-tab").forEach(tab => {
            tab.classList.toggle("active", tab === button);
        });

        document.getElementById("previewPanel").classList.toggle(
            "hidden",
            panel !== "preview"
        );

        document.getElementById("consolePanel").classList.toggle(
            "hidden",
            panel !== "console"
        );
    });
});

editor.addKeyMap({
    "Ctrl-S": saveWorkspace,
    "Cmd-S": saveWorkspace
});

renderFiles();
openFile(
    files["index.html"]
        ? "index.html"
        : Object.keys(files)[0]
);
runCode();
