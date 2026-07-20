# UX Audit — Vibro-diag-system (PulseGuard)

Repozitář: `Th0masis/Vibro-diag-system` · Frontend: React + `App.css` (~4200 řádků, tokenizovaný design systém)
Auditováno proti pravidlům z `ux-pravidla-pro-ai-agenty.md` (designmotionhq.com).

Celkově je základ **nadprůměrně promyšlený** — existuje token systém, `:focus-visible`, `aria-live`/`role="alert"`, empty states s ilustracemi, tabulka s tabular-nums a sticky headerem. Hlavní problém není "chybí UX myšlení", ale **nedůslednost**: systémy jsou navržené, ale ne všude dotažené.

---

## 🔴 P0 — Kritické, opravit jako první

### 1. Žádný notifikační systém — všude `alert()` a `confirm()`
**Nález:** 23 výskytů `alert(...)` napříč `Sensors.jsx`, `UserManagement.jsx`, `MlSector.jsx`, `Machines.jsx`, `MachineDiagnostics.jsx`, `ServiceNotes.jsx`, `MachineSensors.jsx`, `ModelTrainingModal.jsx`, `MachineCard.jsx`. Navíc `MlSector.jsx:66` používá `window.confirm(...)` pro potvrzení **nasazení ML modelu do produkce** — jednu z nejkritičtějších akcí v celé aplikaci.

```js
// MlSector.jsx:66
if (!window.confirm("Are you sure you want to deploy this model version to production?...")) return;
...
alert("Model activated successfully and is now in production."); // :73
```

**Proč vadí:** Pattern *Notification System* popisuje 4 povrchy (toast/banner/modal/badge) podle závažnosti. Nativní `alert()`/`confirm()` blokuje celé vlákno prohlížeče, nejde stylovat, nejde stackovat, action typu "úspěch" i "selhání serveru" vypadají identicky a působí jako pád aplikace, ne jako zpětná vazba. U produkčního nasazení modelu je nativní `confirm()` obzvlášť rizikový — operátor si ho snadno "proklikne" bez skutečného zamyšlení, protože vypadá stejně jako browser popup na "opustit stránku bez uložení".

**Fix:**
- Zavést jednotný `Toast`/`Notification` komponent (4 povrchy podle severity — máte na to už `--status-ok/warning/fault` tokeny, stačí je použít).
- Chybové `alert()` → toast s **Retry** akcí tam, kde dává smysl (`error-message` komponent už v CSS existuje — je vidět, že vzor byl navržen, jen se nepoužil důsledně).
- `window.confirm()` pro deploy modelu → vlastní **modal** (máte `ConfirmModal.jsx` — použijte ho i tady) s jasným textem dopadu ("Nahradí aktuálně běžící model verze X"), ne generický browser dialog.
- Úspěšné akce → toast, ne `alert()`. Aplikace momentálně nemá žádnou pozitivní zpětnou vazbu mimo alert.

---

### 2. Kontrast textu pod hranicí WCAG
**Nález (změřeno):**

| Barva | Použití | Kontrast na bílé | WCAG limit | Stav |
|---|---|---|---|---|
| `#94A3B8` | tlumený text, popisky (14+ výskytů v `App.css`) | **2.56:1** | 4.5:1 (text) | ❌ FAIL |
| `#9CA3AF` | tlumený text | **2.54:1** | 4.5:1 | ❌ FAIL |
| `#F07800` (primary) | `.nav-item.active` text | **2.84:1** | 3:1 (i jako bold/large) | ❌ FAIL (těsně) |
| `#6B7280` / `#64748b` | `--neutral-gray`, `--text-muted` | 4.76–4.83:1 | 4.5:1 | ✅ OK |

**Proč vadí:** Pattern *Color Accessibility* přesně popisuje tenhle scénář — "decorative" šedé texty (popisky, štítky) běžně padají pod limit, protože se netestují. `#94A3B8`/`#9CA3AF` je použito jako sekundární text na 20+ místech v `App.css` (řádky 234, 919, 1136, 1644, 1667, 1678, 2432, 2481, 2495, 2515, 2539, 2557...) — to je systémový problém, ne jeden překlep.

**Fix:**
- Nahradit `#94A3B8`/`#9CA3AF` za `--neutral-gray` (`#6B7280`, 4.83:1 — token už existuje, jen se nepoužívá důsledně) nebo ztmavit na ekvivalent.
- Aktivní nav odkaz: buď zesílit orange na tmavší odstín (`--primary-hover: #D96400` dává vyšší kontrast), nebo přidat druhý signál (podtržítko tam už je — dobře, ale samotná barva textu by kontrast splnit měla také).

---

### 3. Design tokeny existují, ale polovina kódu je obchází
**Nález:** V `:root` je definován slušný token systém (`--primary`, `--status-ok/warning/fault`, `--neutral-*`, spacing scale 4pt). Přesto mimo `:root` blok je v `App.css` **přes 400 samostatných hex hodnot**, z nichž řada je jen mírně odlišný duplikát existujícího tokenu:

```
#ffffff (31×) vs. --neutral-bg-white
#E2E8F0 (20×) + #e2e8f0 (12×) — stejná barva, dvě velikosti písmen, žádný token
#111111 (17×) vs. --neutral-black
#6B7280 (13×) vs. --neutral-gray
```

Navíc přímo v `Dashboard.jsx` (řádky 199, 205, 211) jsou barvy stavů zapsané jako inline `style={{color:'#059669'}}` atd., místo aby používaly `--status-ok`/`--status-warning`/`--status-fault`, které pro přesně tenhle účel v tokenech existují.

