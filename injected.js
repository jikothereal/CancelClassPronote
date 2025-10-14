// ==UserScript==
// @name         Pronote Prof Absent Toggle
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Toggle a class as cancelled and restore original if toggled back, based on unique span text and date.
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'cancelledClasses';

    function GetLanguage() {
        const lang = document.documentElement.lang;
        if (lang && lang !== "en") {
            return false
        }
        return true
    }

    function CheckLanguage() {
        const lg = document.documentElement.lang;
        if (lg && lg == "fr") {
            console.error("Veuillez changer la langue de Pronote dans 'Mes données > Compte > Préférences > Style et accessibilité > Personnalisation > Langue > English'\nCe programme est toujours en cours de développement et ne supporte que la version anglaise pour le moment (car c'est plus simple.).\nL'adaptation automatique pour les autres langues sera ajoutée lorsque le programme sera entièrement terminé.");
            return;
        } else if (lg && lg == "it") {
            console.error("Modifica la lingua di Pronote in 'I miei dati > Account > Preferenze > Stile e accessibilità > Personalizzazione > Lingua > English'\nQuesto programma è ancora in fase di sviluppo e al momento supporta solo la versione inglese (per semplicità).\nL'adattamento automatico per le altre lingue verrà aggiunto quando il programma sarà completamente terminato.");
            return;
        } else if (lg && lg == "es") {
            console.error("Cambia el idioma de Pronote en 'Mis datos > Cuenta > Preferencias > Estilo y accesibilidad > Personalización> Lengua > English'. Este programa aún se encuentra en fase de desarrollo y, por el momento, solo admite la versión en inglés (por simplicidad).\nLa adaptación automática para otros idiomas se añadirá cuando el programa esté completamente terminado.");
            return;
        }
    }

    async function getPing() {
        const start = performance.now();
        await fetch(window.location.origin + '/favicon.ico');
        return performance.now() - start;
    }

    function getCurrentDateString() {
        const dateEl = document.querySelector('.ocb-libelle');
        if (!dateEl) return null;
        const raw = dateEl.textContent.trim();

        const today = new Date();
        const options = { day: '2-digit', month: 'short' };

        if (raw === 'Today') {
            return today.toLocaleDateString('en-GB', options).replace(/^0/, '');
        } else if (raw === 'Yesterday') {
            today.setDate(today.getDate() - 1);
            return today.toLocaleDateString('en-GB', options).replace(/^0/, '');
        } else if (raw === 'Tomorrow') {
            today.setDate(today.getDate() + 1);
            return today.toLocaleDateString('en-GB', options).replace(/^0/, '');
    } else {
        const parts = raw.split('\u00a0');
        if (parts.length >= 2) {
            if (parts.length == 2) {
                return parts[0] + ' ' + parts[1];
            } else {
                return parts[1] + ' ' + parts[2];
            }
        }
    }
    return null;
    }

    function getUniqueClassKey(item) {
        const span = item.querySelector('span.sr-only');
        const dateStr = getCurrentDateString();
        return (span && dateStr) ? `${span.textContent.trim()}|${dateStr}` : null;
    }

    function saveCancelledClass(key, originalEtiquetteHTML) {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        saved[key] = originalEtiquetteHTML;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    }

    function removeCancelledClass(key) {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        delete saved[key];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    }

    function getSavedCancellations() {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    }

    function toggleCancel(item) {
        
        const key = getUniqueClassKey(item);
        if (!key) return;

        const etiquetteContainer = item.querySelector('.container-etiquette');
        const isAlreadyCancelled = etiquetteContainer && etiquetteContainer.textContent.includes('Prof. absent');

        if (isAlreadyCancelled) {
            const saved = getSavedCancellations();
            if (key in saved) {
                etiquetteContainer.innerHTML = saved[key];
                item.classList.remove("cours-annule");
                removeCancelledClass(key);
            }
            return;
        }

        const originalHTML = etiquetteContainer ? etiquetteContainer.innerHTML : '';
        saveCancelledClass(key, originalHTML);

        item.classList.add("cours-annule");
        if (!etiquetteContainer) {
            const ulCours = item.querySelector(".container-cours");
            const absentLi = document.createElement("li");
            absentLi.className = "container-etiquette";
            ulCours.appendChild(absentLi);
        }
        const container = item.querySelector('.container-etiquette');
        container.innerHTML = '<div class="m-left-s tag-style ie-chips gd-red-foncee">Prof. absent</div>';
    }

    function applySavedCancellations() {
        const saved = getSavedCancellations();
        const currentDate = getCurrentDateString();
        console.info(saved);

        document.querySelectorAll('.liste-cours > li').forEach(item => {
            const span = item.querySelector('span.sr-only');
            if (!span || !currentDate) return;

            const key = `${span.textContent.trim()}|${currentDate}`;
            console.info(key);
            if (!(key in saved)) return;

            const etiquetteContainer = item.querySelector('.container-etiquette');
            const isAlreadyCancelled = etiquetteContainer && etiquetteContainer.textContent.includes('Prof. absent');
            if (isAlreadyCancelled) return;

            item.classList.add("cours-annule");
            if (!etiquetteContainer) {
                const ulCours = item.querySelector(".container-cours");
                const absentLi = document.createElement("li");
                absentLi.className = "container-etiquette";
                ulCours.appendChild(absentLi);
            }
            const container = item.querySelector('.container-etiquette');
            container.innerHTML = '<div class="m-left-s tag-style ie-chips gd-red-foncee">Prof. absent</div>';
        });
    }

    window.addEventListener('load', () => {
        CheckLanguage();
        if (!GetLanguage()) {return;}
        const checkLoaded = setInterval(() => {
            const classes = document.querySelectorAll('.liste-cours > li');
            if (classes.length > 0) {
                clearInterval(checkLoaded);
                applySavedCancellations();
            }
        }, 100);
    });

    const observer = new MutationObserver(() => {
        if (!GetLanguage()) {return;}
        const left = document.querySelector('.icon_angle_left');
        const right = document.querySelector('.icon_angle_right');
        const sad = document.querySelector('.icon_fermeture_widget');
        const sadclose = document.querySelector('.themeBoutonSecondaire');

        if (left && !left.dataset.patched) {
            left.addEventListener('click', async () => {
                console.info("left arrow click detected");
                const pingLeft = await getPing();
                console.log(pingLeft);
                applySavedCancellations();
            });
            left.dataset.patched = 'true';
        }

        if (right && !right.dataset.patched) {
            right.addEventListener('click', async () => {
                console.info("right arrow click detected");
                const pingRight = await getPing();
                console.log(pingRight);
                applySavedCancellations();
            });
            right.dataset.patched = 'true';
        }

        if (sad && !sad.dataset.patched) {
            sad.addEventListener('click', async () => {
                console.info("S.A.D's cross button click detected");
                const pingSAD = await getPing();
                console.log(pingSAD);
                applySavedCancellations();
            });
            sad.dataset.patched = 'true';
        }

        if (sadclose && !sadclose.dataset.patched) {
            sadclose.addEventListener('click', async () => {
                console.info("S.A.D's close button click detected");
                const pingSAD2 = await getPing();
                console.log(pingSAD2);
                applySavedCancellations();
            });
            sadclose.dataset.patched = 'true';
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    // Home button
    document.body.addEventListener('click', function (e) {
        if (!GetLanguage()) {return;}
        const homeBtn = e.target.closest('#GInterface\\.Instances\\[0\\]\\.Instances\\[3\\]_Combo0');
        if (!homeBtn) return;

        const checkLoaded = setInterval(() => {
            const classes = document.querySelectorAll('.liste-cours > li');
            if (classes.length > 0) {
                clearInterval(checkLoaded);
                applySavedCancellations();
            }
        }, 40);
    });

    // daily view
    window.CancelClass = function (classNumber) {
        CheckLanguage();
        if (!classNumber && classNumber !== 0) {
            console.warn("You need to specify a number corresponding to the class's order place.");
            return;
        }
        const allItems = document.querySelectorAll('.liste-cours > li');
        let actualIndex = 0;

        for (let i = 0; i < allItems.length; i++) {
            const item = allItems[i];
            const noCourse = item.querySelector('.pas-de-cours');
            const lunch = item.querySelector('.demi-pension');
            const label = item.querySelector('.libelle-cours');

            if (noCourse || lunch || !label || label.textContent.trim() === '') continue;

            if (classNumber === 0) {
                toggleCancel(item);
            }

            actualIndex++;

            if (actualIndex === classNumber) {
                toggleCancel(item);
                return;
            }
        }
    };

    // weekly view
    window.CancelClass2 = function (day, period) {
        const inStudentAdmin = document.querySelector('.item-selected .label-submenu');
        if (!inStudentAdmin || !inStudentAdmin.textContent.includes('Timetable')) {
            console.warn('CancelClass2 can only be used in Student Administration > Timetable.');
            return;
        }

        if (day < 1 || day > 5) {
            console.warn('Day must be between 1 (Monday) and 5 (Friday).');
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

            const date = new Date(2025, monthIndex, dayNum);
            const jsDay = date.getDay(); // 0 = Sunday, 1 = Monday, ...
            return jsDay >= 1 && jsDay <= 5 ? jsDay : null; // Only Mon–Fri
        }

        const allClasses = Array.from(document.querySelectorAll('.EmploiDuTemps_Element'));
        const groupedByDay = { 1: [], 2: [], 3: [], 4: [], 5: [] };

        allClasses.forEach(el => {
            const jsDay = getDayOfWeekFromElement(el);
            if (jsDay && groupedByDay[jsDay]) {
                groupedByDay[jsDay].push(el);
            }
        });

        const classesOfDay = groupedByDay[day];
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

        if (period < 1 || period > validClasses.length) {
            console.warn(`Period must be between 1 and ${validClasses.length} for day ${day}.`);
            return;
        }

        const target = validClasses[period - 1];
        toggleCancelV2(target);
        console.log('Selected class:', target);
    };

    const STORAGE_KEY_V2 = 'cancelledClassesV2';

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
        const allDivs = Array.from(table.querySelectorAll('div.NoWrap'));
        const classroomDiv = allDivs.reverse().find(d => !d.textContent.includes('.') && d.textContent.length <= 4); // like "301" or "207"

        const isAlreadyCancelled = existingEtiquette && existingEtiquette.textContent.includes('Prof. absent');

        if (isAlreadyCancelled) {
            const saved = getSavedCancellationsV2();
            if (saved[key]) {
                // Restore etiquette
                if (existingEtiquette) existingEtiquette.parentElement.parentElement.remove();
                if (saved[key].originalTrHTML) {
                    table.tBodies[0].insertAdjacentHTML('afterbegin', saved[key].originalTrHTML);
                }
                if (classroomDiv) {
                    classroomDiv.className = saved[key].originalClassroomClass;
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
                    <div class="NoWrap ie-ellipsis" style="margin:0px 1px; position:relative;width:160px;" data-tooltip="ellipsis">Prof. absent</div>
                </div>
            </td>
        `;
        table.tBodies[0].insertBefore(newTr, table.tBodies[0].firstChild);

        // Save and hide classroom
        const classroomClass = classroomDiv ? classroomDiv.className : null;
        if (classroomDiv) classroomDiv.className = 'NoWrap sr-only';

        saveCancelledClassV2(key, {
            originalTrHTML: existingEtiquette ? etiquetteTr.outerHTML : null,
            originalClassroomClass: classroomClass
        });
    }

})();
