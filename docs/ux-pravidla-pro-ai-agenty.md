# UX pravidla pro AI agenty (na základě designmotionhq.com)

> Účel: vložit jako system/instrukční kontext AI agentovi (Claude Code, Copilot atd.), který generuje UI nové aplikace, aby stavěl produkčně vypadající, přístupné a promyšlené rozhraní místo generických defaultů.

---

## 1. Rychlost a vnímaná odezva (Doherty Threshold)

- Práh je **400 ms**: pod 200 ms = instantní pocit, 200–400 ms = tolerovatelné, nad 400 ms uživatel mentálně "vypne".
- Na každou interakci dej **vizuální odezvu do 400 ms** – i kdyby to byl jen skeleton nebo potvrzení.
- Optimalizuj **vnímanou** rychlost, ne jen reálnou – skutečná práce může trvat déle, pokud UI zareaguje hned.
- Pod ~300 ms nezobrazuj žádný loading indikátor – krátký záblesk skeletonu/spinneru působí rozbitěji než malé zpoždění.

## 2. Loading stavy – systém, ne jeden default

Vyber podle toho, co o čekání víš:
- **Skeleton** – znám tvar obsahu (karty, seznamy, články) a čekání > ~300 ms.
- **Spinner** – krátké čekání neznámé délky, < ~3 s (uložení tlačítkem, malý fetch). Nikdy na celou stránku.
- **Progress bar** – čekání > ~3 s, kde znám procenta (upload, export, instalace). Vždy s časem zbývajícím / rychlostí.
- **Optimistic UI** – pro reverzibilní, nízko-rizikové akce (like, uložit, přeřadit): UI se aktualizuje okamžitě, server se synchronizuje na pozadí, při chybě se stav vrátí (rollback). Nikdy pro platby a nevratné akce.

## 3. Formuláře

**Stavy pole (6, ne méně):** default, focus, error, success, disabled, loading – každý musí mít explicitní design.
- Label **nad polem**, helper text pod ním – nikdy jen jako placeholder (ten zmizí při psaní).
- Focus ring min. **3:1 kontrast**, viditelný na světlém i tmavém pozadí.
- Chyba = **barva + ikona + text zprávy** současně (samotná červená barva selže ~12 % uživatelů s poruchou barvocitu).
- Success potvrzuj **uvnitř pole** (ne toastem, který zmizí dřív, než si ho uživatel přečte).
- Disabled ≠ loading – disabled má šedý fill a "not-allowed" kurzor, loading má spinner v poli a blokuje vstup (proti double-submitu).

**Timing validace:**
- Validuj **on blur** (při opuštění pole) – ne při každém stisku klávesy (příliš brzy), ne až při submitu (příliš pozdě).
- Jakmile pole jednou chybovalo, přepni na **live validaci** – chyba zmizí okamžitě po opravě.
- Zobrazuj i **success stav** (zelená fajfka), ne jen chyby.

**Dlouhé formuláře → stepper wizard:**
- Rozděl podle **významu** (Osobní údaje / Doprava / Platba / Souhrn), ne podle počtu polí.
- Vždy ukaž progress (bar, tečky nebo popisky kroků).
- Validuj **uvnitř každého kroku** – blokuj tlačítko Další, dokud krok není validní.
- **Ukládej stav** mezi kroky – Zpět i refresh stránky nesmí smazat rozepsaná data.

**Upload souborů je systém stavů, ne jeden input:**
- Dropzone reaguje na drag-over (border, glow, změna textu) ještě před dropem.
- Ukazuj **procenta a odhad zbývajícího času**, ne jen spinner.
- Při chybě na 90 % nabídni **inline retry** bez nutnosti znovu vybírat soubor.
- Ukaž náhled/thumbnail, typ a velikost souboru jako potvrzení, že se nahrálo správně.
- Ve frontě více souborů má **každý svůj progress a retry** – jedno selhání neblokuje ostatní.