**Nalezený konkrétní bug jako důsledek:** `App.css:2111–2114`
```css
.custom-select:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(228, 0, 43, 0.1); /* ČERVENÁ, ne oranžová! */
}
```
`rgba(228, 0, 43, ...)` je červená (zbytek nějaké staré/jiné barevné palety), zatímco `--primary` je oranžová `#F07800`. Focus ring na `custom-select` tak bliká jinou barvou než všude jinde v appce — přesně to, před čím pattern *Design Tokens* varuje: "47 changes, or just one" funguje jen pokud se tokeny opravdu používají všude.

**Fix:**
- Projet `App.css` a nahradit hardcoded hex za odpovídající tokeny (najít/nahradit pro nejčastější hodnoty výše).
- Opravit `rgba(228, 0, 43, 0.1)` → `rgba(240, 120, 0, 0.1)` (nebo lépe `color-mix`/token).
- V `Dashboard.jsx` nahradit inline `style={{color:'#059669'}}` za CSS třídy vázané na `--status-ok` atd.

---

## 🟠 P1 — Vysoká priorita

### 4. Loading stav neodpovídá typu obsahu
**Nález:** `Dashboard.jsx:100-109` — při načítání celé stránky (grid karet strojů, tvar obsahu je **známý**) se zobrazí pouze celoplošný spinner + text "Loading machines…", žádný skeleton.

**Proč vadí:** Pattern *Loading States System*: pokud znáš tvar obsahu (karty), patří sem **skeleton**, ne spinner — spinner je pro krátké čekání neznámého tvaru. Celoplošný spinner navíc pattern přímo zakazuje ("never stretch one across a full-page load").

**Fix:** Nahradit `loading-message` blok v `Dashboard.jsx` za 3–6 skeleton karet stejného rozměru jako `MachineCard`, aby layout "naskočil" bez poskoku.

### 5. Destruktivní akce = tvrdý DELETE + "Opravdu?" dialog, žádné undo
**Nález:** Backend má klasické hard-delete endpointy (`backend/main.py:795 delete_user`, `972 delete_sensor`, `1481 delete_service_note`) bez soft-delete flagu. Frontend je jistí přes `ConfirmModal.jsx` (klasické "Are you sure?").

**Proč vadí:** Pattern *Undo UX*: potvrzovací dialog trestá každého uživatele za hypotetickou chybu; undo netrestá nikoho. U položek jako servisní poznámka nebo senzor (nižší riziko než třeba smazání uživatelského účtu) je to zbytečná friction navíc k tomu, že smazané se nedá vzít zpět.

**Fix (odstupňovaně podle rizika):**
- **Servisní poznámky, senzory** — nízké riziko: smazat rovnou, nabídnout toast s "Undo" (5–10 s) a soft-delete flag v DB.
- **Uživatelé** — vyšší riziko: zachovat potvrzovací modal (má to smysl u účtů s přístupem k systému), ale zvážit soft-delete s možností obnovy do X dní místo trvalého smazání.

### 6. Empty state na Dashboardu nemá akční CTA
**Nález:** `Dashboard.jsx:127-140` — "No machines yet" + popisný text "Add a machine to start...", ale **žádné tlačítko**. CTA tlačítko "+ Add machine" přitom v appce existuje (`Machines.jsx:74`), jen není propojené s tímto empty stavem.

**Proč vadí:** Pattern *Empty States*: "every empty state needs one clear primary CTA" — ne jen text, který říká, co udělat, ale odkaz/tlačítko, které to rovnou umožní.

**Fix:** Přidat do empty-state bloku tlačítko/link na `/machines` (nebo rovnou otevřít modal přidání stroje).

---

## 🟠 P1 — Typografie: chybí type scale (font-size neřízený tokeny)

**Nález:** Fonty samotné jsou v pořádku — `Inter` (400/500/600/700/800) a `DM Mono` (400/500) jsou self-hosted přes `@fontsource` a správně importované v `main.jsx`, takže nehrozí FOUC ani závislost na externím Google Fonts requestu. To je dobrá praxe.

Problém je jinde: zatímco **spacing má jasnou škálu** (`--space-1` … `--space-16`, 4pt báze), **typografie žádnou škálu nemá**. V `App.css` je napočítáno **32 různých hodnot `font-size`**, všechny psané natvrdo v `rem`, bez jediné proměnné:

```
0.62rem, 0.66rem, 0.68rem, 0.7rem, 0.72rem, 0.73rem, 0.75rem, 0.76rem,
0.77rem, 0.78rem, 0.8rem, 0.82rem, 0.84rem, 0.85rem, 0.875rem, 0.88rem,
0.9rem, 0.92rem, 0.95rem, 1rem, 1.02rem, 1.04rem, 1.05rem, 1.1rem,
1.2rem, 1.25rem, 1.5rem, 1.8rem, 1.9rem, 2.2rem, 3rem
```

Žádné globální `h1/h2/h3` — každý nadpis je vlastní CSS třída (`.dashboard-pro-title`, atd.) s vlastní, jednorázově zvolenou velikostí. `line-height` má podobný osud: 10 různých hodnot (1, 1.15, 1.2, 1.25, 1.3, 1.35, 1.45, 1.5, 1.6…) bez vazby na velikost textu.

**Konkrétní problém, který z toho plyne:** popisek grafu na kartě stroje (`App.css:2480`, `.machine-card-pro-graph-label`) má `font-size: 0.62rem` (~9.9 px) **a zároveň** barvu `#94A3B8`, která už v sekci P0-2 padla na kontrastu 2.56:1. Malý text + nízký kontrast dohromady na obrazovce, kde se čtou stavová data stroje — to je přesně kombinace, která dělá text prakticky nečitelný na menší obrazovce nebo z dálky (běžný scénář u průmyslového dashboardu na monitoru u linky).

