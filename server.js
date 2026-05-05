import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";
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
const dataRootDir = path.resolve(process.env.DATA_DIR || process.cwd());

const uploadsDir = path.join(dataRootDir, "uploads");
const cacheDir = path.join(dataRootDir, ".cache");
const parsedCacheDir = path.join(cacheDir, "parsed-docs");
const projectCacheDir = path.join(cacheDir, "projects");
const latestProjectPath = path.join(cacheDir, "latest-project.json");

[uploadsDir, cacheDir, parsedCacheDir, projectCacheDir].forEach((dir) => fs.mkdirSync(dir, { recursive: true }));

app.use(express.json({ limit: "4mb" }));
app.use(express.static(process.cwd()));

app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return originalJson(body);
  };
  next();
});

app.use((req, res, next) => {
  const origin = process.env.CORS_ALLOW_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Project-Id");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  return next();
});

const emptyStatus = {
  overall: "未开始",
  parse: "等待中",
  chunk: "等待中",
  material: "等待中",
  retrieve: "等待中",
  assessment: "等待中",
  cache: "未命中",
  detail: "还没有上传文件。",
};

const projectState = {
  ready: false,
  projectId: null,
  fingerprint: null,
  generatedAt: null,
  version: "2.0",
  cached: false,
  files: [],
  docs: [],
  sections: [],
  chunks: [],
  chunkCount: 0,
  summary: "",
  keyPoints: [],
  chapters: [],
  quiz: [],
  exam: [],
  insights: [],
  retrievalConfig: {
    chunkSize: 520,
    overlap: 80,
    topK: 4,
  },
  metrics: {
    fileCount: 0,
    sectionCount: 0,
    chunkCount: 0,
    questionCount: 0,
  },
  status: { ...emptyStatus },
};

hydrateLatestProject();

function isProjectLike(value) {
  return Boolean(value && typeof value === "object" && value.projectId && value.ready !== undefined);
}

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

function hashText(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function safeReadJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
}

function hydrateLatestProject() {
  const payload = safeReadJson(latestProjectPath);
  if (!payload?.ready) return;
  Object.assign(projectState, payload, { ready: true, cached: true });
}

function persistProject(project) {
  const cachePath = path.join(projectCacheDir, `${project.fingerprint}.json`);
  writeJson(cachePath, project);
  writeJson(latestProjectPath, project);
}

function loadProjectById(projectId) {
  if (!projectId) return projectState.ready ? projectState : safeReadJson(latestProjectPath);
  if (projectState.projectId === projectId && projectState.ready) return projectState;

  const files = fs.existsSync(projectCacheDir)
    ? fs.readdirSync(projectCacheDir).filter((name) => name.endsWith(".json"))
    : [];

  for (const file of files) {
    const payload = safeReadJson(path.join(projectCacheDir, file));
    if (payload?.projectId === projectId) return payload;
  }

  return null;
}

function resolveProject(req, { required = true } = {}) {
  const projectId = String(
    req.query?.projectId || req.body?.projectId || req.headers["x-project-id"] || projectState.projectId || ""
  ).trim();
  const project = loadProjectById(projectId);
  if (!project && required) return { error: "没有找到对应项目，请重新上传资料。" };
  return { project, projectId };
}

function fingerprintDoc(file) {
  return hashText(`${fixFilename(file.originalname)}:${file.size}:${file.buffer.toString("base64")}`);
}

function fingerprintUpload(docs) {
  const parts = docs
    .map((doc) => `${doc.name}:${doc.hash}:${doc.extractedLength}`)
    .sort();
  return hashText(parts.join("|"));
}

function normalizeLine(text = "") {
  return text.replace(/^[\-\d.、)\s]+/, "").trim();
}

function detectChunkType(text = "") {
  if (/[?？]/.test(text) && /答|回复|说明/.test(text)) return "faq";
  if (/步骤|流程|第一|第二|然后|最后/.test(text)) return "process";
  if (/必须|禁止|不得|应当|需要|规范/.test(text)) return "policy";
  if (/\|/.test(text) || /表|sheet/i.test(text)) return "table";
  return "overview";
}

