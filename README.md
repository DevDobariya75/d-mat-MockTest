<div align="center">

# 📝 dMAT Mock Test Platform

**Exam-realistic practice for the Core Module of the dMAT**
*(Digital Master Assessment Test — the general study aptitude test for international applicants to German Master's programmes)*

![Node](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/react-frontend-61DAFB?logo=react&logoColor=black)
![No Backend](https://img.shields.io/badge/backend-none%20(localStorage)-lightgrey)
![Questions](https://img.shields.io/badge/questions-600%20original-blue)
![Tests](https://img.shields.io/badge/tests-260%20passing-brightgreen)
![Status](https://img.shields.io/badge/status-unofficial%20practice%20tool-orange)

</div>

---

## 📖 Overview

**10 full-length mock tests**, each covering the three real dMAT subtests:

| # | Subtest | What you do |
|---|---------|--------------|
| 1️⃣ | **Figure Sequences** | Continue a series of 4 × 4 matrices — pick the 5th and 6th |
| 2️⃣ | **Mathematical Equations** | Solve a system of equations over the integers 1–20 |
| 3️⃣ | **Latin Squares** | Find the letter that belongs in the question-mark field of a 5 × 5 grid |

✨ All **600 questions are original** — generated from the rules in the official preparatory materials, with every single answer machine-verified. Nothing is copied from the source PDF.

🔌 **No backend.** The question bank ships with the app, and all your progress lives right in your browser's `localStorage`.

> ⚠️ **Unofficial practice tool.** Not affiliated with g.a.s.t. or the TestDaF-Institut.

---

## 🚀 Quick Start

```bash
npm install
npm run dev          # → http://localhost:5173
```

<table>
<tr><td><code>npm test</code></td><td>260 tests</td></tr>
<tr><td><code>npm run build</code></td><td>typecheck + production build into <code>dist/</code></td></tr>
<tr><td><code>npm run preview</code></td><td>serve the production build</td></tr>
</table>

> Requires **Node 20+**

---

## 📊 The Test — and What You'll Get

Each mock test runs **3 sections × 20 tasks — 60 tasks in 75 minutes**, with a hard **25-minute limit per section**.

The moment you submit (or the clock hits zero), you get a full result report:

- 🎯 **Total score** + a **section-wise breakdown**
- ✅❌ Counts of **correct / partial / incorrect / unanswered**
- 📈 Your overall **accuracy** and **time used**
- 🔍 A **task-by-task review** — your answer, the correct answer, and the full solution path for every question

Every result is saved locally, so past attempts stay one click away.

---

## 🎮 Modes Available While Solving

Every one of the 10 mock tests can be taken in either mode:

| | 🔒 Test Mode | 🛠️ Practice Mode |
|---|:---:|:---:|
| **Timer** | 25 min / section | none |
| **Fullscreen** | required | optional toggle |
| **Section order** | fixed, one at a time | any section, any time |
| **Leaving mid-section** | not possible | n/a |
| **Feedback** | after the whole test | immediately, per question |
| **Retries** | locked after submission | unlimited |

### 🔒 Test Mode — runs like the real exam
- Read the section's instructions & rules, then start the countdown.
- Optional live **camera preview** for extra realism — shown on screen only, never recorded or uploaded.
- **Fullscreen is required.** Leaving it (Escape, switching apps) **blurs the questions behind a gate** until you return — the timer keeps running, just like a supervised exam.
- Navigate with a **question palette** (answered / unanswered / marked for review / not visited), Previous/Next, or arrow keys.
- ✏️ **Mark for review** or **Clear response** on any task.
- A section can't be paused, restarted, or left early — submit by hand or let the timer auto-submit, then it's **locked for good**.
- Take as long as you like between sections.

### 🛠️ Practice Mode — built for learning
- No timer — jump between sections and tasks freely.
- Retry any task as many times as you like.
- Instant feedback the moment a task is finished — automatic for Figure Sequences & Latin Squares, via **Check answer**/Enter for Equations.
- 💡 **Show answer** reveals the solution path anytime, without counting as an attempt.
- 🔄 **Try again** clears your answer so you can redo the task.
- ✍️ Latin Squares gets an optional **pencil mode** for jotting candidate letters (the real exam allows no notes).
- Fullscreen is a simple on/off toggle — leaving it is never recorded.

---

## 📄 Licence & Attribution

Code in this repository is for practice use. The exam structure follows the official dMAT preparatory materials for test takers (© g.a.s.t., TestDaF-Institut, Bochum 2024), quoted in `docs/DMAT_EXAM_SPEC.md` only to document the rules implemented here. All questions in the bank are original.

---

<div align="center">

**Developed by Dev Dobariya**

</div>