**Proč to vadí obecně:** Pattern *Design Tokens* / *Visual Hierarchy* platí stejně pro typografii jako pro barvy a mezery — bez pojmenované škály (`--text-xs`, `--text-sm`, `--text-base`, `--text-lg`, `--text-xl`…) se hierarchie tvoří "od oka" u každé komponenty zvlášť, což časem vede přesně k tomuto stavu: 32 téměř nerozlišitelných velikostí, kde nikdo neví, jestli je rozdíl mezi `0.72rem` a `0.75rem` záměr nebo náhoda.

**Fix:**
1. Zavést typografickou škálu jako tokeny, např. (zaokrouhlené hodnoty co nejblíž současnému stavu, aby refaktor nebyl destruktivní):
   ```css
   --text-xs: 0.75rem;   /* 12px — nejmenší povolený, ne 0.62/0.66/0.68 */
   --text-sm: 0.875rem;  /* 14px */
   --text-base: 1rem;    /* 16px */
   --text-lg: 1.125rem;
   --text-xl: 1.25rem;
   --text-2xl: 1.5rem;
   --text-3xl: 1.875rem;
   --text-4xl: 2.25rem;
   ```
2. Stanovit **spodní hranici 0.75rem (12px)** pro jakýkoliv čitelný text a zrušit 0.62/0.66/0.68/0.7/0.72rem hodnoty pod ní — zvlášť tam, kde nesou skutečná data (popisky grafů, hodnoty senzorů), ne jen dekorativní mikro-labely.
3. Přidat pár `line-height` tokenů vázaných na účel (`--leading-tight: 1.2` pro nadpisy, `--leading-normal: 1.5` pro běžný text) místo 10 nezávislých hodnot.
4. `.machine-card-pro-graph-label` opravit na `--text-xs` + `--neutral-gray` (místo `#94A3B8`) — vyřeší souběžně velikost i kontrast.

---

## 🟠 P1 — Spacing: 8px mřížka je definovaná, ale ne dodržovaná

**Nález (změřeno):** Prošel jsem všech 373 číselných hodnot v `padding`/`margin`/`gap` napříč `App.css`:

| Skupina | Počet | Podíl |
|---|---|---|
| Dělitelné 8px (čistá 8pt mřížka) | 116 | 31 % |
| Dělitelné 4px, ale ne 8px (4pt sub-grid — v pořádku pro těsné mezery) | 85 | 23 % |
| **Nedělitelné ani 4px (mimo jakoukoliv mřížku)** | **172** | **46 %** |

Necelá polovina odsazení v appce tedy vůbec nesedí na žádnou mřížku. Nejčastější "off-grid" hodnota je **`10px`, použitá 43×** (např. `App.css:1031,1108,1181,1237,1334...` — `padding: 10px 20px` na tlačítkách vedle `padding: 8px 16px` na jiných). Dál se opakuje `6px` (20×), `5px` (13×), `15px` (11×), `14px` (9×) a hrstka podivných desetinných hodnot jako `14.4px`, `9.6px`, `19.2px`, `12.8px`, `10.4px`, `20.8px` — ty typicky vznikají z `em`/`rem` násobků, které nikdo nezaokrouhlil na grid (např. `0.9rem` padding vynásobený něčím).

**Token systém přitom existuje** (`--space-1: 4px` … `--space-16: 64px`, viz P0-3 v předchozí sekci) — jenže se z 251 spacing deklarací použije jen **30** (12 %). Zbytek je psaný natvrdo, mimo token i mimo mřížku.

**Proč to vadí:** Přesně to, co pattern *Grid System* / *Design Tokens* popisuje — 8px mřížka dělá layout "hustý a technický" nebo "vyvážený a čistý" podle zvolené jednotky, ale jen pokud se drží důsledně. Směs `8px`, `10px`, `6px`, `14.4px` vedle sebe je to, co podvědomě čtenář vnímá jako "neladí to", i když neumí říct proč.

**Fix:**
1. Nahradit nejčastější "odpadní" hodnoty za nejbližší tokeny: `10px → 8px (--space-2)` nebo `12px (--space-3)` podle kontextu, `6px → 4px (--space-1)` nebo `8px`, `15px → 16px (--space-4)`, `14px → 12px` nebo `16px`.
2. Zakázat v code review/lint pravidle (Stylelint `declaration-property-value-allowed-list` nebo obdoba) syrové `px`/`rem` hodnoty v `padding`/`margin`/`gap` mimo `var(--space-*)`.
3. Decimální hodnoty (14.4px, 9.6px…) typicky vznikají z `em` počítaného relativně k jinému `font-size` — dohledat zdroj a přepsat na pevnou `px`/`rem` hodnotu z token škály.

---

## 🟢 P3 — Golden ratio (1.618): není použit, ale není to nutně chyba

**Nález:** Aktuální spacing škála (`--space-1` … `--space-16`) je **lineární 4pt systém** (4, 8, 12, 16, 20, 24, 32, 40, 48, 64), ne geometrická řada odvozená ze zlatého řezu (8 → 13 → 21 → 34 → 55). To je legitimní, běžně používaný přístup (Material Design, Tailwind) — golden ratio je jedna z několika platných voleb, ne povinnost.

Dva místa, kde by se poměr 62/38 dal využít, ale aktuálně nejsou takto navržená:

