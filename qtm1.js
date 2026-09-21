    document.addEventListener("DOMContentLoaded", () => {
        let parsedQuestions = [];
        let currentQuestionIdx = 0;
        let timerInterval = null;
        let timeRemaining = totalQuizTime * 60;
        let timeSpent = 0;
        let isSubmitted = false;
        let isReviewMode = false;
        let hasShownIncompleteMessage = false;
        let currentStreak = 0;
        let maxStreak = 0;

        const startBtn = document.getElementById("start");
        const quizSection = document.querySelector(".quiz");
        const loader = document.getElementById("quiz-loader");
        const countdownEl = document.getElementById("countdown-number");
        const canvas = document.getElementById("confetti-canvas");
        const ctx = canvas.getContext("2d");

        const correctSound = new Audio("https://cdn.jsdelivr.net/gh/oneprt/sounds@main/correct.mp3");
        const incorrectSound = new Audio("https://cdn.jsdelivr.net/gh/oneprt/sounds@main/incorrect.mp3");

        function playCorrect() { correctSound.currentTime = 0; correctSound.play().catch(() => { }); }
        function playIncorrect() { incorrectSound.currentTime = 0; incorrectSound.play().catch(() => { }); }

        // ====================== MATHJAX ======================
        function typesetMath(el) {
            if (window.MathJax?.typesetPromise) {
                return MathJax.typesetPromise(el ? [el] : undefined).catch(() => { });
            }
            return new Promise(r => {
                const i = setInterval(() => {
                    if (window.MathJax?.typesetPromise) {
                        clearInterval(i);
                        MathJax.typesetPromise(el ? [el] : undefined).then(r).catch(r);
                    }
                }, 40);
            });
        }

        // ====================== CONFETTI ======================
        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        window.addEventListener("resize", resizeCanvas);
        resizeCanvas();

        function confetti(count = 80) {
            const particles = [];
            for (let i = 0; i < count; i++) {
                particles.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height - canvas.height,
                    r: Math.random() * 6 + 3,
                    d: Math.random() * count,
                    color: `hsl(${Math.random() * 360}, 90%, 60%)`,
                    tilt: Math.random() * 10 - 5,
                    tiltAngle: 0
                });
            }

            let frame = 0;
            function draw() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                particles.forEach((p, i) => {
                    ctx.beginPath();
                    ctx.lineWidth = p.r / 2;
                    ctx.strokeStyle = p.color;
                    ctx.moveTo(p.x + p.tilt + p.r, p.y);
                    ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r);
                    ctx.stroke();

                    p.tiltAngle += 0.1;
                    p.y += (Math.cos(p.d) + 2 + p.r / 2) / 2;
                    p.tilt = Math.sin(p.tiltAngle) * 12;

                    if (p.y > canvas.height) {
                        particles[i] = {
                            x: Math.random() * canvas.width,
                            y: -20,
                            r: p.r,
                            d: p.d,
                            color: p.color,
                            tilt: p.tilt,
                            tiltAngle: p.tiltAngle
                        };
                    }
                });
                frame++;
                if (frame < 140) requestAnimationFrame(draw);
                else ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
            draw();
        }

        // ====================== PARSE ======================
        function parseQuestionsData() {
            parsedQuestions = questions.map(qStr => {
                const parts = qStr.split("||").map(p => p.trim());
                const text = parts[0];
                const explanation = parts.at(-1) || "";
                const correctPart = parts.at(-2) || "";
                const correctIndices = correctPart.split(",")
                    .map(n => parseInt(n.trim(), 10) - 1)
                    .filter(n => !isNaN(n));
                const options = parts.slice(1, -2);

                return {
                    text, options, correctIndices, explanation,
                    clickedIndices: [], status: null,
                    scoreAwarded: 0, evaluated: false,
                    hasShownNavMessage: false
                };
            });
        }

        // ====================== DOM ======================
        function setupDOMStructure() {
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }

            quizSection.innerHTML = "";
            currentQuestionIdx = 0;
            isSubmitted = false;
            isReviewMode = false;
            hasShownIncompleteMessage = false;
            currentStreak = 0;
            maxStreak = 0;
            timeRemaining = totalQuizTime * 60;
            timeSpent = 0;

            const body = document.createElement("div");
            body.className = "quiz-body";
            quizSection.appendChild(body);

            // Trophy Title
            const title = document.createElement("div");
            title.className = "quiz-title";
            title.innerHTML = "🏆 Quiz";
            body.appendChild(title);

            // Header
            const header = document.createElement("div");
            header.className = "quiz-header";
            header.innerHTML = `
                <div class="timer" id="timer-display">⏱ ${totalQuizTime}:00</div>
                <div class="score-box" id="score-display">Score: 0</div>
                <div class="streak-box" id="streak-display">🔥 0</div>
            `;
            body.appendChild(header);

            // Progress
            const prog = document.createElement("div");
            prog.className = "progress-container";
            prog.innerHTML = `<div class="progress-bar" id="progress-bar"></div>`;
            body.appendChild(prog);

            // Index
            const index = document.createElement("div");
            index.className = "quiz-index";
            index.id = "question-index";
            parsedQuestions.forEach((_, i) => {
                const btn = document.createElement("button");
                btn.className = `index-btn ${i === 0 ? "active" : ""}`;
                btn.textContent = i + 1;
                btn.onclick = () => jumpToQuestion(i);
                index.appendChild(btn);
            });
            body.appendChild(index);

            // Questions
            parsedQuestions.forEach((q, idx) => {
                const box = document.createElement("div");
                box.className = `question-box ${idx === 0 ? "active" : ""}`;

                box.innerHTML = `
                    <div class="q-div">
                        <div class="ql">
                            <b>${idx + 1}</b>
                            <span class="q-status" id="status-${idx}"></span>
                            </div>
                        <div>
                            <div class="q-main">${q.text}</div>
                        </div>
                    </div>
                `;

                const ul = document.createElement("ul");
                ul.className = "options";
                q.options.forEach((opt, optIdx) => {
                    const li = document.createElement("li");
                    li.innerHTML = opt;
                    li.onclick = () => handleOptionClick(idx, optIdx, li);
                    ul.appendChild(li);
                });
                box.appendChild(ul);

                const exp = document.createElement("div");
                exp.className = "quiz-explanation";
                exp.innerHTML = q.explanation;
                box.appendChild(exp);

                body.appendChild(box);
            });

            // Controls
            const controls = document.createElement("div");
            controls.className = "quiz-controls";
            controls.innerHTML = `
                <button id="prev-btn">❮ Previous</button>
                <button id="reset-btn">Reset</button>
                <button id="next-btn">Next ❯</button>
                <button id="submit-btn">Submit Quiz</button>
            `;
            body.appendChild(controls);

            // Keyboard hint
            const hint = document.createElement("div");
            hint.className = "keyboard-hint";
            hint.textContent = "Keyboard: ← → navigate • 1-4 select option • Enter submit";
            body.appendChild(hint);

            const msg = document.createElement("div");
            msg.id = "quiz-message";
            msg.className = "quiz-message";
            body.appendChild(msg);

            // Modal
            const modal = document.createElement("div");
            modal.className = "modal";
            modal.id = "quiz-modal";
            modal.innerHTML = `
                <div class="modal-content">
                    <h3 id="modal-title">Submit Quiz</h3>
                    <div id="modal-body">Are you sure?</div>
                    <div class="modal-actions" id="modal-actions">
                        <button class="btn-primary" id="modal-confirm">Yes</button>
                        <button class="btn-secondary" id="modal-cancel">No</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            bindControlEvents();
            updateNavigationButtons();
            updateProgress();
            typesetMath(quizSection);
        }

        function bindControlEvents() {
            document.getElementById("prev-btn").onclick = () => navigate(-1);
            document.getElementById("next-btn").onclick = () => navigate(1);
            document.getElementById("reset-btn").onclick = () => resetCurrentQuestion();
            document.getElementById("submit-btn").onclick = () => promptSubmit(false);
        }

        // ====================== KEYBOARD ======================
        document.addEventListener("keydown", (e) => {
            if (!quizSection.style.display || quizSection.style.display === "none") return;
            if (isSubmitted && !isReviewMode) return;
            if (loader.classList.contains("show")) return; // ignore while loading

            if (e.key === "ArrowLeft") {
                e.preventDefault();
                navigate(-1);
            }
            if (e.key === "ArrowRight") {
                e.preventDefault();
                navigate(1);
            }

            if (["1", "2", "3", "4"].includes(e.key) && !isReviewMode && !isSubmitted) {
                const optIdx = parseInt(e.key) - 1;
                const box = document.querySelectorAll(".question-box")[currentQuestionIdx];
                const options = box.querySelectorAll(".options li");
                if (options[optIdx] && !options[optIdx].classList.contains("disabled")) {
                    options[optIdx].click();
                }
            }

            if (e.key === "Enter" && !isSubmitted && !isReviewMode) {
                e.preventDefault();
                promptSubmit(false);
            }
        });

        // ====================== LOADER + COUNTDOWN ======================
        function showLoaderAndStart() {
            // Show loader
            loader.classList.add("show");
            countdownEl.textContent = "3";
            countdownEl.style.animation = "none";
            void countdownEl.offsetWidth; // reflow
            countdownEl.style.animation = "popNumber 0.6s ease";

            // Prepare quiz behind the scenes
            parseQuestionsData();
            setupDOMStructure();

            startBtn.style.display = "none";
            quizSection.style.display = "block";

            // Scroll to top while loader is visible
            setTimeout(() => {
                quizSection.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            }, 50);

            // Countdown sequence: 3 → 2 → 1 → Go!
            const sequence = ["3", "2", "1", "Go!"];
            let step = 0;

            const countdownInterval = setInterval(() => {
                step++;
                if (step < sequence.length) {
                    countdownEl.textContent = sequence[step];
                    countdownEl.style.animation = "none";
                    void countdownEl.offsetWidth;
                    countdownEl.style.animation = "popNumber 0.6s ease";
                } else {
                    clearInterval(countdownInterval);
                    // Hide loader and start the real timer
                    loader.classList.remove("show");
                    startTimer();
                }
            }, 750); // ~3 seconds total
        }

        // ====================== START / RESTART ======================
        function startQuiz() {
            // Remove old modal if exists
            const oldModal = document.getElementById("quiz-modal");
            if (oldModal) oldModal.remove();

            showLoaderAndStart();
        }

        startBtn.onclick = startQuiz;

        // ====================== TIMER ======================
        function startTimer() {
            if (timerInterval) clearInterval(timerInterval);

            timerInterval = setInterval(() => {
                timeRemaining--;
                timeSpent++;
                const m = Math.floor(timeRemaining / 60);
                const s = timeRemaining % 60;
                document.getElementById("timer-display").textContent =
                    `⏱ ${m}:${s < 10 ? "0" : ""}${s}`;
                if (timeRemaining <= 0) {
                    clearInterval(timerInterval);
                    promptSubmit(true);
                }
            }, 1000);
        }

        // ====================== OPTION CLICK ======================
        function handleOptionClick(qIdx, optIdx, el) {
            if (isSubmitted || isReviewMode) return;
            const q = parsedQuestions[qIdx];
            if (q.evaluated || q.clickedIndices.includes(optIdx)) return;

            q.clickedIndices.push(optIdx);
            const isCorrect = q.correctIndices.includes(optIdx);

            if (isCorrect) {
                playCorrect();
                el.classList.add("green");

                const allDone = q.clickedIndices.length === q.correctIndices.length &&
                    q.clickedIndices.every(i => q.correctIndices.includes(i));

                if (allDone) {
                    currentStreak++;
                    maxStreak = Math.max(maxStreak, currentStreak);
                    const bonus = Math.max(0, (currentStreak - 1) * streakBonus);
                    q.scoreAwarded = marksPerQuestion + bonus;
                    q.status = "green";
                    q.evaluated = true;

                    showScorePop(q.scoreAwarded, true);
                    confetti(60);
                    updateStreakUI();
                }
            } else {
                playIncorrect();
                el.classList.add("red");
                currentStreak = 0;
                updateStreakUI();

                document.querySelectorAll(".question-box")[qIdx]
                    .querySelectorAll(".options li")
                    .forEach((li, i) => {
                        if (q.correctIndices.includes(i)) li.classList.add("green");
                    });

                q.status = "red";
                q.scoreAwarded = -negativeMarks;
                q.evaluated = true;
                showScorePop(-negativeMarks, false);
            }

            if (q.evaluated) {
                document.querySelectorAll(".question-box")[qIdx]
                    .querySelectorAll(".options li")
                    .forEach(li => li.classList.add("disabled"));
                showExplanation(qIdx);
                updateQuestionStatusUI(qIdx);
                updateRealtimeScore();
                updateProgress();
                clearQuizMessage();

                // Auto advance
                if (!isSubmitted) {
                    setTimeout(() => {
                        if (currentQuestionIdx < parsedQuestions.length - 1) {
                            jumpToQuestion(currentQuestionIdx + 1);
                        }
                    }, 1400);
                }
            }
        }

        function showScorePop(points, isPlus) {
            const scoreEl = document.getElementById("score-display");
            const pop = document.createElement("div");
            pop.className = `score-pop ${isPlus ? "plus" : "minus"}`;
            pop.textContent = (isPlus ? "+" : "") + points;
            scoreEl.appendChild(pop);
            setTimeout(() => pop.remove(), 1000);
        }

        function updateStreakUI() {
            document.getElementById("streak-display").innerHTML = `🔥 ${currentStreak}`;
        }

        function showExplanation(qIdx) {
            const q = parsedQuestions[qIdx];
            const box = document.querySelectorAll(".question-box")[qIdx];
            const exp = box.querySelector(".quiz-explanation");
            if (!q.explanation?.trim()) {
                exp.style.display = "none";
                return;
            }
            exp.innerHTML = q.explanation;
            exp.style.display = "block";
            typesetMath(exp);
        }

        function updateQuestionStatusUI(qIdx) {
            const q = parsedQuestions[qIdx];
            const span = document.getElementById(`status-${qIdx}`);
            const btn = document.querySelectorAll(".index-btn")[qIdx];
            if (!span || !btn) return;

            if (q.status === "green") {
                span.className = "q-status";
                span.style.color = "#16a34a";
                span.textContent = "✓ Correct";
                btn.className = "index-btn green";
            } else if (q.status === "red") {
                span.className = "q-status";
                span.style.color = "#dc2626";
                span.textContent = "✕ Incorrect";
                btn.className = "index-btn red";
            } else if (isSubmitted) {
                span.innerHTML = "<i style='color: orange; font-style: normal;'>🤔 Unattempted</i>";
                btn.className = "index-btn";
            } else {
                span.textContent = "";
                btn.className = "index-btn";
            }
            if (qIdx === currentQuestionIdx) btn.classList.add("active");
        }

        function updateRealtimeScore() {
            const total = parsedQuestions.reduce((a, q) => a + q.scoreAwarded, 0);
            document.getElementById("score-display").textContent = `Score: ${total}`;
        }

        function updateProgress() {
            const done = parsedQuestions.filter(q => q.evaluated).length;
            const pct = (done / parsedQuestions.length) * 100;
            document.getElementById("progress-bar").style.width = pct + "%";
        }

        // ====================== NAVIGATION ======================
        function navigate(step) {
            const q = parsedQuestions[currentQuestionIdx];
            if (!isSubmitted && !isReviewMode && q.correctIndices.length > 1 &&
                q.clickedIndices.length > 0 && !q.evaluated) {
                const done = q.clickedIndices.length === q.correctIndices.length &&
                    q.clickedIndices.every(i => q.correctIndices.includes(i));
                if (!done) {
                    if (!q.hasShownNavMessage) {
                        q.hasShownNavMessage = true;
                        showQuizMessage("Select all correct options");
                        return;
                    }
                }
            }
            jumpToQuestion(currentQuestionIdx + step);
        }

        function jumpToQuestion(idx) {
            if (idx < 0 || idx >= parsedQuestions.length) return;
            const boxes = document.querySelectorAll(".question-box");
            const btns = document.querySelectorAll(".index-btn");

            boxes[currentQuestionIdx].classList.remove("active");
            btns[currentQuestionIdx].classList.remove("active");

            currentQuestionIdx = idx;
            boxes[idx].classList.add("active");
            btns[idx].classList.add("active");

            updateQuestionStatusUI(idx);
            updateNavigationButtons();
            clearQuizMessage();
            typesetMath(boxes[idx]);
        }

        function updateNavigationButtons() {
            document.getElementById("prev-btn").disabled = currentQuestionIdx === 0;
            document.getElementById("next-btn").disabled = currentQuestionIdx === parsedQuestions.length - 1;
        }

        function resetCurrentQuestion() {
            if (isSubmitted || isReviewMode) return;
            const q = parsedQuestions[currentQuestionIdx];
            q.clickedIndices = [];
            q.status = null;
            q.scoreAwarded = 0;
            q.evaluated = false;
            q.hasShownNavMessage = false;

            const box = document.querySelectorAll(".question-box")[currentQuestionIdx];
            box.querySelectorAll(".options li").forEach(li => li.className = "");
            box.querySelector(".quiz-explanation").style.display = "none";

            updateQuestionStatusUI(currentQuestionIdx);
            updateRealtimeScore();
            updateProgress();
            clearQuizMessage();
        }

        function showQuizMessage(msg) {
            const el = document.getElementById("quiz-message");
            el.textContent = msg;
            el.style.display = "block";
        }

        function clearQuizMessage() {
            const el = document.getElementById("quiz-message");
            el.style.display = "none";
        }

        // ====================== SUBMIT ======================
        function promptSubmit(auto) {
            if (!auto && !isSubmitted && !isReviewMode) {
                const incomplete = parsedQuestions.some(q => {
                    if (q.correctIndices.length <= 1 || q.clickedIndices.length === 0 || q.evaluated) return false;
                    return !(q.clickedIndices.length === q.correctIndices.length &&
                        q.clickedIndices.every(i => q.correctIndices.includes(i)));
                });
                if (incomplete && !hasShownIncompleteMessage) {
                    hasShownIncompleteMessage = true;
                    showQuizMessage("Please select all correct options");
                    return;
                }
            }

            const modal = document.getElementById("quiz-modal");
            const title = document.getElementById("modal-title");
            const body = document.getElementById("modal-body");
            const actions = document.getElementById("modal-actions");

            modal.classList.add("open");

            if (auto) {
                title.textContent = "Time's Up!";
                body.textContent = "Submitting automatically...";
                actions.style.display = "none";
                setTimeout(finalizeSubmission, 1200);
            } else {
                title.textContent = "Submit Quiz?";
                body.textContent = "Are you sure you want to finish?";
                actions.style.display = "flex";
                document.getElementById("modal-confirm").onclick = finalizeSubmission;
                document.getElementById("modal-cancel").onclick = () => modal.classList.remove("open");
            }
        }

        function finalizeSubmission() {
            clearInterval(timerInterval);
            isSubmitted = true;

            parsedQuestions.forEach((q, i) => {
                if (q.clickedIndices.length === 0) {
                    q.status = null;
                    q.scoreAwarded = 0;
                }
                updateQuestionStatusUI(i);
            });

            const totalAttempted = parsedQuestions.filter(q => q.clickedIndices.length > 0).length;
            const totalCorrect = parsedQuestions.filter(q => q.status === "green").length;
            const totalIncorrect = parsedQuestions.filter(q => q.status === "red").length;
            const marksScored = parsedQuestions.reduce((a, q) => a + q.scoreAwarded, 0);
            const maxMarks = parsedQuestions.length * marksPerQuestion;
            const passMarks = (passPercentage / 100) * maxMarks;
            const isPassed = marksScored >= passMarks;
            const isPerfect = totalCorrect === parsedQuestions.length;
            const mins = Math.floor(timeSpent / 60);
            const secs = timeSpent % 60;

            // High score
            const high = parseInt(localStorage.getItem("quizHighScore") || "0");
            if (marksScored > high) localStorage.setItem("quizHighScore", marksScored);

            const title = document.getElementById("modal-title");
            const body = document.getElementById("modal-body");
            const actions = document.getElementById("modal-actions");

            if (isPerfect) {
                title.textContent = "🌟 Perfect Score!";
                confetti(220);
            } else if (isPassed) {
                title.textContent = "🏆 You Passed!";
                confetti(140);
            } else {
                title.textContent = "Keep Practicing!";
            }

            body.innerHTML = `
                <div class="results-summary">
                    <table class="rt">
                        <caption><b>${marksScored}</b></caption>
                        <tr><td>Marks Scored</td><td>${marksScored} / ${maxMarks}</td></tr>
                        <tr><td>Correct</td><td>${totalCorrect}</td></tr>
                        <tr><td>Incorrect</td><td>${totalIncorrect}</td></tr>
                        <tr><td>Unattempted</td><td>${parsedQuestions.length - totalAttempted}</td></tr>
                        <tr><td>Max Streak</td><td>🔥 ${maxStreak}</td></tr>
                        <tr><td>Time Taken</td><td>${mins}m ${secs}s</td></tr>
                        <tr><td>High Score</td><td>${Math.max(high, marksScored)}</td></tr>
                    </table>
                </div>
            `;

            actions.style.display = "flex";
            actions.innerHTML = `
                <button class="btn-primary" id="review-btn">Review Questions</button>
                <button class="btn-secondary" id="restart-btn">Play Again</button>
            `;

            document.getElementById("review-btn").onclick = () => {
                document.getElementById("quiz-modal").classList.remove("open");
                enableReviewMode();
            };

            // Play Again = restart with loader
            document.getElementById("restart-btn").onclick = () => {
                document.getElementById("quiz-modal").classList.remove("open");
                startQuiz();
            };
        }

        // ====================== REVIEW MODE ======================
        function enableReviewMode() {
            isReviewMode = true;
            isSubmitted = true;

            document.getElementById("reset-btn").style.display = "none";
            document.getElementById("submit-btn").style.display = "none";

            parsedQuestions.forEach((q, idx) => {
                const box = document.querySelectorAll(".question-box")[idx];
                box.querySelectorAll(".options li").forEach((li, i) => {
                    li.classList.add("disabled");
                    if (q.correctIndices.includes(i)) li.classList.add("green");
                });

                const exp = box.querySelector(".quiz-explanation");
                if (q.explanation?.trim()) {
                    exp.innerHTML = q.explanation;
                    exp.style.display = "block";
                }
            });

            jumpToQuestion(0);
            typesetMath(quizSection);
        }
    });
