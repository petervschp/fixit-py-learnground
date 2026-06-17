import {
  incHints,
  recordEvent,
  getLastDiag
} from "../storage.js";

function stderrHint(stderr) {
  const s = String(stderr || "");
  if (!s) return null;

  if (s.includes("EOFError")) {
    return "EOFError: program čítal input(), ale nedostal žiadny vstup. V tejto úlohe buď doplň stdin pre Run, alebo (pri stavových funkčných úlohách) nepoužívaj input() a pracuj s parametrami funkcie.";
  }
  if (s.includes("IndentationError")) {
    return "IndentationError: problém s odsadením. Skontroluj, že bloky po if/for/while/def majú rovnaké odsadenie (typicky 4 medzery).";
  }
  if (s.includes("SyntaxError")) {
    return "SyntaxError: syntaktická chyba. Skontroluj dvojbodky po if/for/while/def, uzatváranie zátvoriek a úvodzoviek.";
  }
  if (s.includes("NameError")) {
    return "NameError: používaš názov, ktorý neexistuje (premenná/funkcia). Skontroluj preklepy a či si funkciu naozaj definoval.";
  }
  if (s.includes("TypeError")) {
    return "TypeError: nesprávne typy alebo počet argumentov. Pri CLI úlohách skontroluj int()/float(); pri stavových funkčných úlohách skontroluj parametre funkcie a návratovú hodnotu.";
  }
  if (s.includes("IndexError")) {
    return "IndexError: index je mimo rozsah. Skontroluj dĺžku zoznamu/reťazca a hranice v range().";
  }
  if (s.includes("KeyError")) {
    return "KeyError: v slovníku chýba kľúč. Skontroluj, či existuje, alebo použi dict.get().";
  }
  if (s.includes("RecursionError")) {
    return "RecursionError: príliš hlboká rekurzia (možno nekonečná). Skontroluj ukončovaciu podmienku.";
  }
  return null;
}

