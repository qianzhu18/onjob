/* ============================================
   新人上岗 AI 培训 - App Logic
   Direct upload → process → learn → quiz → exam flow
   ============================================ */

const state = {
  project: null,
  projectId: localStorage.getItem("onjob_project_id") || "",
  selectedFiles: [],
  quizAnswers: {},
  examAnswers: {},
};

// ---- DOM refs ----
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const fileInput = $("#file-input");
const selectFilesBtn = $("#select-files-btn");
const uploadZone = $("#upload-zone");
const selectedFilesEl = $("#selected-files");
const fileCountLabel = $("#file-count-label");
const fileList = $("#file-list");
const uploadBtn = $("#upload-btn");
const clearBtn = $("#clear-btn");
const processingStatus = $("#processing-status");
const processingTitle = $("#processing-title");
const resultsPanel = $("#results-panel");
const resultsSummary = $("#results-summary");
const resultsStats = $("#results-stats");
const resultsChapters = $("#results-chapters");
const chatPanel = $("#chat-panel");
const chatMessages = $("#chat-messages");
const chatForm = $("#chat-form");
const chatInput = $("#chat-input");
const quizPanel = $("#quiz-panel");
const quizQuestions = $("#quiz-questions");
const quizFeedback = $("#quiz-feedback");
const examPanel = $("#exam-panel");
const examQuestions = $("#exam-questions");
const examResult = $("#exam-result");
const dashboardPanel = $("#dashboard-panel");
const dashboardStats = $("#dashboard-stats");
const dashboardTable = $("#dashboard-table");
const dashboardInsights = $("#dashboard-insights");

// ---- Utility ----
function formatBytes(bytes = 0) {
  if (!bytes) return "0 KB";
  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function api(path, options = {}) {
  const isAbsolute = /^https?:\/\//i.test(path);
  const requestUrl = new URL(path, isAbsolute ? undefined : window.location.origin);
  if (state.projectId && requestUrl.pathname.startsWith("/api/")) {
    requestUrl.searchParams.set("projectId", state.projectId);
  }

  const headers = new Headers(options.headers || {});
  if (state.projectId && requestUrl.pathname.startsWith("/api/")) {
    headers.set("X-Project-Id", state.projectId);
  }

  const response = await fetch(isAbsolute ? path : requestUrl.toString(), {
    ...options,
    headers,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: "请求失败" }));
    throw new Error(payload.error || "请求失败");
  }
  return response.json();
}

function rememberProject(project) {
  state.project = project;
  state.projectId = project?.projectId || "";
  if (state.projectId) {
    localStorage.setItem("onjob_project_id", state.projectId);
  } else {
    localStorage.removeItem("onjob_project_id");
  }
}

// ---- Panel switching ----
function hideAllPanels() {
  [selectedFilesEl, processingStatus, resultsPanel, chatPanel, quizPanel, examPanel, dashboardPanel].forEach(
    (el) => (el.style.display = "none")
  );
}

function showPanel(el) {
  el.style.display = "block";
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---- File Selection ----
selectFilesBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  fileInput.click();
});
uploadZone.addEventListener("click", (e) => {
  if (e.target.closest("button") || e.target.closest("input")) return;
  fileInput.click();
});

// Drag & drop
uploadZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadZone.classList.add("drag-over");
});
uploadZone.addEventListener("dragleave", () => {
  uploadZone.classList.remove("drag-over");
});
uploadZone.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadZone.classList.remove("drag-over");
  if (e.dataTransfer.files.length) {
    fileInput.files = e.dataTransfer.files;
    handleFileSelect(e.dataTransfer.files);
  }
});

fileInput.addEventListener("change", () => handleFileSelect(fileInput.files));

function handleFileSelect(files) {
  state.selectedFiles = Array.from(files);
  if (!state.selectedFiles.length) return;

  hideAllPanels();
  showPanel(selectedFilesEl);
  fileCountLabel.textContent = `已选择 ${state.selectedFiles.length} 个文件`;

  fileList.innerHTML = state.selectedFiles
    .map(
      (f) => `
    <li>
      <div class="file-info">
        <span class="file-name">${f.name}</span>
        <span class="file-meta">${f.type || "unknown"} · ${formatBytes(f.size)}</span>
      </div>
      <span class="file-status success">待上传</span>
    </li>
  `
    )
    .join("");
}

