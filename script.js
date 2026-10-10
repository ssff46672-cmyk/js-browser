
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
    console.log("RUN BUTTON CLICKED");

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
    const css = files["style.css"] || files["style.Css"] || "";
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


const helpDialog = $("helpDialog");

$("helpButton").addEventListener("click", () => {
    helpDialog.showModal();
});

$("closeHelp").addEventListener("click", () => {
    helpDialog.close();
});


/* JS Browser - Examples menu */

const builtInExamples = {
    calculator: {
        "index.html": `<h1>Calculator</h1>
<input id="display" value="0" readonly>
<div id="keys">
<button data-v="7">7</button><button data-v="8">8</button><button data-v="9">9</button><button data-v="+">+</button>
<button data-v="4">4</button><button data-v="5">5</button><button data-v="6">6</button><button data-v="-">-</button>
<button data-v="1">1</button><button data-v="2">2</button><button data-v="3">3</button><button data-v="*">*</button>
<button data-v="0">0</button><button data-v=".">.</button><button id="equal">=</button><button data-v="/">/</button>
<button id="clear">Clear</button>
</div>`,
        "style.css": `body{font-family:Arial;text-align:center;background:#eef2ff;padding:25px}
#display{width:230px;padding:12px;font-size:24px;margin-bottom:10px}
#keys{display:grid;grid-template-columns:repeat(4,60px);gap:7px;justify-content:center}
button{padding:14px;cursor:pointer;border:0;border-radius:6px;background:#dbeafe}
#equal{background:#2563eb;color:white}`,
        "script.js": `const display=document.getElementById("display");
let expr="";
document.getElementById("keys").addEventListener("click",e=>{
 if(e.target.tagName!=="BUTTON")return;
 if(e.target.id==="clear"){expr="";display.value="0";return}
 if(e.target.id==="equal"){
  if(!expr)return;
  if(!/^[0-9+*/. -]+$/.test(expr)){display.value="Error";expr="";return}
  try{
   const result=Function('"use strict";return ('+expr+')')();
   if(!Number.isFinite(result))throw Error();
   expr=String(Number(result.toFixed(8)));display.value=expr;
  }catch{expr="";display.value="Error"}
  return;
 }
 expr+=e.target.dataset.v;display.value=expr;
});`
    },

    todo: {
        "index.html": `<h1>My To-Do List</h1>
<form id="form"><input id="task" placeholder="Write a task..." required><button>Add</button></form>
<ul id="list"></ul>`,
        "style.css": `body{font-family:Arial;max-width:500px;margin:40px auto;padding:15px;background:#f0fdf4}
h1{color:#166534}input{padding:10px}button{padding:10px;background:#16a34a;color:white;border:0;cursor:pointer}
li{padding:10px;border-bottom:1px solid #ddd}li span{margin-right:10px}li.done{text-decoration:line-through;color:#888}`,
        "script.js": `const form=document.getElementById("form");
const input=document.getElementById("task");
const list=document.getElementById("list");
form.addEventListener("submit",e=>{
 e.preventDefault();
 const li=document.createElement("li");
 const text=document.createElement("span");text.textContent=input.value;
 const done=document.createElement("input");done.type="checkbox";
 done.addEventListener("change",()=>li.classList.toggle("done",done.checked));
 const del=document.createElement("button");del.textContent="Delete";
 del.addEventListener("click",()=>li.remove());
 li.append(done,text,del);list.append(li);
 input.value="";
});`
    },

    clock: {
        "index.html": `<h1>Digital Clock</h1><div id="clock">00:00:00</div><p id="date"></p>`,
        "style.css": `body{font-family:Arial;text-align:center;background:#0f172a;color:white;padding:50px}
#clock{font-size:clamp(40px,10vw,70px);color:#38bdf8;font-weight:bold}`,
        "script.js": `function updateClock(){
 const now=new Date();
 document.getElementById("clock").textContent=now.toLocaleTimeString();
 document.getElementById("date").textContent=now.toLocaleDateString(undefined,{weekday:"long",year:"numeric",month:"long",day:"numeric"});
}
updateClock();setInterval(updateClock,1000);`
    },

    guess: {
        "index.html": `<h1>Guess the Number</h1>
<p>Guess a number between 1 and 100.</p>
<form id="form"><input id="guess" type="number" min="1" max="100" required><button>Guess</button></form>
<p id="message">Good luck!</p><p>Attempts: <span id="attempts">0</span></p>
<button id="restart">New Game</button>`,
        "style.css": `body{font-family:Arial;text-align:center;background:#fff7ed;padding:30px}
input,button{padding:12px;margin:5px}button{background:#ea580c;color:white;border:0;cursor:pointer}
#message{font-weight:bold;min-height:24px}`,
        "script.js": `let secret=Math.floor(Math.random()*100)+1;
let attempts=0,finished=false;
const form=document.getElementById("form");
const input=document.getElementById("guess");
const message=document.getElementById("message");
form.addEventListener("submit",e=>{
 e.preventDefault();if(finished)return;
 const n=Number(input.value);
 if(!Number.isInteger(n)||n<1||n>100){message.textContent="Enter a number from 1 to 100.";return}
 attempts++;document.getElementById("attempts").textContent=attempts;
 if(n===secret){message.textContent="Correct! You won!";finished=true}
 else message.textContent=n<secret?"Too low! Try higher.":"Too high! Try lower.";
 input.select();
});
document.getElementById("restart").addEventListener("click",()=>{
 secret=Math.floor(Math.random()*100)+1;attempts=0;finished=false;
 document.getElementById("attempts").textContent="0";
 message.textContent="New game! Good luck.";input.value="";
});`
    },

    portfolio: {
        "index.html": `<header><h1>Your Name</h1><p>Beginner Web Developer</p><a href="#about">About</a> | <a href="#projects">Projects</a> | <a href="#contact">Contact</a></header>
<main><section id="about"><h2>About Me</h2><p>I am learning HTML, CSS and JavaScript.</p></section>
<section id="projects"><h2>My Projects</h2><article><h3>Calculator</h3><p>A simple calculator.</p></article><article><h3>To-Do List</h3><p>An app for daily tasks.</p></article></section>
<section id="contact"><h2>Contact</h2><button id="hello">Say Hello</button><p id="message"></p></section></main>
<footer>Made with HTML, CSS and JavaScript.</footer>`,
        "style.css": `body{font-family:Arial;margin:0;line-height:1.6;color:#1e293b}
header{background:#1d4ed8;color:white;padding:35px;text-align:center}
a{color:inherit}main{max-width:800px;margin:auto;padding:20px}
section{padding:20px 0}article{background:#eff6ff;padding:15px;margin:10px 0;border-radius:8px}
button{padding:10px 15px;background:#2563eb;color:white;border:0;border-radius:5px;cursor:pointer}
footer{text-align:center;background:#172554;color:white;padding:20px}`,
        "script.js": `document.getElementById("hello").addEventListener("click",()=>{
 document.getElementById("message").textContent="Thanks for visiting my portfolio!";
});`
    }
};

const examplesSelect = document.getElementById("examplesSelect");
const loadExampleButton = document.getElementById("loadExampleButton");

if (examplesSelect && loadExampleButton) {
    loadExampleButton.addEventListener("click", function () {
        const example = builtInExamples[examplesSelect.value];

        if (!example) {
            alert("Please choose an example first.");
            return;
        }

        if (!confirm("Load this example? Save your current code first. Files with matching names will be replaced.")) {
            return;
        }

        Object.entries(example).forEach(function ([name, content]) {
            files[name] = content;
        });

        renderFiles();
        openFile("index.html");
        runCode();
    });
}


