const editor = document.getElementById("editor");
const lineNumbers = document.getElementById("lineNumbers");
const currentTab = document.getElementById("currentTab");
const saveStatus = document.getElementById("saveStatus");
const languageLabel = document.getElementById("languageLabel");
const preview = document.getElementById("preview");

const fileNames = {
    html: "🌐 index.html",
    css: "🎨 style.css",
    js: "🟨 script.js"
};

const languages = {
    html: "HTML",
    css: "CSS",
    js: "JAVASCRIPT"
};

const defaultFiles = {
    html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My First Website</title>
</head>
<body>
    <h1>Hello World!</h1>
    <p>Welcome to my first website.</p>
    <button onclick="sayHello()">Click Me</button>
</body>
</html>`,

    css: `body {
    font-family: Arial, sans-serif;
    text-align: center;
    padding: 40px;
    background: #f0f4f8;
}

h1 {
    color: #007acc;
}

p {
    font-size: 18px;
}

button {
    padding: 10px 20px;
    color: white;
    background: #007acc;
    border: none;
    border-radius: 5px;
    cursor: pointer;
}

button:hover {
    background: #005a9e;
}`,

    js: `function sayHello() {
    alert("Hello from JS Browser!");
}

console.log("JavaScript is working!");`
};

let files = loadFiles();
let activeFile = "html";

function loadFiles() {
    try {
        const saved = localStorage.getItem("jsBrowserFiles");

        if (saved) {
            const parsed = JSON.parse(saved);

            return {
                html: typeof parsed.html === "string"
                    ? parsed.html : defaultFiles.html,
                css: typeof parsed.css === "string"
                    ? parsed.css : defaultFiles.css,
                js: typeof parsed.js === "string"
                    ? parsed.js : defaultFiles.js
            };
        }
    } catch (error) {
        console.warn("Could not load saved files.", error);
    }

    return { ...defaultFiles };
}

function openFile(file) {
    saveCurrentEditor();

    activeFile = file;
    editor.value = files[file];

    currentTab.textContent = fileNames[file];
    languageLabel.textContent = languages[file];

    document.querySelectorAll(".file").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.file === file
        );
    });

    updateLineNumbers();
    saveStatus.textContent = "Ready";
}

function saveCurrentEditor() {
    if (editor && activeFile) {
        files[activeFile] = editor.value;
    }
}

function saveFiles() {
    saveCurrentEditor();

    try {
        localStorage.setItem(
            "jsBrowserFiles",
            JSON.stringify(files)
        );

        saveStatus.textContent = "Saved ✓";
    } catch (error) {
        saveStatus.textContent = "Save failed";
        console.error("Could not save files.", error);
    }
}

function updateLineNumbers() {
    const count = editor.value.split("\n").length;

    lineNumbers.textContent = Array.from(
        { length: count },
        (_, index) => index + 1
    ).join("\n");
}

function runCode() {
    saveCurrentEditor();

    let html = files.html;
    const css = files.css;
    const js = files.js;

    const styleTag = `<style>\n${css}\n</style>`;
    const scriptTag = `<script>\n${js}\n<\/script>`;

    if (/<\/head\s*>/i.test(html)) {
        html = html.replace(
            /<\/head\s*>/i,
            styleTag + "\n</head>"
        );
    } else {
        html = styleTag + "\n" + html;
    }

    if (/<\/body\s*>/i.test(html)) {
        html = html.replace(
            /<\/body\s*>/i,
            scriptTag + "\n</body>"
        );
    } else {
        html += "\n" + scriptTag;
    }

    preview.srcdoc = html;
    saveStatus.textContent = "Preview updated";
}

document.querySelectorAll(".file").forEach(button => {
    button.addEventListener("click", () => {
        openFile(button.dataset.file);
    });
});

editor.addEventListener("input", () => {
    saveCurrentEditor();
    updateLineNumbers();
    saveStatus.textContent = "Unsaved changes";
});

editor.addEventListener("scroll", () => {
    lineNumbers.scrollTop = editor.scrollTop;
});

editor.addEventListener("keydown", event => {
    if (event.key === "Tab") {
        event.preventDefault();

        const start = editor.selectionStart;
        const end = editor.selectionEnd;

        editor.setRangeText("    ", start, end, "end");

        saveCurrentEditor();
        updateLineNumbers();
        saveStatus.textContent = "Unsaved changes";
    }

    if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "s"
    ) {
        event.preventDefault();
        saveFiles();
    }
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
    saveFiles
);

openFile("html");
runCode();
