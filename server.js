import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import mammoth from "mammoth";
import XLSX from "xlsx";
import AdmZip from "adm-zip";
import dotenv from "dotenv";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

dotenv.config({ path: path.join(process.cwd(), ".env") });

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const PORT = Number(process.env.PORT || 4173);
const uploadsDir = path.join(process.cwd(), "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

app.use(express.json({ limit: "4mb" }));
app.use(express.static(process.cwd()));

// Ensure all JSON responses use UTF-8 charset
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return originalJson(body);
  };
  next();
});

const projectState = {
  ready: false,
  files: [],
  chunks: [],
  chunkCount: 0,
  summary: "",
  keyPoints: [],
  chapters: [],
  quiz: [],
  exam: [],
  insights: [],
  status: {
    overall: "未开始",
    parse: "等待中",
    chunk: "等待中",
    material: "等待中",
    detail: "还没有上传文件。",
  },
};

function decodeXmlEntities(text = "") {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(text = "") {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactText(text = "") {
  return text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}

function splitIntoChunks(text, source) {
  const normalized = compactText(text);
  if (!normalized) return [];

  const parts = normalized.split(/\n{2,}/).filter(Boolean);
  const chunks = [];
  let current = "";

  for (const part of parts) {
    if ((current + "\n\n" + part).length > 900 && current) {
      chunks.push({ source, text: current.trim() });
      current = part;
    } else {
      current = current ? `${current}\n\n${part}` : part;
    }
  }

  if (current.trim()) chunks.push({ source, text: current.trim() });
  return chunks;
}

function extractLines(text, limit = 6) {
  return compactText(text)
    .split("\n")
    .map((item) => item.trim())
    .filter((item) => item.length >= 4 && item.length <= 60 && !/^[\d\-→|/%年月周xX.]+$/.test(item))
    .slice(0, limit);
}

function extractSentences(text, limit = 3) {
  return compactText(text)
    .split(/[。！？.!?]\s*/)
    .map((item) => item.trim())
    .filter((item) => item.length > 8)
    .slice(0, limit);
}

function buildProjectFromDocs(docs) {
  const chunks = docs.flatMap((doc) => splitIntoChunks(doc.text, doc.name));
  const topChunks = chunks.slice(0, 8);
  const topSentences = topChunks
    .flatMap((chunk) => [...extractLines(chunk.text, 4), ...extractSentences(chunk.text, 2)])
    .filter(Boolean)
    .slice(0, 10);
  const keyPoints = [...new Set(topSentences.slice(0, 6))];

  const chapters = topChunks.slice(0, 4).map((chunk, index) => {
    const linePoints = extractLines(chunk.text, 4);
    const sentencePoints = extractSentences(chunk.text, 2);
    const points = [...new Set([...linePoints, ...sentencePoints])].slice(0, 3);
    const title = linePoints[0]?.slice(0, 22) || sentencePoints[0]?.slice(0, 22) || `${chunk.source} 重点`;
    return {
      id: `chapter-${index + 1}`,
      title,
      summary: points[0] || chunk.text.slice(0, 80),
      points: points.length ? points : [chunk.text.slice(0, 80)],
      source: chunk.source,
    };
  });

  const summary = keyPoints.length
    ? `系统已从 ${docs.length} 份资料中抽取 ${chunks.length} 个知识片段。当前最突出的培训重点包括：${keyPoints
        .slice(0, 3)
        .join("；")}。`
    : "资料已上传，但暂时没有提取到足够清晰的内容。";

  const quiz = chapters.slice(0, 3).map((chapter, index) => ({
    id: `quiz-${index + 1}`,
    question: `根据培训资料，关于「${chapter.title}」最准确的理解是什么？`,
    options: shuffle([
      chapter.points[0],
      "资料中没有明确提到这个主题",
      "这个主题完全由员工自己自由判断",
      "处理这个主题时不需要记录或审批",
    ]),
    answerSeed: chapter.points[0],
    explanation: `正确答案来自 ${chapter.source} 提炼出的重点内容。`,
    topic: chapter.title,
  }));

  const examTopics = chapters.length ? chapters : topChunks.slice(0, 4).map((chunk, index) => ({
    title: `${chunk.source} 第 ${index + 1} 个重点`,
    points: extractSentences(chunk.text, 2),
    source: chunk.source,
  }));

  const exam = examTopics.slice(0, 4).map((topic, index) => ({
    id: `exam-${index + 1}`,
    question: `下面关于「${topic.title}」的说法，哪一项最符合资料内容？`,
    options: shuffle([
      topic.points[0] || `${topic.title} 是重点内容`,
      "这个主题在资料中被明确禁止学习",
      "处理这个主题时可以跳过标准流程",
      "这个主题只需要临场发挥，不需要看资料",
    ]),
    answerSeed: topic.points[0] || `${topic.title} 是重点内容`,
    explanation: `这道题用于判断员工是否真的理解 ${topic.title}。`,
    topic: topic.title,
  }));

  const normalizedQuiz = quiz.map((item) => ({
    ...item,
    answer: item.options.findIndex((option) => option === item.answerSeed),
  }));
  const normalizedExam = exam.map((item) => ({
    ...item,
    answer: item.options.findIndex((option) => option === item.answerSeed),
  }));

  const insights = [
    `员工最可能反复提问的内容集中在：${chapters.map((item) => item.title).slice(0, 2).join(" / ") || "基础流程"}`,
    `如果综合考试不过，优先补训章节建议是：${chapters.map((item) => item.title).slice(0, 3).join(" / ") || "暂无"}`,
    "后续最值得补强的是把例外流程、授权边界和常错点拆成独立章节。",
  ];

  projectState.ready = true;
  projectState.files = docs.map((doc) => ({
    name: doc.name,
    size: doc.size,
    type: doc.type,
    extractedLength: doc.text.length,
    error: doc.error || null,
  }));
  projectState.chunks = chunks;
  projectState.chunkCount = chunks.length;
  projectState.summary = summary;
  projectState.keyPoints = keyPoints;
  projectState.chapters = chapters;
  projectState.quiz = normalizedQuiz;
  projectState.exam = normalizedExam;
  projectState.insights = insights;
  projectState.status = {
    overall: "可用",
    parse: "已完成",
    chunk: "已完成",
    material: "已完成",
    detail: `共处理 ${docs.length} 个文件，已生成 ${chapters.length} 个学习章节、${normalizedQuiz.length} 道小测题和 ${normalizedExam.length} 道综合考试题。`,
  };
}

function scoreQuestions(questions, answers) {
  let correct = 0;
  const wrong = [];

  questions.forEach((item) => {
    if (Number(answers[item.id]) === item.answer) {
      correct += 1;
    } else {
      wrong.push({
        question: item.question,
        explanation: item.explanation,
        topic: item.topic,
      });
    }
  });

  return {
    correct,
    total: questions.length,
    score: questions.length ? Math.round((correct / questions.length) * 100) : 0,
    wrong,
  };
}

function tokenize(text = "") {
  const raw = text.toLowerCase().match(/[\u4e00-\u9fa5a-z0-9]+/g) || [];
  const tokens = [];

  raw.forEach((item) => {
    if (/^[\u4e00-\u9fa5]+$/.test(item)) {
      for (let i = 0; i < item.length - 1; i += 1) {
        tokens.push(item.slice(i, i + 2));
      }
      if (item.length <= 4) tokens.push(item);
    } else if (item.length > 1) {
      tokens.push(item);
    }
  });

  return [...new Set(tokens)];
}

function searchChunks(message) {
  const terms = tokenize(message);
  const scored = projectState.chunks
    .map((chunk) => {
      const text = chunk.text.toLowerCase();
      const score = terms.reduce((sum, term) => sum + (text.includes(term) ? 1 : 0), 0);
      return { ...chunk, score };
    })
    .sort((a, b) => b.score - a.score || b.text.length - a.text.length);
  return scored.slice(0, 3);
}

function localAnswer(message) {
  const matches = searchChunks(message).filter((item) => item.score > 0);
  if (!matches.length) {
    return {
      answer:
        "我在当前资料里没有找到足够直接的答案。你可以换一种问法，或者让管理员补充更明确的制度、流程和 FAQ 文件。",
      meta: "本地检索：未命中足够相关片段",
    };
  }

  const snippets = matches
    .map((item) => `${item.text.slice(0, 160)}${item.text.length > 160 ? "..." : ""}`)
    .join(" ");
  const sources = [...new Set(matches.map((item) => item.source))].join(" / ");
  return {
    answer: `根据当前上传资料，和你问题最相关的内容是：${snippets}`,
    meta: `引用来源：${sources}`,
  };
}

function shuffle(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getMimoBaseUrl() {
  if (process.env.MIMO_BASE_URL_OVERRIDE) return process.env.MIMO_BASE_URL_OVERRIDE;

  const accessMode = process.env.MIMO_ACCESS_MODE || "payg";
  const compatMode = process.env.MIMO_API_COMPAT_MODE || "openai";

  if (accessMode === "token_plan") {
    return compatMode === "anthropic"
      ? process.env.MIMO_TOKEN_PLAN_ANTHROPIC_BASE_URL
      : process.env.MIMO_TOKEN_PLAN_OPENAI_BASE_URL;
  }

  return compatMode === "anthropic"
    ? process.env.MIMO_ANTHROPIC_BASE_URL || "https://api.xiaomimimo.com/anthropic"
    : process.env.MIMO_OPENAI_BASE_URL || "https://api.xiaomimimo.com/v1";
}

async function maybeAskMimo(message) {
  const key = process.env.MIMO_API_KEY;
  if (!key) return null;

  const context = searchChunks(message)
    .map((item, index) => `资料片段 ${index + 1}（${item.source}）：\n${item.text}`)
    .join("\n\n");

  const baseUrl = getMimoBaseUrl();
  const model = process.env.MIMO_MODEL || "mimo-v2.5-pro";

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_completion_tokens: 1200,
        messages: [
          {
            role: "system",
            content:
              "你是企业新人培训助手。请严格基于提供的资料片段回答，不要编造。如果资料不足，请明确说明资料未覆盖。回答尽量短而清楚。",
          },
          {
            role: "user",
            content: `用户问题：${message}\n\n以下是可引用资料：\n${context}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const answer = payload?.choices?.[0]?.message?.content?.trim();
    if (!answer) return null;

    return {
      answer,
      meta: `MiMo 回答 · 模型：${model}`,
    };
  } catch {
    return null;
  }
}

async function parsePdf(buffer) {
  const payload = await pdfParse(buffer);
  return payload.text || "";
}

async function parseDocx(buffer) {
  const payload = await mammoth.extractRawText({ buffer });
  return payload.value || "";
}

function parsePptx(buffer) {
  const zip = new AdmZip(buffer);
  const entries = zip
    .getEntries()
    .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/.test(entry.entryName))
    .sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true }));

  return entries
    .map((entry) => {
      const xml = entry.getData().toString("utf8");
      const matches = [...xml.matchAll(/<a:t[^>]*>(.*?)<\/a:t>/g)];
      return matches.map((match) => decodeXmlEntities(match[1])).join("\n");
    })
    .join("\n\n");
}

function parseXlsx(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  return workbook.SheetNames.map((sheetName) => {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
    const text = rows.map((row) => row.join(" | ")).join("\n");
    return `${sheetName}\n${text}`;
  }).join("\n\n");
}

function parseXmlLike(buffer) {
  const zip = new AdmZip(buffer);
  const entries = zip
    .getEntries()
    .filter((entry) => /^word\/document\.xml$/.test(entry.entryName) || /^word\/header\d+\.xml$/.test(entry.entryName));
  return entries
    .map((entry) => {
      const xml = entry.getData().toString("utf8");
      const matches = [...xml.matchAll(/<w:t[^>]*>(.*?)<\/w:t>/g)];
      return matches.map((match) => decodeXmlEntities(match[1])).join("");
    })
    .join("\n");
}

// Fix multer's Latin-1 decoded originalname back to proper UTF-8
function fixFilename(name) {
  try {
    // Re-interpret each char as a byte, then decode as UTF-8
    const bytes = Buffer.from(name, "binary");
    const fixed = Buffer.from(bytes).toString("utf8");
    return fixed;
  } catch {
    return name;
  }
}

async function parseFile(file) {
  const originalName = fixFilename(file.originalname);
  const ext = path.extname(originalName).toLowerCase();
  const buffer = file.buffer;
  let text = "";

  if ([".txt", ".md", ".csv", ".json"].includes(ext)) {
    text = buffer.toString("utf8");
  } else if ([".html", ".htm"].includes(ext)) {
    text = stripHtml(buffer.toString("utf8"));
  } else if (ext === ".pdf") {
    text = await parsePdf(buffer);
  } else if (ext === ".docx") {
    text = await parseDocx(buffer);
    if (!text.trim()) text = parseXmlLike(buffer);
  } else if (ext === ".pptx") {
    text = parsePptx(buffer);
  } else if (ext === ".xlsx") {
    text = parseXlsx(buffer);
  } else {
    throw new Error(`暂不支持解析 ${ext || "该类型"} 文件`);
  }

  const safeName = `${Date.now()}-${originalName.replace(/[^\w.\u4e00-\u9fa5-]/g, "_")}`;
  fs.writeFileSync(path.join(uploadsDir, safeName), buffer);

  return {
    name: originalName,
    size: file.size,
    type: ext.replace(".", "") || file.mimetype,
    text: compactText(text),
  };
}

app.get("/api/project", (req, res) => {
  res.json({
    project: {
      ready: projectState.ready,
      files: projectState.files,
      chunkCount: projectState.chunkCount,
      summary: projectState.summary,
      keyPoints: projectState.keyPoints,
      chapters: projectState.chapters,
      quiz: projectState.quiz,
      exam: projectState.exam,
      insights: projectState.insights,
      status: projectState.status,
    },
  });
});

app.post("/api/upload", upload.array("files", 20), async (req, res) => {
  const files = req.files || [];
  if (!files.length) {
    return res.status(400).json({ error: "没有收到文件。" });
  }

  projectState.ready = false;
  projectState.status = {
    overall: "处理中",
    parse: "进行中",
    chunk: "等待中",
    material: "等待中",
    detail: "正在解析上传文件。",
  };

  try {
    const docs = [];
    for (const file of files) {
      docs.push(await parseFile(file));
    }
    buildProjectFromDocs(docs);
    return res.json({ project: projectState });
  } catch (error) {
    projectState.status = {
      overall: "失败",
      parse: "失败",
      chunk: "未开始",
      material: "未开始",
      detail: error.message,
    };
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/load-demo", async (req, res) => {
  const demoPath = path.join(process.cwd(), "新人上岗AI培训_商业计划书.pptx");
  if (!fs.existsSync(demoPath)) {
    return res.status(404).json({ error: "当前目录没有找到演示 BP 文件。" });
  }

  try {
    const buffer = fs.readFileSync(demoPath);
    const docs = [
      {
        name: path.basename(demoPath),
        size: buffer.length,
        type: "pptx",
        text: compactText(parsePptx(buffer)),
      },
    ];
    buildProjectFromDocs(docs);
    return res.json({ project: projectState });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/chat", async (req, res) => {
  const message = req.body?.message?.trim();
  if (!message) return res.status(400).json({ error: "缺少问题内容。" });
  if (!projectState.ready) return res.status(400).json({ error: "知识库还没有准备好。" });

  const mimoAnswer = await maybeAskMimo(message);
  if (mimoAnswer) return res.json(mimoAnswer);

  return res.json(localAnswer(message));
});

app.post("/api/quiz/submit", (req, res) => {
  const result = scoreQuestions(projectState.quiz, req.body?.answers || {});
  res.json(result);
});

app.post("/api/exam/submit", (req, res) => {
  const result = scoreQuestions(projectState.exam, req.body?.answers || {});
  res.json({
    ...result,
    weakTopics: [...new Set(result.wrong.map((item) => item.topic))].slice(0, 3),
  });
});

app.listen(PORT, () => {
  console.log(`MVP server running at http://127.0.0.1:${PORT}`);
});