function extractKeywords(text = "", limit = 8) {
  const matches = text.match(/[\u4e00-\u9fa5]{2,8}|[a-zA-Z][a-zA-Z0-9-]{2,}/g) || [];
  const counts = new Map();

  matches.forEach((item) => {
    const key = item.toLowerCase();
    if (/^(以及|需要|可以|一个|我们|他们|进行|这个|那个|sheet)$/i.test(key)) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, limit)
    .map(([key]) => key);
}

function extractLines(text, limit = 6) {
  return compactText(text)
    .split("\n")
    .map((item) => normalizeLine(item))
    .filter(
      (item) =>
        item.length >= 4 &&
        item.length <= 80 &&
        !/^[\d\-→|/%年月周xX.]+$/.test(item) &&
        !/^slide\s+\d+$/i.test(item) &&
        !/^sheet:\s*/i.test(item)
    )
    .slice(0, limit);
}

function extractSentences(text, limit = 3) {
  return compactText(text)
    .split(/[。！？.!?]\s*/)
    .map((item) => item.trim())
    .filter((item) => item.length > 10)
    .slice(0, limit);
}

function findSectionTitle(text = "", fallback = "未命名章节") {
  const candidates = extractLines(text, 5);
  const preferred = candidates.find(
    (line) =>
      line.length <= 24 &&
      !/[：:]/.test(line.slice(0, 2)) &&
      !/^(执行摘要|第\d+阶段)$/i.test(line)
  );
  return (preferred || candidates[0] || fallback).slice(0, 32);
}

function createSections(doc) {
  const raw = compactText(doc.text);
  if (!raw) return [];

  const splitters = doc.structure === "slide"
    ? raw.split(/\n{2,}(?=Slide\s+\d+)/)
    : doc.structure === "sheet"
      ? raw.split(/\n{2,}(?=Sheet:\s*)/)
      : raw.split(/\n{2,}(?=(?:#+\s*|第[一二三四五六七八九十\d]+[章节部分]|[一二三四五六七八九十]+、))/);

  const parts = splitters.filter((part) => compactText(part).length > 20);
  const sections = (parts.length ? parts : [raw]).map((part, index) => {
    const title = findSectionTitle(part, `${doc.name} - 第 ${index + 1} 段`);
    return {
      id: `${doc.id}-section-${index + 1}`,
      docId: doc.id,
      source: doc.name,
      sourceType: doc.type,
      title,
      order: index + 1,
      text: compactText(part),
      sectionType: detectChunkType(part),
      keywords: extractKeywords(part, 6),
    };
  });

  return sections;
}

function splitSectionIntoChunks(section, config) {
  const paragraphs = compactText(section.text).split(/\n{2,}/).filter(Boolean);
  const pieces = [];
  let current = "";
  let partIndex = 0;

  function flush() {
    const text = compactText(current);
    if (!text) return;
    partIndex += 1;
    pieces.push({
      id: `${section.id}-chunk-${partIndex}`,
      docId: section.docId,
      sectionId: section.id,
      source: section.source,
      sourceType: section.sourceType,
      sectionTitle: section.title,
      chunkType: detectChunkType(text),
      order: partIndex,
      text,
      keywords: extractKeywords(text, 8),
      tokenCount: tokenize(text).length,
    });
  }

  paragraphs.forEach((paragraph) => {
    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (next.length <= config.chunkSize || !current) {
      current = next;
      return;
    }

    flush();
    const overlap = current.slice(Math.max(0, current.length - config.overlap));
    current = compactText(`${overlap}\n${paragraph}`);
  });

  flush();
  return pieces;
}

function tokenize(text = "") {
  const raw = text.toLowerCase().match(/[\u4e00-\u9fa5a-z0-9]+/g) || [];
  const tokens = [];

  raw.forEach((item) => {
    if (/^[\u4e00-\u9fa5]+$/.test(item)) {
      if (item.length <= 4) tokens.push(item);
      for (let i = 0; i < item.length - 1; i += 1) tokens.push(item.slice(i, i + 2));
    } else if (item.length > 1) {
      tokens.push(item);
    }
  });

  return [...new Set(tokens)];
}

function searchChunks(message, topK = projectState.retrievalConfig.topK) {
  const terms = tokenize(message);
  if (!terms.length) return [];

  return projectState.chunks
    .map((chunk) => {
      const haystack = `${chunk.sectionTitle}\n${chunk.text}\n${chunk.keywords.join(" ")}`.toLowerCase();
      const matchedTerms = terms.filter((term) => haystack.includes(term));
      const densityScore = matchedTerms.length / Math.max(terms.length, 1);
      const titleBoost = matchedTerms.some((term) => chunk.sectionTitle.toLowerCase().includes(term)) ? 0.8 : 0;
      const typeBoost = chunk.chunkType === "faq" ? 0.3 : chunk.chunkType === "process" ? 0.2 : 0;
      const score = matchedTerms.length + densityScore + titleBoost + typeBoost;
      return { ...chunk, matchedTerms, score };
    })
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score || b.matchedTerms.length - a.matchedTerms.length || a.order - b.order)
    .slice(0, topK);
}

function createSummary(chapters, docs, chunks) {
  const highlights = chapters
    .flatMap((chapter) => chapter.points.slice(0, 1))
    .filter(Boolean)
    .slice(0, 3);
  if (!highlights.length) {
    return `系统已接入 ${docs.length} 份资料，抽取 ${chunks.length} 个知识片段，但当前资料可直接学习的结构还不够清晰。`;
  }

  return `系统已完成 ${docs.length} 份资料的知识化处理，生成 ${chunks.length} 个知识片段。当前最值得优先掌握的是：${highlights.join("；")}。`;
}

function buildChapters(sections, chunks) {
  const chapterMap = new Map();

  sections.forEach((section) => {
    const relatedChunks = chunks.filter((chunk) => chunk.sectionId === section.id);
    const lines = [...extractLines(section.text, 4), ...extractSentences(section.text, 2)];
    const points = [...new Set(lines)].slice(0, 3);
    chapterMap.set(section.id, {
      id: section.id,
      title: section.title,
      summary: points[0] || section.text.slice(0, 80),
      points: points.length ? points : [section.text.slice(0, 80)],
      source: section.source,
      sectionType: section.sectionType,
      keywords: section.keywords,
      chunkIds: relatedChunks.map((chunk) => chunk.id),
    });
  });

  return [...chapterMap.values()].slice(0, 8);
}

function buildQuestion(item, index, kind) {
  const point = item.points?.[0] || item.summary || `${item.title} 是培训重点`;
  const distractors = [
    "资料中没有明确提到这个主题",
    "这个主题可以临场发挥，不需要标准流程",
    "处理这个主题时无需记录或复盘",
    "这个主题只适合资深员工，新人不用掌握",
  ];

  return {
    id: `${kind}-${index + 1}`,
    question:
      kind === "quiz"
        ? `根据培训资料，关于「${item.title}」最准确的理解是什么？`
        : `下面关于「${item.title}」的说法，哪一项最符合资料内容？`,
    options: shuffle([point, ...distractors].slice(0, 4)),
    answerSeed: point,
    explanation: `正确答案来自《${item.source}》中「${item.title}」的核心内容。`,
    topic: item.title,
    source: item.source,
    sectionType: item.sectionType,
  };
}

function buildAssessments(chapters) {
  const quiz = chapters.slice(0, 4).map((chapter, index) => buildQuestion(chapter, index, "quiz"));
  const exam = chapters.slice(0, 6).map((chapter, index) => buildQuestion(chapter, index, "exam"));

  const normalize = (items) =>
    items.map((item) => ({
      ...item,
      answer: item.options.findIndex((option) => option === item.answerSeed),
    }));

  return {
    quiz: normalize(quiz),
    exam: normalize(exam),
  };
}

function buildInsights(chapters, quiz, exam) {
  const keyChapterTitles = chapters.map((item) => item.title);
  return [
    `高频问答预计会集中在：${keyChapterTitles.slice(0, 3).join(" / ") || "基础流程"}`,
    `小测覆盖 ${quiz.length} 个章节，综合测试覆盖 ${exam.length} 个章节，可直接用于首轮上岗验证。`,
    "建议后续继续补齐例外处理、审批边界和典型错误案例，这三类资料最能提升 RAG 回答稳定性。",
  ];
}

function buildProjectFromDocs(docs, options = {}) {
  const retrievalConfig = {
    chunkSize: 520,
    overlap: 80,
    topK: 4,
  };
  const sections = docs.flatMap((doc) => createSections(doc));
  const chunks = sections.flatMap((section) => splitSectionIntoChunks(section, retrievalConfig));
  const chapters = buildChapters(sections, chunks);
  const assessments = buildAssessments(chapters);
  const summary = createSummary(chapters, docs, chunks);
  const keyPoints = [...new Set(chapters.flatMap((chapter) => chapter.points).slice(0, 8))];
  const fingerprint = fingerprintUpload(docs);

  const project = {
    ready: true,
    projectId: `project-${fingerprint.slice(0, 12)}`,
    fingerprint,
    generatedAt: new Date().toISOString(),
    version: "2.0",
    cached: Boolean(options.cached),
    files: docs.map((doc) => ({
      id: doc.id,
      name: doc.name,
      size: doc.size,
      type: doc.type,
      extractedLength: doc.extractedLength,
      sectionCount: sections.filter((section) => section.docId === doc.id).length,
      hash: doc.hash,
      error: doc.error || null,
    })),
    docs: docs.map((doc) => ({
      id: doc.id,
      name: doc.name,
      type: doc.type,
      structure: doc.structure,
      extractedLength: doc.extractedLength,
    })),
    sections,
    chunks,
    chunkCount: chunks.length,
    summary,
    keyPoints,
    chapters,
    quiz: assessments.quiz,
    exam: assessments.exam,
    insights: buildInsights(chapters, assessments.quiz, assessments.exam),
    retrievalConfig,
    metrics: {
      fileCount: docs.length,
      sectionCount: sections.length,
      chunkCount: chunks.length,
      questionCount: assessments.quiz.length + assessments.exam.length,
    },
    status: {
      overall: "可用",
      parse: "已完成",
      chunk: "已完成",
      material: "已完成",
      retrieve: "已就绪",
      assessment: "已完成",
      cache: options.cached ? "命中" : "已更新",
      detail: `共处理 ${docs.length} 个文件，生成 ${sections.length} 个章节分段、${chunks.length} 个知识片段、${assessments.quiz.length} 道小测题和 ${assessments.exam.length} 道综合考试题。`,
    },
  };

  Object.assign(projectState, project);
  persistProject(project);
  return project;
}

function scoreQuestions(questions, answers) {
  let correct = 0;
  const wrong = [];

  questions.forEach((item) => {
    if (Number(answers[item.id]) === item.answer) {
      correct += 1;
    } else {
      wrong.push({
        id: item.id,
        question: item.question,
        explanation: item.explanation,
        topic: item.topic,
        source: item.source,
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

function localAnswer(message) {
  const matches = searchChunks(message);
  if (!matches.length) {
    return {
      answer:
        "我在当前资料里没有找到足够直接的依据。建议补充更明确的制度、流程或 FAQ 文件，或者换一种更具体的问法。",
      meta: "本地 RAG：未命中足够相关片段",
      sources: [],
    };
  }

  const answer = matches
    .map(
      (item, index) =>
        `${index + 1}. ${item.sectionTitle}：${item.text.slice(0, 150)}${item.text.length > 150 ? "..." : ""}`
    )
    .join("\n");

  return {
    answer: `根据当前资料检索结果，最相关的内容如下：\n${answer}`,
    meta: `本地 RAG：命中 ${matches.length} 个知识片段`,
    sources: matches.map((item) => ({
      source: item.source,
      sectionTitle: item.sectionTitle,
      chunkId: item.id,
      matchedTerms: item.matchedTerms,
      score: Number(item.score.toFixed(2)),
    })),
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

async function maybeAskMimo(project, message) {
  const key = process.env.MIMO_API_KEY;
  if (!key) return null;

  const matches = searchProjectChunks(project, message, 4);
  const context = matches
    .map((item, index) => `资料片段 ${index + 1}（${item.source} / ${item.sectionTitle}）：\n${item.text}`)
    .join("\n\n");
  if (!context) return null;

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
        temperature: 0.2,
        max_completion_tokens: 1200,
        messages: [
          {
            role: "system",
            content:
              "你是企业新人培训助手。请严格基于提供的资料片段回答，不要编造。如果资料不足，请明确说明资料未覆盖。回答要简洁，并尽量引用资料标题。",
          },
          {
            role: "user",
            content: `用户问题：${message}\n\n以下是可引用资料：\n${context}`,
          },
        ],
      }),
    });

    if (!response.ok) return null;

    const payload = await response.json();
    const answer = payload?.choices?.[0]?.message?.content?.trim();
    if (!answer) return null;

    return {
      answer,
      meta: `MiMo RAG · 模型：${model}`,
      sources: matches.map((item) => ({
        source: item.source,
        sectionTitle: item.sectionTitle,
        chunkId: item.id,
      })),
    };
  } catch {
    return null;
  }
}

async function parsePdf(buffer) {
  const payload = await pdfParse(buffer);
  return { text: payload.text || "", structure: "document" };
}

async function parseDocx(buffer) {
  const payload = await mammoth.extractRawText({ buffer });
  const text = payload.value || parseXmlLike(buffer);
  return { text, structure: "document" };
}

function parsePptx(buffer) {
  const zip = new AdmZip(buffer);
  const entries = zip
    .getEntries()
    .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/.test(entry.entryName))
    .sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true }));

  const slides = entries
    .map((entry, index) => {
      const xml = entry.getData().toString("utf8");
      const matches = [...xml.matchAll(/<a:t[^>]*>(.*?)<\/a:t>/g)];
      const body = matches.map((match) => decodeXmlEntities(match[1])).join("\n");
      return `Slide ${index + 1}\n${body}`;
    })
    .filter((item) => compactText(item));

  return {
    text: slides.join("\n\n"),
    structure: "slide",
  };
}

function parseXlsx(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheets = workbook.SheetNames.map((sheetName) => {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
    const text = rows.map((row) => row.join(" | ")).join("\n");
    return `Sheet: ${sheetName}\n${text}`;
  });

  return {
    text: sheets.join("\n\n"),
    structure: "sheet",
  };
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

function fixFilename(name) {
  try {
    const bytes = Buffer.from(name, "binary");
    const decoded = Buffer.from(bytes).toString("utf8");
    const decodedLooksBad = /[\u0000-\u001f]/.test(decoded);
    const originalLooksReadable = /[\u4e00-\u9fa5a-zA-Z0-9_.()\- ]/.test(name);
    if (decodedLooksBad && originalLooksReadable) return name;
    return decoded;
  } catch {
    return name;
  }
}

async function parseFile(file) {
  const originalName = fixFilename(file.originalname);
  const ext = path.extname(originalName).toLowerCase();
  const hash = fingerprintDoc(file);
  const cachePath = path.join(parsedCacheDir, `${hash}.json`);
  const cached = safeReadJson(cachePath);
  if (cached?.text) {
    return { ...cached, size: file.size, hash, fromCache: true };
  }

  const buffer = file.buffer;
  let parsed = { text: "", structure: "document" };

  if ([".txt", ".md", ".csv", ".json"].includes(ext)) {
    parsed = { text: buffer.toString("utf8"), structure: "document" };
  } else if ([".html", ".htm"].includes(ext)) {
    parsed = { text: stripHtml(buffer.toString("utf8")), structure: "document" };
  } else if (ext === ".pdf") {
    parsed = await parsePdf(buffer);
  } else if (ext === ".docx") {
    parsed = await parseDocx(buffer);
  } else if (ext === ".pptx") {
    parsed = parsePptx(buffer);
  } else if (ext === ".xlsx") {
    parsed = parseXlsx(buffer);
  } else {
    throw new Error(`暂不支持解析 ${ext || "该类型"} 文件`);
  }

  const safeName = `${Date.now()}-${originalName.replace(/[^\w.\u4e00-\u9fa5-]/g, "_")}`;
  fs.writeFileSync(path.join(uploadsDir, safeName), buffer);

  const payload = {
    id: `doc-${hash.slice(0, 12)}`,
    name: originalName,
    size: file.size,
    type: ext.replace(".", "") || file.mimetype,
    structure: parsed.structure,
    text: compactText(parsed.text),
    extractedLength: compactText(parsed.text).length,
    hash,
  };

  writeJson(cachePath, payload);
  return payload;
}

async function buildOrLoadProject(files) {
  const docs = [];
  let usedParsedCache = false;

  for (const file of files) {
    const doc = await parseFile(file);
    usedParsedCache = usedParsedCache || Boolean(doc.fromCache);
    docs.push(doc);
  }

  const fingerprint = fingerprintUpload(docs);
  const projectCachePath = path.join(projectCacheDir, `${fingerprint}.json`);
  const cachedProject = safeReadJson(projectCachePath);
  if (cachedProject?.ready) {
    Object.assign(projectState, cachedProject, {
      cached: true,
      status: {
        ...cachedProject.status,
        cache: "命中",
        detail: `${cachedProject.status.detail} 本次直接复用了缓存结果。`,
      },
    });
    writeJson(latestProjectPath, projectState);
    return projectState;
  }

  return buildProjectFromDocs(
    docs.map((doc) => ({ ...doc, fromCache: undefined })),
    { cached: usedParsedCache }
  );
}

function searchProjectChunks(project, message, topK = project?.retrievalConfig?.topK || 4) {
  const terms = tokenize(message);
  if (!terms.length || !project?.chunks?.length) return [];

  return project.chunks
    .map((chunk) => {
      const haystack = `${chunk.sectionTitle}\n${chunk.text}\n${chunk.keywords.join(" ")}`.toLowerCase();
      const matchedTerms = terms.filter((term) => haystack.includes(term));
      const densityScore = matchedTerms.length / Math.max(terms.length, 1);
      const titleBoost = matchedTerms.some((term) => chunk.sectionTitle.toLowerCase().includes(term)) ? 0.8 : 0;
      const typeBoost = chunk.chunkType === "faq" ? 0.3 : chunk.chunkType === "process" ? 0.2 : 0;
      const score = matchedTerms.length + densityScore + titleBoost + typeBoost;
      return { ...chunk, matchedTerms, score };
    })
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score || b.matchedTerms.length - a.matchedTerms.length || a.order - b.order)
    .slice(0, topK);
}

function buildLocalAnswer(project, message) {
  const matches = searchProjectChunks(project, message);
  if (!matches.length) {
    return {
      answer:
        "我在当前资料里没有找到足够直接的依据。建议补充更明确的制度、流程或 FAQ 文件，或者换一种更具体的问法。",
      meta: "本地 RAG：未命中足够相关片段",
      sources: [],
    };
  }

  const answer = matches
    .map(
      (item, index) =>
        `${index + 1}. ${item.sectionTitle}：${item.text.slice(0, 150)}${item.text.length > 150 ? "..." : ""}`
    )
    .join("\n");

  return {
    answer: `根据当前资料检索结果，最相关的内容如下：\n${answer}`,
    meta: `本地 RAG：命中 ${matches.length} 个知识片段`,
    sources: matches.map((item) => ({
      source: item.source,
      sectionTitle: item.sectionTitle,
      chunkId: item.id,
      matchedTerms: item.matchedTerms,
      score: Number(item.score.toFixed(2)),
    })),
  };
}

function scoreProjectQuestions(project, kind, answers) {
  const questions = kind === "quiz" ? project.quiz : project.exam;
  return scoreQuestions(questions, answers || {});
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "onjob-api",
    time: new Date().toISOString(),
    projectReady: Boolean(projectState.ready),
  });
});