- **`.ml-sector-layout`** (`App.css:3374-3387`) — dvoupanelový layout `grid-template-columns: 340px 1fr`. Při typické šířce obsahu (~1400px kontejner) vychází poměr postranního panelu k obsahu cca **25 : 75**, při zúžení na 1100px cca **28 : 72** — užší, než doporučuje golden-ratio split (38:62). Není to špatně, ale je to náhodné číslo (340px), ne odvozené z žádného poměru.
- **`.service-notes-timeline-layout`** (`App.css:2762-2767`) — podobně `minmax(290px, 360px) minmax(0, 1fr)`, opět fixní pixelová šířka bez vztahu k celkové šířce kontejneru.

**Typová škála** (viz sekce Typografie výše) golden ratio také nevyužívá — a vzhledem k tomu, že tam chybí *jakákoliv* škála, by právě zavedení poměru 1.618 (16 → 26 → 42 → 68px) byla jedna z nejrychlejších cest, jak z 32 nahodilých velikostí udělat systém s viditelnou hierarchií.

### Detailní pohled: proporce `MachineCard`

Rozebral jsem konkrétní rozměry karty stroje (`App.css:2367-2463`, `components/MachineCard.jsx`):

| Prvek | Rozměr | Poměr | Golden ratio (1.618:1)? |
|---|---|---|---|
| Celá karta (grid `minmax(340px,1fr)`, `min-height: 360px`) | 340 × 360 px | **1.06 : 1** (skoro čtverec) | Ne — a to je v pořádku, viz níže |
| Vnitřní split graf/poznámka (`.machine-card-pro-main`, `grid-template-rows: minmax(124px,1fr) minmax(86px,auto)`) | 124 × 86 px | **1.44 : 1** | Blízko, ale ne přesně |
| Tlačítka akcí (3× `.compact-btn-pro`) | rovnoměrný `repeat(3, 1fr)`, `min-height: 44px`, `gap: 7px` | 1:1:1 | n/a — správně rovnoměrné, akce mají mít stejnou váhu |

**Vnější rozměr karty (skoro čtverec) je správně** — golden ratio na obrys karty v gridové dlaždicové mřížce (`repeat(auto-fill, minmax(340px, 1fr))`) by ve skutečnosti škodilo: elongovaný obdélník 1.618:1 by v gridu s více sloupci dělal buď zbytečně vysoké karty, nebo velké mezery. U kartiček určených k dlaždicování (ne u hero/marketing karty) je čtvercový/téměř čtvercový poměr žádoucí — tohle není chyba k opravě.

**Kde by golden ratio reálně pomohl:** vnitřní rozdělení `graph : note` je 124:86 = 1.44:1 — dost blízko zlatému řezu na to, aby šlo o *skoro trefu*, ale ne dost přesně na to, aby to vypadalo záměrně. Kdyby graf dostal o něco víc prostoru (`minmax(140px, 1fr)` místo `124px`, tj. `86 × 1.618 ≈ 139`, zaokrouhleno na 4px grid), poměr by byl téměř přesně 1.628:1 — graf (primární, vizuálně nejdůležitější obsah karty) by dostal jasně větší, ne jen "trochu větší" podíl prostoru než textová poznámka. Drobná úprava, ale přesně to, o čem mluví pattern *Golden Ratio*: "one layout looks cheap, the other expensive — the difference is 1.618".

**Vedlejší nález propojený s dřívější sekcí Spacing:** padding karty `0.9rem` (= 14.4px) a `gap: 0.62rem` (= 9.92px) v `.machine-card-pro-main` jsou přesně ty "rozbité" desetinné hodnoty z P1 sekce výše — vznikají z `rem` zápisu, který nesedí na 4/8px mřížku. Mezera mezi tlačítky akcí (`gap: 7px`) má stejný problém — nejbližší grid hodnota je `8px`.

**Fix (kosmetický, ne kritický):**
```css
.machine-card-pro-main {
  grid-template-rows: minmax(140px, 1fr) minmax(86px, auto); /* ~1.628 : 1, zaokrouhleno na 4px grid */
  gap: var(--space-2); /* 8px místo 0.62rem */
}
.machine-card-pro {
  padding: var(--space-4); /* 16px místo 0.9rem/14.4px */
}
.machine-card-pro-actions {
  gap: var(--space-2); /* 8px místo 7px */
}
```

- Pokud chcete vizuálně "prémiovější" dojem u dvoupanelových layoutů, nahraďte fixní `340px`/`290-360px` za `minmax()` odvozené z `%` (např. `38% 1fr` nebo `clamp(320px, 38%, 420px) 1fr`), aby se poměr choval konzistentně napříč šířkami obrazovky místo skoku přes media query.
- Typovou škálu (viz P1 výše) lze postavit buď na lineárním 4pt vzoru (konzistentní s dnešním spacingem) **nebo** na 1.618 progresi — obojí je v pořádku, hlavní je zvolit jedno a použít ho všude. Vzhledem k tomu, že zbytek systému (spacing) je lineární, doporučuji zůstat u lineární/škálovatelné soustavy i pro typografii kvůli konzistenci celého systému, golden ratio nechat jako volitelné pro marketingové/landing stránky, ne pro datově hustý dashboard.

---

## 🟠 P1 — Grid System: stránka nemá sdílenou mřížku, jen jeden max-width kontejner

Prostudoval jsem pattern *Grid System* (12sloupcová mřížka, poměry sloupců 4:8/6:6/3:9, gutter jako nástroj nálady, sdílené hrany sloupců = "polished vs. amateur", responzivní ubírání sloupců 12→6→4→1) a porovnal ho s tím, jak je postavený celkový layout stránky.

**Co je na nejvyšší úrovni v pořádku:** `.app-container` i `.main-content` mají shodně `max-width: 1400px` a `margin: 0 auto` (`App.css:81-88, 219-225`) — obsah je konzistentně vystředěný a stejně široký napříč celou appkou. Dobrý, stabilní rám.

