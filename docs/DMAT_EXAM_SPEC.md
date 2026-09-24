# dMAT Exam Specification

Everything in this document is extracted from **`dmat_general_questions.pdf`** —
"dMAT – Digital Master Assessment Test, Subject Module Data Science for the MSc Data
Science, Preparatory Materials for Test Takers" (g.a.s.t. / TestDaF-Institut, Bochum;
footer "as at: 21.04.2026"). Page references below point at that PDF.

Where the PDF is silent, the decision taken by this implementation is called out
explicitly under **Implementation decision**. `https://www.d-mat.de/en/` was used only
to cross-check the general framing; it added nothing beyond the PDF.

> The source PDF is a scan (32 image-only pages, no text layer), so it was read by
> rendering each page and transcribing it.

---

## 1. What the dMAT is

> "The digital Master Assessment Test (dMAT) is a new study aptitude test used for the
> admission of international applicants to Master's degree programmes in Germany."
> — p. 5

The exams are evaluated centrally at the TestDaF Institute in Bochum. The test is
standardised so that all participants can be compared with each other (p. 5).

## 2. Overall structure (p. 6)

The dMAT has **two parts**:

| Part | Content | Duration |
| --- | --- | --- |
| **Core Module** | General study aptitude — three subtests | 90 minutes |
| **Subject Module** | One subject-specific battery (Computer Science, Chemistry, Physics, Computer Sc., Electrical Eng., Mechanical Eng.) | 90 minutes |

Total exam time is about three hours, with a 30-minute break between the two parts.

The **Core Module** consists of exactly three subtests:

1. **Figure Sequences**
2. **Mathematical Equations**
3. **Latin Squares**

> "**Please note:** You may not take notes throughout the exam." — p. 6

This platform implements the **Core Module**, which is what the supplied PDF documents
in full. The Subject Module section of the PDF (announced in the table of contents at
page 34) is not present in the 32-page file.

### Timing, stated per subtest

| Subtest | Tasks | Time | Source |
| --- | --- | --- | --- |
| Figure Sequences | 20 series of matrices | 25 minutes | p. 8 |
| Mathematical Equations | 20 systems of equations | 25 minutes | p. 18 |
| Latin Squares | 20 tasks | 25 minutes | p. 25 |
| **Core Module total** | **60 tasks** | **75 minutes** | — |

All three subtests repeat the same closing instruction, in slightly different wording:

> "In the exam you have a total of **25 minutes** for **20** series of matrices. Please be
> as quick and accurate as possible. If you do not know an answer, please guess which
> answer might be correct. You are not allowed to take notes in the exam." — p. 8

Each task type is offered in the preparatory materials at **three difficulty levels —
low, medium and high** — with two exercises each (pp. 9, 19, 26).

---

## 3. Subtest 1 — Figure Sequences

### Task (p. 7)

> "In this task you will see a series of pictures (matrices). The figures in the matrices
> can change their **position**, **colour**, and/or **orientation** from one matrix to the
> next according to specific rules. It is your task to continue the series logically and
> to determine what the next two matrices look like."

### Format

- Each matrix is a **4 × 4 grid** (confirmed by measuring the rendered grids on pp. 7–12;
  the worked example on p. 7 speaks of "the four middle fields", which is the 2 × 2 centre
  of a 4 × 4 grid).
- **Four matrices are given**; matrices **5 and 6** are blank.
- The two blanks are labelled **"Image 1"** and **"Image 2"** (p. 13).
- Each blank offers **three response matrices**, labelled **"Matrix 1", "Matrix 2",
  "Matrix 3"** (p. 13).
- The solution key is given as, e.g., "Image 1: Matrix 3 / Image 2: Matrix 2" (p. 14).
- Low-difficulty series carry one figure; medium and high series carry several, each
  following its own independent rule (pp. 11–12, 15–16).

### Rules (pp. 7–8)

- Figures can change their colour.
- Figures can rotate around their own axis.
- Figures can move in the matrix. Vertical, horizontal and diagonal movements are
  allowed. Figures cannot change from one diagonal movement to another type of movement.
- Figures can also change their movement, colour or orientation **by x + 1**: "If a figure
  moves one step from matrix 1 to matrix 2, it moves 2 steps from matrix 2 to matrix 3,
  then 3 steps, etc."
- Figures cannot disappear or overlap.
- Figures cannot leave the matrix. At an outer boundary they can **either bounce off or
  move along the outer boundary**.