## 4. Chybové stavy a zotavení

- Typ chyby → odpovídající místo: validace pole = inline pod polem, výpadek spojení = banner/toast, kritická chyba/blokace = vlastní prostor (modal).
- Závažnost řídí formu: drobná chyba = inline, přechodná = toast, blokující = modal. Čím víc chyba přeruší uživatele, tím větší prostor smí zabrat (a naopak).
- **Každá chyba potřebuje východisko** – Retry, odkaz na podporu, rozbalitelné technické detaily. Nikdy jen "OK" bez akce.
- Piš **lidsky, konkrétně** – ne "Error 500 – An error occurred", ale co se stalo a co dál.
- Preferuj prevenci (inline validace) před reakcí na chybu po submitu.

## 5. Notifikace – 4 povrchy podle závažnosti

- **Toast** – nízká priorita, automaticky mizí, nabídni undo.
- **Banner** – degradovaná služba/varování, zůstává, dokud ho uživatel nezavře.
- **Modal** – blokující chyba (např. odmítnutá platba), vyžaduje akci.
- **Badge** – pasivní počítadlo, tiché, dokud se nevyřeší.
- Toasty se mohou vrstvit; **modaly nikdy** (blokující dialogy nad sebou = zmatek).
- Neeskaluj vše na nejhlasitější povrch – uživatelé se to naučí ignorovat.

## 6. Undo místo potvrzovacích dialogů

- **Undo > "Opravdu?" dialog** – potvrzovací dialog trestá všechny za chybu jednoho, undo netrestá nikoho.
- **Soft delete**: položka zmizí z obrazovky, ne z databáze (flag + koš 30 dní + pak trvalé smazání).
- Friction (např. přepsat název repa) si zaslouží jen skutečně **nevratné** akce.
- Ukazuj **odpočet** (ubíhající kruh/bar) na undo toastu.

## 7. Prázdné stavy (empty states)

- Nikdy neposílej holý "No data" text – malá ilustrace/ikona signalizuje, že je to záměr, ne chyba.
- 4 typy: první spuštění, žádné výsledky, chyba, vyfiltrováno – **každý má vlastní copy a CTA**.
- Vždy jedna jasná primární akce (např. "+ Nový projekt"), ne "Zkusit obnovit".
- Empty state je nejlepší onboarding moment – klidně ukaž "ghost" náhled toho, jak bude vypadat reálná položka.

## 8. Mikrocopy

- Popisky tlačítek pojmenuj podle **odměny**, ne mechaniky ("Vytvořit účet zdarma" místo "Odeslat").
- Chybu proměň v pomoc: "Tento e-mail je už zabraný – přihlásit se?" místo "Neplatný vstup".
- Piš, jak by mluvil kolega, ne systém ("operation failed" nikdy neříká nikdo naživo).

## 9. Navigace

- **Mobil = spodní taby** (3–5 hlavních destinací, vždy viditelné, na dosah palce). Skrytí do hamburgeru snižuje engagement ~40 %.
- **Desktop = trvalý sidebar** pro 5+ sekcí hierarchického obsahu – nesbalovat defaultně.
- **Hamburger jen jako sekundární navigace**, nikdy primární (na desktopu snižuje engagement až ~56 %).
- **Command palette (⌘K)** je akcelerátor pro power-users navíc k viditelné navigaci, ne náhrada.
- **Breadcrumbs** jen u hierarchie hlubší než 2 úrovně, jinak jsou to jen šum.

## 10. Focus states a klávesnicová přístupnost

- Nikdy `outline: none` bez náhrady – jinak jde o accessibility bug.
- Vlastní focus ring: **2px tloušťka, 2px offset**, dostatečný kontrast na světlém i tmavém pozadí.
- Použij `:focus-visible` – klik myší ring nezobrazí, Tab ano.
- Pořadí focusu = **DOM pořadí**, ne vizuální – při CSS reorderu sladit obojí.
- V modalu **trapni focus** (Tab cykluje uvnitř, wrap-around), Escape zavře a vrátí focus na spouštěcí prvek.
- Skip-link jako první focusovatelný prvek, viditelný jen při focusu.

