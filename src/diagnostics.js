import { escapeHtml } from "./utils.js";

export function classifyFailureCause(evalKind, detail) {
  const stderr = String(detail?.stderr || "");
  const expected = String(detail?.expected ?? "");
  const got = String(detail?.got ?? "");

  if (detail?.runtimeOk === false || stderr) {
    if (stderr.includes("EOFError")) return { cause: "Program čakal vstup cez input(), ale pri teste ho nedostal alebo ho číta na nesprávnom mieste.", next: "Skontroluj, či úloha naozaj chce input(), a či ho používaš len tam, kde treba." };
    if (stderr.includes("IndentationError")) return { cause: "Python narazil na problém s odsadením bloku.", next: "Skontroluj riadky po if/for/while/def a použi rovnaké odsadenie, ideálne 4 medzery." };
    if (stderr.includes("SyntaxError")) return { cause: "Kód má syntaktickú chybu, takže test sa nedostal k overeniu logiky.", next: "Skontroluj dvojbodky, zátvorky, úvodzovky a či príkazy nie sú napísané mimo platnej Python syntaxe." };
    if (stderr.includes("NameError")) return { cause: "Používaš názov premennej alebo funkcie, ktorý Python nepozná.", next: "Skontroluj preklepy a či je premenná vytvorená skôr, než ju používaš." };
    if (stderr.includes("TypeError")) return { cause: "Operácia dostala nesprávny typ hodnoty alebo nesprávny počet argumentov.", next: "Pri vstupe skontroluj int()/float(); pri funkcii skontroluj parametre a return." };
    return { cause: "Program počas testu spadol, preto sa výsledok nedal porovnať.", next: "Pozri chybovú hlášku v detaile testu alebo v Output a oprav najprv pád programu." };
  }

  if (evalKind === "function") {
    if (got === "" || got === "null") return { cause: "Funkcia pravdepodobne nič nevracia, alebo používa print() namiesto return.", next: "V stavových funkčných úlohách má funkcia výsledok vrátiť cez return, nie iba vypísať." };
    if (detail?.mutationActive && !detail?.okMutation) return { cause: "Funkcia zmenila vstupné dáta, hoci mala vrátiť nový výsledok bez vedľajšieho efektu.", next: "Nevpisuj výsledok späť do pôvodného zoznamu/slovníka; vytvor novú hodnotu a tú vráť." };
    return { cause: "Funkcia beží, ale vracia inú hodnotu, než test očakáva.", next: "Porovnaj argumenty testu s expected/got a prejdi si výpočet ručne na malom príklade." };
  }

  if (got === "" && expected !== "") return { cause: "Program nič nevypísal, hoci test očakáva výstup.", next: "Skontroluj, či máš print(...) a či sa program dostane do vetvy alebo cyklu, kde sa má vypísať výsledok." };
  if (expected.trim() === got.trim() && expected !== got) return { cause: "Obsah je takmer správny, ale nesedí formátovanie: medzery alebo nové riadky.", next: "Porovnaj počet riadkov a medzier. Najčastejšie pomôže upraviť print(...)." };
  if (expected.toLowerCase() === got.toLowerCase() && expected !== got) return { cause: "Výstup sa líši veľkosťou písmen.", next: "Skontroluj malé/veľké písmená v texte, ktorý vypisuješ." };
  return { cause: "Program beží, ale výstup sa nezhoduje s očakávaním.", next: "Skús si pre daný vstup vypočítať výsledok ručne a porovnať ho s tým, čo vypísal program." };
}

export function renderFirstFailedSummary({ overallPassed, structure, functional, evalKind }) {
  if (overallPassed) return "";
  const firstStructure = (!structure?.passed && (structure?.violations?.length ?? 0) > 0) ? structure.violations[0] : null;
  const firstFail = (functional?.details ?? []).find(d => !d.ok) ?? null;

  if (!firstStructure && !firstFail && functional?.fatal) {
    return `<div class="card first-fail-summary"><h4 style="margin:0 0 8px 0;">❌ Prvý problém</h4><p><strong>Testovací harness zlyhal:</strong> ${escapeHtml(functional.fatal)}</p><p class="small">Skontroluj konfiguráciu úlohy alebo názov funkcie v zadaní.</p></div>`;
  }

  if (firstStructure && (!firstFail || firstStructure.lineno != null)) {
    return `<div class="card first-fail-summary"><h4 style="margin:0 0 8px 0;">❌ Prvý problém</h4><p><strong>Štrukturálna kontrola neprešla.</strong></p><p>${escapeHtml(firstStructure.message || "Porušené pravidlo v kóde.")}</p>${firstStructure.lineno != null ? `<p class="small">Miesto: riadok ${escapeHtml(firstStructure.lineno)}:${escapeHtml(firstStructure.col ?? 0)}</p>` : ``}<p class="small"><strong>Ďalší krok:</strong> oprav najprv zakázaný vzor v kóde; až potom má zmysel riešiť expected/got.</p></div>`;
  }

  if (!firstFail) return "";
  const visible = firstFail.visible !== false;
  const { cause, next } = classifyFailureCause(evalKind, firstFail);

  if (!visible) {
    return `<div class="card first-fail-summary"><h4 style="margin:0 0 8px 0;">❌ Prvý problém</h4><p><strong>Nezlyhal viditeľný, ale skrytý test ${escapeHtml(firstFail.index ?? "")}.</strong></p><p class="small">To zvyčajne znamená, že riešenie funguje iba pre vzorový príklad, ale nie všeobecne.</p><p><strong>Možná príčina:</strong> ${escapeHtml(cause)}</p><p><strong>Ďalší krok:</strong> ${escapeHtml(next)}</p><p class="small">Tip: klikni na <strong>Poraď mi</strong>; rada bude vychádzať z tejto diagnostiky.</p></div>`;
  }

  const inputBlock = evalKind === "function"
    ? `<div class="small">argumenty</div><pre>${escapeHtml(JSON.stringify(firstFail.args ?? []))}</pre>${(firstFail.kwargs && Object.keys(firstFail.kwargs).length) ? `<div class="small">kwargs</div><pre>${escapeHtml(JSON.stringify(firstFail.kwargs))}</pre>` : ``}`
    : `<div class="small">vstup</div><pre>${escapeHtml(firstFail.input ?? "")}</pre>`;
  const labelExpected = evalKind === "function" ? "očakávaný return" : "očakávaný výstup";
  const labelGot = evalKind === "function" ? "tvoj return" : "tvoj výstup";

  return `<div class="card first-fail-summary"><h4 style="margin:0 0 8px 0;">❌ Prvý problém: test ${escapeHtml(firstFail.index ?? "")} zlyhal</h4><div class="kv" style="margin-top:8px;">${inputBlock}<div class="small">${labelExpected}</div><pre>${escapeHtml(firstFail.expected ?? "")}</pre><div class="small">${labelGot}</div><pre>${escapeHtml(firstFail.got ?? "")}</pre></div>${firstFail.stderr ? `<div class="small">chyba</div><pre>${escapeHtml(firstFail.stderr)}</pre>` : ``}<p><strong>Možná príčina:</strong> ${escapeHtml(cause)}</p><p><strong>Ďalší krok:</strong> ${escapeHtml(next)}</p><p class="small">Tip: klikni na <strong>Poraď mi</strong>; rada bude vychádzať z tejto diagnostiky.</p></div>`;
}


