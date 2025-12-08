// ==UserScript==
// @name         Pronote Class Cancellation
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Toggle class cancellation.
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // start selecting from here if you use raw script instead of extension
    const STORAGE_KEY = 'cancelledClasses';
    const STORAGE_KEY_V2 = 'cancelledClassesV2';

    window.average = function () {
        let turns = 0;
        let avg = 0.0;
        document.querySelectorAll(".SansMain.liste_fixed.liste-focus-grid > div").forEach(item => {
            const ne = item.querySelector('div.ie-titre-gros');
            if (!ne) return;
            turns += 1;
            const t = parseFloat(ne.textContent.trim().replace(',', '.'));
            avg += t;
        });
        console.log((avg/turns).toPrecision(4));
    }

    window.ResetStorage = function () {
        localStorage.removeItem('cancelledClasses');
        localStorage.removeItem('cancelledClassesV2');
    }

    function GetLanguage() {
        return document.documentElement.lang === "en";
    }

    function CheckLanguage() {
        const lang = document.documentElement.lang;
        const messages = {
            fr: "Veuillez changer la langue de Pronote dans 'Mes données > Compte > Préférences > Style et accessibilité > Personnalisation > Langue > English'.",
            it: "Modifica la lingua di Pronote in 'I miei dati > Account > Preferenze > Stile e accessibilità > Personalizzazione > Lingua > English'.",
            es: "Cambia el idioma de Pronote en 'Mis datos > Cuenta > Preferencias > Estilo y accesibilidad > Personalización> Lengua > English'."
        };
        if (lang && messages[lang]) console.error(messages[lang]);
    }

    function getCurrentDateString() {
        const dateEl = document.querySelector('.ocb-libelle');
        if (!dateEl) return null;
        const raw = dateEl.textContent.trim();
        const today = new Date();
        const options = { day: '2-digit', month: 'short' };

        if (raw === 'Today') return today.toLocaleDateString('en-GB', options).replace(/^0/, '');
        if (raw === 'Yesterday') { today.setDate(today.getDate() - 1); return today.toLocaleDateString('en-GB', options).replace(/^0/, ''); }
        if (raw === 'Tomorrow') { today.setDate(today.getDate() + 1); return today.toLocaleDateString('en-GB', options).replace(/^0/, ''); }

        const parts = raw.split('\u00a0');
        if (parts.length >= 2) return parts.length === 2 ? parts[0] + ' ' + parts[1] : parts[1] + ' ' + parts[2];
        return null;
    }

    function getSaved(key, storageKey) {
        return JSON.parse(localStorage.getItem(storageKey) || '{}')[key]
    }

    function saveData(key, value, storageKey) {
        const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
        saved[key] = value;
        localStorage.setItem(storageKey, JSON.stringify(saved));
    }

    function removeData(key, storageKey) {
        const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
        delete saved[key];
        localStorage.setItem(storageKey, JSON.stringify(saved));
    }

    // Universal DOM watcher
    function startWatching(selector, callback, options = {}) {
        const pollInterval = options.pollInterval || 300;
        let currentNode = null;
        let innerObserver = null;
        let stopped = false;

        function attachTo(node) {
            if (!node) return;
            if (innerObserver) innerObserver.disconnect();
            innerObserver = new MutationObserver(() => setTimeout(() => callback(node), 0));
            innerObserver.observe(node, { childList: true, characterData: true, subtree: true });
            callback(node);
            currentNode = node;
        }

        function detachInner() {
            if (innerObserver) innerObserver.disconnect();
            innerObserver = null;
            currentNode = null;
        }

        const docObserver = new MutationObserver(() => {
            if (stopped) return;
            if (currentNode && !document.contains(currentNode)) detachInner();
            if (!currentNode) {
                const found = document.querySelector(selector);
                if (found) attachTo(found);
            }
        });

        docObserver.observe(document.documentElement || document.body, { childList: true, subtree: true });

        const poller = setInterval(() => {
            if (stopped) return;
            if (!currentNode) {
                const found = document.querySelector(selector);
                if (found) attachTo(found);
            }
        }, pollInterval);

        const initial = document.querySelector(selector);
        if (initial) attachTo(initial);

        return { stop() { stopped = true; detachInner(); docObserver.disconnect(); clearInterval(poller); } };
    }

    // Toggle daily view class
    function toggleCancel(item) {
        const span = item.querySelector('span.sr-only');
        const dateStr = getCurrentDateString();
        if (!span || !dateStr) return;
        const key = `${span.textContent.trim()}|${dateStr}`;
        const container = item.querySelector('.container-etiquette');
        const isCancelled = container && container.textContent.includes('Prof. absent');

        if (isCancelled) {
            const saved = getSaved(key, STORAGE_KEY);
            if (saved !== null) {
                container.innerHTML = saved;
                item.classList.remove("cours-annule");
                removeData(key, STORAGE_KEY);
            }
            return;
        }

        const originalHTML = container ? container.innerHTML : '';
        saveData(key, originalHTML, STORAGE_KEY);
        item.classList.add("cours-annule");

        if (!container) {
            const ulCours = item.querySelector(".container-cours");
            const absentLi = document.createElement("li");
            absentLi.className = "container-etiquette";
            ulCours.appendChild(absentLi);
        }

        const containerUpdated = item.querySelector('.container-etiquette');
        containerUpdated.innerHTML = '<div class="m-left-s tag-style ie-chips gd-red-foncee">Prof. absent</div>';
    }

    function applySavedCancellations() {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        const currentDate = getCurrentDateString();
        if (!currentDate) return;

        document.querySelectorAll('.liste-cours > li').forEach(item => {
            const span = item.querySelector('span.sr-only');
            if (!span) return;
            const key = `${span.textContent.trim()}|${currentDate}`;
            if (!(key in saved)) return;

            const container = item.querySelector('.container-etiquette');
            if (container && container.textContent.includes('Prof. absent')) return;

            item.classList.add("cours-annule");
            if (!container) {
                const ulCours = item.querySelector(".container-cours");
                const absentLi = document.createElement("li");
                absentLi.className = "container-etiquette";
                ulCours.appendChild(absentLi);
            }
            item.querySelector('.container-etiquette').innerHTML = '<div class="m-left-s tag-style ie-chips gd-red-foncee">Prof. absent</div>';
        });
    }

    // Daily classes watcher
    startWatching('.liste-cours', () => {
        if (!GetLanguage()) return;
        applySavedCancellations();
    });

    // weekly classes watcher
    startWatching('.ObjetGrilleCours', () => {
        applySavedCancellationsV2();
    });

    // daily view
    window.CancelClass = function (index) {
        CheckLanguage();
        const items = document.querySelectorAll('.liste-cours > li');
        const validItems = Array.from(items).filter(item => !item.querySelector('.pas-de-cours,.demi-pension') && item.querySelector('.libelle-cours')?.textContent.trim());
        const target = validItems[index === 0 ? 0 : index - 1];
        if (index === 0) {
            for (let i = 0; i < validItems.length; i++) {
                const item = validItems[i];
                toggleCancel(item);
            }
        }
        if (target && index !== 0) toggleCancel(target);
    };

    // weekly view
    window.CancelClass2 = function (day, period) {
        const inStudentAdmin = document.querySelector('.item-selected .label-submenu');
        if (!inStudentAdmin) {
            console.warn('CancelClass2 can only be used in Student Administration > Timetable.');
            return;
        }

        if (day < 0 || day > 5) {
            console.warn('Day must be between 1 (Monday) and 5 (Friday) (or 0 for all).');
            return;
        }

        const monthMap = {
            'January': 0, 'February': 1, 'March': 2, 'April': 3, 'May': 4, 'June': 5,
            'July': 6, 'August': 7, 'September': 8, 'October': 9, 'November': 10, 'December': 11
        };

        function getDayOfWeekFromElement(el) {
            const span = el.querySelector('div.cours-simple').getAttribute('aria-label');
            if (!span) return null;
            const match = span.match(/Course of (\d{1,2}) (\w+)/);
            if (!match) return null;

            const dayNum = parseInt(match[1], 10);
            const monthStr = match[2];
            const monthIndex = monthMap[monthStr];
            if (monthIndex === undefined) return null;

            const date = new Date(getYear(), monthIndex, dayNum);
            const jsDay = date.getDay(); // 0 = Sunday, 1 = Monday, ...
            return jsDay >= 1 && jsDay <= 5 ? jsDay : null; // Only Mon–Fri
        }

        const allClasses = Array.from(document.querySelectorAll('.EmploiDuTemps_Element'));
        const groupedByDay = { 1: [], 2: [], 3: [], 4: [], 5: [] };

        allClasses.forEach(el => {
            const jsDay = getDayOfWeekFromElement(el);
            const invisible = el.classList.contains('cours-invisible');
            if (jsDay && groupedByDay[jsDay] && !invisible) {
                groupedByDay[jsDay].push(el);
            }
        });

        let classesOfDay = null;
        if (day === 0) {
            if (period !== 0) {
                classesOfDay = [1,2,3,4,5].map(d => groupedByDay[d][period - 1]).filter(Boolean);
                for (let i = 0; i < classesOfDay.length; i++) {
                    toggleCancelV2(classesOfDay[i]);
                }
                return;
            }
            classesOfDay = groupedByDay[1].concat(groupedByDay[2], groupedByDay[3], groupedByDay[4], groupedByDay[5]);
        } else {
            classesOfDay = groupedByDay[day];
        }

        if (!classesOfDay || classesOfDay.length === 0) {
            console.warn(`No classes found for day ${day}.`);
            return;
        }

        const validClasses = classesOfDay.filter(el => {
            const label = el.querySelector('.NoWrap');
            return label && label.textContent.trim() !== '';
        });

        if (validClasses.length === 0) {
            console.warn(`No valid classes found for day ${day}.`);
            return;
        }

        if (period < 0 || period > validClasses.length) {
            console.warn(`Period must be between 1 and ${validClasses.length} for day ${day}. (or 0 for all)`);
            return;
        }

        if (period === 0) {
            for (let i = 0; i < validClasses.length; i++) {
                const item = validClasses[i];
                toggleCancelV2(item);
            }
            return;
        }
        const target = validClasses[period - 1];
        toggleCancelV2(target);
    };

    function applySavedCancellationsV2() {
        const saved = getSavedCancellationsV2();

        document.querySelectorAll('.EmploiDuTemps_Element').forEach(element => {
            const key = getUniqueKeyV2(element);
            if (!(key in saved)) return;

            const table = element.querySelector('table.Cours');
            const existingEtiquette = table.querySelector('.EtiquetteCours');
            const allDivs = Array.from(table.tBodies[0].lastChild.querySelectorAll('div.NoWrap'));
            let height = 0;
            allDivs.forEach(item => {
                if (item.style.height && !item.classList.contains('sr-only')) {
                    const s = parseInt(item.style.height);
                    height += s;
                }
            });
            const tHeight = parseInt(element.style.height);

            const newTr = document.createElement('tr');
            newTr.innerHTML = `
                <td style="height:10px;">
                    <div id="GInterface.Instances[2].Instances[1].Instances[0]_Grille_Elements_statut_17" style="background-color: white; color: rgb(192, 0, 0); height: 13px;" class="EtiquetteCours">
                        <div class="NoWrap ie-ellipsis" style="margin:0px 1px; position:relative; width:${table.clientWidth - 10}px;" data-tooltip="ellipsis">Prof. absent</div>
                    </div>
                </td>
            `;
            if (existingEtiquette) {
                existingEtiquette.parentElement.parentElement.remove();
            }
            table.tBodies[0].insertBefore(newTr, table.tBodies[0].firstChild);
            let indexC = allDivs.length - 1; while(indexC >= 0 && allDivs[indexC].classList.contains('sr-only')) indexC--;
            if ((height + 20) > tHeight) {
                const last = allDivs[indexC];
                last.classList.add("sr-only");
            }
        });
    }

    function getYear() {
        const onglet = document.querySelector('span.titre-onglet');
        if (!onglet) return new Date().getFullYear();
        const text = onglet.textContent;
        const match = text.match(/(20\d{2})/);
        if (match) return parseInt(match[1], 10);
        return new Date().getFullYear();
    }

    function getUniqueKeyV2(element) {
        const span = element.querySelector('div.cours-simple').getAttribute('aria-label');
        return span;
    }

    function saveCancelledClassV2(key, data) {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY_V2) || '{}');
        saved[key] = data;
        localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(saved));
    }

    function removeCancelledClassV2(key) {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY_V2) || '{}');
        delete saved[key];
        localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(saved));
    }

    function getSavedCancellationsV2() {
        return JSON.parse(localStorage.getItem(STORAGE_KEY_V2) || '{}');
    }

    function toggleCancelV2(element) {
        const key = getUniqueKeyV2(element);
        if (!key) return;

        const table = element.querySelector('table.Cours');
        const existingEtiquette = table.querySelector('.EtiquetteCours');
        const allDivs = Array.from(table.tBodies[0].lastChild.querySelectorAll('div.NoWrap'));
        let height = 0;
        allDivs.forEach(item => {
            if (item.style.height && !item.classList.contains('sr-only')) {
                const s = parseInt(item.style.height);
                height += s;
            }
        });
        const tHeight = parseInt(element.style.height);

        const isAlreadyCancelled = existingEtiquette && existingEtiquette.textContent.includes('Prof. absent');

        if (isAlreadyCancelled) {
            const saved = getSavedCancellationsV2();
            if (saved[key]) {
                // Restore etiquette
                if (existingEtiquette) existingEtiquette.parentElement.parentElement.remove();
                if (saved[key].originalTrHTML) {
                    table.tBodies[0].insertAdjacentHTML('afterbegin', saved[key].originalTrHTML);
                }
                if (saved[key].originalClassroomClass) {
                    const lastf = allDivs[saved[key].originalClassroomClass];
                    lastf.classList.remove('sr-only');
                }
                removeCancelledClassV2(key);
            }
            return;
        }

        const etiquetteTr = table.querySelector('tr');
        const etiquetteRowHTML = etiquetteTr.outerHTML;

        const newTr = document.createElement('tr');
        newTr.innerHTML = `
            <td style="height:10px;">
                <div id="GInterface.Instances[2].Instances[1].Instances[0]_Grille_Elements_statut_17" style="background-color: white; color: rgb(192, 0, 0); height: 13px;" class="EtiquetteCours">
                    <div class="NoWrap ie-ellipsis" style="margin:0px 1px; position:relative; width:${table.clientWidth - 10}px;" data-tooltip="ellipsis">Prof. absent</div>
                </div>
            </td>
        `;
        if (existingEtiquette) {
            existingEtiquette.parentElement.parentElement.remove();
        }
        table.tBodies[0].insertBefore(newTr, table.tBodies[0].firstChild);
        let indexC = allDivs.length - 1; while(indexC >= 0 && allDivs[indexC].classList.contains('sr-only')) indexC--;
        if ((height + 20) > tHeight) {
            const last = allDivs[indexC];
            last.classList.add("sr-only");
        }

        saveCancelledClassV2(key, {
            originalTrHTML: existingEtiquette ? etiquetteTr.outerHTML : null,
            originalClassroomClass: (height + 20) > tHeight ? indexC : null
        });
    }
    // stop selecting here if you're using raw script instead of extension
})();