app.get("/api/project", (req, res) => {
  const { project } = resolveProject(req, { required: false });
  if (!isProjectLike(project)) {
    return res.json({
      project: {
        ...projectState,
        ready: false,
        files: [],
        docs: [],
        sections: [],
        chunks: [],
        chapters: [],
        quiz: [],
        exam: [],
        insights: [],
      },
    });
  }
  return res.json({ project });
});

app.get("/api/knowledge/search", (req, res) => {
  const query = String(req.query.q || "").trim();
  if (!query) return res.status(400).json({ error: "缺少查询参数 q。" });
  const { project, error } = resolveProject(req);
  if (error) return res.status(400).json({ error });
  if (!project?.ready) return res.status(400).json({ error: "知识库还没有准备好。" });

  res.json({
    query,
    projectId: project.projectId,
    count: project.chunks.length,
    hits: searchProjectChunks(project, query).map((item) => ({
      chunkId: item.id,
      source: item.source,
      sectionTitle: item.sectionTitle,
      chunkType: item.chunkType,
      score: Number(item.score.toFixed(2)),
      matchedTerms: item.matchedTerms,
      text: item.text,
    })),
  });
});

app.post("/api/upload", upload.array("files", 20), async (req, res) => {
  const files = req.files || [];
  if (!files.length) {
    return res.status(400).json({ error: "没有收到文件。" });
  }

  Object.assign(projectState, {
    ready: false,
    cached: false,
    status: {
      overall: "处理中",
      parse: "进行中",
      chunk: "等待中",
      material: "等待中",
      retrieve: "等待中",
      assessment: "等待中",
      cache: "检索中",
      detail: "正在解析上传文件并构建知识库。",
    },
  });

  try {
    const project = await buildOrLoadProject(files);
    return res.json({ project });
  } catch (error) {
    projectState.ready = false;
    projectState.status = {
      overall: "失败",
      parse: "失败",
      chunk: "未开始",
      material: "未开始",
      retrieve: "未开始",
      assessment: "未开始",
      cache: "失败",
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
    const fakeFile = {
      originalname: path.basename(demoPath),
      size: buffer.length,
      mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      buffer,
    };
    const project = await buildOrLoadProject([fakeFile]);
    return res.json({ project });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/chat", async (req, res) => {
  const message = req.body?.message?.trim();
  if (!message) return res.status(400).json({ error: "缺少问题内容。" });
  const { project, error } = resolveProject(req);
  if (error) return res.status(400).json({ error });
  if (!project?.ready) return res.status(400).json({ error: "知识库还没有准备好。" });

  const mimoAnswer = await maybeAskMimo(project, message);
  if (mimoAnswer) return res.json(mimoAnswer);
  return res.json(buildLocalAnswer(project, message));
});

app.post("/api/quiz/submit", (req, res) => {
  const { project, error } = resolveProject(req);
  if (error) return res.status(400).json({ error });
  const result = scoreProjectQuestions(project, "quiz", req.body?.answers || {});
  res.json({
    ...result,
    recommendation:
      result.score >= 80 ? "可以进入综合考试。" : "建议先针对错题章节进行补训，再继续下一步。",
  });
});

app.post("/api/exam/submit", (req, res) => {
  const { project, error } = resolveProject(req);
  if (error) return res.status(400).json({ error });
  const result = scoreProjectQuestions(project, "exam", req.body?.answers || {});
  const weakTopics = [...new Set(result.wrong.map((item) => item.topic))].slice(0, 3);

  res.json({
    ...result,
    weakTopics,
    recommendation:
      result.score >= 80
        ? "综合测试通过，建议进入上岗观察期。"
        : `建议优先回看：${weakTopics.join(" / ") || "基础流程"}。`,
  });
});

app.delete("/api/project", (req, res) => {
  Object.assign(projectState, {
    ready: false,
    projectId: null,
    fingerprint: null,
    generatedAt: null,
    cached: false,
    files: [],
    docs: [],
    sections: [],
    chunks: [],
    chunkCount: 0,
    summary: "",
    keyPoints: [],
    chapters: [],
    quiz: [],
    exam: [],
    insights: [],
    metrics: {
      fileCount: 0,
      sectionCount: 0,
      chunkCount: 0,
      questionCount: 0,
    },
    status: { ...emptyStatus },
  });

  if (fs.existsSync(latestProjectPath)) fs.unlinkSync(latestProjectPath);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`MVP server running at http://127.0.0.1:${PORT}`);
});
