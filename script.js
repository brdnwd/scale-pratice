(async () => {
    "use strict";

    // DOM elements
    const $ = id => document.getElementById(id);

    const keySelect = $("keySelect");
    const scaleSelect = $("scaleSelect");
    const rangeSelect = $("rangeSelect");
    const directionSelect = $("directionSelect");
    const errorBox = $("error");

    const setup = $("setup");
    const test = $("test");
    const results = $("results");
    const noteChoices = $("noteChoices");
    const selectedNotes = $("selectedNotes");

    const settingsButton = $("settingsButton");
    const settingsOverlay = $("settingsOverlay");
    const scaleSettingsTree = $("scaleSettingsTree");
    const themeSelect = $("themeSelect");

    // Storage keys
    const HIDDEN_SCALES_KEY = "scalePracticeHiddenScales";
    const THEME_KEY = "scalePracticeTheme";

    // Test state
    let data;
    let currentKey = "";
    let currentType = "";
    let currentRange = "";
    let expected = [];
    let answers = [];
    let finished = false;
    let hiddenScales = new Set();
    let customDropdowns = null;

    // Note names and notation
    const noteNames = {
        "c": "C", "c-sharp": "C♯", "c-flat": "C♭", "c-natural": "C♮",
        "d": "D", "d-sharp": "D♯", "d-flat": "D♭", "d-natural": "D♮",
        "e": "E", "e-sharp": "E♯", "e-flat": "E♭", "e-natural": "E♮",
        "f": "F", "f-sharp": "F♯", "f-flat": "F♭", "f-natural": "F♮",
        "g": "G", "g-sharp": "G♯", "g-flat": "G♭", "g-natural": "G♮",
        "a": "A", "a-sharp": "A♯", "a-flat": "A♭", "a-natural": "A♮",
        "b": "B", "b-sharp": "B♯", "b-flat": "B♭", "b-natural": "B♮"
    };

    const naturalNotes = ["c", "d", "e", "f", "g", "a", "b"];
    const accidentalNotes = ["natural", "sharp", "flat"];

    function displayNote(note) {
        return noteNames[note] || note.split("-")
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ");
    }

    function displayName(value) {
        return value.split("-")
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ");
    }

    // Settings and saved preferences
    function keySettingId(key) {
        return "key:" + key;
    }

    function rangeSettingId(key, range) {
        return "range:" + key + ":" + range;
    }

    function scaleSettingId(key, range, type) {
        return "scale:" + key + ":" + range + ":" + type;
    }

    function getScaleTypes(key) {
        const scaleData = data.scales[key].scale;

        return Object.keys(scaleData).filter(type =>
            type !== "types" && Array.isArray(scaleData[type])
        );
    }

    function isScaleVisible(key, range, type) {
        return !hiddenScales.has(keySettingId(key)) &&
            !hiddenScales.has(rangeSettingId(key, range)) &&
            !hiddenScales.has(scaleSettingId(key, range, type));
    }

    function getVisibleScaleTypes(key, range) {
        return getScaleTypes(key).filter(type =>
            isScaleVisible(key, range, type)
        );
    }

    function getVisibleRanges(key) {
        const ranges = data.scales[key].scale.types || [];

        return ranges.filter(range =>
            getVisibleScaleTypes(key, range).length > 0
        );
    }

    function getVisibleKeys() {
        return Object.keys(data.scales).filter(key =>
            getVisibleRanges(key).length > 0
        );
    }

    function loadSettings() {
        try {
            const savedHidden = JSON.parse(
                localStorage.getItem(HIDDEN_SCALES_KEY) || "[]"
            );

            hiddenScales = new Set(
                Array.isArray(savedHidden) ? savedHidden : []
            );
        } catch (error) {
            hiddenScales = new Set();
            console.warn("Could not load saved scale settings:", error);
        }

        let savedTheme = "dark";

        try {
            savedTheme = localStorage.getItem(THEME_KEY) || "dark";
        } catch (error) {
            console.warn("Could not load saved theme:", error);
        }

        if (!["dark", "light"].includes(savedTheme)) savedTheme = "dark";

        themeSelect.value = savedTheme;
        applyTheme(savedTheme);
    }

    function saveHiddenScales() {
        try {
            localStorage.setItem(
                HIDDEN_SCALES_KEY,
                JSON.stringify([...hiddenScales])
            );
        } catch (error) {
            console.warn("Could not save scale settings:", error);
        }
    }

    function applyTheme(theme) {
        if (!["dark", "light"].includes(theme)) theme = "dark";

        document.documentElement.dataset.theme = theme;
        document.documentElement.style.colorScheme = theme;
        themeSelect.value = theme;

        if (customDropdowns) customDropdowns.refresh();
    }

    function saveTheme() {
        const theme = themeSelect.value;
        applyTheme(theme);

        try {
            localStorage.setItem(THEME_KEY, theme);
        } catch (error) {
            console.warn("Could not save theme:", error);
        }
    }

    function resetSettings() {
        hiddenScales.clear();
        saveHiddenScales();

        try {
            localStorage.removeItem(THEME_KEY);
        } catch (error) {
            console.warn("Could not reset saved theme:", error);
        }

        themeSelect.value = "dark";
        applyTheme("dark");
        renderScaleSettings();
        refreshScaleSelectors();

        if (customDropdowns) customDropdowns.refresh();
    }

    // Custom dropdowns
    function initCustomDropdowns() {
        const selects = [
            keySelect,
            scaleSelect,
            rangeSelect,
            directionSelect,
            themeSelect
        ].filter(Boolean);

        const instances = new Map();

        function closeAll(except = null) {
            instances.forEach(instance => {
                if (instance !== except) instance.close();
            });
        }

        function createDropdown(select) {
            if (instances.has(select)) {
                instances.get(select).refresh();
                return instances.get(select);
            }

            const wrapper = document.createElement("div");
            wrapper.className = "custom-select";

            select.parentNode.insertBefore(wrapper, select);
            wrapper.append(select);

            const trigger = document.createElement("button");
            trigger.type = "button";
            trigger.className = "custom-select-trigger";
            trigger.setAttribute("aria-haspopup", "listbox");
            trigger.setAttribute("aria-expanded", "false");

            const label = document.createElement("span");
            label.className = "custom-select-label";

            const arrow = document.createElement("span");
            arrow.className = "custom-select-arrow";
            arrow.setAttribute("aria-hidden", "true");

            trigger.append(label, arrow);

            const menu = document.createElement("div");
            menu.className = "custom-select-menu";
            menu.setAttribute("role", "listbox");

            const optionButtons = new Map();
            let highlightedIndex = -1;
            let typeBuffer = "";
            let typeBufferTimeout;

            wrapper.append(trigger, menu);

            function getOptions() {
                return [...select.options].filter(option => !option.disabled);
            }

            function updateHighlight() {
                const buttons = [...menu.querySelectorAll(".custom-select-option")];

                buttons.forEach((button, index) => {
                    const highlighted = index === highlightedIndex;
                    button.classList.toggle("highlighted", highlighted);

                    if (highlighted) button.scrollIntoView({ block: "nearest" });
                });
            }

            function positionMenu() {
                const rect = trigger.getBoundingClientRect();
                const gap = 6;
                const viewportPadding = 8;
                const maxHeight = 240;

                const spaceBelow =
                    window.innerHeight - rect.bottom - gap - viewportPadding;
                const spaceAbove = rect.top - gap - viewportPadding;

                const openAbove =
                    spaceBelow < Math.min(maxHeight, 160) &&
                    spaceAbove > spaceBelow;

                const availableHeight = Math.max(
                    80,
                    Math.min(maxHeight, openAbove ? spaceAbove : spaceBelow)
                );

                menu.style.width = `${rect.width}px`;
                menu.style.maxHeight = `${availableHeight}px`;
                menu.style.left = `${Math.max(
                    viewportPadding,
                    Math.min(
                        rect.left,
                        window.innerWidth - rect.width - viewportPadding
                    )
                )}px`;

                if (openAbove) {
                    menu.style.top = "auto";
                    menu.style.bottom = `${window.innerHeight - rect.top + gap}px`;
                    menu.style.transformOrigin = "bottom center";
                } else {
                    menu.style.bottom = "auto";
                    menu.style.top = `${rect.bottom + gap}px`;
                    menu.style.transformOrigin = "top center";
                }
            }

            function refresh() {
                const options = getOptions();

                label.textContent =
                    select.selectedOptions[0]?.textContent || "Select an option";

                trigger.disabled = select.disabled;
                trigger.setAttribute(
                    "aria-label",
                    select.getAttribute("aria-label") ||
                        select.labels?.[0]?.textContent?.trim() ||
                        label.textContent
                );

                menu.replaceChildren();
                optionButtons.clear();

                if (!options.length) {
                    const empty = document.createElement("div");
                    empty.className = "custom-select-empty";
                    empty.textContent = "No options available";
                    menu.append(empty);
                    highlightedIndex = -1;
                    return;
                }

                options.forEach(option => {
                    const button = document.createElement("button");
                    button.type = "button";
                    button.className = "custom-select-option";
                    button.textContent = option.textContent;
                    button.setAttribute("role", "option");
                    button.setAttribute(
                        "aria-selected",
                        String(option.value === select.value)
                    );
                    button.classList.toggle(
                        "selected",
                        option.value === select.value
                    );

                    button.addEventListener("click", () => {
                        select.value = option.value;
                        select.dispatchEvent(new Event("change", { bubbles: true }));
                        refresh();
                        close();
                        trigger.focus();
                    });

                    menu.append(button);
                    optionButtons.set(option, button);
                });

                highlightedIndex = options.findIndex(
                    option => option.value === select.value
                );
            }

            function open() {
                if (select.disabled) return;

                closeAll(instance);
                refresh();

                wrapper.classList.add("open");
                trigger.setAttribute("aria-expanded", "true");
                positionMenu();

                const options = getOptions();
                highlightedIndex = options.findIndex(
                    option => option.value === select.value
                );

                updateHighlight();
            }

            function close() {
                wrapper.classList.remove("open");
                trigger.setAttribute("aria-expanded", "false");
            }

            function moveHighlight(direction) {
                const options = getOptions();
                if (!options.length) return;

                if (highlightedIndex < 0) {
                    highlightedIndex = direction > 0 ? 0 : options.length - 1;
                } else {
                    highlightedIndex =
                        (highlightedIndex + direction + options.length) %
                        options.length;
                }

                updateHighlight();
            }

            function chooseHighlighted() {
                const options = getOptions();
                const option = options[highlightedIndex];
                if (!option) return;

                select.value = option.value;
                select.dispatchEvent(new Event("change", { bubbles: true }));
                refresh();
                close();
                trigger.focus();
            }

            function handleTypeSearch(character) {
                clearTimeout(typeBufferTimeout);
                typeBuffer += character.toLowerCase();

                typeBufferTimeout = setTimeout(() => {
                    typeBuffer = "";
                }, 700);

                const options = getOptions();
                const index = options.findIndex(option =>
                    option.textContent.trim().toLowerCase().startsWith(typeBuffer)
                );

                if (index !== -1) {
                    highlightedIndex = index;
                    updateHighlight();
                }
            }

            trigger.addEventListener("click", () => {
                if (wrapper.classList.contains("open")) close();
                else open();
            });

            trigger.addEventListener("keydown", event => {
                switch (event.key) {
                    case "ArrowDown":
                        event.preventDefault();
                        if (!wrapper.classList.contains("open")) open();
                        else moveHighlight(1);
                        break;

                    case "ArrowUp":
                        event.preventDefault();
                        if (!wrapper.classList.contains("open")) open();
                        else moveHighlight(-1);
                        break;

                    case "Enter":
                    case " ":
                        event.preventDefault();
                        if (!wrapper.classList.contains("open")) open();
                        else chooseHighlighted();
                        break;

                    case "Escape":
                        close();
                        break;

                    case "Tab":
                        close();
                        break;

                    default:
                        if (
                            event.key.length === 1 &&
                            !event.ctrlKey &&
                            !event.metaKey
                        ) {
                            if (!wrapper.classList.contains("open")) open();
                            handleTypeSearch(event.key);
                        }
                }
            });

            menu.addEventListener("keydown", event => {
                switch (event.key) {
                    case "ArrowDown":
                        event.preventDefault();
                        moveHighlight(1);
                        break;

                    case "ArrowUp":
                        event.preventDefault();
                        moveHighlight(-1);
                        break;

                    case "Enter":
                    case " ":
                        event.preventDefault();
                        chooseHighlighted();
                        break;

                    case "Escape":
                        event.preventDefault();
                        close();
                        trigger.focus();
                        break;

                    default:
                        if (
                            event.key.length === 1 &&
                            !event.ctrlKey &&
                            !event.metaKey
                        ) {
                            handleTypeSearch(event.key);
                        }
                }
            });

            select.addEventListener("change", refresh);

            window.addEventListener("resize", () => {
                if (wrapper.classList.contains("open")) positionMenu();
            });

            window.addEventListener("scroll", () => {
                if (wrapper.classList.contains("open")) positionMenu();
            }, true);

            const observer = new MutationObserver(refresh);
            observer.observe(select, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ["disabled", "label", "value"]
            });

            const instance = { refresh, open, close };
            instances.set(select, instance);
            refresh();

            return instance;
        }

        selects.forEach(createDropdown);

        document.addEventListener("click", event => {
            if (!event.target.closest(".custom-select")) closeAll();
        });

        return {
            refresh() {
                instances.forEach(instance => instance.refresh());
            },
            closeAll
        };
    }

    // Scale settings tree
    function createSettingsNode(label, id, children, parentId = "") {
        const node = document.createElement("div");
        node.className = "scale-settings-node";

        const row = document.createElement("div");
        row.className = "scale-settings-row";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.dataset.settingId = id;
        checkbox.dataset.settingParent = parentId;

        const name = document.createElement("label");
        name.className = "scale-settings-name";
        name.textContent = label;
        name.htmlFor = "setting-" + id.replace(/[^a-zA-Z0-9_-]/g, "_");
        checkbox.id = name.htmlFor;

        if (children.length > 0) {
            const toggle = document.createElement("button");
            toggle.type = "button";
            toggle.className = "scale-settings-toggle";
            toggle.textContent = "▸";
            toggle.setAttribute("aria-expanded", "false");
            toggle.setAttribute("aria-label", "Expand " + label);

            const childContainer = document.createElement("div");
            childContainer.className = "scale-settings-children";
            childContainer.hidden = true;
            children.forEach(child => childContainer.append(child));

            toggle.addEventListener("click", () => {
                const expanded = toggle.getAttribute("aria-expanded") === "true";

                toggle.setAttribute("aria-expanded", String(!expanded));
                toggle.textContent = expanded ? "▸" : "▾";
                toggle.setAttribute(
                    "aria-label",
                    (expanded ? "Expand " : "Collapse ") + label
                );

                node.classList.toggle("expanded", !expanded);
                childContainer.hidden = expanded;
            });

            const folderIcon = document.createElement("span");
            folderIcon.className = "settings-folder-icon";
            folderIcon.setAttribute("aria-hidden", "true");
            folderIcon.textContent = "📁";

            row.append(toggle, checkbox, folderIcon, name);
            node.append(row, childContainer);
        } else {
            const fileIcon = document.createElement("span");
            fileIcon.className = "settings-file-icon";
            fileIcon.setAttribute("aria-hidden", "true");
            fileIcon.textContent = "♫";

            row.append(document.createElement("span"));
            row.append(checkbox, fileIcon, name);
            node.append(row);
        }

        checkbox.addEventListener("change", () => {
            const descendants = [
                ...node.querySelectorAll("input[type='checkbox']")
            ];

            descendants.forEach(child => {
                if (checkbox.checked) hiddenScales.delete(child.dataset.settingId);
                else hiddenScales.add(child.dataset.settingId);
            });

            if (checkbox.checked) hiddenScales.delete(id);
            else hiddenScales.add(id);

            saveHiddenScales();
            updateSettingsCheckboxes();
            refreshScaleSelectors();
        });

        return node;
    }

    function renderScaleSettings() {
        scaleSettingsTree.replaceChildren();

        Object.keys(data.scales).forEach(key => {
            const scaleData = data.scales[key].scale;
            const types = getScaleTypes(key);
            const ranges = scaleData.types || [];

            const rangeNodes = ranges.map(range => {
                const typeNodes = types.map(type =>
                    createSettingsNode(
                        displayName(type),
                        scaleSettingId(key, range, type),
                        [],
                        rangeSettingId(key, range)
                    )
                );

                return createSettingsNode(
                    displayName(range),
                    rangeSettingId(key, range),
                    typeNodes,
                    keySettingId(key)
                );
            });

            scaleSettingsTree.append(
                createSettingsNode(displayName(key), keySettingId(key), rangeNodes)
            );
        });

        updateSettingsCheckboxes();
    }

    function updateSettingsCheckboxes() {
        const checkboxes = [
            ...scaleSettingsTree.querySelectorAll("input[type='checkbox']")
        ];

        checkboxes.forEach(checkbox => {
            const id = checkbox.dataset.settingId;

            if (id.startsWith("scale:")) {
                const parts = id.split(":");
                checkbox.checked = isScaleVisible(
                    parts[1],
                    parts[2],
                    parts.slice(3).join(":")
                );
            }
        });

        checkboxes.reverse().forEach(checkbox => {
            const node = checkbox.closest(".scale-settings-node");
            const descendants = [
                ...node.querySelectorAll(
                    ".scale-settings-children input[type='checkbox']"
                )
            ];

            if (!descendants.length) return;

            const visibleCount = descendants.filter(child =>
                child.checked || child.indeterminate
            ).length;

            checkbox.checked =
                visibleCount === descendants.length && descendants.length > 0;

            checkbox.indeterminate =
                visibleCount > 0 && visibleCount < descendants.length;
        });
    }

    function setSettingsBranch(node, visible) {
        const checkbox = node.querySelector(
            ":scope > .scale-settings-row input[type='checkbox']"
        );

        if (checkbox) {
            if (visible) hiddenScales.delete(checkbox.dataset.settingId);
            else hiddenScales.add(checkbox.dataset.settingId);
        }

        node.querySelectorAll("input[type='checkbox']").forEach(child => {
            if (visible) hiddenScales.delete(child.dataset.settingId);
            else hiddenScales.add(child.dataset.settingId);

            child.checked = visible;
            child.indeterminate = false;
        });
    }

    function openSettings() {
        renderScaleSettings();
        settingsOverlay.classList.remove("hidden");
        settingsOverlay.setAttribute("aria-hidden", "false");
        $("closeSettingsButton").focus();
    }

    function closeSettings() {
        settingsOverlay.classList.add("hidden");
        settingsOverlay.setAttribute("aria-hidden", "true");
        settingsButton.focus();
    }

    // Staff drawing and scrolling
    function drawStaff() {
        const svg = $("scaleStaff");
        const staffLines = svg.querySelector(".staff-lines");
        const notesGroup = $("staffNotes");
        const ledgerGroup = $("staffLedgerLines");

        notesGroup.replaceChildren();
        ledgerGroup.replaceChildren();

        const letterIndex = { c: 0, d: 1, e: 2, f: 3, g: 4, a: 5, b: 6 };
        const NS = "http://www.w3.org/2000/svg";
        const noteSpacing = 34;
        const startX = 100;
        const stepY = 6;
        const bottomY = 93;

        let octave = 4;
        let previousLetter = null;

        const positions = [];

        answers.forEach((note, index) => {
            const letter = note.split("-")[0];
            const currentLetter = letterIndex[letter];

            if (currentLetter === undefined) return;

            if (previousLetter !== null) {
                const difference = currentLetter - previousLetter;
                if (difference < -3) octave++;
                else if (difference > 3) octave--;
            }

            previousLetter = currentLetter;

            const diatonicPosition =
                (octave - 4) * 7 + currentLetter - letterIndex.e;

            positions.push({
                note,
                x: startX + index * noteSpacing,
                y: bottomY - diatonicPosition * stepY,
                index
            });
        });

        const width = Math.max(680, startX + answers.length * noteSpacing + 35);

        svg.setAttribute("viewBox", `0 0 ${width} 145`);
        svg.style.width = width + "px";

        staffLines.querySelectorAll("line").forEach(line => {
            line.setAttribute("x2", width - 20);
        });

        positions.forEach(({ note, x, y, index }) => {
            // Ledger lines below and above the staff
            if (y >= 99) {
                for (let ledgerY = 105; ledgerY <= y; ledgerY += 12) {
                    const line = document.createElementNS(NS, "line");
                    line.setAttribute("x1", x - 10);
                    line.setAttribute("x2", x + 10);
                    line.setAttribute("y1", ledgerY);
                    line.setAttribute("y2", ledgerY);
                    line.setAttribute("class", "staff-ledger");
                    ledgerGroup.append(line);
                }
            }

            if (y <= 39) {
                for (let ledgerY = 33; ledgerY >= y; ledgerY -= 12) {
                    const line = document.createElementNS(NS, "line");
                    line.setAttribute("x1", x - 10);
                    line.setAttribute("x2", x + 10);
                    line.setAttribute("y1", ledgerY);
                    line.setAttribute("y2", ledgerY);
                    line.setAttribute("class", "staff-ledger");
                    ledgerGroup.append(line);
                }
            }

            // Accidentals
            const accidental = note.includes("-") ? note.split("-")[1] : "";
            const accidentalSymbols = { sharp: "♯", flat: "♭", natural: "♮" };

            if (accidentalSymbols[accidental]) {
                const accidentalText = document.createElementNS(NS, "text");
                accidentalText.setAttribute("x", x - 12);
                accidentalText.setAttribute("y", y + 6);
                accidentalText.setAttribute("class", "staff-accidental");
                accidentalText.textContent = accidentalSymbols[accidental];
                notesGroup.append(accidentalText);
            }

            // Notehead and stem
            const notehead = document.createElementNS(NS, "ellipse");
            notehead.setAttribute("cx", x);
            notehead.setAttribute("cy", y);
            notehead.setAttribute("rx", 7);
            notehead.setAttribute("ry", 5);
            notehead.setAttribute("transform", `rotate(-20 ${x} ${y})`);
            notehead.setAttribute(
                "class",
                index === answers.length - 1 ? "staff-note current" : "staff-note"
            );
            notesGroup.append(notehead);

            const stem = document.createElementNS(NS, "line");
            stem.setAttribute("x1", x + 6);
            stem.setAttribute("x2", x + 6);
            stem.setAttribute("y1", y);
            stem.setAttribute("y2", y < 69 ? y + 30 : y - 30);
            stem.setAttribute("class", "staff-stem");
            notesGroup.append(stem);
        });

        // Keep the initial staff at the left and scroll as new notes are added.
        requestAnimationFrame(() => {
            if (!answers.length) {
                resetStaffScroll();
                return;
            }

            scrollStaffToNote(notesGroup.querySelector(".staff-note.current"));
        });
    }

    function resetStaffScroll() {
        const wrapper = $("staffWrapper");
        if (wrapper) wrapper.scrollLeft = 0;
    }

    function scrollStaffToNote(noteElement) {
        const wrapper = $("staffWrapper");
        if (!wrapper || !noteElement) return;

        const wrapperRect = wrapper.getBoundingClientRect();
        const noteRect = noteElement.getBoundingClientRect();
        const padding = Math.min(48, Math.max(16, wrapper.clientWidth * 0.12));
        const visibleLeft = wrapperRect.left + padding;
        const visibleRight = wrapperRect.left + wrapper.clientWidth - padding;

        let targetScrollLeft = wrapper.scrollLeft;

        if (noteRect.right > visibleRight) {
            targetScrollLeft += noteRect.right - visibleRight;
        } else if (noteRect.left < visibleLeft) {
            targetScrollLeft -= visibleLeft - noteRect.left;
        } else {
            return;
        }

        const maxScrollLeft = Math.max(
            0,
            wrapper.scrollWidth - wrapper.clientWidth
        );

        targetScrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScrollLeft));

        if (Math.abs(targetScrollLeft - wrapper.scrollLeft) > 1) {
            wrapper.scrollTo({ left: targetScrollLeft, behavior: "smooth" });
        }
    }

    // Scale selection and sequence generation
    function populateKeys() {
        const previous = keySelect.value;
        keySelect.replaceChildren();

        getVisibleKeys().forEach(key => {
            const option = document.createElement("option");
            option.value = key;
            option.textContent = displayName(key);
            keySelect.append(option);
        });

        if ([...keySelect.options].some(option => option.value === previous)) {
            keySelect.value = previous;
        }
    }

    function updateRangeOptions() {
        const key = data.scales[keySelect.value];

        if (!key) {
            rangeSelect.replaceChildren();
            return;
        }

        const available = getVisibleRanges(keySelect.value);
        const previous = rangeSelect.value;
        rangeSelect.replaceChildren();

        available.forEach(range => {
            const option = document.createElement("option");
            option.value = range;
            option.textContent = displayName(range);
            rangeSelect.append(option);
        });

        if (available.includes(previous)) rangeSelect.value = previous;
    }

    function updateScaleOptions() {
        const key = data.scales[keySelect.value];
        scaleSelect.replaceChildren();

        if (!key) return;

        getVisibleScaleTypes(keySelect.value, rangeSelect.value).forEach(type => {
            const option = document.createElement("option");
            option.value = type;
            option.textContent = displayName(type);
            scaleSelect.append(option);
        });
    }

    function refreshScaleSelectors() {
        const previousKey = keySelect.value;
        const previousRange = rangeSelect.value;
        const previousType = scaleSelect.value;

        populateKeys();

        if ([...keySelect.options].some(option => option.value === previousKey)) {
            keySelect.value = previousKey;
        }

        updateRangeOptions();

        if ([...rangeSelect.options].some(option => option.value === previousRange)) {
            rangeSelect.value = previousRange;
        }

        updateScaleOptions();

        if ([...scaleSelect.options].some(option => option.value === previousType)) {
            scaleSelect.value = previousType;
        }

        $("startButton").disabled =
            !keySelect.value || !rangeSelect.value || !scaleSelect.value;

        if (customDropdowns) customDropdowns.refresh();
    }

    function chooseRandomScale() {
        const options = [];

        Object.keys(data.scales).forEach(key => {
            const ranges = getVisibleRanges(key);

            getScaleTypes(key).forEach(type => {
                ranges.forEach(range => {
                    if (!isScaleVisible(key, range, type)) return;

                    try {
                        const sequence = getScaleSequence(
                            key,
                            type,
                            range,
                            directionSelect.value
                        );

                        if (sequence.length) options.push({ key, type, range });
                    } catch (error) {
                        // Skip invalid scale combinations.
                    }
                });
            });
        });

        if (!options.length) {
            throw new Error(
                "No visible scales are available. Enable at least one in Settings."
            );
        }

        const choice = options[Math.floor(Math.random() * options.length)];

        keySelect.value = choice.key;
        updateRangeOptions();
        rangeSelect.value = choice.range;
        updateScaleOptions();
        scaleSelect.value = choice.type;

        if (customDropdowns) customDropdowns.refresh();
    }

    function getScaleSequence(key, type, range, direction) {
        const scaleData = data.scales[key].scale;

        if (!Array.isArray(scaleData[type])) {
            throw new Error("Missing scale array: " + type);
        }

        let ascending = [...scaleData[type]];

        if (range === "extended-range") {
            ascending = ascending.slice(0, Math.max(0, ascending.length - 3));
        }

        if (direction === "ascending") return ascending;

        let descending;

        if (type === "melodic-minor") {
            if (!Array.isArray(scaleData["natural-minor"])) {
                throw new Error("Melodic minor requires a natural-minor array.");
            }

            descending = [...scaleData["natural-minor"]];

            if (range === "extended-range") {
                descending = descending.slice(
                    0,
                    Math.max(0, descending.length - 3)
                );
            }
        } else {
            descending = [...ascending];
        }

        descending = descending.slice(0, -1).reverse();
        return ascending.concat(descending);
    }

    function getNoteOptions(key) {
        const staffKeys = data.scales[key]["staff-data"]?.keys || [];
        const choices = new Set();

        naturalNotes.forEach(letter => {
            choices.add(letter);
            accidentalNotes.forEach(accidental => {
                choices.add(letter + "-" + accidental);
            });
        });

        staffKeys.forEach(note => choices.add(note));
        if (key.includes("-")) choices.add(key);

        return [...choices].sort((a, b) => {
            const aLetter = a.split("-")[0];
            const bLetter = b.split("-")[0];
            const letterDifference =
                naturalNotes.indexOf(aLetter) - naturalNotes.indexOf(bLetter);

            return letterDifference !== 0 ? letterDifference : a.localeCompare(b);
        });
    }

    // Test flow
    function startTest(randomize = false) {
        try {
            if (randomize) chooseRandomScale();

            if (
                !keySelect.value ||
                !scaleSelect.value ||
                !rangeSelect.value ||
                !isScaleVisible(keySelect.value, rangeSelect.value, scaleSelect.value)
            ) {
                throw new Error("Select a visible scale, range, and key in Settings.");
            }

            currentKey = keySelect.value;
            currentType = scaleSelect.value;
            currentRange = rangeSelect.value;

            const direction = directionSelect.value;
            expected = getScaleSequence(
                currentKey,
                currentType,
                currentRange,
                direction
            );

            if (!expected.length) throw new Error("This scale has no notes.");

            answers = [];
            finished = false;
            errorBox.textContent = "";

            $("testTitle").textContent =
                displayName(currentKey) + " " +
                displayName(currentType) + " · " +
                displayName(currentRange) + " · " +
                (direction === "both" ? "Ascending and Descending" : "Ascending Only");

            setup.classList.add("hidden");
            results.classList.add("hidden");
            test.classList.remove("hidden");

            renderQuestion();
            resetStaffScroll();
            requestAnimationFrame(resetStaffScroll);
        } catch (error) {
            test.classList.add("hidden");
            results.classList.add("hidden");
            setup.classList.remove("hidden");
            errorBox.textContent = error.message;
            console.error("Could not start scale test:", error);
        }
    }

    function renderQuestion() {
        if (answers.length >= expected.length) {
            gradeTest();
            return;
        }

        $("noteNumber").textContent =
            "Note " + (answers.length + 1) + " of " + expected.length;

        $("noteLetter").textContent = answers.length
            ? answers[answers.length - 1]
            : "?";

        $("noteInstruction").textContent = "Choose the note you think belongs here.";
        $("progressBar").style.width = (answers.length / expected.length * 100) + "%";
        noteChoices.replaceChildren();

        getNoteOptions(currentKey).forEach(note => {
            const button = document.createElement("button");
            button.className = "note-button";
            button.textContent = displayNote(note);
            button.title = note;

            button.addEventListener("click", () => {
                if (finished) return;
                answers.push(note);
                renderQuestion();
            });

            noteChoices.append(button);
        });

        $("undoButton").disabled = answers.length === 0;
        renderSelectedNotes();
        drawStaff();
    }

    function renderSelectedNotes() {
        selectedNotes.replaceChildren();

        answers.forEach((note, index) => {
            const chip = document.createElement("span");
            chip.className = "note-chip";
            chip.textContent = (index + 1) + ". " + displayNote(note);
            selectedNotes.append(chip);
        });

        if (!answers.length) {
            const empty = document.createElement("span");
            empty.className = "muted";
            empty.textContent = "No notes selected yet.";
            selectedNotes.append(empty);
        }
    }

    function gradeTest() {
        finished = true;
        test.classList.add("hidden");
        results.classList.remove("hidden");

        const mistakes = [];

        expected.forEach((note, index) => {
            if (answers[index] !== note) {
                mistakes.push({ index, expected: note, actual: answers[index] });
            }
        });

        const correct = expected.length - mistakes.length;
        const percentage = Math.round(correct / expected.length * 100);

        $("resultTitle").textContent =
            percentage === 100 ? "Perfect Scale!" : "Scale Complete";

        $("score").textContent =
            correct + " / " + expected.length + " correct (" + percentage + "%)";

        const details = $("resultDetails");
        details.replaceChildren();

        if (!mistakes.length) {
            const message = document.createElement("p");
            message.className = "status good";
            message.textContent = "Every note is correct. Great work!";
            details.append(message);
        } else {
            const message = document.createElement("p");
            message.className = "status bad";
            message.textContent = mistakes.length + " note(s) need correction:";
            details.append(message);
        }

        const heading = document.createElement("div");
        heading.className = "result-row muted";
        heading.innerHTML = "<span>Your answer</span><span>Correct answer</span>";
        details.append(heading);

        expected.forEach((note, index) => {
            const row = document.createElement("div");
            row.className = "result-row";

            const actual = document.createElement("span");
            actual.textContent =
                (index + 1) + ". " +
                (answers[index] ? displayNote(answers[index]) : "No answer");

            const expectedSpan = document.createElement("span");
            expectedSpan.textContent = (index + 1) + ". " + displayNote(note);
            expectedSpan.className = "expected";

            actual.className = answers[index] !== note ? "incorrect" : "expected";

            row.append(actual, expectedSpan);
            details.append(row);
        });

        $("progressBar").style.width = "100%";
    }

    function returnToSetup() {
        test.classList.add("hidden");
        results.classList.add("hidden");
        setup.classList.remove("hidden");
    }

    function nextScale() {
        try {
            if (!data || !currentKey || !currentType) {
                throw new Error("No current scale is available to advance from.");
            }

            const options = [];

            Object.keys(data.scales).forEach(key => {
                getVisibleRanges(key).forEach(range => {
                    getVisibleScaleTypes(key, range).forEach(type => {
                        options.push({ key, range, type });
                    });
                });
            });

            if (!options.length) {
                throw new Error(
                    "No visible scales are available. Enable at least one in Settings."
                );
            }

            const currentIndex = options.findIndex(option =>
                option.key === currentKey &&
                option.range === currentRange &&
                option.type === currentType
            );

            const next = options[(currentIndex + 1) % options.length];

            keySelect.value = next.key;
            updateRangeOptions();
            rangeSelect.value = next.range;
            updateScaleOptions();
            scaleSelect.value = next.type;

            if (customDropdowns) customDropdowns.refresh();
            startTest();
        } catch (error) {
            test.classList.add("hidden");
            results.classList.add("hidden");
            setup.classList.remove("hidden");
            errorBox.textContent = error.message;
            console.error("Could not advance to the next scale:", error);
        }
    }

    // Event listeners
    keySelect.addEventListener("change", () => {
        updateRangeOptions();
        updateScaleOptions();
    });

    rangeSelect.addEventListener("change", updateScaleOptions);

    $("startButton").addEventListener("click", () => startTest());

    $("undoButton").addEventListener("click", () => {
        if (!finished && answers.length) {
            answers.pop();
            renderQuestion();
        }
    });

    document.querySelectorAll(".nextButton").forEach(button => {
        button.addEventListener("click", returnToSetup);
    });

    document.querySelectorAll(".randomButton").forEach(button => {
        button.addEventListener("click", () => startTest(true));
    });

    $("nextscaleButton").addEventListener("click", nextScale);

    settingsButton.addEventListener("click", openSettings);
    $("closeSettingsButton").addEventListener("click", closeSettings);
    $("doneSettingsButton").addEventListener("click", closeSettings);
    $("resetSettingsButton").addEventListener("click", resetSettings);
    themeSelect.addEventListener("change", saveTheme);

    settingsOverlay.addEventListener("click", event => {
        if (event.target === settingsOverlay) closeSettings();
    });

    document.addEventListener("keydown", event => {
        if (
            event.key === "Escape" &&
            !settingsOverlay.classList.contains("hidden")
        ) {
            closeSettings();
        }
    });

    $("retryButton").addEventListener("click", () => startTest());

    // Initialize
    if ($("copyrightYear")) {
        $("copyrightYear").textContent = new Date().getFullYear();
    }

    loadSettings();

    async function loadData() {
        try {
            errorBox.textContent = "";
            $("startButton").disabled = true;

            const response = await fetch("./scales-data.json");

            if (!response.ok) {
                throw new Error(`Failed to load scales-data.json (${response.status})`);
            }

            data = await response.json();

            if (!data.scales || !Object.keys(data.scales).length) {
                throw new Error("No scales found in scales-data.json.");
            }

            populateKeys();
            updateRangeOptions();
            updateScaleOptions();

            $("startButton").disabled =
                !keySelect.value || !rangeSelect.value || !scaleSelect.value;

            renderScaleSettings();
        } catch (error) {
            errorBox.textContent =
                "Could not load scales-data.json: " + error.message;

            $("startButton").disabled = true;
            console.error("Scale data loading failed:", error);
        }
    }

    await loadData();

    customDropdowns = initCustomDropdowns();
    customDropdowns.refresh();
    
    if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
            navigator.serviceWorker.register("./service-worker.js")
                .then(() => {
                    console.log("Scale practice service worker registered.");
                })
                .catch(error => {
                    console.error("Service worker registration failed:", error);
                });
        });
    }
})();