**Problém je uvnitř tohoto rámu — žádná sdílená mřížka, jen samostatné, nekoordinované grid/flex layouty na úrovni jednotlivých stránek:**

**1. "Postranní panel" má na čtyřech místech čtyři různé šířky:**

| Kde | Šířka postranního panelu |
|---|---|
| `.ml-sector-layout` (`App.css:3377`) | `340px` |
| `.ml-sector-layout` @1100px (`App.css:3384`) | `300px` |
| `.service-notes-timeline-layout` (`App.css:2764`) | `minmax(290px, 360px)` |
| `.dashboard-pro-grid` / `.machine-card-pro` min. šířka karty (`App.css:2347`) | `340px` |

Žádná z těchto hodnot není odvozená od společné mřížky — jsou to čtyři nezávisle "od oka" zvolená čísla, která se náhodou pohybují ve stejném řádu velikosti (290–360px), ale nesdílí jednu hranu. Přesně to pattern označuje jako rozdíl mezi "polished" a "amateur": *"Alignment is what separates polished from amateur: elements snapped to shared column edges instantly read as designed."*

**2. Gutter (mezera mezi hlavními bloky) se mění bez zjevného systému:**

| Kde | Gutter |
|---|---|
| Karetní mřížky (Dashboard, Machines) | `var(--space-5)` = **20px** (token) |
| `.ml-sector-layout`, `.service-notes-timeline-layout` | `2rem` = **32px** (natvrdo, ne token) |
| Jiné dvoupanelové bloky | `1.5rem` = **24px** (natvrdo, ne token) |

Pattern říká, že gutter má nést záměr (8px = husté/technické, 24px = vyvážené, 40px = editoriální) — tady se ale 20/24/32px střídají bez viditelného pravidla, navíc dva z nich obcházejí token systém úplně (`2rem`/`1.5rem` místo `var(--space-8)`/`var(--space-6)`).

**3. Osm různých breakpointů bez sdílené škály:**
```
640px, 680px, 900px, 901px(min), 960px, 1100px, 1200px, 1360px
```
Pattern doporučuje responzivní **ubírání sloupců na sdílených zlomech** (12 → 6 → 4 → 1, typicky 2-4 pevné breakpointy). Tady má skoro každá komponenta svůj vlastní bod zlomu — `900px` i `960px` dělají prakticky totéž o 60px jinde, `1100px` a `1200px` podobně. Žádná stránka se nezlomí "na stejném místě" jako jiná, takže při zmenšování okna přeskupují bloky nekoordinovaně, každý jindy.

**Proč to vadí prakticky:** Tři různé sidebar šířky a tři gutter hodnoty samy o sobě nejsou vidět jako "bug" — ale jsou to přesně ty drobnosti, díky kterým appka podvědomě působí jako poskládaná z více samostatně dělaných obrazovek místo jednoho konzistentního systému, i když barvy a komponenty vypadají stejně.

**Fix:**
1. Zavést 2-3 sdílené breakpointy jako proměnné/SCSS-like konstanty (viz konkrétní návrh níže) a přemapovat všech 8 dnešních hodnot na nejbližší z nich.
2. Sjednotit šířku "postranního panelu" na jednu hodnotu, ideálně token (`--sidebar-width: 320px` nebo derivovanou z `%`/`clamp()`, viz doporučení u Golden Ratio výše) a použít ji ve `ml-sector-layout`, `service-notes-timeline-layout` i kdekoliv dalším podobném layoutu.
3. Gutter mezi hlavními bloky stránky sjednotit na `var(--space-6)` (24px) jako výchozí "balanced" hodnotu a `var(--space-8)` (32px) rezervovat jen pro skutečně velké sekční předěly — ne měnit nahodile mezi `1.5rem`/`2rem`.
4. Zvážit explicitní 12-sloupcovou utilitu (`--col-1` … `--col-12` jako `%` nebo CSS Grid `grid-template-columns: repeat(12, 1fr)` na úrovni `.main-content`) pro budoucí layouty, aby nové stránky měly z čeho vycházet místo vymýšlení vlastního čísla pokaždé znovu.

### Návrh sjednocených breakpointů (PC / notebook / tablet / mobil)

Z 8 dnešních hodnot dvě jasně dominují — **900px** (použito 4×) a **640px** (použito 3×) — to jsou reálné, organicky vzniklé "přirozené" zlomy appky. Zbytek (680, 960, 1100, 1200, 1360) jsou jednorázové odchylky, které patří k jednomu z těchto dvou, nebo tvoří třetí, chybějící mezistupeň mezi tabletem a plným desktopem (1400px kontejner).

| Zařízení | Šířka viewportu | Token | Sloupce (12→) | Poznámka k appce |
|---|---|---|---|---|
| **Mobil** | do 639px | `--bp-mobile: 640px` (max-width) | 1 | Nahrazuje dnešní `640px` (beze změny) i `680px` (posunout sem) |
| **Tablet** | 640–899px | `--bp-tablet: 900px` (max-width) | 4 | Nahrazuje dnešní `900px` (beze změny) i `960px` (posunout sem) |
| **Notebook / malý desktop** | 900–1199px | `--bp-laptop: 1200px` (max-width) | 6 | Nahrazuje `1100px` i `1200px` — sem patří sidebar-splity jako `.ml-sector-layout`, které dnes lámou zvlášť na 1100 |
| **PC / plný desktop** | 1200px+ | *(bez horního limitu — appka je stejně capnutá na `max-width: 1400px`)* | 12 | Nahrazuje dnešní `1360px`; nad `1400px` se stejně nic dál neroztahuje, takže čtvrtý breakpoint navíc není potřeba |