## 11. Modaly, sheety, drawery, popovery – podle blokování

- Nejdřív otázka: **blokuje to uživatele?** Ano → modal. Ne → sheet/drawer/popover podle kontextu.
- **Modal** – full scrim, jedna kritická/destruktivní volba (např. "Smazat účet?").
- **Bottom sheet** – mobile-first default, drag handle, snap pointy, pozadí částečně vidět.
- **Drawer** – boční panel pro navigaci, dimuje jen svou oblast, app za ním žije dál.
- **Popover** – ukotvený k triggeru, malý (~200px), lehké menu/rychlé akce, nikdy blokující flow.
- Nesahej po modalu, když stačí popover – zbytečná friction u rutinní akce.

## 12. Vizuální hierarchie a design tokeny

- Primární prvek cca **2× větší** než běžný text.
- Barva jako měna: **neutrální UI + jeden akcent** pro jednu nejdůležitější akci. Více barev = šum.
- Kontrast odlišuje role (tučný nadpis vs. tlumený text; plné primární tlačítko vs. ghost sekundární).
- Whitespace je signál důležitosti, ne výplň – hlavní prvek má víc prostoru.
- Font weight buduje hierarchii bez měnění velikosti (800 nadpisy, 400 text, 300 popisky).
- **Design tokeny pojmenovávej podle role/významu**, ne hodnoty (`color-primary`, ne `color-blue-500`) – přežije to rebrand.
- Struktura tokenů: primitives → semantic → component, jedna změna primitivy se propíše všude.
- Vše naskoč na pevnou **spacing/font scale** – žádné náhodné 13px, 17px hodnoty.
- Dark mode = swap sady tokenů, ne prostá inverze barev.

## 13. Kontrast a barevná přístupnost (WCAG)

- Text na pozadí: min. **4.5:1** (běžný text), **3:1** (velký text/nadpisy).
- Nikdy nekóduj význam **jen barvou** – ~8 % uživatelů má poruchu barvocitu. Vždy druhý signál (ikona, šrafování, popisek).
- Zkontroluj i "dekorativní" šedé texty (nav odkazy, štítky karet) – často padají pod limit.

## 14. Datové tabulky

- Sort je **tri-state** (vzestupně → sestupně → původní pořadí), ne binární přepínač.
- Číselné sloupce **zarovnej doprava**, tabulkové (monospace-like) číslice pro srovnatelnost.
- **Sticky header** při vertikálním scrollu, **freeze první sloupec** při horizontálním.
- Hustotu řádků (36/48/60px) drž jako jeden token/přepínač, ne nahodile.
- Celý řádek je selection target (tint + accent bar + checkbox), ne jen malý checkbox.
- Select-all má 3 stavy: prázdný → indeterminate (pomlčka) → zaškrtnutý.

## 15. Command palette (⌘K)

- **Fuzzy matching** – "stg" musí najít "Settings", ne jen přesnou shodu.
- Výsledky seskup do sekcí (Recent, Actions, Pages).
- Plně ovladatelné klávesnicí (šipky, Enter, Esc).
- Neotvírej do prázdna – předvyplň recent/suggested příkazy.
- Async příkazy: inline spinner, paleta zůstává otevřená.

## 16. Grid systém a poměr zlatého řezu