// ---- Upload ----
uploadBtn.addEventListener("click", uploadFiles);
clearBtn.addEventListener("click", () => {
  state.selectedFiles = [];
  fileInput.value = "";
  hideAllPanels();
});

async function uploadFiles() {
  if (!state.selectedFiles.length) {
    alert("请先选择要上传的文件。");
    return;
  }

  const formData = new FormData();
  state.selectedFiles.forEach((f) => formData.append("files", f));

  hideAllPanels();
  showPanel(processingStatus);
  processingTitle.textContent = "正在处理...";

  // Animate pipeline steps
  const steps = ["step-parse", "step-chunk", "step-material", "step-done"];
  steps.forEach((id) => {
    const el = $(`#${id}`);
    el.classList.remove("active", "done");
  });

  // Step 1 active
  $("#step-parse").classList.add("active");

  try {
    const payload = await api("/api/upload", { method: "POST", body: formData });
    rememberProject(payload.project);

    // Mark all steps done
    steps.forEach((id) => {
      $(`#${id}`).classList.remove("active");
      $(`#${id}`).classList.add("done");
    });
    processingTitle.textContent = "处理完成";

    setTimeout(() => renderResults(), 500);
  } catch (error) {
    processingTitle.textContent = "处理失败: " + error.message;
    steps.forEach((id) => $(`#${id}`).classList.remove("active"));
  }
}

// ---- Render Results ----
function renderResults() {
  hideAllPanels();
  showPanel(resultsPanel);

  const p = state.project;
  resultsSummary.textContent = p.status.detail || "处理完成";

  resultsStats.innerHTML = `
    <div class="stat-item"><span class="stat-value">${p.files.length}</span><span class="stat-label">上传文件</span></div>
    <div class="stat-item"><span class="stat-value">${p.chunkCount || 0}</span><span class="stat-label">知识片段</span></div>
    <div class="stat-item"><span class="stat-value">${p.chapters.length}</span><span class="stat-label">学习章节</span></div>
    <div class="stat-item"><span class="stat-value">${p.quiz.length}</span><span class="stat-label">小测题目</span></div>
    <div class="stat-item"><span class="stat-value">${p.exam.length}</span><span class="stat-label">考试题目</span></div>
  `;

  resultsChapters.innerHTML =
    p.chapters.length
      ? p.chapters
          .map(
            (ch, i) => `
        <div class="chapter-item">
          <h4>${i + 1}. ${ch.title}</h4>
          <p>${ch.summary}</p>
          <div class="chapter-points">重点：${ch.points.join("；")}</div>
        </div>
      `
          )
          .join("")
      : "<p>暂无学习章节</p>";
}

// ---- Learn (Chat) ----
$("#go-learn-btn").addEventListener("click", () => {
  hideAllPanels();
  showPanel(chatPanel);
  chatMessages.innerHTML = "";
  addBubble("assistant", "知识库已就绪。你可以围绕培训资料提问，我会基于已上传的内容回答。");
});

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const msg = chatInput.value.trim();
  if (!msg) return;
  addBubble("user", msg);
  chatInput.value = "";
  sendChat(msg);
});

$$(".suggestion-chip").forEach((btn) => {
  btn.addEventListener("click", () => {
    const q = btn.dataset.q;
    addBubble("user", q);
    sendChat(q);
  });
});

