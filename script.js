(async () => {
    "use strict";

    const isMobile = window.matchMedia(
        "(max-width: 768px), (hover: none) and (pointer: coarse)"
    ).matches;

    // DOM elements
    const $ = id => document.getElementById(id);

    // Storage keys
    const HIDDEN_SCALES_KEY = "scalePracticeHiddenScales";
    const THEME_KEY = "scalePracticeTheme";
    const FINGERING_KEY = "scalePracticeShowFingerings";
    const VALVE_INPUT_KEY = "scalePracticeValveInput";
    const KEY_SIGNATURE_KEY = "scalePracticeShowKeySignature";
    const SELECTED_KEY_KEY = "scalePracticeSelectedKey";
    const SELECTED_TYPE_KEY = "scalePracticeSelectedType";
    const SELECTED_RANGE_KEY = "scalePracticeSelectedRange";
    const DIRECTION_KEY = "scalePracticeDirection";

    // Apply the saved theme before initializing page-specific features.
    const themeSelect = $("themeSelect");

    let initialTheme = "dark";

    try {
        initialTheme = localStorage.getItem(THEME_KEY) || "dark";
    } catch (error) {
        console.warn("Could not load saved theme:", error);
    }

    if (!["dark", "light"].includes(initialTheme)) {
        initialTheme = "dark";
    }

    document.documentElement.dataset.theme = initialTheme;
    document.documentElement.style.colorScheme = initialTheme;

    // Theme switching also works on pages without the scale builder.
    if (themeSelect) {
        themeSelect.value = initialTheme;

        themeSelect.addEventListener("change", () => {
            const theme = ["dark", "light"].includes(themeSelect.value)
                ? themeSelect.value
                : "dark";

            document.documentElement.dataset.theme = theme;
            document.documentElement.style.colorScheme = theme;

            try {
                localStorage.setItem(THEME_KEY, theme);
            } catch (error) {
                console.warn("Could not save theme:", error);
            }
        });
    }

    // DOM elements used by the scale builder
    const keySelect = $("keySelect");
    const scaleSelect = $("scaleSelect");
    const rangeSelect = $("rangeSelect");
    const directionSelect = $("directionSelect");
    const errorBox = $("error");
    const backButton = $("backButton");

    function updateBackButton() {
        if (!backButton) return;

        backButton.href = test && !test.classList.contains("hidden")
            ? "/scales-builder/"
            : "/";
    }

    const hasScaleBuilder = Boolean(
        keySelect &&
        scaleSelect &&
        rangeSelect &&
        directionSelect &&
        errorBox
    );

    const setup = $("setup");
    const test = $("test");
    const results = $("results");
    const noteChoices = $("noteChoices");

    const valvePicker = $("valvePicker");
    const trumpetValves = $("trumpetValves");
    const valveElements = trumpetValves
        ? [...trumpetValves.querySelectorAll(".valve")]
        : [];
    const placeNoteButton = $("placeNoteButton");

    const settingsButton = $("settingsButton");
    const settingsOverlay = $("settingsOverlay");
    const scaleSettingsTree = $("scaleSettingsTree");
    const fingeringToggle = $("fingeringToggle");
    const valveInputToggle = $("valveInputToggle");
    const keySignatureToggle = $("keySignatureToggle");
    const scaleTypeFilters = $("scaleTypeFilters");
    const scaleRangeFilters = $("scaleRangeFilters");

    try {
        if (isMobile) {
            $("fingeringSettings")?.remove();
            $("valveInputSettings")?.remove();
            $("valveInputToggle").parentElement.parentElement.remove();
            valvePicker?.remove();
            noteChoices?.classList.remove("show-fingerings");
        }
    } catch (e) {
        // Ignore
    }

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
    let savedDirection = null;
    let showFingerings = true;
    let useValveInput = false;
    let expectedMidis = [];
    let showKeySignature = true;
    let randomScaleMode = false;

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
    const accidentalSymbols = { sharp: "♯", flat: "♭", natural: "♮" };

    // Fields in each key's data that are not scale types.
    const NON_SCALE_FIELDS = ["key-signature", "types"];

    // Accidentals are drawn as paths, not font glyphs, so they look the same on
    // every device. Each shape is centered on the staff position it applies to.
    const ACCIDENTAL_SHAPES = {
        sharp: [
            { d: "M-3.2 -12V11M3.2 -10V13", width: 1.3 },
            { d: "M-6 -2.2L6 -5.4M-6 5.6L6 2.4", width: 2.6 }
        ],
        flat: [
            { d: "M-3 -16V5M-3 5C7 0.5 7.5 -8.5 -3 -4", width: 1.5 }
        ],
        natural: [
            { d: "M-3 -11V4M3 -4V11", width: 1.3 },
            { d: "M-3 -1L3 -3.5M-3 4L3 1.5", width: 2.4 }
        ]
    };

    const ACCIDENTAL_WIDTH = 12;

    function drawAccidental(parent, accidental, x, y) {
        const shapes = ACCIDENTAL_SHAPES[accidental];
        if (!shapes) return;

        const group = document.createElementNS(SVG_NS, "g");
        group.setAttribute("class", "staff-accidental-shape");
        group.setAttribute("transform", `translate(${x} ${y})`);

        shapes.forEach(({ d, width }) => {
            const path = document.createElementNS(SVG_NS, "path");
            path.setAttribute("d", d);
            path.setAttribute("stroke-width", width);
            group.append(path);
        });

        parent.append(group);
    }

    const BASE_SCALE_TYPE = "major";

    // Vertical staff positions (treble clef) for key signature accidentals.
    const SIGNATURE_Y = {
        sharp: { f: 45, c: 63, g: 39, d: 57, a: 75, e: 51, b: 69 },
        flat: { b: 69, e: 51, a: 75, d: 57, g: 81, c: 63, f: 87 }
    };

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

    function notePitch(note) {
        return note.endsWith("-natural")
            ? note.slice(0, -"-natural".length)
            : note;
    }

    function notesMatch(answer, correct) {
        return Boolean(answer) && notePitch(answer) === notePitch(correct);
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
        const keyData = data.scales[key];

        return Object.keys(keyData).filter(type =>
            !NON_SCALE_FIELDS.includes(type) && Array.isArray(keyData[type])
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
        const ranges = data.scales[key].types || [];

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

        if (themeSelect) {
            themeSelect.value = savedTheme;
        }

        applyTheme(savedTheme);

        try {
            showFingerings = localStorage.getItem(FINGERING_KEY) !== "false";
        } catch (error) {
            showFingerings = true;
        }

        if (fingeringToggle) {
            fingeringToggle.checked = showFingerings;
        }

        try {
            useValveInput = !isMobile &&
                localStorage.getItem(VALVE_INPUT_KEY) === "true";
        } catch (error) {
            useValveInput = false;
        }

        if (valveInputToggle) {
            valveInputToggle.checked = useValveInput;
        }

        applyInputMode();

        try {
            showKeySignature =
                localStorage.getItem(KEY_SIGNATURE_KEY) !== "false";
        } catch (error) {
            showKeySignature = true;
        }

        if (keySignatureToggle) {
            keySignatureToggle.checked = showKeySignature;
        }

        try {
            const savedDirection = localStorage.getItem(DIRECTION_KEY);

            if (["ascending", "both"].includes(savedDirection)) {
                directionSelect.value = savedDirection;
            }
        } catch (error) {
            console.warn("Could not load saved direction:", error);
        }
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

        if (themeSelect) {
            themeSelect.value = theme;
        }

        if (customDropdowns) customDropdowns.refresh();
    }

    function saveTheme() {
        if (!themeSelect) return;

        const theme = themeSelect.value;
        applyTheme(theme);

        try {
            localStorage.setItem(THEME_KEY, theme);
        } catch (error) {
            console.warn("Could not save theme:", error);
        }
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

            if (!select.parentNode) return null;

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
            
            // The real select is hidden and replaced by this control. Keep it
            // from ever receiving focus or label clicks, which is what opens
            // the native iOS picker.
            select.tabIndex = -1;
            select.setAttribute("aria-hidden", "true");
            select.setAttribute("inert", "");

            // Stop clicks inside the dropdown from being passed on to the
            // select through the surrounding <label>.
            wrapper.addEventListener("click", event => {
                event.preventDefault();
            });

            function getOptions() {
                return [...select.options].filter(option => !option.disabled);
            }

            function updateHighlight() {
                const buttons = [
                    ...menu.querySelectorAll(".custom-select-option")
                ];

                buttons.forEach((button, index) => {
                    const highlighted = index === highlightedIndex;
                    button.classList.toggle("highlighted", highlighted);

                    if (highlighted) {
                        button.scrollIntoView({ block: "nearest" });
                    }
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
                    menu.style.bottom =
                        `${window.innerHeight - rect.top + gap}px`;
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
                        select.dispatchEvent(
                            new Event("change", { bubbles: true })
                        );
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
                if (checkbox.checked) {
                    hiddenScales.delete(child.dataset.settingId);
                } else {
                    hiddenScales.add(child.dataset.settingId);
                }
            });

            if (checkbox.checked) hiddenScales.delete(id);
            else hiddenScales.add(id);

            saveHiddenScales();
            updateSettingsCheckboxes();
            updateFilterToggles();
            refreshScaleSelectors();
        });

        return node;
    }

    function getAllScaleTypes() {
        const types = [];

        Object.keys(data.scales).forEach(key => {
            getScaleTypes(key).forEach(type => {
                if (!types.includes(type)) types.push(type);
            });
        });

        return types;
    }

    function getAllRanges() {
        const ranges = [];

        Object.keys(data.scales).forEach(key => {
            (data.scales[key].types || []).forEach(range => {
                if (!ranges.includes(range)) ranges.push(range);
            });
        });

        return ranges;
    }

    // Every key / range / scale type combination in the data.
    function getScaleEntries() {
        const entries = [];

        Object.keys(data.scales).forEach(key => {
            const ranges = data.scales[key].types || [];

            getScaleTypes(key).forEach(type => {
                ranges.forEach(range => entries.push({ key, range, type }));
            });
        });

        return entries;
    }

    function getFilterState(entries) {
        const visibleCount = entries.filter(entry =>
            isScaleVisible(entry.key, entry.range, entry.type)
        ).length;

        if (visibleCount === 0) return "off";
        return visibleCount === entries.length ? "on" : "mixed";
    }

    // Turns a whole group of scales on or off by setting their individual
    // checkboxes, so each one can still be changed afterwards.
    function setFilterEntries(entries, visible) {
        entries.forEach(({ key, range, type }) => {
            if (visible) {
                hiddenScales.delete(scaleSettingId(key, range, type));
                hiddenScales.delete(rangeSettingId(key, range));
                hiddenScales.delete(keySettingId(key));
            } else {
                hiddenScales.add(scaleSettingId(key, range, type));
            }
        });

        saveHiddenScales();
        updateSettingsCheckboxes();
        updateFilterToggles();
        refreshScaleSelectors();
    }

    const filterToggles = [];

    function updateFilterToggles() {
        filterToggles.forEach(({ button, entries }) => {
            const state = getFilterState(entries);

            button.dataset.state = state;
            button.setAttribute(
                "aria-pressed",
                state === "on" ? "true" : state === "off" ? "false" : "mixed"
            );
        });
    }

    function renderFilterGroup(container, values, matches) {
        if (!container) return;

        container.replaceChildren();

        values.forEach(value => {
            const entries = getScaleEntries().filter(entry => matches(entry, value));

            const button = document.createElement("button");
            button.type = "button";
            button.className = "scale-type-filter";

            const name = document.createElement("span");
            name.textContent = displayName(value);

            const track = document.createElement("span");
            track.className = "filter-switch";
            track.setAttribute("aria-hidden", "true");

            const knob = document.createElement("span");
            knob.className = "filter-switch-knob";
            track.append(knob);

            button.append(name, track);

            button.addEventListener("click", () => {
                setFilterEntries(entries, getFilterState(entries) !== "on");
            });

            filterToggles.push({ button, entries });
            container.append(button);

            button.dataset.state = getFilterState(entries);
        });
    }

    function renderGlobalFilters() {
        filterToggles.length = 0;

        renderFilterGroup(
            scaleTypeFilters,
            getAllScaleTypes(),
            (entry, type) => entry.type === type
        );

        renderFilterGroup(
            scaleRangeFilters,
            getAllRanges(),
            (entry, range) => entry.range === range
        );
    }

    // Older versions saved whole-type and whole-range filters as their own
    // entries. Expand them into individual scales so nothing is locked out.
    // TODO: Remove at a later date.
    function migrateGlobalFilters() {
        let changed = false;

        [...hiddenScales].forEach(id => {
            const isType = id.startsWith("type:");
            const isRange = id.startsWith("allranges:");
            if (!isType && !isRange) return;

            const value = id.slice(id.indexOf(":") + 1);

            getScaleEntries().forEach(entry => {
                if ((isType ? entry.type : entry.range) === value) {
                    hiddenScales.add(
                        scaleSettingId(entry.key, entry.range, entry.type)
                    );
                }
            });

            hiddenScales.delete(id);
            changed = true;
        });

        if (changed) saveHiddenScales();
    }

    function renderScaleSettings() {
        if (!scaleSettingsTree || !data?.scales) return;

        scaleSettingsTree.replaceChildren();
        renderGlobalFilters();

        Object.keys(data.scales).forEach(key => {
            const types = getScaleTypes(key);
            const ranges = data.scales[key].types || [];

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
        if (!scaleSettingsTree) return;

        const checkboxes = [
            ...scaleSettingsTree.querySelectorAll("input[type='checkbox']")
        ];

        // Individual scales reflect their own saved visibility, independently
        // of whether their parent key or range is disabled.
        checkboxes.forEach(checkbox => {
            const id = checkbox.dataset.settingId;

            if (!id.startsWith("scale:")) return;

            checkbox.checked = !hiddenScales.has(id);
            checkbox.indeterminate = false;
        });

        // Update ranges and keys from their descendant scales.
        checkboxes.reverse().forEach(checkbox => {
            const id = checkbox.dataset.settingId;

            if (id.startsWith("scale:")) return;

            const node = checkbox.closest(".scale-settings-node");
            if (!node) return;

            const descendants = [
                ...node.querySelectorAll(
                    ":scope > .scale-settings-children input[type='checkbox']"
                )
            ];

            if (!descendants.length) return;

            const visibleCount = descendants.filter(child =>
                child.checked || child.indeterminate
            ).length;

            // A disabled key or range stays unchecked, but its children
            // can still show their own mixed visibility states.
            const explicitlyHidden = hiddenScales.has(id);

            checkbox.checked = !explicitlyHidden &&
                visibleCount === descendants.length;

            checkbox.indeterminate = !explicitlyHidden &&
                visibleCount > 0 &&
                visibleCount < descendants.length;
        });
    }

    function openSettings() {
        document.documentElement.classList.add("settings-open");

        if (!settingsOverlay) return;

        if (hasScaleBuilder && data?.scales) {
            renderScaleSettings();
        }

        settingsOverlay.classList.remove("hidden");
        settingsOverlay.setAttribute("aria-hidden", "false");
        $("closeSettingsButton")?.focus();
    }

    function closeSettings() {
        document.documentElement.classList.remove("settings-open");

        if (!settingsOverlay) return;

        settingsOverlay.classList.add("hidden");
        settingsOverlay.setAttribute("aria-hidden", "true");
        settingsButton?.focus();
    }

    // Key signatures
    function getKeySignature(key) {
        return data.scales[key]?.["key-signature"] || [];
    }

    function getKeySignatureMap(key) {
        const map = {};

        getKeySignature(key).forEach(note => {
            const [letter, accidental] = note.split("-");
            if (letter && accidental) map[letter] = accidental;
        });

        return map;
    }
    

    // Staff drawing and scrolling
    function drawStaff() {
        const svg = $("scaleStaff");
        if (!svg) return;

        // Right edge of the drawn clef, so the key signature can start after it.
        const CLEF_RIGHT = 47;

        const staffLines = svg.querySelector(".staff-lines");
        const notesGroup = $("staffNotes");
        const ledgerGroup = $("staffLedgerLines");
        const signatureGroup = $("staffKeySignature");

        if (!staffLines || !notesGroup || !ledgerGroup || !signatureGroup) {
            return;
        }

        notesGroup.replaceChildren();
        ledgerGroup.replaceChildren();
        signatureGroup.replaceChildren();

        const letterIndex = { c: 0, d: 1, e: 2, f: 3, g: 4, a: 5, b: 6 };
        const NS = "http://www.w3.org/2000/svg";
        const noteSpacing = 34;
        const stepY = 6;
        const bottomY = 93;

        const clefRight = CLEF_RIGHT;

        const signature = showKeySignature ? getKeySignature(currentKey) : [];
        const signatureMap = showKeySignature ? getKeySignatureMap(currentKey) : {};
        const signatureStartX = clefRight + 10 + ACCIDENTAL_WIDTH / 2;
        const signatureSpacing = 13;

        signature.forEach((note, index) => {
            const [letter, accidental] = note.split("-");
            const y = SIGNATURE_Y[accidental]?.[letter];

            if (y === undefined) return;

            drawAccidental(
                signatureGroup,
                accidental,
                signatureStartX + index * signatureSpacing,
                y
            );
        });

        const signatureEndX = signature.length
            ? signatureStartX +
                (signature.length - 1) * signatureSpacing +
                ACCIDENTAL_WIDTH / 2
            : clefRight;

        const startX = Math.max(100, signatureEndX + 34);

        let octave = Number(data.scales[currentKey]?.["octave-level"] || 4);
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

            const [letter, accidental = ""] = note.split("-");
            const effectiveAccidental = accidental || "natural";
            const signatureAccidental = signatureMap[letter] || "natural";
            const wrong = finished && !notesMatch(note, expected[index]);

            const needsAccidental = showKeySignature
                ? effectiveAccidental !== signatureAccidental
                : Boolean(accidental);

            if (needsAccidental) {
                drawAccidental(notesGroup, effectiveAccidental, x - 17, y);
                if (wrong) notesGroup.lastElementChild?.classList.add("wrong");
            }

            const notehead = document.createElementNS(NS, "ellipse");
            notehead.setAttribute("cx", x);
            notehead.setAttribute("cy", y);
            notehead.setAttribute("rx", 7);
            notehead.setAttribute("ry", 5);
            notehead.setAttribute("transform", `rotate(-20 ${x} ${y})`);
            notehead.setAttribute(
                "class",
                wrong
                    ? "staff-note wrong"
                    : !finished && index === answers.length - 1
                        ? "staff-note current"
                        : "staff-note"
            );
            notesGroup.append(notehead);

            const stem = document.createElementNS(NS, "line");
            const stemDown = y < 69;
            const stemX = x + (stemDown ? -6 : 6);

            stem.setAttribute("x1", stemX);
            stem.setAttribute("x2", stemX);
            stem.setAttribute("y1", y);
            stem.setAttribute("y2", y + (stemDown ? 30 : -30));
            stem.setAttribute("class", "staff-stem");
            notesGroup.append(stem);

            // A larger invisible target so a wrong note is easy to tap.
            if (wrong) {
                const hit = document.createElementNS(NS, "circle");
                hit.setAttribute("cx", x);
                hit.setAttribute("cy", y);
                hit.setAttribute("r", 14);
                hit.setAttribute("class", "staff-note-hit");
                hit.addEventListener("click", () => {
                    answers.length = index;
                    renderQuestion();
                });
                notesGroup.append(hit);
            }
        });

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

        targetScrollLeft = Math.max(
            0,
            Math.min(targetScrollLeft, maxScrollLeft)
        );

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

    function syncDirectionLock() {
        const isMelodic = scaleSelect.value === "melodic-minor";

        if (isMelodic) {
            if (!directionSelect.disabled) savedDirection = directionSelect.value;
            directionSelect.value = "both";
            directionSelect.disabled = true;
        } else {
            directionSelect.disabled = false;

            if (savedDirection) {
                directionSelect.value = savedDirection;
                savedDirection = null;
            }
        }

        if (customDropdowns) customDropdowns.refresh();
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
        const previousType = scaleSelect.value ||
            localStorage.getItem(SELECTED_TYPE_KEY);

        scaleSelect.replaceChildren();

        if (!key) return;

        getVisibleScaleTypes(keySelect.value, rangeSelect.value).forEach(type => {
            const option = document.createElement("option");
            option.value = type;
            option.textContent = displayName(type);
            scaleSelect.append(option);
        });

        if ([...scaleSelect.options].some(option => option.value === previousType)) {
            scaleSelect.value = previousType;
        }

        syncDirectionLock();

        try {
            localStorage.setItem(SELECTED_TYPE_KEY, scaleSelect.value);
        } catch (error) {
            console.warn("Could not save scale type:", error);
        }
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

        syncDirectionLock();

        const startButton = $("startButton");

        if (startButton) {
            startButton.disabled =
                !keySelect.value || !rangeSelect.value || !scaleSelect.value;
        }

        if (customDropdowns) customDropdowns.refresh();
    }

    function chooseRandomScale(excludeCurrent = false) {
        const options = [];

        Object.keys(data.scales).forEach(key => {
            getVisibleRanges(key).forEach(range => {
                getVisibleScaleTypes(key, range).forEach(type => {
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

        let choices = options;

        if (excludeCurrent && options.length > 1) {
            choices = options.filter(option =>
                option.key !== currentKey ||
                option.range !== currentRange ||
                option.type !== currentType
            );
        }

        const choice = choices[Math.floor(Math.random() * choices.length)];

        keySelect.value = choice.key;
        updateRangeOptions();
        rangeSelect.value = choice.range;
        updateScaleOptions();
        scaleSelect.value = choice.type;

        syncDirectionLock();

        if (customDropdowns) customDropdowns.refresh();
    }

    function buildScale(key, type) {
        const keyData = data.scales[key];
        const baseLetters = keyData[BASE_SCALE_TYPE];

        if (!Array.isArray(baseLetters)) {
            throw new Error("Missing base scale array: " + BASE_SCALE_TYPE);
        }

        if (!Array.isArray(keyData[type])) {
            throw new Error("Missing scale array: " + type);
        }

        const signatureMap = getKeySignatureMap(key);
        const changes = {};

        if (type !== BASE_SCALE_TYPE) {
            keyData[type].forEach(note => {
                const [letter, accidental] = note.split("-");
                if (letter && accidental) changes[letter] = accidental;
            });
        }

        return baseLetters.map(letter => {
            const accidental = changes[letter] || signatureMap[letter];
            return accidental ? letter + "-" + accidental : letter;
        });
    }

    function applyRange(notes, range) {
        if (range === "1-octave") return notes.slice(0, 8);

        if (range === "extended-range") {
            return notes.slice(0, Math.max(0, notes.length - 3));
        }

        return [...notes];
    }

    function getScaleSequence(key, type, range, direction) {
        const ascending = applyRange(buildScale(key, type), range);
        const includeDescending =
            direction === "both" || type === "melodic-minor";

        if (!includeDescending) return ascending;

        const descendingSource = type === "melodic-minor"
            ? applyRange(buildScale(key, "natural-minor"), range)
            : ascending;

        const descending = descendingSource.slice(0, -1).reverse();
        return ascending.concat(descending);
    }

    function getNoteOptions() {
        const choices = new Map();

        naturalNotes.forEach(letter => {
            [letter, ...accidentalNotes.map(accidental =>
                letter + "-" + accidental
            )].forEach(note => {
                const name = notePitch(note);

                if (!choices.has(name)) {
                    choices.set(name, note);
                }
            });
        });

        return [...choices.values()].sort((a, b) => {
            const aLetter = a.split("-")[0];
            const bLetter = b.split("-")[0];

            const letterDifference =
                naturalNotes.indexOf(aLetter) - naturalNotes.indexOf(bLetter);

            return letterDifference !== 0
                ? letterDifference
                : a.localeCompare(b);
        });
    }

    // Fingerings
    const FINGERINGS = {
        54: [1, 2, 3], 55: [1, 3], 56: [2, 3], 57: [1, 2], 58: [1], 59: [2],
        60: [], 61: [1, 2, 3], 62: [1, 3], 63: [2, 3], 64: [1, 2], 65: [1],
        66: [2], 67: [], 68: [2, 3], 69: [1, 2], 70: [1], 71: [2],
        72: [], 73: [1, 2], 74: [1], 75: [2], 76: [], 77: [1],
        78: [2], 79: [], 80: [2, 3], 81: [1, 2], 82: [1], 83: [2],
        84: [], 85: [1, 2], 86: [1], 87: [2], 88: [], 89: [1]
    };

    const LETTER_SEMITONES = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
    const ACCIDENTAL_OFFSETS = { sharp: 1, flat: -1, natural: 0 };
    const LETTER_ORDER = ["c", "d", "e", "f", "g", "a", "b"];
    const SVG_NS = "http://www.w3.org/2000/svg";

    function noteSemitone(note) {
        const [letter, accidental] = note.split("-");
        return LETTER_SEMITONES[letter] + (ACCIDENTAL_OFFSETS[accidental] || 0);
    }

    function getSequenceMidis(notes) {
        let octave = Number(data.scales[currentKey]?.["octave-level"] || 4);
        let previousLetter = null;

        return notes.map(note => {
            const letter = LETTER_ORDER.indexOf(note.split("-")[0]);

            if (previousLetter !== null) {
                const difference = letter - previousLetter;
                if (difference < -3) octave++;
                else if (difference > 3) octave--;
            }

            previousLetter = letter;
            return (octave + 1) * 12 + noteSemitone(note);
        });
    }

    function getButtonMidi(note, targetMidi) {
        const pitchClass = ((noteSemitone(note) % 12) + 12) % 12;
        return pitchClass + 12 * Math.round((targetMidi - pitchClass) / 12);
    }

    function createFingeringSvg() {
        const svg = document.createElementNS(SVG_NS, "svg");
        svg.setAttribute("class", "fingering");
        svg.setAttribute("viewBox", "0 0 54 22");
        svg.setAttribute("aria-hidden", "true");

        [1, 2, 3].forEach((valveNumber, index) => {
            const group = document.createElementNS(SVG_NS, "g");
            group.setAttribute("transform", `translate(${9 + index * 18} 3)`);

            const valve = document.createElementNS(SVG_NS, "path");
            valve.setAttribute("class", "valve");
            valve.setAttribute("d", "M-6 0H6V4H2V15H-2V4H-6Z");
            valve.dataset.valve = valveNumber;

            group.append(valve);
            svg.append(group);
        });

        return svg;
    }

    function buildNoteButtons() {
        if (!noteChoices) return;

        noteChoices.replaceChildren();

        getNoteOptions().forEach(note => {
            const button = document.createElement("button");
            button.className = "note-button";
            button.dataset.note = note;
            button.title = displayNote(note);

            const label = document.createElement("span");
            label.className = "note-label";

            label.textContent = naturalNotes.includes(note)
                ? displayNote(note) + " / " + displayNote(note + "-natural")
                : displayNote(note);

            button.append(label);

            if (!isMobile) {
                button.append(createFingeringSvg());
            }

            button.addEventListener("click", () => {
                if (finished) return;
                answers.push(note);
                renderQuestion();
            });

            noteChoices.append(button);
        });
    }

    function updateFingerings() {
        if (isMobile || !noteChoices) return;

        noteChoices.classList.toggle("show-fingerings", showFingerings);

        const targetMidi = expectedMidis[answers.length];
        if (!showFingerings || targetMidi === undefined) return;

        noteChoices.querySelectorAll(".note-button").forEach(button => {
            const note = button.dataset.note;
            const fingering = FINGERINGS[getButtonMidi(note, targetMidi)];
            const svg = button.querySelector(".fingering");

            if (!svg) return;

            svg.classList.toggle("unknown", !fingering);

            svg.querySelectorAll(".valve").forEach(valve => {
                valve.classList.toggle(
                    "pressed",
                    Boolean(fingering?.includes(Number(valve.dataset.valve)))
                );
            });

            button.setAttribute(
                "aria-label",
                displayNote(note) + (fingering
                    ? ", " + (fingering.length ? "valves " + fingering.join(" ") : "open")
                    : "")
            );
        });
    }

    function saveFingeringSetting() {
        if (!fingeringToggle) return;

        showFingerings = fingeringToggle.checked;

        try {
            localStorage.setItem(FINGERING_KEY, String(showFingerings));
        } catch (error) {
            console.warn("Could not save fingering setting:", error);
        }

        updateFingerings();
    }

    // Valve picker
    const VALVE_KEYS = ["ArrowLeft", "ArrowDown", "ArrowRight"];

    const SHARP_NAMES = [
        "c", "c-sharp", "d", "d-sharp", "e", "f",
        "f-sharp", "g", "g-sharp", "a", "a-sharp", "b"
    ];

    const FLAT_NAMES = [
        "c", "d-flat", "d", "e-flat", "e", "f",
        "g-flat", "g", "a-flat", "a", "b-flat", "b"
    ];

    const FINGERING_LOOKUP = new Map();

    Object.entries(FINGERINGS).forEach(([midi, valves]) => {
        const id = valves.join("-");
        if (!FINGERING_LOOKUP.has(id)) FINGERING_LOOKUP.set(id, []);
        FINGERING_LOOKUP.get(id).push(Number(midi));
    });

    const valveStates = [false, false, false];

    function isPickerActive() {
        return useValveInput &&
            test &&
            !test.classList.contains("hidden") &&
            !finished &&
            (!settingsOverlay || settingsOverlay.classList.contains("hidden"));
    }

    function getPressedValves() {
        return [1, 2, 3].filter((_, index) => valveStates[index]);
    }

    function spellMidi(midi) {
        const prefersFlats = getKeySignature(currentKey)
            .some(note => note.endsWith("-flat"));

        return (prefersFlats ? FLAT_NAMES : SHARP_NAMES)[midi % 12];
    }

    function resolvePickedNote() {
        const index = answers.length;
        const targetMidi = expectedMidis[index];
        if (targetMidi === undefined) return null;

        const candidates = FINGERING_LOOKUP.get(getPressedValves().join("-"));
        if (!candidates) return null;

        const midi = candidates.reduce((best, candidate) =>
            Math.abs(candidate - targetMidi) < Math.abs(best - targetMidi)
                ? candidate
                : best
        );

        const expectedPitchClass =
            ((noteSemitone(expected[index]) % 12) + 12) % 12;
        const preview = spellMidi(midi);

        return {
            midi,
            preview,
            note: midi % 12 === expectedPitchClass ? expected[index] : preview
        };
    }

    function updatePicker() {
        if (!useValveInput) return;

        const picked = resolvePickedNote();
        const noteLetter = $("noteLetter");

        if (noteLetter) {
            noteLetter.textContent = picked ? displayNote(picked.preview) : "?";
        }

        if (placeNoteButton) placeNoteButton.disabled = !picked;
    }

    function setValve(index, pressed) {
        if (!valveElements[index] || valveStates[index] === pressed) return;
        if (finished && pressed) return;

        valveStates[index] = pressed;
        valveElements[index].classList.toggle("pressed", pressed);
        valveElements[index].setAttribute("aria-pressed", String(pressed));
        updatePicker();
    }

    function releaseAllValves() {
        valveStates.forEach((_, index) => setValve(index, false));
    }

    function placePickedNote() {
        if (!isPickerActive()) return;

        const picked = resolvePickedNote();
        if (!picked) return;

        answers.push(picked.note);
        renderQuestion();
    }

    function refreshNoteInput() {
        const noteInstruction = $("noteInstruction");
        const noteLetter = $("noteLetter");

        if (useValveInput) {
            if (noteInstruction) {
                noteInstruction.innerHTML = `
                    Press the valves down with
                    <span class="keyboard-keys" aria-label="Arrow keys">
                        <svg class="key-icon" viewBox="0 0 24 24" aria-label="Left arrow">
                            <rect x="1" y="1" width="22" height="22" rx="4" />
                            <path d="M14 7l-5 5 5 5" />
                        </svg>
                        <svg class="key-icon" viewBox="0 0 24 24" aria-label="Down arrow">
                            <rect x="1" y="1" width="22" height="22" rx="4" />
                            <path d="M7 9l5 5 5-5" />
                        </svg>
                        <svg class="key-icon" viewBox="0 0 24 24" aria-label="Right arrow">
                            <rect x="1" y="1" width="22" height="22" rx="4" />
                            <path d="M10 7l5 5-5 5" />
                        </svg>
                    </span>
                    <br>
                    Press
                    <svg class="key-icon key-enter" viewBox="0 0 40 24" aria-label="Enter">
                        <rect x="1" y="1" width="38" height="22" rx="4" />
                        <path d="M9 7v5h19M23 9l5 3-5 3" />
                    </svg>
                    or
                    <svg class="key-icon key-space" viewBox="0 0 48 24" aria-label="Spacebar">
                        <rect x="1" y="1" width="46" height="22" rx="4" />
                        <path d="M13 16h22" />
                    </svg>
                    to choose the note.
                `;
            }

            updatePicker();
        } else {
            if (noteInstruction) {
                noteInstruction.textContent = "Choose the correct note.";
            }

            if (noteLetter) {
                noteLetter.textContent = answers.length
                    ? displayNote(answers[answers.length - 1])
                    : "?";
            }
            
            if (noteChoices && !noteChoices.children.length) {
                buildNoteButtons();
            }

            updateFingerings();
        }
    }

    function applyInputMode() {
        updateCompletionUi();

        if (!useValveInput) releaseAllValves();

        if (expected.length && test && !test.classList.contains("hidden")) {
            refreshNoteInput();
        }
    }

    function saveValveInputSetting() {
        if (isMobile || !valveInputToggle) return;

        useValveInput = valveInputToggle.checked;

        try {
            localStorage.setItem(VALVE_INPUT_KEY, String(useValveInput));
        } catch (error) {
            console.warn("Could not save note input setting:", error);
        }

        applyInputMode();
    }

    function initValvePicker() {
        document.addEventListener("keydown", event => {
            if (!isPickerActive()) return;
            if (event.target.closest?.("input, textarea, select, [contenteditable=true]")) {
                return;
            }

            const index = VALVE_KEYS.indexOf(event.key);

            if (index !== -1) {
                event.preventDefault();
                setValve(index, true);
                return;
            }

            const isPlaceKey =
                event.code === "Space" ||
                (event.key === "Enter" &&
                    !event.target.closest?.("button, a, .valve"));

            if (isPlaceKey) {
                event.preventDefault();
                if (!event.repeat) placePickedNote();
            }
        });

        document.addEventListener("keyup", event => {
            const index = VALVE_KEYS.indexOf(event.key);
            if (index !== -1) setValve(index, false);
        });

        window.addEventListener("blur", releaseAllValves);

        valveElements.forEach((valve, index) => {
            valve.addEventListener("keydown", event => {
                if (event.key !== "Space" && event.key !== " ") return;
                event.preventDefault();
                setValve(index, true);
            });

            valve.addEventListener("keyup", event => {
                if (event.key === "Space" || event.key === " ") {
                    setValve(index, false);
                }
            });
        });

        if (placeNoteButton) {
            placeNoteButton.addEventListener("mousedown", event => {
                event.preventDefault();
            });

            placeNoteButton.addEventListener("click", placePickedNote);
        }
    }

    function saveKeySignatureSetting() {
        if (!keySignatureToggle) return;

        showKeySignature = keySignatureToggle.checked;

        try {
            localStorage.setItem(KEY_SIGNATURE_KEY, String(showKeySignature));
        } catch (error) {
            console.warn("Could not save key signature setting:", error);
        }

        if (currentKey && test && !test.classList.contains("hidden")) {
            drawStaff();
        }
    }

    // Test flow
    function startTest(randomize = false) {
        try {
            if (randomize) {
                chooseRandomScale();
            }

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

            expectedMidis = getSequenceMidis(expected);

            if (!expected.length) throw new Error("This scale has no notes.");

            answers = [];
            finished = false;
            errorBox.textContent = "";
            releaseAllValves();

            const testTitle = $("testTitle");

            if (testTitle) {
                testTitle.textContent =
                    displayName(currentKey) + " " +
                    displayName(currentType) + " · " +
                    displayName(currentRange) + " · " +
                    (direction === "both" || currentType === "melodic-minor"
                        ? "Ascending and Descending"
                        : "Ascending Only") +
                    (randomScaleMode == false ? "" : " · " + "Random Mode");
            }

            setup?.classList.add("hidden");
            results?.classList.add("hidden");
            test?.classList.remove("hidden");

            updateBackButton();
            renderQuestion();
            resetStaffScroll();
            requestAnimationFrame(resetStaffScroll);
        } catch (error) {
            test?.classList.add("hidden");
            results?.classList.add("hidden");
            setup?.classList.remove("hidden");
            errorBox.textContent = error.message;
            console.error("Could not start scale test:", error);
        }
    }

    // Everything that depends on whether the scale is complete.
    // Everything that depends on whether the scale is complete.
    function updateCompletionUi() {
        $("retryButton")?.classList.toggle("hidden", !finished);
        $("nextscaleButton")?.classList.toggle("hidden", !finished);

        // The input mode decides which control is shown...
        noteChoices?.classList.toggle("hidden", useValveInput);
        valvePicker?.classList.toggle("hidden", !useValveInput);

        // ...and a finished scale disables it instead of hiding it.
        if (finished && !useValveInput && noteChoices && !noteChoices.children.length) {
            buildNoteButtons();
        }

        noteChoices?.classList.toggle("is-disabled", finished);
        noteChoices?.querySelectorAll("button").forEach(button => {
            button.disabled = finished;
        });

        valvePicker?.classList.toggle("is-disabled", finished);

        if (finished) {
            releaseAllValves();

            if (placeNoteButton) placeNoteButton.disabled = true;
        }
    }

    function renderQuestion() {
        finished = answers.length >= expected.length;

        const noteNumber = $("noteNumber");
        const progressBar = $("progressBar");
        const undoButton = $("undoButton");

        if (noteNumber) {
            const hasWrong = answers.some((note, index) =>
                !notesMatch(note, expected[index])
            );

            noteNumber.textContent = finished
                ? (hasWrong ? "Tap a red note to go back to that position" : "Perfect scale!")
                : "Note " + (answers.length + 1) + " of " + expected.length;
        }

        if (progressBar) {
            progressBar.style.width =
                (answers.length / expected.length * 100) + "%";
        }

        updateCompletionUi();

        if (!finished) refreshNoteInput();

        if (undoButton) {
            undoButton.disabled = answers.length === 0;
        }

        drawStaff();
    }

    function returnToSetup() {
        test?.classList.add("hidden");
        results?.classList.add("hidden");
        setup?.classList.remove("hidden");
        updateBackButton();
    }

    function nextScale() {
        try {
            if (!data || !currentKey || !currentType) {
                throw new Error("No current scale is available to advance from.");
            }

            if (randomScaleMode) {
                chooseRandomScale(true);
                startTest();
                return;
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

            const nextIndex = currentIndex === -1
                ? 0
                : (currentIndex + 1) % options.length;

            const next = options[nextIndex];

            keySelect.value = next.key;
            updateRangeOptions();
            rangeSelect.value = next.range;
            updateScaleOptions();
            scaleSelect.value = next.type;

            syncDirectionLock();

            if (customDropdowns) customDropdowns.refresh();

            startTest();
        } catch (error) {
            test?.classList.add("hidden");
            results?.classList.add("hidden");
            setup?.classList.remove("hidden");
            errorBox.textContent = error.message;
            console.error("Could not advance to the next scale:", error);
        }
    }

    // Initialize
    const copyrightYear = $("copyrightYear");

    if (copyrightYear) {
        copyrightYear.textContent = new Date().getFullYear();
    }

    

    directionSelect?.addEventListener("change", () => {
        try {
            localStorage.setItem(DIRECTION_KEY, directionSelect.value);
        } catch (error) {
            console.warn("Could not save direction:", error);
        }
    });

    // Event listeners
    keySelect?.addEventListener("change", () => {
        try {
            localStorage.setItem(SELECTED_KEY_KEY, keySelect.value);
            localStorage.setItem(SELECTED_RANGE_KEY, rangeSelect.value);
            localStorage.setItem(SELECTED_TYPE_KEY, scaleSelect.value);
        } catch (error) {
            console.warn("Could not save scale selections:", error);
        }
        
        updateRangeOptions();
        updateScaleOptions();
    });

    rangeSelect?.addEventListener("change", () => {
        updateScaleOptions();

        try {
            localStorage.setItem(SELECTED_RANGE_KEY, rangeSelect.value);
            localStorage.setItem(SELECTED_TYPE_KEY, scaleSelect.value);
        } catch (error) {
            console.warn("Could not save scale selections:", error);
        }
    });

    $("startButton")?.addEventListener("click", () => {
        randomScaleMode = false;
        startTest();
    });

    document.querySelectorAll(".randomButton").forEach(button => {
        button.addEventListener("click", () => {
            randomScaleMode = true;
            startTest(true);
        });
    });

    $("undoButton")?.addEventListener("click", () => {
        if (answers.length) {
            answers.pop();
            renderQuestion();
        }
    });

    document.querySelectorAll(".nextButton").forEach(button => {
        button.addEventListener("click", returnToSetup);
    });

    $("nextscaleButton")?.addEventListener("click", nextScale);

    settingsButton?.addEventListener("click", openSettings);
    $("closeSettingsButton")?.addEventListener("click", closeSettings);
    $("doneSettingsButton")?.addEventListener("click", closeSettings);

    settingsOverlay?.addEventListener("click", event => {
        if (event.target === settingsOverlay) closeSettings();
    });

    document.addEventListener("keydown", event => {
        if (
            event.key === "Escape" &&
            settingsOverlay &&
            !settingsOverlay.classList.contains("hidden")
        ) {
            closeSettings();
        }
    });

    $("retryButton")?.addEventListener("click", () => startTest());

    fingeringToggle?.addEventListener("change", saveFingeringSetting);
    valveInputToggle?.addEventListener("change", saveValveInputSetting);
    keySignatureToggle?.addEventListener("change", saveKeySignatureSetting);
    scaleSelect?.addEventListener("change", () => {
        syncDirectionLock();

        try {
            localStorage.setItem(SELECTED_TYPE_KEY, scaleSelect.value);
        } catch (error) {
            console.warn("Could not save scale type:", error);
        }
    });
    themeSelect?.addEventListener("change", saveTheme);

    loadSettings();

    if (hasScaleBuilder) {
        initValvePicker();
    }

    async function loadData() {
        try {
            errorBox.textContent = "";

            const startButton = $("startButton");
            if (startButton) startButton.disabled = true;

            const response = await fetch(
                new URL("../scales-data.json", window.location.href)
            );

            if (!response.ok) {
                throw new Error(
                    `Failed to load scales-data.json (${response.status})`
                );
            }

            data = await response.json();

            if (!data.scales || !Object.keys(data.scales).length) {
                throw new Error("No scales found in scales-data.json.");
            }

            migrateGlobalFilters();
            populateKeys();

            const savedKey = localStorage.getItem(SELECTED_KEY_KEY);

            if ([...keySelect.options].some(option => option.value === savedKey)) {
                keySelect.value = savedKey;
            }

            updateRangeOptions();

            const savedRange = localStorage.getItem(SELECTED_RANGE_KEY);

            if ([...rangeSelect.options].some(option => option.value === savedRange)) {
                rangeSelect.value = savedRange;
            }

            updateScaleOptions();

            const savedType = localStorage.getItem(SELECTED_TYPE_KEY);

            if ([...scaleSelect.options].some(option => option.value === savedType)) {
                scaleSelect.value = savedType;
            }

            const savedDirection = localStorage.getItem(DIRECTION_KEY);

            if (["ascending", "both"].includes(savedDirection)) {
                directionSelect.value = savedDirection;
            }

            syncDirectionLock();

            if (startButton) {
                startButton.disabled =
                    !keySelect.value || !rangeSelect.value || !scaleSelect.value;
            }

            renderScaleSettings();
        } catch (error) {
            errorBox.textContent =
                "Could not load scales-data.json: " + error.message;

            const startButton = $("startButton");
            if (startButton) startButton.disabled = true;

            console.error("Scale data loading failed:", error);
        }
    }

    if (hasScaleBuilder) {
        await loadData();
    }

    customDropdowns = initCustomDropdowns();
    customDropdowns.refresh();

    if ("serviceWorker" in navigator && window.location.pathname === "/") {
        window.addEventListener("load", () => {
            navigator.serviceWorker.register("./service-worker.js")
                .then(() => {
                    console.log("Scale practice service worker registered.");
                })
                .catch(error => {
                    console.error(
                        "Service worker registration failed:",
                        error
                    );
                });
        });
    }
})();