document.addEventListener("DOMContentLoaded", () => {

    let parsedQuestions = [];
    let currentQuestionIdx = 0;
    let timerInterval = null;
    let timeRemaining = totalQuizTime * 60;
    let timeSpent = 0;
    let isSubmitted = false;
    let isReviewMode = false;
    let hasShownIncompleteMessage = false;

    const startBtn = document.getElementById("start");
    const quizSection = document.querySelector(".quiz");

    const correctSound = new Audio(
        "https://cdn.jsdelivr.net/gh/oneprt/sounds@main/correct.mp3"
    );

    const incorrectSound = new Audio(
        "https://cdn.jsdelivr.net/gh/oneprt/sounds@main/incorrect.mp3"
    );


    /* =========================================================
       MATHJAX
       ========================================================= */

    function renderMathJax(element) {

        if (!element) return;

        const tryRender = () => {

            if (
                window.MathJax &&
                typeof window.MathJax.typesetPromise === "function"
            ) {

                window.MathJax.typesetPromise([element])
                    .catch(error => {
                        console.error("MathJax rendering error:", error);
                    });

                return true;
            }

            return false;
        };


        // MathJax already loaded
        if (tryRender()) return;


        // MathJax still loading
        let attempts = 0;

        const waitForMathJax = setInterval(() => {

            attempts++;

            if (tryRender() || attempts >= 100) {
                clearInterval(waitForMathJax);
            }

        }, 100);

    }


    /* =========================================================
       SOUNDS
       ========================================================= */

    function playCorrectSound() {
        correctSound.currentTime = 0;
        correctSound.play().catch(() => {});
    }

    function playIncorrectSound() {
        incorrectSound.currentTime = 0;
        incorrectSound.play().catch(() => {});
    }


    /* =========================================================
       PARSE QUESTIONS
       ========================================================= */

    function parseQuestionsData() {

        parsedQuestions = questions.map((qStr) => {

            const parts = qStr
                .split("||")
                .map(p => p.trim());

            const text = parts[0];

            const explanation =
                parts.length > 1
                    ? parts[parts.length - 1]
                    : "";

            const correctAnswerPart =
                parts.length > 1
                    ? parts[parts.length - 2]
                    : "";

            const correctIndices =
                correctAnswerPart
                    .split(",")
                    .map(num => parseInt(num.trim(), 10) - 1)
                    .filter(num => !isNaN(num));

            const options =
                parts.slice(1, parts.length - 2);

            return {
                text,
                options,
                correctIndices,
                explanation,
                clickedIndices: [],
                status: null,
                scoreAwarded: 0,
                evaluated: false,
                hasShownNavMessage: false
            };

        });

        totalQuestions = parsedQuestions.length;
    }


    /* =========================================================
       CREATE QUIZ
       ========================================================= */

    function setupDOMStructure() {

        quizSection.innerHTML = "";

        currentQuestionIdx = 0;
        isSubmitted = false;
        isReviewMode = false;
        hasShownIncompleteMessage = false;


        const quizBody = document.createElement("div");
        quizBody.className = "quiz-body";

        quizSection.appendChild(quizBody);


        /* HEADER */

        const header = document.createElement("div");

        header.className = "quiz-header";

        header.innerHTML = `
            <div class="timer" id="timer-display">
                Time: ${totalQuizTime}:00
            </div>

            <div class="real-time-score" id="score-display">
                Score: 0 / ${totalQuestions * marksPerQuestion}
            </div>
        `;

        quizBody.appendChild(header);


        /* INDEX PALETTE */

        const indexPalette = document.createElement("div");

        indexPalette.className = "quiz-index";
        indexPalette.id = "question-index";


        for (let i = 0; i < totalQuestions; i++) {

            const btn = document.createElement("button");

            btn.className =
                `index-btn ${i === 0 ? "active" : ""}`;

            btn.innerText = i + 1;

            btn.onclick = () => jumpToQuestion(i);

            indexPalette.appendChild(btn);
        }

        quizBody.appendChild(indexPalette);


        /* QUESTIONS */

        parsedQuestions.forEach((q, idx) => {

            const box = document.createElement("div");

            box.className =
                `question-box ${idx === 0 ? "active" : ""}`;


            const qHead = document.createElement("div");

            qHead.className = "question";
            qHead.id = `${idx + 1}`;


            qHead.innerHTML = `
                <div class="q-div">

                    <b class="ql">${idx + 1}</b>

                    <div class="qr">

                        <span
                            class="q-status"
                            id="status-${idx}">
                        </span>

                        <div class="q-main">
                            ${q.text}
                        </div>

                    </div>

                </div>
            `;


            /* OPTIONS */

            const ul = document.createElement("ul");

            ul.className = "options";


            q.options.forEach((optText, optIdx) => {

                const li = document.createElement("li");

                li.innerHTML = optText;

                li.onclick = () =>
                    handleOptionClick(
                        idx,
                        optIdx,
                        li
                    );

                ul.appendChild(li);

            });


            /* EXPLANATION */

            const explanationDiv =
                document.createElement("div");

            explanationDiv.className =
                "quiz-explanation";

            explanationDiv.style.display = "none";

            explanationDiv.innerHTML =
                q.explanation;


            box.appendChild(qHead);
            box.appendChild(ul);
            box.appendChild(explanationDiv);

            quizBody.appendChild(box);

        });


        /* CONTROLS */

        const controls =
            document.createElement("div");

        controls.className = "quiz-controls";

        controls.innerHTML = `
            <button id="prev-btn">❮ Previous</button>
            <button id="reset-btn">Reset</button>
            <button id="next-btn">Next ❯</button>
            <button id="submit-btn">Submit Quiz ▲</button>
        `;

        quizBody.appendChild(controls);


        /* MESSAGE */

        const messageDiv =
            document.createElement("div");

        messageDiv.id = "quiz-message";
        messageDiv.className = "quiz-message";
        messageDiv.style.display = "none";

        quizBody.appendChild(messageDiv);


        /* MODAL */

        const modal =
            document.createElement("div");

        modal.className = "modal";
        modal.id = "quiz-modal";
        modal.style.zIndex = "999999";


        modal.innerHTML = `
            <div class="modal-content">

                <h3 id="modal-title">
                    Submit Quiz
                </h3>

                <div id="modal-body">
                    Are you sure you want to submit?
                </div>

                <div
                    class="modal-actions"
                    id="modal-actions">

                    <button
                        class="btn-primary"
                        id="modal-confirm">
                        Yes
                    </button>

                    <button
                        class="btn-secondary"
                        id="modal-cancel">
                        No
                    </button>

                </div>

            </div>
        `;


        document.body.appendChild(modal);

        bindControlEvents();

        updateNavigationButtons();


        /* ==========================================
           IMPORTANT:
           QUIZ DOM IS NOW CREATED.
           RENDER ALL LATEX.
           ========================================== */

        renderMathJax(quizSection);

    }


    /* =========================================================
       CONTROLS
       ========================================================= */

    function bindControlEvents() {

        document.getElementById("prev-btn").onclick =
            () => navigate(-1);

        document.getElementById("next-btn").onclick =
            () => navigate(1);

        document.getElementById("reset-btn").onclick =
            () => resetCurrentQuestion();

        document.getElementById("submit-btn").onclick =
            () => promptSubmit(false);

    }


    /* =========================================================
       AUTO START
       ========================================================= */

    function startQuizAutomatically() {

        if (startBtn)
            startBtn.style.display = "none";

        quizSection.style.display = "none";


        const loadingScreen =
            document.createElement("div");

        loadingScreen.id =
            "quiz-loading-screen";


        loadingScreen.innerHTML = `
            <div class="quiz-spinner"></div>
            <div class="quiz-loading-text">
                Preparing your quiz...
            </div>
        `;


        quizSection.parentNode.insertBefore(
            loadingScreen,
            quizSection
        );


        setTimeout(() => {

            loadingScreen.remove();

            parseQuestionsData();

            setupDOMStructure();

            quizSection.style.display = "block";

            startTimer();

        }, 3000);

    }


    /* =========================================================
       TIMER
       ========================================================= */

    function startTimer() {

        timerInterval = setInterval(() => {

            timeRemaining--;
            timeSpent++;


            const minutes =
                Math.floor(timeRemaining / 60);

            const seconds =
                timeRemaining % 60;


            const timer =
                document.getElementById(
                    "timer-display"
                );


            if (timer) {

                timer.innerText =
                    `Time: ${minutes}:${
                        seconds < 10 ? "0" : ""
                    }${seconds}`;

            }


            if (timeRemaining <= 0) {

                clearInterval(timerInterval);

                promptSubmit(true);

            }

        }, 1000);

    }


    /* =========================================================
       OPTION CLICK
       ========================================================= */

    function handleOptionClick(
        qIdx,
        optIdx,
        element
    ) {

        if (isSubmitted || isReviewMode)
            return;

        const q = parsedQuestions[qIdx];

        if (q.evaluated)
            return;

        if (q.clickedIndices.includes(optIdx))
            return;


        q.clickedIndices.push(optIdx);


        const isCorrectOption =
            q.correctIndices.includes(optIdx);


        if (isCorrectOption) {

            playCorrectSound();

            element.classList.add("green");


            const totalRequired =
                q.correctIndices.length;


            const allCorrectOptionsSelected =
                q.clickedIndices.length === totalRequired &&
                q.clickedIndices.every(
                    index =>
                        q.correctIndices.includes(index)
                );


            if (allCorrectOptionsSelected) {

                q.status = "green";

                q.scoreAwarded =
                    marksPerQuestion;

                q.evaluated = true;

            }


        } else {

            playIncorrectSound();

            element.classList.add("red");


            const currentBox =
                document.querySelectorAll(
                    ".question-box"
                )[qIdx];


            currentBox
                .querySelectorAll(".options li")
                .forEach((li, index) => {

                    if (
                        q.correctIndices.includes(index)
                    ) {
                        li.classList.add("green");
                    }

                });


            q.status = "red";

            q.scoreAwarded =
                -negativeMarks;

            q.evaluated = true;

        }


        if (q.evaluated) {

            const currentBox =
                document.querySelectorAll(
                    ".question-box"
                )[qIdx];


            currentBox
                .querySelectorAll(".options li")
                .forEach(li =>
                    li.classList.add("disabled")
                );


            showExplanation(qIdx);

        }


        updateQuestionStatusUI(qIdx);

        updateRealtimeScore();

        clearQuizMessage();

    }


    /* =========================================================
       EXPLANATION
       ========================================================= */

    function showExplanation(qIdx) {

        const q = parsedQuestions[qIdx];

        const box =
            document.querySelectorAll(
                ".question-box"
            )[qIdx];


        const explanationDiv =
            box.querySelector(
                ".quiz-explanation"
            );


        if (
            !q.explanation ||
            q.explanation.trim() === ""
        ) {

            explanationDiv.style.display = "none";

            return;

        }


        explanationDiv.innerHTML =
            q.explanation;

        explanationDiv.style.display =
            "block";


        /* RENDER LATEX IN EXPLANATION */

        renderMathJax(explanationDiv);

    }


    /* =========================================================
       STATUS
       ========================================================= */

    function updateQuestionStatusUI(qIdx) {

        const q = parsedQuestions[qIdx];

        const statusSpan =
            document.getElementById(
                `status-${qIdx}`
            );

        const indexBtn =
            document.querySelectorAll(
                ".index-btn"
            )[qIdx];


        if (!statusSpan || !indexBtn)
            return;


        if (q.status === "green") {

            statusSpan.className = "green";
            statusSpan.innerText =
                "✓ Correct 🥳";

            indexBtn.className =
                "index-btn green";


        } else if (q.status === "red") {

            statusSpan.className = "red";
            statusSpan.innerText =
                "❌ Incorrect 😐";

            indexBtn.className =
                "index-btn red";


        } else if (isSubmitted) {

            statusSpan.className =
                "unattempted";

            statusSpan.innerHTML =
                "<b class='bun'>🤔 Unattempted</b>";

            indexBtn.className =
                "index-btn unattempted";


        } else {

            statusSpan.className = "";
            statusSpan.innerText = "";

            indexBtn.className =
                "index-btn";

        }


        if (qIdx === currentQuestionIdx)
            indexBtn.classList.add("active");

    }


    /* =========================================================
       SCORE
       ========================================================= */

    function updateRealtimeScore() {

        const currentTotal =
            parsedQuestions.reduce(
                (acc, curr) =>
                    acc + curr.scoreAwarded,
                0
            );


        const maxScore =
            totalQuestions * marksPerQuestion;


        document.getElementById(
            "score-display"
        ).innerText =
            `Score: ${currentTotal}/${maxScore}`;

    }


    /* =========================================================
       NAVIGATION
       ========================================================= */

    function navigate(step) {

        const q =
            parsedQuestions[currentQuestionIdx];


        if (
            !isSubmitted &&
            !isReviewMode &&
            q.correctIndices.length > 1 &&
            q.clickedIndices.length > 0 &&
            !q.evaluated
        ) {

            const allSelectedAreCorrect =
                q.clickedIndices.every(
                    index =>
                        q.correctIndices.includes(index)
                );


            const allCorrectOptionsSelected =
                q.clickedIndices.length ===
                    q.correctIndices.length &&
                allSelectedAreCorrect;


            if (!allCorrectOptionsSelected) {

                if (!q.hasShownNavMessage) {

                    q.hasShownNavMessage = true;

                    showQuizMessage(
                        "Please select all correct options ...",
                        "red"
                    );

                    return;

                }

            }

        }


        jumpToQuestion(
            currentQuestionIdx + step
        );

    }


    function jumpToQuestion(targetIdx) {

        if (
            targetIdx < 0 ||
            targetIdx >= totalQuestions
        )
            return;


        const boxes =
            document.querySelectorAll(
                ".question-box"
            );

        const indexBtns =
            document.querySelectorAll(
                ".index-btn"
            );


        boxes[currentQuestionIdx]
            .classList.remove("active");

        indexBtns[currentQuestionIdx]
            .classList.remove("active");


        currentQuestionIdx =
            targetIdx;


        boxes[currentQuestionIdx]
            .classList.add("active");

        indexBtns[currentQuestionIdx]
            .classList.add("active");


        updateQuestionStatusUI(
            currentQuestionIdx
        );

        updateNavigationButtons();

        clearQuizMessage();


        /* RENDER LATEX FOR CURRENT QUESTION */

        renderMathJax(
            boxes[currentQuestionIdx]
        );

    }


    /* =========================================================
       NAV BUTTONS
       ========================================================= */

    function updateNavigationButtons() {

        const prevBtn =
            document.getElementById(
                "prev-btn"
            );

        const nextBtn =
            document.getElementById(
                "next-btn"
            );


        if (!prevBtn || !nextBtn)
            return;


        prevBtn.disabled =
            currentQuestionIdx === 0;

        nextBtn.disabled =
            currentQuestionIdx ===
            totalQuestions - 1;

    }


    /* =========================================================
       RESET
       ========================================================= */

    function resetCurrentQuestion() {

        if (isSubmitted || isReviewMode)
            return;


        const q =
            parsedQuestions[currentQuestionIdx];


        q.clickedIndices = [];
        q.status = null;
        q.scoreAwarded = 0;
        q.evaluated = false;
        q.hasShownNavMessage = false;


        const box =
            document.querySelectorAll(
                ".question-box"
            )[currentQuestionIdx];


        box.querySelectorAll(
            ".options li"
        ).forEach(li => {

            li.className = "";

        });


        const explanationDiv =
            box.querySelector(
                ".quiz-explanation"
            );


        explanationDiv.style.display =
            "none";

        explanationDiv.innerHTML =
            q.explanation;


        updateQuestionStatusUI(
            currentQuestionIdx
        );

        updateRealtimeScore();

        clearQuizMessage();


        renderMathJax(box);

    }


    /* =========================================================
       MESSAGE
       ========================================================= */

    function showQuizMessage(
        message,
        className = "red"
    ) {

        const messageDiv =
            document.getElementById(
                "quiz-message"
            );


        if (!messageDiv)
            return;


        messageDiv.className =
            `quiz-message ${className}`;

        messageDiv.innerText =
            message;

        messageDiv.style.display =
            "block";

    }


    function clearQuizMessage() {

        const messageDiv =
            document.getElementById(
                "quiz-message"
            );


        if (!messageDiv)
            return;


        messageDiv.innerText = "";

        messageDiv.style.display =
            "none";

    }


    /* =========================================================
       SUBMIT
       ========================================================= */

    function promptSubmit(
        isAutoTimeOut
    ) {

        if (
            !isAutoTimeOut &&
            !isSubmitted &&
            !isReviewMode
        ) {

            const incompleteMultiCorrect =
                parsedQuestions.some(q => {

                    if (
                        q.correctIndices.length <= 1 ||
                        q.clickedIndices.length === 0 ||
                        q.evaluated
                    )
                        return false;


                    const allSelectedAreCorrect =
                        q.clickedIndices.every(
                            index =>
                                q.correctIndices.includes(
                                    index
                                )
                        );


                    return !(
                        q.clickedIndices.length ===
                            q.correctIndices.length &&
                        allSelectedAreCorrect
                    );

                });


            if (
                incompleteMultiCorrect &&
                !hasShownIncompleteMessage
            ) {

                hasShownIncompleteMessage = true;

                showQuizMessage(
                    "Please select all correct options.",
                    "red"
                );

                return;

            }

        }


        const modal =
            document.getElementById(
                "quiz-modal"
            );

        const title =
            document.getElementById(
                "modal-title"
            );

        const body =
            document.getElementById(
                "modal-body"
            );

        const actions =
            document.getElementById(
                "modal-actions"
            );


        modal.style.zIndex = "999999";

        modal.classList.add("open");


        if (isAutoTimeOut) {

            title.innerText =
                "Time's Up!";

            body.innerText =
                "Submitting your quiz automatically...";

            actions.style.display =
                "none";


            setTimeout(() => {

                finalizeSubmission();

            }, 1500);


        } else {

            title.innerText =
                "Submit Quiz";

            body.innerText =
                "Are you sure you want to submit your responses?";

            actions.style.display =
                "flex";


            document.getElementById(
                "modal-confirm"
            ).onclick = () => {

                finalizeSubmission();

            };


            document.getElementById(
                "modal-cancel"
            ).onclick = () => {

                modal.classList.remove(
                    "open"
                );

            };

        }

    }


    /* =========================================================
       FINALIZE
       ========================================================= */

    function finalizeSubmission() {

        clearInterval(timerInterval);

        isSubmitted = true;
        isReviewMode = false;


        parsedQuestions.forEach(
            (q, idx) => {

                if (
                    q.clickedIndices.length === 0
                ) {

                    q.status = null;
                    q.scoreAwarded = 0;
                    q.evaluated = false;

                }


                updateQuestionStatusUI(idx);

            }
        );


        const totalAttempted =
            parsedQuestions.filter(
                q =>
                    q.clickedIndices.length > 0
            ).length;


        const totalCorrect =
            parsedQuestions.filter(
                q =>
                    q.status === "green"
            ).length;


        const totalIncorrect =
            parsedQuestions.filter(
                q =>
                    q.status === "red"
            ).length;


        const marksScored =
            parsedQuestions.reduce(
                (acc, q) =>
                    acc + q.scoreAwarded,
                0
            );


        const maxMarks =
            totalQuestions * marksPerQuestion;


        const passMarks =
            (passPercentage / 100) *
            maxMarks;


        const isPassed =
            marksScored >= passMarks;


        const minsTaken =
            Math.floor(timeSpent / 60);

        const secsTaken =
            timeSpent % 60;


        const body =
            document.getElementById(
                "modal-body"
            );

        const title =
            document.getElementById(
                "modal-title"
            );

        const actions =
            document.getElementById(
                "modal-actions"
            );


        title.innerText =
            isPassed
                ? "🏆 Passed!"
                : "🤦‍♂️ Quiz Failed";


        body.innerHTML = `

            <div class="results-summary">

                <table class="rt">

                    <caption>
                        <b>
                            ${marksScored} / ${maxMarks}
                        </b>
                    </caption>

                    <tbody>

                        <tr>
                            <td>Marks Scored</td>
                            <td>
                                ${marksScored} / ${maxMarks}
                            </td>
                        </tr>

                        <tr>
                            <td>Total Questions</td>
                            <td>${totalQuestions}</td>
                        </tr>

                        <tr>
                            <td>Total Attempted</td>
                            <td>${totalAttempted}</td>
                        </tr>

                        <tr>
                            <td>Total Time Taken</td>
                            <td>
                                ${minsTaken}m ${secsTaken}s
                            </td>
                        </tr>

                        <tr>
                            <td>Passing Score</td>
                            <td>
                                ${passMarks} (${passPercentage}%)
                            </td>
                        </tr>

                        <tr>
                            <td>Total Correct</td>
                            <td>${totalCorrect}</td>
                        </tr>

                        <tr>
                            <td>Total Incorrect</td>
                            <td>${totalIncorrect}</td>
                        </tr>

                        <tr>
                            <td>Unattempted</td>
                            <td>
                                ${totalQuestions - totalAttempted}
                            </td>
                        </tr>

                    </tbody>

                </table>

            </div>

        `;


        actions.style.display = "flex";


        actions.innerHTML = `

            <button
                class="btn-primary"
                id="review-btn">
                Review Questions
            </button>

            <button
                class="btn-secondary"
                id="restart-btn">
                Restart Quiz
            </button>

        `;


        document.getElementById(
            "review-btn"
        ).onclick = () => {

            document.getElementById(
                "quiz-modal"
            ).classList.remove("open");

            enableReviewMode();

        };


        document.getElementById(
            "restart-btn"
        ).onclick = () => {

            window.location.reload();

        };

    }


    /* =========================================================
       REVIEW
       ========================================================= */

    function enableReviewMode() {

        isReviewMode = true;
        isSubmitted = true;


        document.getElementById(
            "reset-btn"
        ).style.display = "none";


        document.getElementById(
            "submit-btn"
        ).style.display = "none";


        parsedQuestions.forEach(
            (q, idx) => {

                const box =
                    document.querySelectorAll(
                        ".question-box"
                    )[idx];


                const options =
                    box.querySelectorAll(
                        ".options li"
                    );


                options.forEach(
                    (li, optIdx) => {

                        li.classList.add(
                            "disabled"
                        );


                        if (
                            q.correctIndices.includes(
                                optIdx
                            )
                        ) {

                            li.classList.add(
                                "green"
                            );

                        }

                    }
                );

            }
        );


        renderMathJax(quizSection);

    }


    /* =========================================================
       START
       ========================================================= */

    startQuizAutomatically();

});