function addBubble(role, text, meta = "") {
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${role}`;
  bubble.innerHTML = `<p>${text}</p>${meta ? `<span class="bubble-meta">${meta}</span>` : ""}`;
  chatMessages.appendChild(bubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendChat(message) {
  if (!state.project?.ready) {
    addBubble("assistant", "知识库尚未就绪，请先上传并处理培训资料。");
    return;
  }
  try {
    const payload = await api("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, projectId: state.projectId }),
    });
    addBubble("assistant", payload.answer, payload.meta || "");
  } catch (error) {
    addBubble("assistant", `请求失败：${error.message}`);
  }
}

// ---- Quiz ----
$("#go-quiz-btn").addEventListener("click", () => {
  hideAllPanels();
  showPanel(quizPanel);
  renderAssessment(quizQuestions, state.project.quiz, state.quizAnswers, "quiz");
  quizFeedback.innerHTML = "";
});

$("#submit-quiz-btn").addEventListener("click", () => submitAssessment("quiz"));
$("#reset-quiz-btn").addEventListener("click", () => {
  state.quizAnswers = {};
  renderAssessment(quizQuestions, state.project.quiz, state.quizAnswers, "quiz");
  quizFeedback.innerHTML = "";
});

// ---- Exam ----
$("#go-exam-btn").addEventListener("click", () => {
  hideAllPanels();
  showPanel(examPanel);
  renderAssessment(examQuestions, state.project.exam, state.examAnswers, "exam");
  examResult.innerHTML = "";
});

$("#submit-exam-btn").addEventListener("click", () => submitAssessment("exam"));
$("#reset-exam-btn").addEventListener("click", () => {
  state.examAnswers = {};
  renderAssessment(examQuestions, state.project.exam, state.examAnswers, "exam");
  examResult.innerHTML = "";
});

// ---- Assessment Rendering ----
function renderAssessment(container, questions, answerStore, groupName) {
  if (!questions.length) {
    container.innerHTML = "<p>暂无题目，请先上传并处理培训资料。</p>";
    return;
  }

  container.innerHTML = questions
    .map(
      (item, i) => `
    <div class="question-card">
      <h4>${i + 1}. ${item.question}</h4>
      <div class="option-list">
        ${item.options
          .map(
            (opt, oi) => `
          <label class="option-item">
            <input type="radio" name="${groupName}-${item.id}" value="${oi}" ${
              String(answerStore[item.id]) === String(oi) ? "checked" : ""
            } />
            <span>${opt}</span>
          </label>
        `
          )
          .join("")}
      </div>
    </div>
  `
    )
    .join("");

  container.querySelectorAll("input[type=radio]").forEach((input) => {
    input.addEventListener("change", (e) => {
      const parts = e.target.name.split("-");
      const scope = parts[0];
      const id = parts.slice(1).join("-");
      if (scope === "quiz") state.quizAnswers[id] = Number(e.target.value);
      if (scope === "exam") state.examAnswers[id] = Number(e.target.value);
    });
  });
}

async function submitAssessment(kind) {
  if (!state.project?.ready) {
    alert("请先完成文件处理。");
    return;
  }

  const answers = kind === "quiz" ? state.quizAnswers : state.examAnswers;

  try {
    const payload = await api(`/api/${kind}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers, projectId: state.projectId }),
    });

    if (kind === "quiz") {
      quizFeedback.innerHTML = `
        <div class="feedback-box">
          <h4>得分：${payload.score} 分 (${payload.correct}/${payload.total} 答对)</h4>
          ${
            payload.wrong.length
              ? payload.wrong
                  .map(
                    (w) => `
                <p>错题：${w.question}<br/>解释：${w.explanation}</p>
              `
                  )
                  .join("")
              : "<p>表现不错，可以继续进入综合考试。</p>"
          }
        </div>
      `;
    } else {
      const pass = payload.score >= 80;
      examResult.innerHTML = `
        <div class="score-box ${pass ? "pass" : "fail"}">
          <span class="score-value">${payload.score}</span>
          <span class="score-label">${pass ? "建议上岗" : "建议补训后重考"}</span>
        </div>
        ${
          payload.weakTopics?.length
            ? `<p style="margin-top:12px;font-size:14px;color:#6b6b6b;">薄弱章节：${payload.weakTopics.join(" / ")}</p>`
            : ""
        }
      `;
    }
  } catch (error) {
    alert(error.message);
  }
}

// ---- Load existing state on page load ----
async function loadState() {
  try {
    const payload = await api("/api/project");
    if (payload.project?.ready) {
      rememberProject(payload.project);
      // If project is already processed, show results
      renderResults();
    }
  } catch {
    // No existing project, that's fine
  }
}

// ---- Scroll reveal ----
function initReveal() {
  const items = $$(".reveal");
  if (!items.length) return;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  items.forEach((item) => observer.observe(item));
}

// ---- Init ----
initReveal();
loadState();