export function createHintController({ problem, state, btnHint, hintBox, setStatus }) {
  let hintLevel = 0;

  function refreshHintAvailability() {
    const diag = getLastDiag(state, problem.id);
    if (diag) {
      btnHint?.removeAttribute("disabled");
      btnHint?.removeAttribute("title");
    } else {
      btnHint?.setAttribute("disabled", "disabled");
      btnHint?.setAttribute("title", "Najprv spusti Run alebo Testy.");
    }
  }

  function resetHint() {
    hintLevel = 0;
    hintBox.classList.add("hidden");
    hintBox.textContent = "";
  }

  btnHint?.addEventListener("click", () => {
    hintBox.classList.remove("hidden");

    const diag = getLastDiag(state, problem.id);

    if (!diag) {
      hintBox.textContent = "Najprv spusti Run alebo Testy, aby som vedel dať konkrétnu radu k tvojmu kódu.";
      incHints(state, problem.id);
      recordEvent(state, "hint2", { problemId: problem.id, kind: "no_diag" });
      setStatus("Hint: najprv spusti test.");
      return;
    }

    if (diag?.overall?.passed === true || diag?.overallPassed === true) {
      const nextMsg = (problem.evaluation?.kind === "function")
        ? "Testy už prešli ✅ Skús sa pozrieť, či funkcia používa čisté parametre a return (bez vedľajších efektov), a potom pokračuj na ďalšiu úlohu."
        : "Testy už prešli ✅ Ak chceš, skús ešte raz skontrolovať formát výstupu (riadky/medzery) a pokračuj na ďalšiu úlohu.";
      hintBox.textContent = nextMsg;
      incHints(state, problem.id);
      recordEvent(state, "hint2", { problemId: problem.id, kind: "passed" });
      setStatus("Hint: testy prešli.");
      return;
    }

    if (diag?.timeout) {
      hintBox.textContent = "Časový limit prekročený – pravdepodobne nekonečný cyklus. Skontroluj podmienku while/for, či sa mení premenná v podmienke, prípadne či máš break. Pri funkcii si daj pozor na rekurziu bez ukončenia.";
      incHints(state, problem.id);
      recordEvent(state, "hint2", { problemId: problem.id, kind: "timeout" });
      setStatus("Hint: nekonečný cyklus / timeout.");
      return;
    }

    if (diag?.structure && !diag.structure.passed && (diag.structure.violations?.length ?? 0) > 0) {
      const v = diag.structure.violations[0];
      hintBox.textContent =
        "Štruktúra neprešla: " + (v.message || "porušené pravidlo") +
        "\n\nTip: stavové funkčné úlohy chcú parametre + return (nie input/print). Odstráň zakázané volanie a nech funkcia vracia výsledok.";
      incHints(state, problem.id);
      recordEvent(state, "hint2", { problemId: problem.id, kind: "structure", type: v.type, name: v.name ?? null });
      setStatus("Hint: štruktúra (zakázaný vzor).");
      return;
    }

    if (diag?.functional && !diag.functional.passed) {
      if (diag.functional.fatal) {
        hintBox.textContent = "Testovací harness hlási: " + diag.functional.fatal + "\nSkontroluj definíciu funkcie, názov a že existujú test cases.";
        incHints(state, problem.id);
        recordEvent(state, "hint2", { problemId: problem.id, kind: "fatal" });
        setStatus("Hint: interné nastavenie úlohy / fatal.");
        return;
      }

      const f = diag.functional.firstFail;
      if (f) {
        if (f.runtimeOk === false && f.stderr) {
          const h = stderrHint(f.stderr);
          if (h) {
            hintBox.textContent = h;
            incHints(state, problem.id);
            recordEvent(state, "hint2", { problemId: problem.id, kind: "stderr" });
            setStatus("Hint: chyba v behu programu.");
            return;
          }
        }

        if ((diag.evalKind === "function" || problem.evaluation?.kind === "function")) {
          if (String(f.got ?? "") === "null" || String(f.got ?? "") === "") {
            hintBox.textContent = "Vyzerá to, že funkcia nevracia výsledok (vracia None). Pri stavových funkčných úlohách nepoužívaj print() ako výstup – namiesto toho použi return hodnoty.";
            incHints(state, problem.id);
            recordEvent(state, "hint2", { problemId: problem.id, kind: "return_none" });
            setStatus("Hint: return vs print.");
            return;
          }
          if (f.mutationActive && !f.okMutation) {
            hintBox.textContent = "Zlyhala kontrola mutácie: meníš vstupné dáta. Pri 'filter' úlohách vráť NOVÝ zoznam a pôvodný neupravuj (nepoužívaj nums[:] = ...).";
            incHints(state, problem.id);
            recordEvent(state, "hint2", { problemId: problem.id, kind: "mutation" });
            setStatus("Hint: nemutuj vstup.");
            return;
          }
        }

        const isStdoutEval = (diag.evalKind === "stdout" || !problem.evaluation || problem.evaluation.kind === "stdout");
        const exp = (f.expected != null) ? String(f.expected) : null;
        const got = (f.got != null) ? String(f.got) : null;

        if (isStdoutEval && exp != null && got != null) {
          if (exp.trim() === got.trim() && exp !== got) {
            hintBox.textContent = "Výstup je skoro správny, ale nesedí presne formátovanie (medzery alebo nový riadok). Skontroluj presný počet riadkov a medzier.";
            incHints(state, problem.id);
            recordEvent(state, "hint2", { problemId: problem.id, kind: "whitespace" });
            setStatus("Hint: formátovanie výstupu.");
            return;
          }

          if (got === "" && exp !== "") {
            hintBox.textContent = "Zdá sa, že program nič nevypísal. Skontroluj, či máš na konci print(...) a či sa dostaneš do vetvy/cyklu, kde sa má vypísať výsledok.";
            incHints(state, problem.id);
            recordEvent(state, "hint2", { problemId: problem.id, kind: "no_output" });
            setStatus("Hint: nič nevypisuje.");
            return;
          }

          if (exp.replace(/\s+$/g, "") === got.replace(/\s+$/g, "") && exp !== got) {
            hintBox.textContent = "Výsledok sa líši iba koncovými medzerami alebo novým riadkom. Skontroluj, či používaš print(...) a či nepridávaš alebo neuberáš zbytočné znaky.";
            incHints(state, problem.id);
            recordEvent(state, "hint2", { problemId: problem.id, kind: "trailing_whitespace" });
            setStatus("Hint: koniec výstupu / newline.");
            return;
          }

          hintBox.textContent = "Výstup nesedí presne. Porovnaj expected a got v časti Testy: hľadaj chýbajúci znak, preklep, rozdiel vo veľkosti písmen alebo interpunkcii.";
          incHints(state, problem.id);
          recordEvent(state, "hint2", { problemId: problem.id, kind: "stdout_mismatch" });
          setStatus("Hint: porovnaj expected vs got.");
          return;
        }
      }
    }

    hintBox.textContent = problem.hints?.[hintLevel] ?? "";
    hintLevel = Math.min(2, hintLevel + 1);

    incHints(state, problem.id);
    recordEvent(state, "hint", { problemId: problem.id, hintLevel });
    setStatus("Hint použitý. (Ukladám progres)");
  });

  refreshHintAvailability();

  return { refreshHintAvailability, resetHint };
}