Prakticky jako CSS proměnné (media queries proměnné číst neumí přímo, ale dá se to udělat přes Sass/PostCSS custom media, nebo aspoň jako komentovaná konvence, kterou všichni dodržují):

```css
/* Sdílené breakpointy appky — nepřidávat nové hodnoty mimo tuto čtveřici */
@custom-media --mobile  (max-width: 639px);
@custom-media --tablet  (max-width: 899px);
@custom-media --laptop  (max-width: 1199px);
/* PC/desktop = default, žádný max-width media query potřeba */
```

Pokud PostCSS custom media není v buildu k dispozici, stačí i obyčejný komentář nad `:root` s tímhle přehledem a "code review pravidlo" — nový `@media (max-width: XYZpx)` mimo tuto čtveřici se v review vrací zpět.

---

## 🟠 P1 — Proximity: mezera mezi sekcemi karty je menší než mezera uvnitř sekce

**Nález:** Karta stroje je svisle poskládaná z 4 zón — **Header** (název, typ, ID, status badge) → **AI Diagnostics banner** (`AiStatusBanner.jsx`) → **Main** (graf + servisní poznámka) → **Actions** (3 tlačítka). Změřil jsem mezery mezi nimi (`.machine-card-pro` je flex-column bez `gap`, takže mezery dělají jen okrajové `margin` jednotlivých bloků — u flexboxu se marginy nekolapsují, sčítají se):

| Přechod | Kde v kódu | Mezera |
|---|---|---|
| Header → AI banner | `.machine-card-pro-header { margin-bottom: 0.45rem }` (7.2px) + `.ai-banner { margin: 8px 0 4px }` (8px top) | **15.2px** |
| AI banner → Main (graf/poznámka) | `.ai-banner { margin: 8px 0 4px }` (4px bottom) + `.machine-card-pro-body` (bez marginu) | **4px** |
| Graf → Poznámka (uvnitř Main) | `.machine-card-pro-main { gap: 0.62rem }` | 9.92px |
| Main → Actions (uvnitř Body) | `.machine-card-pro-body { gap: 0.7rem }` | 11.2px |

**Proč to vadí:** Pattern *Proximity Rule* říká přesně jednu věc — mezera **uvnitř** skupiny má být menší než mezera **mezi** skupinami, jinak se hierarchie ztrácí. Tady je to obráceně: přechod mezi dvěma jasně odlišnými bloky (AI verdikt vs. grafová/poznámková sekce) má **jen 4px** — méně, než kolik je mezera mezi grafem a poznámkou (9.92px), které spolu logicky patří blíž k sobě víc než AI banner k celému zbytku karty. AI banner tak opticky "lepí" na graf, zatímco od hlavičky karty (se kterou souvisí stejně málo/hodně) je odsazený 4× víc. Uživatel to nejspíš nepojmenuje, ale bude to vnímat jako "graf a poznámka se přelévají do AI pásku", ne jako tři oddělené, srovnatelně důležité zóny.

**Fix:**
```css
.ai-banner {
  margin: 8px 0 8px; /* symetrické, ne 8px/4px */
}
/* nebo lépe: zrušit vlastní margin na .ai-banner a nechat mezery řídit obalující flex/grid gap na .machine-card-pro, konzistentně se zbytkem karty */
```
Ideálně sjednotit celou svislou skladbu karty na jeden `gap` (na `.machine-card-pro` jako flex `gap: var(--space-3)` např.) a zrušit ruční `margin` na jednotlivých blocích — dnes se prolínají 3 různé mechanismy zároveň (margin na headeru, margin na banneru, gap na body) a výsledek je nekonzistentní čistě náhodou.

---

## 🟠 P1 — AI diagnostika: "vše v pořádku" text má nejnižší kontrast ze všech stavů

**Nález (změřeno):** Barvy hodnot v AI banneru (`ai-metric-value--good/bad/rul`) na pozadí banneru `#F8FAFC`:

| Stav | Barva | Kontrast | WCAG (4.5:1 pro běžný text ~13px) |
|---|---|---|---|
| **Good/Healthy** (`--good`) | `#059669` | **3.6:1** | ❌ FAIL |
| Bad/Fault (`--bad`) | `#DC2626` | 4.62:1 | ✅ OK |
| RUL estimate (`--rul`) | `#2563EB` | 4.94:1 | ✅ OK |
| Timestamp (`.ai-banner-timestamp`) | `#9CA3AF` | 2.43:1 | ❌ FAIL (stejný token jako v P0-2 výše) |

**Proč to vadí:** Ironický detail — právě text, který operátor uvidí nejčastěji (stroj běží v pořádku, žádná anomálie), je ten nejhůř čitelný ze všech tří stavů. Poruchové a varovné stavy jsou čitelné dobře (je fajn, že tam nezůstal problém tam, kde by nejvíc bolel), ale "všechno OK" by mělo být čitelné přinejmenším stejně jistě, aby operátor nemusel tušit, jestli mu obrazovka říká "healthy" nebo se jen špatně načetla.

**Fix:** Ztmavit `--good` na něco jako `#047857` nebo `#046C4E` (dá se ověřit rychlým přepočtem kontrastu) — vizuálně pořád zelená, ale nad 4.5:1.

**Vedlejší poznámka — chybí druhý signál i tady:** stejně jako u status teček na Dashboardu (viz níže) nese Anomaly/Fault/RUL stav v AI banneru informaci čistě barvou textu (zelená/červená), žádná ikona vedle. U bezpečnostně relevantních dat (vibrodiagnostika stroje) by i tady stálo za zvážení přidat malou ikonku (✓/⚠) vedle textu.