### Movement vocabulary observed in the solution keys (pp. 13–16)

| Rule | Example wording |
| --- | --- |
| Straight line with bounce | "moves vertically one field at a time in the second column and bounces off the upper or lower boundary" |
| Diagonal with path retrace | "moves one space diagonally upwards to the right … until it bounces off the upper boundary and returns to the starting position in the same way (diagonally downwards to the left)" |
| Along the outer border | "moves along the outer borders clockwise by two squares at a time" / "counter clockwise one space at a time" |
| Border movement, accelerating | "moves along the outer borders clockwise by x + 1 fields" |
| Fixed cycle of directions | "moves one field at a time … the order of the directions … is: left, up, right, down, and so on" |
| Centre cycle | "moves one field clockwise within the four middle fields" |
| Rotation | "rotates 90 degrees to the right from image to image" |
| Rotation, accelerating | "always turns x + 1 times to the right by 90 degrees" |
| Colour cycle | "changes its colour alternately from black to pink" / "from yellow to green to orange, etc." |

All of these are implemented in `src/lib/figureSequence.ts`.

---

## 4. Subtest 2 — Mathematical Equations

### Task (p. 17)

> "In this task, you are supposed to solve systems of equations in such a way that all
> requirements are met. One system of equations always consists of several single
> equations. Your task is to find out which numbers must be used for the unknowns
> (letters) in the equations so that all equations are correct."

### Format and constraints (p. 17)

- **There is always only one solution for each letter**, in which all requirements are met.
- **Each letter can be an integer between 1 and 20.**
- The answer is a value per letter; the solution key lists them as `A = 7`, `B = 10`, … (p. 21).
- Operators seen: `+`, `−`, `×`, `÷`, e.g. `3 × C = A`, `B ÷ 2 = A`, `18 − B = A`,
  `2 × A + 2 × C = B`, `A − B + C − D = 2`, `3 × C − 1 = B` (pp. 19–20).
- Literal constants may exceed 20 (`18 − B = A`, `13 − C = A`); only the **unknowns** are
  restricted to 1..20.

### Difficulty (pp. 19–20)

| Level | Shape of the system | Example |
| --- | --- | --- |
| low | 2 unknowns, 2 equations | `7 + A = 14`, `B − 3 = A` |
| medium | 3 unknowns, 3 equations | `3 × C = A`, `A + C = 8`, `2 × A + 2 × C = B` |
| high | 4 unknowns, 4 equations | `A − B + C − D = 2`, `10 × B = C`, `5 × B = A`, `11 + B = D` |

The solution keys always work by expressing the other unknowns through one pivot unknown
and substituting into the remaining equation (pp. 21–23).

---

## 5. Subtest 3 — Latin Squares

This is the "Sudoku-like" task type of the dMAT. It is **not** a classic Sudoku: there are
no 3 × 3 boxes, only the row and column constraints of a Latin square.

### Task (p. 24)

> "In this task you will see a 5x5 grid (a square containing 5 rows and 5 columns). Some
> fields of the grid contain letters. Each letter can only appear once in each row and each
> column. Only the letters that are shown as response options (the row next to the grid)
> can appear in the grid. Your task is to decide which letter belongs in the field with the
> question mark. Sometimes you need to fill in other fields in your mind before you can
> figure out what letter should replace the question mark."

### Format

- **5 × 5 grid**, letters **A, B, C, D, E**.
- Exactly **one field carries a red question mark**.
- The response options are always the five letters, shown in a column beside the grid (p. 24).
- The answer is a single letter; the key reads "Solution = C" (p. 29).
- Coordinates in the solution keys use **Greek column names α β γ δ ε** and **row numbers
  1–5**, e.g. "β4", "γ3" (p. 29).
- Solution keys are step-by-step deduction chains, e.g. (p. 32):
  > - "Only C can be inserted at position γ4."
  > - "In row 3, A and D are missing. At position γ3, only an A can be inserted because it
  >   is already present in column α. Consequently, only a D can be inserted at position α1."
  > - …
  > - "At the position of the question mark, D must be inserted, since all other letters are
  >   already present in column γ."

The worked example on p. 25 also shows the two-step case: first a different field must be
filled in ("you first need to fill in 'B' in the first row of the last column"), only then
can the question mark be resolved.

---

## 6. Marking

The PDF does **not** state a marking scheme. What it does state, in all three subtests:

> "If you do not know an answer, please guess which answer might be correct." — pp. 8, 25