- Web layout stav na **12-sloupcové mřížce** — dělí se čistě na poloviny, třetiny, čtvrtiny i šestiny.
- Poměry sloupců strukturují stránku: **4:8** (sidebar + obsah), **6:6** (rovný split), **3:9** (úzká nav + široké plátno).
- **Gutter (mezera mezi sloupci) určuje náladu**: 8px = husté a technické, 24px = vyvážené, 40px = editoriální/prémiové.
- Responzivně ubírej sloupce: 12 (desktop) → 6 (tablet) → 4 (velký mobil) → 1 (malý mobil).
- Mřížku nejdřív ustав, pak ji **vědomě poruš** (hero na celou šířku, pull quote do marginu) — bleed čte jako záměr jen tehdy, když předtím existoval řád.
- **Zlatý řez (1.618)**: spacing škála jako geometrická řada `8 → 13 → 21 → 34 → 55`, typová škála `16 → 26 → 42 → 68px`. Alternativa k lineární 4pt/8pt škále, ne povinnost — hlavní je zvolit jeden systém a použít ho všude.
- Rozdělení obrazovky na **62 % / 38 %** (hlavní obsah / vedlejší panel) čte jako přirozeně vyvážené; rozdělení na kulaté, ale nahodilé zlomky (25/75, pevné `340px`) čte jako náhoda.
- Zlatý řez nepoužívej rigidně proti obsahu nebo proti existující 8px mřížce — zaokrouhli výsledky na hodnoty, které mřížka unese.

## 17. Proximity (blízkost = příbuznost)

- Prvky **blízko sebe** čte oko jako jednu skupinu, prvky **daleko od sebe** jako oddělené — funguje to i bez rámečků a linek.
- Klíčový trik: mezera **uvnitř** skupiny musí být menší než mezera **mezi** skupinami. Stejná mezera všude = plochá hierarchie, uživatel musí louskat vše najednou.
- Ve formulářích: související pole u sebe (~12px), předěl mezi sekcemi široký (~40px) — "Osobní údaje" a "Platba" se opticky oddělí bez jediné linky.
- V toolbarech a navigaci seskupuj podle funkce (navigace / akce / systém), ne do jedné rovnoměrně rozestupované řady.
- Nejdřív zkus, jestli seskupení zvládne samotný whitespace — teprve pak sáhni po rámečku nebo oddělovači.

---

## Rychlý checklist pro AI agenta před dokončením UI featury

1. Má každá async akce vizuální odezvu do 400 ms?
2. Má formulářové pole všech 6 stavů (default/focus/error/success/disabled/loading)?
3. Validuje se on-blur, ne on-submit ani on-keystroke?
4. Má destruktivní akce undo (ne jen "Opravdu?" dialog), pokud to jde?
5. Má prázdný stav ilustraci, kontextovou zprávu a jednu jasnou CTA?
6. Odpovídá typ notifikace (toast/banner/modal/badge) závažnosti události?
7. Je navigace podle platformy (mobil = spodní taby, desktop = sidebar) a primární položky nejsou schované v hamburgeru?
8. Má focus ring viditelnou náhradu a je pořadí tabování logické?
9. Je zvolený overlay (modal/sheet/drawer/popover) úměrný tomu, jestli akce blokuje uživatele?
10. Prochází kontrast textu WCAG (4.5:1 / 3:1) a nese se význam i jinak než jen barvou?
11. Jsou barvy, mezery a typografie navázané na tokeny podle role, ne natvrdo zapsané hodnoty?
12. Sedí všechna odsazení (padding/margin/gap) na 4px/8px mřížku — žádné natvrdo psané 10px, 6px, 15px mimo token?
13. Je mezera uvnitř skupiny prvků menší než mezera mezi skupinami (proximity), takže hierarchie je čitelná i bez rámečků?

---
*Zdroj: designmotionhq.com – pattern library (feedback, forms, navigation, interaction, visual, content). Sestaveno na základě fetchnutých vzorů: Doherty Threshold, Loading States System, Optimistic UI, Form Field States, Form Validation Timing, Stepper Wizard, File Upload UX, Error States, Notification System, Undo UX, Empty States, Microcopy, Navigation Patterns, Focus States, Modal Hierarchy, Visual Hierarchy, Design Tokens, Color Accessibility, Data Table, Command Palette.*
