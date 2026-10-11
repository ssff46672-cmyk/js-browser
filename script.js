
(function () {
    "use strict";

    

    var STORAGE_KEY = "jsBrowserProject_v2";
    var ACTIVE_FILE_KEY = "jsBrowserActiveFile_v2";

    var files = {};
    var activeFile = "index.html";
    var editor = null;
    var isDirty = false;
    var saveTimer = null;
    var consoleMessages = [];

    var elements = {
        editor: document.getElementById("editor"),
        fileList: document.getElementById("fileList"),
        currentTab: document.getElementById("currentTab"),
        saveStatus: document.getElementById("saveStatus"),
        languageLabel: document.getElementById("languageLabel"),
        runBtn: document.getElementById("runBtn"),
        saveBtn: document.getElementById("saveBtn"),
        newFileBtn: document.getElementById("newFileBtn"),
        sidebarNewBtn: document.getElementById("sidebarNewBtn"),
        deleteFileBtn: document.getElementById("deleteFileBtn"),
        exportBtn: document.getElementById("exportBtn"),
        refreshBtn: document.getElementById("refreshBtn"),
        clearConsoleBtn: document.getElementById("clearConsoleBtn"),
        preview: document.getElementById("preview"),
        previewPanel: document.getElementById("previewPanel"),
        consolePanel: document.getElementById("consolePanel"),
        consoleOutput: document.getElementById("consoleOutput"),
        panelTabs: document.querySelectorAll(".panel-tab"),
        helpButton: document.getElementById("helpButton"),
        helpDialog: document.getElementById("helpDialog"),
        closeHelp: document.getElementById("closeHelp"),
        examplesSelect: document.getElementById("examplesSelect"),
        loadExampleButton: document.getElementById("loadExampleButton")
    };

    var defaultFiles = {
        "index.html": [
            "<!DOCTYPE html>",
            '<html lang="en">',
            "<head>",
            '    <meta charset="UTF-8">',
            '    <meta name="viewport" content="width=device-width, initial-scale=1.0">',
            "    <title>My First Website</title>",
            "</head>",
            "<body>",
            "    <h1>Hello, JS Browser!</h1>",
            "    <p>Start writing your website here.</p>",
            '    <button id="helloButton">Click me</button>',
            "    <script src=\"script.js\"><" + "/script>",
            "</body>",
            "</html>"
        ].join("\n"),

        "style.css": [
            "body {",
            "    font-family: Arial, sans-serif;",
            "    max-width: 800px;",
            "    margin: 40px auto;",
            "    padding: 20px;",
            "    line-height: 1.6;",
            "    background: #f4f7fb;",
            "    color: #222;",
            "}",
            "",
            "h1 {",
            "    color: #635bff;",
            "}",
            "",
            "button {",
            "    padding: 10px 18px;",
            "    border: 0;",
            "    border-radius: 8px;",
            "    background: #635bff;",
            "    color: white;",
            "    cursor: pointer;",
            "}",
            "",
            "button:hover {",
            "    background: #4941d8;",
            "}"
        ].join("\n"),

        "script.js": [
            'var button = document.getElementById("helloButton");',
            "",
            "if (button) {",
            '    button.addEventListener("click", function () {',
            '        console.log("Button clicked!");',
            '        alert("Hello from JS Browser!");',
            "    });",
            "}",
            "",
            'console.log("Your JavaScript is running!");'
        ].join("\n")
    };

    

    function $(id) {
        return document.getElementById(id);
    }

    function setStatus(message) {
        if (elements.saveStatus) {
            elements.saveStatus.textContent = message;
        }
    }

    function escapeHTML(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function getExtension(filename) {
        var index = filename.lastIndexOf(".");
        return index === -1 ? "" : filename.substring(index + 1).toLowerCase();
    }

    function getLanguage(filename) {
        var extension = getExtension(filename);

        if (extension === "html" || extension === "htm") {
            return "HTML";
        }

        if (extension === "css") {
            return "CSS";
        }

        if (extension === "js") {
            return "JavaScript";
        }

        if (extension === "json") {
            return "JSON";
        }

        return "Text";
    }

    function getEditorMode(filename) {
        var extension = getExtension(filename);

        if (extension === "html" || extension === "htm") {
            return "htmlmixed";
        }

        if (extension === "css") {
            return "css";
        }

        if (extension === "js") {
            return "javascript";
        }

        if (extension === "json") {
            return { name: "javascript", json: true };
        }

        return "text/plain";
    }

    function isValidFilename(filename) {
        return /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(filename);
    }

    function getEditorValue() {
        if (editor) {
            return editor.getValue();
        }

        return elements.editor ? elements.editor.value : "";
    }

    function setEditorValue(value) {
        if (editor) {
            editor.setValue(value);
        } else if (elements.editor) {
            elements.editor.value = value;
        }
    }

    function refreshEditorLayout() {
        if (editor) {
            editor.refresh();
        }
    }

    function sortedFilenames() {
        return Object.keys(files).sort(function (a, b) {
            var priority = {
                "index.html": 0,
                "style.css": 1,
                "script.js": 2
            };

            var pa = typeof priority[a] === "number" ? priority[a] : 10;
            var pb = typeof priority[b] === "number" ? priority[b] : 10;

            if (pa !== pb) {
                return pa - pb;
            }

            return a.localeCompare(b);
        });
    }

    

function htmlTagHint(cm) {
    var cursor = cm.getCursor();
    var line = cm.getLine(cursor.line);
    var before = line.slice(0, cursor.ch);
    var match = before.match(/[a-zA-Z][a-zA-Z0-9-]*$/);

    if (!match) {
        return { list: [], from: cursor, to: cursor };
    }

    var word = match[0].toLowerCase();

    var tags = [
        "h1", "h2", "h3", "h4", "h5", "h6",
        "header", "footer", "main", "nav",
        "section", "article", "aside", "div",
        "span", "p", "a", "img", "ul", "ol",
        "li", "table", "thead", "tbody", "tfoot",
        "tr", "th", "td", "form", "label",
        "input", "textarea", "button", "select",
        "option", "title", "meta", "link",
        "script", "style", "video", "audio",
        "figure", "figcaption", "strong", "em"
    ];

    var suggestions = tags
        .filter(function (tag) {
            return tag.indexOf(word) === 0;
        })
        .map(function (tag) {
            return {
                text: tag,
                displayText: tag
            };
        });

    return {
        list: suggestions,
        from: CodeMirror.Pos(
            cursor.line,
            cursor.ch - match[0].length
        ),
        to: cursor
    };
}

    function initializeEditor() {
        if (!elements.editor) {
            console.error("Editor textarea was not found.");
            return;
        }

        if (window.CodeMirror) {
            editor = window.CodeMirror.fromTextArea(elements.editor, {
                lineNumbers: true,
                mode: "htmlmixed",
                theme: "dracula",
                lineWrapping: true,
                tabSize: 4,
                indentUnit: 4,
                indentWithTabs: false,
                autoCloseBrackets: true,
                matchBrackets: true
            });
            
editor.on("inputRead", function (cm, change) {
    if (!change.text || !change.text.length) {
        return;
    }

    if (!/\.(html|htm)$/i.test(activeFile)) {
        return;
    }

    if (!window.CodeMirror.showHint) {
        return;
    }

    var cursor = cm.getCursor();
    var line = cm.getLine(cursor.line);
    var before = line.slice(0, cursor.ch);

    if (!/[a-zA-Z][a-zA-Z0-9-]*$/.test(before)) {
        return;
    }

    cm.showHint({
        hint: htmlTagHint,
        completeSingle: false
    });
});


            editor.on("change", function () {
                handleEditorChange();
            });

            editor.setSize("100%", "100%");
        } else {
            elements.editor.addEventListener("input", handleEditorChange);
            elements.editor.style.width = "100%";
            elements.editor.style.height = "100%";
            elements.editor.style.boxSizing = "border-box";
            elements.editor.style.resize = "none";
            setStatus("Editor loaded without syntax highlighting");
        }
    }

    function handleEditorChange() {
        if (!activeFile || !Object.prototype.hasOwnProperty.call(files, activeFile)) {
            return;
        }

        files[activeFile] = getEditorValue();
        isDirty = true;

        setStatus("Unsaved changes");

        window.clearTimeout(saveTimer);
        saveTimer = window.setTimeout(function () {
            saveProject(false);
        }, 700);
    }

    function updateEditorLanguage() {
        var language = getLanguage(activeFile);

        if (elements.languageLabel) {
            elements.languageLabel.textContent = language;
        }

        if (editor) {
            editor.setOption("mode", getEditorMode(activeFile));
        }
    }

    

    function renderFileList() {
        if (!elements.fileList) {
            return;
        }

        elements.fileList.innerHTML = "";

        sortedFilenames().forEach(function (filename) {
            var item = document.createElement("button");
            item.type = "button";
            item.className = "file";

            if (filename === activeFile) {
                item.classList.add("active");
            }

            var icon = document.createElement("span");
            icon.className = "file-icon";

            var extension = getExtension(filename);
            icon.textContent = extension === "html" || extension === "htm"
                ? "🌐"
                : extension === "css"
                    ? "🎨"
                    : extension === "js"
                        ? "📜"
                        : "📄";

            var name = document.createElement("span");
            name.className = "file-name";
            name.textContent = filename;

            item.appendChild(icon);
            item.appendChild(name);

            item.addEventListener("click", function () {
                openFile(filename);
            });

            elements.fileList.appendChild(item);
        });
    }

    function openFile(filename) {
        if (!Object.prototype.hasOwnProperty.call(files, filename)) {
            return;
        }

        if (activeFile && isDirty) {
            files[activeFile] = getEditorValue();
        }

        activeFile = filename;

        setEditorValue(files[filename]);
        updateEditorLanguage();

        if (elements.currentTab) {
            elements.currentTab.textContent = filename;
        }

        renderFileList();
        isDirty = false;
        setStatus("Ready");

        try {
            localStorage.setItem(ACTIVE_FILE_KEY, activeFile);
        } catch (error) {
            // Local storage may be unavailable.
        }

        window.setTimeout(refreshEditorLayout, 0);
    }

    function createFile() {
        var filename = window.prompt(
            "Enter a filename, for example: about.html, style.css or app.js"
        );

        if (filename === null) {
            return;
        }

        filename = filename.trim();

        if (!filename) {
            window.alert("Please enter a filename.");
            return;
        }

        if (!isValidFilename(filename)) {
            window.alert(
                "Invalid filename. Use letters, numbers, hyphens or underscores, followed by an extension."
            );
            return;
        }

        if (Object.prototype.hasOwnProperty.call(files, filename)) {
            window.alert("A file with this name already exists.");
            return;
        }

        files[filename] = "";
        saveProject(false);
        openFile(filename);

        setStatus("File created");
    }

    function deleteFile() {
        if (!activeFile) {
            return;
        }

        var names = Object.keys(files);

        if (names.length <= 1) {
            window.alert("You must keep at least one project file.");
            return;
        }

        if (!window.confirm('Delete "' + activeFile + '"? This cannot be undone.')) {
            return;
        }

        delete files[activeFile];

        var remaining = sortedFilenames();
        activeFile = remaining[0];

        saveProject(false);
        openFile(activeFile);
        renderFileList();

        setStatus("File deleted");
    }

    

    function saveProject(showMessage) {
        if (activeFile && Object.prototype.hasOwnProperty.call(files, activeFile)) {
            files[activeFile] = getEditorValue();
        }

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
            localStorage.setItem(ACTIVE_FILE_KEY, activeFile);

            isDirty = false;

            if (showMessage !== false) {
                setStatus("Project saved");
            } else {
                setStatus("Saved automatically");
            }

            return true;
        } catch (error) {
            setStatus("Save failed");

            if (showMessage !== false) {
                window.alert(
                    "The project could not be saved in this browser. Export a ZIP backup to avoid losing your work."
                );
            }

            return false;
        }
    }

    function loadProject() {
        var restored = false;

        try {
            var storedFiles = localStorage.getItem(STORAGE_KEY);

            if (storedFiles) {
                var parsed = JSON.parse(storedFiles);

                if (
                    parsed &&
                    typeof parsed === "object" &&
                    !Array.isArray(parsed)
                ) {
                    Object.keys(parsed).forEach(function (filename) {
                        if (
                            isValidFilename(filename) &&
                            typeof parsed[filename] === "string"
                        ) {
                            files[filename] = parsed[filename];
                        }
                    });

                    restored = Object.keys(files).length > 0;
                }
            }

            var storedActive = localStorage.getItem(ACTIVE_FILE_KEY);

            if (
                storedActive &&
                Object.prototype.hasOwnProperty.call(files, storedActive)
            ) {
                activeFile = storedActive;
            }
        } catch (error) {
            console.warn("Could not restore the saved project.", error);
        }

        if (!restored) {
            files = {};
            Object.keys(defaultFiles).forEach(function (filename) {
                files[filename] = defaultFiles[filename];
            });
            activeFile = "index.html";
        }
    }

    

    function showPanel(panelName) {
        if (elements.previewPanel) {
            elements.previewPanel.classList.toggle("hidden", panelName !== "preview");
        }

        if (elements.consolePanel) {
            elements.consolePanel.classList.toggle("hidden", panelName !== "console");
        }

        if (elements.panelTabs) {
            Array.prototype.forEach.call(elements.panelTabs, function (button) {
                button.classList.toggle(
                    "active",
                    button.getAttribute("data-panel") === panelName
                );
            });
        }

        if (panelName === "preview") {
            window.setTimeout(refreshEditorLayout, 0);
        }
    }

    function renderConsole() {
        if (!elements.consoleOutput) {
            return;
        }

        elements.consoleOutput.innerHTML = "";

        if (!consoleMessages.length) {
            var hint = document.createElement("p");
            hint.className = "console-hint";
            hint.textContent = "JavaScript messages and errors appear here.";
            elements.consoleOutput.appendChild(hint);
            return;
        }

        consoleMessages.forEach(function (entry) {
            var line = document.createElement("div");
            line.className = "console-line";

            if (entry.type === "error") {
                line.classList.add("error");
            } else if (entry.type === "warn") {
                line.classList.add("warn");
            }

            var prefix = document.createElement("strong");
            prefix.textContent = entry.type.toUpperCase() + ": ";

            var message = document.createElement("span");
            message.textContent = entry.message;

            line.appendChild(prefix);
            line.appendChild(message);

            elements.consoleOutput.appendChild(line);
        });

        elements.consoleOutput.scrollTop = elements.consoleOutput.scrollHeight;
    }

    function addConsoleMessage(type, message) {
        consoleMessages.push({
            type: type || "log",
            message: String(message)
        });

        if (consoleMessages.length > 300) {
            consoleMessages.shift();
        }

        renderConsole();
    }

    function clearConsole() {
        consoleMessages = [];
        renderConsole();
    }

    function formatConsoleArguments(args) {
        return Array.prototype.map.call(args, function (value) {
            if (typeof value === "string") {
                return value;
            }

            if (value instanceof Error) {
                return value.stack || value.message;
            }

            try {
                if (value === undefined) {
                    return "undefined";
                }

                if (typeof value === "function") {
                    return value.toString();
                }

                return JSON.stringify(value);
            } catch (error) {
                return String(value);
            }
        }).join(" ");
    }

    window.addEventListener("message", function (event) {
        if (!elements.preview || event.source !== elements.preview.contentWindow) {
            return;
        }

        var data = event.data;

        if (!data || data.jsBrowserMessage !== true) {
            return;
        }

        addConsoleMessage(data.type || "log", data.message || "");
    });

    

    function escapeScriptClosingTags(code) {
        return String(code).replace(/<\/script/gi, "<\\/script");
    }

    function addConsoleBridge(html) {
        var bridge = [
            "<script>",
            "(function(){",
            'var send=function(type,args){',
            'var message=Array.prototype.map.call(args,function(item){',
            'try{return typeof item==="string"?item:JSON.stringify(item);}',
            'catch(e){return String(item);}',
            '}).join(" ");',
            'parent.postMessage({jsBrowserMessage:true,type:type,message:message},"*");',
            '};',
            '["log","info","debug","warn","error"].forEach(function(type){',
            'var original=console[type];',
            'console[type]=function(){',
            'send(type,arguments);',
            'if(original){original.apply(console,arguments);}',
            '};',
            '});',
            'window.addEventListener("error",function(event){',
            'send("error",[event.message+" ("+event.filename+":"+event.lineno+")"]);',
            '});',
            'window.addEventListener("unhandledrejection",function(event){',
            'send("error",["Unhandled promise rejection:",event.reason]);',
            '});',
            '})();',
            "<" + "/script>"
        ].join("");

        if (/<head(?:\s[^>]*)?>/i.test(html)) {
            return html.replace(/<head(?:\s[^>]*)?>/i, function (match) {
                return match + bridge;
            });
        }

        return bridge + html;
    }

    function injectProjectAssets(html) {
        var css = "";
        var js = "";

        if (Object.prototype.hasOwnProperty.call(files, "style.css")) {
            css = files["style.css"];
        } else if (Object.prototype.hasOwnProperty.call(files, "style.Css")) {
            css = files["style.Css"];
        }

        if (Object.prototype.hasOwnProperty.call(files, "script.js")) {
            js = files["script.js"];
        }

        // Add project CSS directly to the preview.
        if (css) {
            var styleTag = "<style>\n" + css + "\n</style>";

            if (/<\/head\s*>/i.test(html)) {
                html = html.replace(/<\/head\s*>/i, styleTag + "\n</head>");
            } else {
                html = styleTag + "\n" + html;
            }
        }

        // Remove local CSS links because CSS is embedded above.
        html = html.replace(
            /<link\b[^>]*href\s*=\s*["'](?:\.\/)?style\.(?:css|Css)["'][^>]*>/gi,
            ""
        );

        // Remove the local script.js reference to avoid loading it twice.
        html = html.replace(
            /<script\b[^>]*src\s*=\s*["'](?:\.\/)?script\.js["'][^>]*>\s*<\/script\s*>/gi,
            ""
        );

        // Run project JavaScript after the HTML is parsed.
        if (js) {
            var scriptTag = "<script>\n" +
                escapeScriptClosingTags(js) +
                "\n<" + "/script>";

            if (/<\/body\s*>/i.test(html)) {
                html = html.replace(/<\/body\s*>/i, scriptTag + "\n</body>");
            } else {
                html += "\n" + scriptTag;
            }
        }

        return html;
    }

    function runCode() {
        if (!Object.prototype.hasOwnProperty.call(files, activeFile)) {
            return;
        }

        files[activeFile] = getEditorValue();

        if (!Object.prototype.hasOwnProperty.call(files, "index.html")) {
            window.alert("Create an index.html file before running the project.");
            return;
        }

        clearConsole();

        var html = files["index.html"];
        html = injectProjectAssets(html);
        html = addConsoleBridge(html);

        if (elements.preview) {
            elements.preview.srcdoc = html;
        }

        showPanel("preview");
        setStatus("Project running");

        window.setTimeout(function () {
            setStatus(isDirty ? "Unsaved changes" : "Ready");
        }, 1200);
    }

    

    function exportProject() {
        if (!window.JSZip) {
            window.alert(
                "ZIP export is unavailable because the JSZip library did not load. Check your internet connection and try again."
            );
            return;
        }

        files[activeFile] = getEditorValue();

        var zip = new window.JSZip();
        var projectFolder = zip.folder("js-browser-project");

        sortedFilenames().forEach(function (filename) {
            projectFolder.file(filename, files[filename]);
        });

        projectFolder.file(
            "README.txt",
            [
                "JS Browser Project",
                "==================",
                "",
                "1. Open index.html in your browser.",
                "2. Edit style.css to change the design.",
                "3. Edit script.js to add JavaScript behavior.",
                "",
                "Note: Some browser features require a local web server."
            ].join("\n")
        );

        setStatus("Preparing ZIP...");

        zip.generateAsync({
            type: "blob",
            compression: "DEFLATE",
            compressionOptions: { level: 6 }
        }).then(function (blob) {
            var url = URL.createObjectURL(blob);
            var link = document.createElement("a");

            link.href = url;
            link.download = "js-browser-project.zip";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            window.setTimeout(function () {
                URL.revokeObjectURL(url);
            }, 1500);

            setStatus("ZIP exported");
        }).catch(function (error) {
            console.error("ZIP export failed:", error);
            setStatus("ZIP export failed");
            window.alert("Could not export the ZIP file. Please try again.");
        });
    }

    

    var examples = {
        calculator: {
            "index.html": [
                "<!DOCTYPE html>",
                '<html lang="en">',
                "<head>",
                '    <meta charset="UTF-8">',
                '    <meta name="viewport" content="width=device-width, initial-scale=1.0">',
                "    <title>Calculator</title>",
                "</head>",
                "<body>",
                '    <main class="calculator">',
                "        <h1>Calculator</h1>",
                '        <input id="display" type="text" value="0" readonly>',
                '        <div class="keys">',
                '            <button data-value="7">7</button>',
                '            <button data-value="8">8</button>',
                '            <button data-value="9">9</button>',
                '            <button data-value="/">÷</button>',
                '            <button data-value="4">4</button>',
                '            <button data-value="5">5</button>',
                '            <button data-value="6">6</button>',
                '            <button data-value="*">×</button>',
                '            <button data-value="1">1</button>',
                '            <button data-value="2">2</button>',
                '            <button data-value="3">3</button>',
                '            <button data-value="-">−</button>',
                '            <button data-value="0">0</button>',
                '            <button data-value=".">.</button>',
                '            <button id="clear">C</button>',
                '            <button data-value="+">+</button>',
                '            <button id="equals">=</button>',
                "        </div>",
                "    </main>",
                "    <script src=\"script.js\"><" + "/script>",
                "</body>",
                "</html>"
            ].join("\n"),

            "style.css": [
                "body { font-family: Arial; background: #eef2ff; padding: 30px; }",
                ".calculator { max-width: 320px; margin: auto; padding: 22px; background: white; border-radius: 16px; box-shadow: 0 8px 25px #0002; }",
                "h1 { text-align: center; color: #4f46e5; }",
                "#display { width: 100%; box-sizing: border-box; padding: 15px; margin-bottom: 12px; font-size: 24px; text-align: right; }",
                ".keys { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }",
                "button { padding: 14px; border: 0; border-radius: 8px; background: #e0e7ff; cursor: pointer; font-size: 18px; }",
                "button:hover { background: #c7d2fe; }",
                "#equals { grid-column: span 4; background: #4f46e5; color: white; }"
            ].join("\n"),

            "script.js": [
                'var display = document.getElementById("display");',
                'var keys = document.querySelectorAll("[data-value]");',
                'var expression = "";',
                'keys.forEach(function (key) {',
                '    key.addEventListener("click", function () {',
                '        expression += key.getAttribute("data-value");',
                '        display.value = expression;',
                '    });',
                '});',
                'document.getElementById("clear").addEventListener("click", function () {',
                '    expression = ""; display.value = "0";',
                '});',
                'document.getElementById("equals").addEventListener("click", function () {',
                '    try {',
                '        if (!/^[0-9+*/.() -]+$/.test(expression)) throw new Error("Invalid input");',
                '        var result = Function("return (" + expression + ")")();',
                '        if (!Number.isFinite(result)) throw new Error("Invalid calculation");',
                '        display.value = result; expression = String(result);',
                '    } catch (error) { display.value = "Error"; expression = ""; }',
                '});'
            ].join("\n")
        },

        todo: {
            "index.html": [
                "<!DOCTYPE html>",
                '<html lang="en">',
                "<head>",
                '    <meta charset="UTF-8">',
                '    <meta name="viewport" content="width=device-width, initial-scale=1.0">',
                "    <title>To-Do List</title>",
                "</head>",
                "<body>",
                '    <main class="app">',
                "        <h1>My To-Do List</h1>",
                '        <form id="todoForm">',
                '            <input id="todoInput" placeholder="What do you need to do?" required>',
                '            <button type="submit">Add</button>',
                "        </form>",
                '        <ul id="todoList"></ul>',
                "    </main>",
                "    <script src=\"script.js\"><" + "/script>",
                "</body>",
                "</html>"
            ].join("\n"),

            "style.css": [
                "body { font-family: Arial; background: #f1f5f9; padding: 30px; }",
                ".app { max-width: 500px; margin: auto; background: white; padding: 25px; border-radius: 14px; }",
                "h1 { color: #0f766e; }",
                "form { display: flex; gap: 8px; }",
                "input { flex: 1; min-width: 0; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; }",
                "button { padding: 12px 18px; border: 0; border-radius: 8px; background: #0f766e; color: white; cursor: pointer; }",
                "li { display: flex; justify-content: space-between; gap: 10px; align-items: center; padding: 12px 0; border-bottom: 1px solid #e2e8f0; }",
                "li.done span { text-decoration: line-through; color: #94a3b8; }",
                "li button { background: #dc2626; padding: 7px 10px; }"
            ].join("\n"),

            "script.js": [
                'var form = document.getElementById("todoForm");',
                'var input = document.getElementById("todoInput");',
                'var list = document.getElementById("todoList");',
                'form.addEventListener("submit", function (event) {',
                '    event.preventDefault();',
                '    var text = input.value.trim();',
                '    if (!text) return;',
                '    var item = document.createElement("li");',
                '    var label = document.createElement("span");',
                '    label.textContent = text;',
                '    label.style.cursor = "pointer";',
                '    label.addEventListener("click", function () { item.classList.toggle("done"); });',
                '    var remove = document.createElement("button");',
                '    remove.textContent = "Delete";',
                '    remove.type = "button";',
                '    remove.addEventListener("click", function () { item.remove(); });',
                '    item.appendChild(label); item.appendChild(remove);',
                '    list.appendChild(item);',
                '    input.value = ""; input.focus();',
                '});'
            ].join("\n")
        },

        clock: {
            "index.html": [
                "<!DOCTYPE html>",
                '<html lang="en">',
                "<head>",
                '    <meta charset="UTF-8">',
                '    <meta name="viewport" content="width=device-width, initial-scale=1.0">',
                "    <title>Digital Clock</title>",
                "</head>",
                "<body>",
                '    <main class="clock-card">',
                "        <h1>Digital Clock</h1>",
                '        <div id="clock">00:00:00</div>',
                '        <p id="date"></p>',
                "    </main>",
                "    <script src=\"script.js\"><" + "/script>",
                "</body>",
                "</html>"
            ].join("\n"),

            "style.css": [
                "body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0f172a; font-family: Arial; color: white; }",
                ".clock-card { text-align: center; padding: 35px; border-radius: 20px; background: #1e293b; box-shadow: 0 10px 40px #0005; }",
                "h1 { color: #38bdf8; }",
                "#clock { font-size: clamp(35px, 8vw, 65px); font-weight: bold; letter-spacing: 3px; }",
                "#date { color: #cbd5e1; }"
            ].join("\n"),

            "script.js": [
                'function updateClock() {',
                '    var now = new Date();',
                '    document.getElementById("clock").textContent = now.toLocaleTimeString();',
                '    document.getElementById("date").textContent = now.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });',
                '}',
                'updateClock();',
                'setInterval(updateClock, 1000);'
            ].join("\n")
        },

        guess: {
            "index.html": [
                "<!DOCTYPE html>",
                '<html lang="en">',
                "<head>",
                '    <meta charset="UTF-8">',
                '    <meta name="viewport" content="width=device-width, initial-scale=1.0">',
                "    <title>Guess the Number</title>",
                "</head>",
                "<body>",
                '    <main class="game">',
                "        <h1>Guess the Number</h1>",
                "        <p>I'm thinking of a number between 1 and 100.</p>",
                '        <form id="guessForm">',
                '            <input id="guessInput" type="number" min="1" max="100" placeholder="Enter a number" required>',
                '            <button type="submit">Guess</button>',
                "        </form>",
                '        <p id="message" aria-live="polite">Good luck!</p>',
                '        <p>Attempts: <strong id="attempts">0</strong></p>',
                '        <button id="restart" type="button">New Game</button>',
                "    </main>",
                "    <script src=\"script.js\"><" + "/script>",
                "</body>",
                "</html>"
            ].join("\n"),

            "style.css": [
                "body { font-family: Arial; background: #fef3c7; padding: 30px; }",
                ".game { max-width: 500px; margin: 40px auto; padding: 25px; background: white; border-radius: 16px; text-align: center; }",
                "h1 { color: #b45309; }",
                "input { padding: 12px; width: 160px; max-width: 55%; border: 1px solid #d1d5db; border-radius: 8px; }",
                "button { padding: 12px 16px; border: 0; border-radius: 8px; background: #d97706; color: white; cursor: pointer; }",
                "#message { font-weight: bold; min-height: 24px; }"
            ].join("\n"),

            "script.js": [
                'var secret = Math.floor(Math.random() * 100) + 1;',
                'var attempts = 0;',
                'var form = document.getElementById("guessForm");',
                'var input = document.getElementById("guessInput");',
                'var message = document.getElementById("message");',
                'var attemptsLabel = document.getElementById("attempts");',
                'form.addEventListener("submit", function (event) {',
                '    event.preventDefault();',
                '    var guess = Number(input.value);',
                '    if (guess < 1 || guess > 100 || !Number.isInteger(guess)) {',
                '        message.textContent = "Enter a whole number from 1 to 100."; return;',
                '    }',
                '    attempts++; attemptsLabel.textContent = attempts;',
                '    if (guess === secret) {',
                '        message.textContent = "Correct! You won in " + attempts + " attempts!";',
                '    } else if (guess < secret) {',
                '        message.textContent = "Too low! Try a bigger number.";',
                '    } else {',
                '        message.textContent = "Too high! Try a smaller number.";',
                '    }',
                '});',
                'document.getElementById("restart").addEventListener("click", function () {',
                '    secret = Math.floor(Math.random() * 100) + 1;',
                '    attempts = 0; attemptsLabel.textContent = "0";',
                '    message.textContent = "New game! Good luck!";',
                '    input.value = ""; input.focus();',
                '});'
            ].join("\n")
        },

        portfolio: {
            "index.html": [
                "<!DOCTYPE html>",
                '<html lang="en">',
                "<head>",
                '    <meta charset="UTF-8">',
                '    <meta name="viewport" content="width=device-width, initial-scale=1.0">',
                "    <title>My Portfolio</title>",
                "</head>",
                "<body>",
                '    <header class="hero">',
                "        <p>HELLO, I'M</p>",
                "        <h1>Your Name</h1>",
                "        <h2>Web Developer</h2>",
                "        <p>I create useful and beautiful websites for the web.</p>",
                '        <a href="#projects">View My Projects</a>',
                "    </header>",
                '    <section class="about">',
                "        <h2>About Me</h2>",
                "        <p>I enjoy learning new technologies and building projects with HTML, CSS, and JavaScript.</p>",
                "    </section>",
                '    <section id="projects" class="projects">',
                "        <h2>My Projects</h2>",
                '        <article><h3>Project One</h3><p>A responsive website built with HTML and CSS.</p></article>',
                '        <article><h3>Project Two</h3><p>An interactive application built with JavaScript.</p></article>',
                "    </section>",
                "    <footer>© 2026 Your Name. Built with HTML, CSS and JavaScript.</footer>",
                "</body>",
                "</html>"
            ].join("\n"),

            "style.css": [
                "* { box-sizing: border-box; }",
                "body { margin: 0; font-family: Arial, sans-serif; color: #1f2937; line-height: 1.7; }",
                ".hero { padding: 80px 20px; text-align: center; background: linear-gradient(135deg, #312e81, #6366f1); color: white; }",
                ".hero h1 { font-size: clamp(40px, 8vw, 70px); margin: 5px; }",
                ".hero h2 { color: #c7d2fe; }",
                ".hero a { display: inline-block; margin-top: 15px; padding: 12px 20px; background: white; color: #4338ca; border-radius: 8px; text-decoration: none; font-weight: bold; }",
                ".about, .projects { max-width: 900px; margin: auto; padding: 35px 20px; }",
                ".projects article { display: inline-block; vertical-align: top; width: 45%; margin: 1%; padding: 20px; background: #f3f4f6; border-radius: 12px; }",
                "footer { padding: 25px; text-align: center; background: #111827; color: white; }",
                "@media (max-width: 600px) { .projects article { width: 100%; margin: 10px 0; } }"
            ].join("\n"),

            "script.js": [
                'console.log("Welcome to your portfolio!");'
            ].join("\n")
        }
    };

    function loadExample() {
        var select = elements.examplesSelect;
        var exampleName = select ? select.value : "";

        if (!exampleName || !examples[exampleName]) {
            window.alert("Please choose an example first.");
            return;
        }

        if (
            isDirty &&
            !window.confirm("Load this example? Your current unsaved changes will be replaced.")
        ) {
            return;
        }

        files = {};

        Object.keys(examples[exampleName]).forEach(function (filename) {
            files[filename] = examples[exampleName][filename];
        });

        activeFile = "index.html";
        isDirty = false;

        saveProject(false);
        openFile(activeFile);
        renderFileList();
        runCode();

        setStatus("Example loaded");
    }

    function openHelp() {
        var dialog = elements.helpDialog;

        if (!dialog) {
            window.alert(
                "1. Select a file from Explorer.\n" +
                "2. Write your code.\n" +
                "3. Click Run to see your website.\n" +
                "4. Use Console to inspect messages and errors.\n" +
                "5. Click Save to save your work."
            );
            return;
        }

        if (typeof dialog.showModal === "function") {
            dialog.showModal();
        } else {
            dialog.setAttribute("open", "open");
        }
    }

    function closeHelp() {
        var dialog = elements.helpDialog;

        if (!dialog) {
            return;
        }

        if (typeof dialog.close === "function") {
            dialog.close();
        } else {
            dialog.removeAttribute("open");
        }
    }

    

    document.addEventListener("keydown", function (event) {
        var key = event.key ? event.key.toLowerCase() : "";

        if ((event.ctrlKey || event.metaKey) && key === "s") {
            event.preventDefault();
            saveProject(true);
        }

        if ((event.ctrlKey || event.metaKey) && key === "enter") {
            event.preventDefault();
            runCode();
        }

        if (
            (event.ctrlKey || event.metaKey) &&
            key === "n" &&
            !event.shiftKey
        ) {
            event.preventDefault();
            createFile();
        }
    });



    function connectEvents() {
        if (elements.runBtn) {
            elements.runBtn.addEventListener("click", runCode);
        }

        if (elements.saveBtn) {
            elements.saveBtn.addEventListener("click", function () {
                saveProject(true);
            });
        }

        if (elements.newFileBtn) {
            elements.newFileBtn.addEventListener("click", createFile);
        }

        if (elements.sidebarNewBtn) {
            elements.sidebarNewBtn.addEventListener("click", createFile);
        }

        if (elements.deleteFileBtn) {
            elements.deleteFileBtn.addEventListener("click", deleteFile);
        }

        if (elements.exportBtn) {
            elements.exportBtn.addEventListener("click", exportProject);
        }

        if (elements.refreshBtn) {
            elements.refreshBtn.addEventListener("click", runCode);
        }

        if (elements.clearConsoleBtn) {
            elements.clearConsoleBtn.addEventListener("click", clearConsole);
        }

        if (elements.helpButton) {
            elements.helpButton.addEventListener("click", openHelp);
        }

        if (elements.closeHelp) {
            elements.closeHelp.addEventListener("click", closeHelp);
        }

        if (elements.loadExampleButton) {
            elements.loadExampleButton.addEventListener("click", loadExample);
        }

        if (elements.panelTabs) {
            Array.prototype.forEach.call(elements.panelTabs, function (button) {
                button.addEventListener("click", function () {
                    var panel = button.getAttribute("data-panel");

                    if (panel === "preview" || panel === "console") {
                        showPanel(panel);
                    }
                });
            });
        }
    }



    function initialize() {
        initializeEditor();
        loadProject();
        connectEvents();

        if (!Object.prototype.hasOwnProperty.call(files, activeFile)) {
            activeFile = sortedFilenames()[0];
        }

        if (!activeFile) {
            files = {};
            Object.keys(defaultFiles).forEach(function (filename) {
                files[filename] = defaultFiles[filename];
            });
            activeFile = "index.html";
        }

        openFile(activeFile);
        renderFileList();
        renderConsole();

        window.setTimeout(function () {
            runCode();
            setStatus("Ready");
        }, 100);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize);
    } else {
        initialize();
    }

})();