**Co je naopak uděláno dobře:** primární tlačítko `AI Analysis` (`.compact-btn-pro--primary`) má plnou oranžovou výplň a bílý text, zatímco `History` a `Trend` zůstávají neutrální outline tlačítka — přesně podle *Visual Hierarchy* ("jedna barva pro jednu hlavní akci"). Nerozbíjet při refaktoru.

---

## 🟠 P1 — Tab systém (`MachineDetail.jsx`): funguje, ale chybí polovina systému

Prostudoval jsem pattern *Tabs System* (sliding indikátor, horizontální scroll místo zalomení, klávesnicová ovladatelnost šipkami, focus ring ≠ barva aktivního stavu, fade přechod obsahu, mobil jako segmented control/bottom sheet) a porovnal s 6taby na `MachineDetail.jsx` (`Charts`, `AI Analysis`, `Maintenance Log`, `History`, `Sensors`, `Settings` — `App.css:1457-1534`).

| Pravidlo z patternu | Stav v appce |
|---|---|
| Aktivní indikátor se sune, netáhá | ⚠️ Částečně — `.tab-btn` má `transition: background 0.12s`, takže přechod je měkký, ale jde o segmented-control styl (každý tab = vlastní "pilulka" s stínem), ne posuvný pruh. Není to teleport, ale ani "slide" ve smyslu patternu. Nízké riziko. |
| Přetečení: horizontální scroll, ne zalomení | ✅ `.tabs-header { overflow-x: auto }` — scrolluje, nezalamuje. ⚠️ Ale chybí **edge fade** (náznak, že je něco mimo obrazovku) a **scrollbar je schovaný** (`scrollbar-width: none`) — při 6 tabech na užší obrazovce může uživatel nevědět, že "Settings" existuje, protože nic nenaznačuje, že lze scrollovat dál. |
| Klávesnice: šipky mezi taby, Home/End, Tab pryč ze skupiny | ❌ Žádné — `.tab-btn` jsou obyčejná `<button>` bez `onKeyDown`, bez `role="tablist"`/`role="tab"`/`aria-selected`/`role="tabpanel"`. Pro screen reader to nejsou taby, jen řada tlačítek. Tab klávesa prochází všech 6 tlačítek jednotlivě místo šipek uvnitř skupiny + jednoho Tab-stopu ven. |
| Focus ring ≠ barva aktivního stavu | ✅ Nekoliduje — aktivní tab je bílý/šedý stín (nebo oranžový jen u `--priority` AI Analysis tabu), globální focus ring je neutrální šedá `#94A3B8`. ⚠️ **Ale** právě tahle barva focus ringu (`App.css:1717-1725`, platí globálně na **všechna** tlačítka/odkazy/inputy v appce) má kontrast jen **2.56:1** vůči bílému pozadí — stejná barva, kterou jsme flagli u textu v P0-2, tady navíc padá pod **3:1 limit pro non-text/focus indikátory (WCAG 2.4.11)**. Tohle je závažnější než původní nález, protože se týká viditelnosti klávesnicového fokusu úplně všude v appce, ne jen textu. |
| Obsah se nepřepíná natvrdo — fade out, pauza, fade in, srovnané výšky | ❌ `{activeTab === 'x' && (...)}` — čistý podmíněný render, žádná animace, žádné srovnání výšek. `.tab-content` má jen `min-height: 400px` jako podlahu, ne strop — přepnutí z krátkého tabu (Settings) na dlouhý (History = celá datová tabulka) udělá viditelný skok layoutu. |
| Mobil ≠ zmenšený desktop (segmented control ≤5 tabů, bottom sheet >5) | ❌ Appka má **6 tabů** (nad hranicí z patternu) a na mobilu se používá **úplně stejná horizontálně scrollovací lišta** — žádný media query pro `.tabs-header`/`.tab-btn` nikde v kódu. Přesně to, co pattern zakazuje: "never reuse the desktop tab bar shrunk down on mobile." |

**Shrnutí:** Vizuálně tab systém působí v pořádku (hover, aktivní stav, horizontální scroll fungují), ale ze 6 klíčových pravidel patternu appka čistě splňuje jen 2, další 2 splňuje částečně a 2 nesplňuje vůbec — hlavně klávesnicová přístupnost a mobilní chování úplně chybí.

**Fix (podle priority):**
1. **Focus ring kontrast** (souvisí s P0-2) — ztmavit `#94A3B8` na `--neutral-gray` (`#6B7280`, 4.83:1) v `App.css:1717-1725`. Tohle opraví focus viditelnost všude v appce najednou, ne jen na tabech.
2. **ARIA tab pattern** — přidat `role="tablist"` na `.tabs-header`, `role="tab"` + `aria-selected={activeTab==='x'}` + `id`/`aria-controls` na každý `.tab-btn`, `role="tabpanel"` + `aria-labelledby` na `.tab-content`. Přidat `onKeyDown` handler na `.tabs-header` pro šipky/Home/End (standardní vzor, dá se najít jako "ARIA APG tabs pattern").
3. **Edge fade** na `.tabs-header` — `mask-image: linear-gradient(to right, black calc(100% - 24px), transparent)` (nebo pseudo-element gradient overlay) když je obsah scrollovatelný.
4. **Fade přechod obsahu** — jednoduchý CSS `transition: opacity` s `key`-based remountem v Reactu, nebo aspoň `opacity`/`transform` přechod přes `useState` + `setTimeout` ~80ms mezi zmizením a objevením.
5. **Mobil nad 5 tabů** — na `max-width: 640px` přepnout `Maintenance Log`/`Sensors`/`Settings` (méně používané) do menu/bottom sheet a nechat na hlavní liště jen 3-4 nejpoužívanější (Charts, AI Analysis, History), nebo implementovat plnohodnotný bottom sheet pro všech 6.