**Implementation decision.** Because guessing is actively encouraged, there is no negative
marking:

| Rule | Value |
| --- | --- |
| Correct task | **1 point** |
| Wrong task | **0 points** |
| Unanswered task | **0 points** |
| Maximum per subtest | **20 points** |
| Maximum for the Core Module | **60 points** |

**Figure Sequences and partial credit.** One figure series asks for two matrices
("Image 1" and "Image 2") and the official key marks them separately. Its single point is
therefore split into two halves of **0.5** each. In the tallies such a task counts as:

- `correct` when both images are right,
- `partial` when exactly one is right (0.5 points),
- `incorrect` when neither is right,
- `unanswered` when neither image was chosen.

**Mathematical Equations** gives no partial credit: the PDF says "Any other solution is
wrong" (p. 17), so a system scores only when *every* unknown is right.

**Accuracy** is reported as `points earned ÷ tasks attempted`, and the percentage as
`points earned ÷ maximum points`.

---

## 7. Session rules implemented in Test Mode

Derived from the exam structure above:

| Rule | Source |
| --- | --- |
| Three subtests, fixed order: Figure Sequences → Mathematical Equations → Latin Squares | p. 6 |
| 20 tasks and 25 minutes per subtest, 60 tasks and 75 minutes in total | pp. 8, 18, 25 |
| Each subtest has its own countdown; it auto-submits at zero | pp. 8, 18, 25 |
| No notes and no helping tools | pp. 6, 9, 19, 26 |
| Short reminders only during the exam; the full instructions are preparation material | p. 4 |
| Guessing is preferable to leaving a task open | pp. 8, 25 |

**Implementation decisions** for the things the PDF does not spell out:

- **A started subtest cannot be left, paused or restarted.** The running screen has no
  navigation out of it, in-app navigation is blocked, and a reload is confirmed by the
  browser. This mirrors a supervised digital exam.
- **Unlimited time between subtests.** The PDF gives per-subtest times and a 30-minute
  break between the *two parts*, but says nothing about the gaps between subtests, so the
  platform lets the test taker take as long as they like before starting the next one.
- **A submitted subtest is locked** and cannot be retaken; only the whole attempt can be
  reset.
- **The clock is stored as an absolute end timestamp**, so refreshing, closing the tab or
  suspending the machine neither adds nor removes time. A deadline that passed while the
  app was closed auto-submits on the next load.
- **Fullscreen is required in Test Mode, optional in Practice Mode.** The PDF does not
  mention fullscreen — it only says the exam is taken digitally and that no notes or helping
  tools are allowed (pp. 4, 6). Running each subtest fullscreen is this platform's way of
  approximating those conditions: it removes the browser chrome and other tabs from view.
  Leaving fullscreen does not pause anything (the clock cannot stop mid-subtest), it hides
  the questions until the test taker returns, and the number of exits is recorded on the
  attempt and reported in the result. Practice Mode only offers it as a toggle, since
  practice is not a supervised sitting. A browser without a Fullscreen API runs the test
  windowed rather than refusing to run it.
- **Camera preview is optional and local only.** No dMAT proctoring requirement is stated
  in the PDF; the preview exists purely for exam realism, is never recorded, stored or
  uploaded, and declining it does not affect the test.
- **Pencil marks** for Latin Squares are offered in Practice Mode only, because the exam
  instructions forbid notes and helping tools.
- **Practice Mode reveals a solution only once the task is finished** — both images of a
  figure series, every unknown of a system — so answering one part never gives the rest
  away. Equation systems are committed explicitly (Check answer / Enter) because a value
  typed towards `18` passes through `1`, which would otherwise look complete and lock the
  field mid-number. Neither rule applies in Test Mode, where partial answers are simply
  kept and marked at the end.

---

## 8. Question generation