---

## 🟡 P2 — Střední priorita / ke zvážení

### 7. Tři různé monospace font stacky pro podobný obsah
**Nález:** Vedle `'DM Mono'` (řádky 2361, 2718, 3067 — správně natažený font) se na jiných místech pro číselná/technická data používá `'Monaco', 'Menlo', monospace` (řádek 3748) a `Consolas, 'Courier New', monospace` (řádek 3123) — fonty, které nejsou nikde importované, takže spadají na systémový fallback. Vizuálně tak podobná data (např. hodnoty senzorů vs. ID záznamů) mohou používat jinak vyhlížející monospace font podle prohlížeče/OS uživatele.
**Fix:** Sjednotit na jeden token, např. `--font-mono: 'DM Mono', ui-monospace, monospace;`, a použít všude, kde se dnes objevuje `Consolas`/`Monaco`/`Menlo`.

### 8. Desktopová navigace jako horní lišta, ne sidebar
**Nález:** `App.jsx` — 5 hlavních položek (Dashboard, Machines, Sensors, AI Models, Team) je v horizontální liště pod headerem, na mobilu se sbaluje do hamburgeru (`nav-toggle`), na desktopu zůstává vždy vidět.

**Poznámka:** Tohle **není chyba** — hamburger je použit jen na mobilu, což pattern *Navigation Patterns* schvaluje. Pattern nicméně doporučuje pro desktop s 5+ hierarchickými sekcemi spíš **persistentní sidebar** než horní lištu — hlavně pokud časem přibudou další sekce nebo pod-navigace (např. u "AI Models" nebo "Machines" bude potřeba druhá úroveň). Za současného počtu položek je horní lišta v pořádku; zmiňuji jako věc ke zvážení při růstu aplikace, ne jako bug.

### 9. Chybí druhý vizuální signál u barevných stavů (OK/Warning/Fault)
**Nález:** `Dashboard.jsx` status dots (`status-stat-dot--ok/warning/fault`) nesou informaci čistě barvou (zelená/žlutá/červená tečka).

**Fix:** Vzhledem k tomu, že jde o **průmyslový monitoring** (bezpečnostně relevantní data), stojí za zvážení přidat i tvar/ikonu vedle barvy (např. ✓ / ! / ✕ uvnitř tečky), ne jen spoléhat na barvocit — přesně podle pravidla "never encode meaning with color alone" z *Color Accessibility*.

---

## ✅ Co už je uděláno dobře (nerozbíjet při refaktoru)

- **Fonty jsou self-hosted přes `@fontsource`** (Inter + DM Mono, správně importované v `main.jsx`) — žádná závislost na Google Fonts, žádný FOUC.
- **Design tokeny existují** a spacing scale (4pt) je konzistentní — jde jen o důslednost použití, ne o chybějící systém.
- **`:focus-visible`** je globálně nastaven (`App.css:1717`) a touch targety mají `min-height/width: 44px` (`App.css:2081-2084`) — accessibility základ je promyšlený.
- **Tabulka měření** (`MeasurementsHistory.jsx`) má `position: sticky` header, `text-align: right` pro čísla a `font-variant-numeric: tabular-nums` — přesně podle *Data Table* patternu.
- **Login formulář** má `aria-describedby`, `role="alert"` na chybě, `aria-busy` na loading stavu tlačítka — solidní implementace *Form Field States*.
- **Error states s Retry** na Dashboardu (`handleRetry`) odpovídají patternu *Error States*.
- **Empty states mají ilustrace + kontextový text** (byť bez CTA, viz bod 6) — struktura je správná, jen dotáhnout.

---

## Doporučené pořadí prací

1. Nahradit `alert()`/`window.confirm()` jednotným toast/modal systémem (P0-1) — dopadá na celou appku a je to nejviditelnější problém navenek.
2. Projet a opravit kontrast tlumeného textu (P0-2) **a globální focus ring** (`#94A3B8` → `#6B7280`, `App.css:1717`) — stejná barva, jedna oprava řeší obojí najednou a zlepší klávesnicovou přístupnost v celé appce.
3. Sjednotit barvy na tokeny + opravit červený focus ring bug (P0-3).
4. Skeleton na Dashboardu (P1-4) a CTA v empty state (P1-6) — rychlé, viditelné vylepšení.
5. Zavést typografickou škálu a opravit `.machine-card-pro-graph-label` (P1, sekce Typografie) — souvisí s bodem 2, řeší se prakticky ve stejném refaktoru.
6. Sjednotit spacing na 8px/4px mřížku — hromadný find/replace nejčastějších "odpadních" hodnot (10px, 6px, 15px) na tokeny (P1, sekce Spacing).
7. Sjednotit breakpointy, šířky postranních panelů a gutter hodnoty napříč stránkami (P1, sekce Grid System) — souvisí s bodem 6, jde ruku v ruce.
8. Opravit mezery mezi zónami karty (`.ai-banner` margin) a kontrast "good" stavu v AI banneru — obojí levné, vysoký dopad na to, jak karta "sedí" (P1, sekce Proximity/AI diagnostika).
9. Doplnit ARIA tab pattern a klávesnicovou navigaci na `MachineDetail.jsx` taby (P1, sekce Tab systém) — přístupnost, ne kosmetika.
10. Undo/soft-delete tam, kde dává smysl (P1-5) — vyžaduje změnu na backendu, plánovat samostatně.
11. Golden ratio u dvoupanelových layoutů a mobilní bottom-sheet pro taby — kosmetické/rozšiřující, dělat až po zbytku (P3).