All 600 questions are original and generated from the rules above, never copied from the
PDF. Generation is deterministic (`seed = 20260421`, the PDF's "as at" date) and every
question is verified before it is committed:

| Subtest | How the answer is verified |
| --- | --- |
| Figure Sequences | The six matrices are produced by simulating each figure's rule; distractors are single-step perturbations of the correct matrix, checked to be distinct from it and from each other. |
| Mathematical Equations | The system is **re-solved by brute force over the whole 1..20 domain** and must have exactly one solution, which must equal the stored answer. The validator re-parses the *rendered* equation strings, independently of the generator. |
| Latin Squares | The clue grid must have exactly one completion (backtracking solver), exactly one letter must fit the question mark, and the question mark must be reachable by plain constraint propagation — so no task requires guessing. The recorded propagation steps become the solution path. |

### Uniqueness

No task repeats anywhere in the bank. Generation threads one shared set of canonical
signatures through all 600 questions and re-rolls any collision with a fresh seed. The
signature is deliberately weaker than byte-equality, so that near-repeats are caught too:

| Subtest | Canonical signature |
| --- | --- |
| Figure Sequences | the movement paths of the figures, ignoring shape and colour |
| Mathematical Equations | the set of equations, ignoring print order and variable names |
| Latin Squares | the clue grid and target field, ignoring which letters are used |

Without this, the low-difficulty figure series collided often — a single figure on a 4x4
grid has a small space of four-step paths, and 16 groups of tasks shared a path (one of them
five times over) while differing only in the glyph drawn.

### Difficulty mix

Each 20-task section is 6 low, 8 medium and 6 high, in that order, so every mock test is
18 / 24 / 18 and the bank totals 180 / 240 / 180. The level corresponds to a measurable
property in every subtest (figure count, number of unknowns, clue count), not just a label.

### Difficulty level (bank v3)

Figure Sequences and Latin Squares were made about **40% harder** in bank v3, measured on
the load a test taker has to carry. Question formats did not change, and every rule still
comes from the preparatory materials.

| Subtest | Load measure | v2 section total (mean of 10 tests) | v3 section total (every test) | Change |
| --- | --- | --- | --- | --- |
| Figure Sequences | rule components: one per figure, plus one per advanced movement (steps > 1, x + 1, direction cycle), rotation, x + 1 rotation and extra colour | 99.6 (range 86–116) | **139** | +40% |
| Latin Squares | deduction steps to the question mark | 110.7 (range 102–126) | **155** | +40% |

What changed per level:

| | low | medium | high |
| --- | --- | --- | --- |
| Figure rule load per task (v2 → v3) | 1.4 → 2.3 | 4.8 → 6.5 | 8.8 → 12.2 |
| Figures per matrix (v2 → v3 mean) | 1 → 1 | 2.4 → 2.6 | 3.3 → 3.6 |
| Latin clues (v2 → v3) | 15 → 13 | 12 → 11 | 10 → 9 |
| Latin deduction steps (v2 → v3) | 1–4 → 2–4 | 3–8 → 6–9 | 6–13 → 10–14 |

Each of the 20 slots in a section has a **fixed load target** (`FIGURE_LOAD_PLAN` in
`src/lib/figureSequence.ts`, `LATIN_STEP_PLAN` in `src/lib/latinSquare.ts`). As a result,
all ten mock tests are equally hard and still ramp from easy to hard. In v2 the load varied
by up to 35% from one test to the next. A low Latin square now always needs at least one
other field filled in before the question mark can be resolved.

### Mathematical Equations difficulty (bank v4)

Mathematical Equations became about **20% harder** in bank v4. The shape of a system did
not change: low, medium and high still have 2, 3 and 4 unknowns with as many equations,
and every unknown is still an integer from 1 to 20 with exactly one solution. What changed
is how much arithmetic each equation carries. More definitions take two operations
(`3 × C - 11 = B`) or combine two unknowns (`2 × A + C = B`). The pinning equation is more
often a signed sum over all unknowns or a weighted pair (`2 × A + B = 23`). Low systems
can be pinned by a two-step equation (`3 × A + 4 = 19`).

The load is measured per equation as its arithmetic operators plus the unknowns it links
(`equationLoad` in `src/lib/equations.ts`).

| | low | medium | high | Section total |
| --- | --- | --- | --- | --- |
| v2 (mean per task) | 5.7 | 11.0 | 15.6 | 215.7 (range 208–225) |
| v4 (mean per task) | 6.8 | 13.3 | 18.7 | **259** in every test (+20%) |

As in the other two subtests, `MATH_LOAD_PLAN` fixes the load of each of the 20 slots,
so all ten mock tests are equally hard.

See `src/lib/validateBank.ts`, `src/lib/signature.ts`, `npm run validate:bank`,
`npm run audit:bank`, `tests/questionBank.test.ts` and `tests/bankIntegrity.test.ts`.

---

## 9. Attribution

This platform is an unofficial practice tool and is not affiliated with g.a.s.t. or the
TestDaF-Institut. The source PDF is © g.a.s.t., TestDaF-Institut, Bochum 2024; its text is
quoted here only to document the exam rules the implementation follows.
