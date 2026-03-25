const express = require("express");
const multer = require("multer");
const ExcelJS = require("exceljs");
const pdfParse = require("pdf-parse");
const fs = require("fs");
const path = require("path");
const router = express.Router();

// Temp directory for generated files
const REPORTS_DIR = path.join(__dirname, "../tmp_reports");
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
const { OpenAI } = require("openai");
const authMiddleware = require("../authMiddleware");
const AgentModel = require("../models/Agent");
const ConversationModel = require("../models/Conversation");
const AgentTaskModel = require("../models/AgentTask");
const UserModel = require("../models/User");
const ProjectModel = require("../models/Project");
const ReceiptModel = require("../models/Receipt");
const { genericToPdf } = require("../pdf/genericToPdf");
const { genericToExcel } = require("../excel/genericToExcel");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function getIncomesModel() {
  try {
    return require("../models/Incomes");
  } catch {
    return null;
  }
}

function getPeriodStartDate(period = "month") {
  const now = new Date();

  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    return new Date(now.getFullYear(), q * 3, 1);
  }

  return new Date(now.getFullYear(), 0, 1);
}

function getPeriodLabel(period = "month") {
  return {
    month: "This Month",
    quarter: "This Quarter",
    year: "This Year",
  }[period] || period;
}

function safeCsvValue(value) {
  const stringValue = value == null ? "" : String(value);
  if (/[,"\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function buildCsv(rows = []) {
  return rows.map((row) => row.map(safeCsvValue).join(",")).join("\n");
}

async function buildUserContext(userId) {
  const [user, projects, receipts] = await Promise.all([
    UserModel.findById(userId).select(
      "name businessName currency locale totalIncomes totalExpenses subscription"
    ),
    ProjectModel.find({ userId })
      .select("name payment expenses days paid")
      .limit(20)
      .lean(),
    ReceiptModel.find({ userId })
      .select("category sumOfReceipt createdAt")
      .sort({ createdAt: -1 })
      .limit(30)
      .lean(),
  ]);

  const totalProjectValue = projects.reduce((s, p) => s + (Number(p.payment) || 0), 0);
  const totalProjectExpenses = projects.reduce((s, p) => s + (Number(p.expenses) || 0), 0);
  const totalReceiptsSum = receipts.reduce((s, r) => s + (Number(r.sumOfReceipt) || 0), 0);

  const categoryBreakdown = receipts.reduce((acc, r) => {
    const cat = r.category || "Uncategorized";
    acc[cat] = (acc[cat] || 0) + Number(r.sumOfReceipt || 0);
    return acc;
  }, {});

  return {
    user: {
      name: user?.name,
      businessName: user?.businessName,
      currency: user?.currency || "USD",
      locale: user?.locale || "en-US",
      totalIncomes: user?.totalIncomes || 0,
      totalExpenses: user?.totalExpenses || 0,
    },
    projects: projects.map((p) => ({
      name: p.name,
      payment: p.payment,
      expenses: p.expenses,
      paid: p.paid,
      profit: (Number(p.payment) || 0) - (Number(p.expenses) || 0),
    })),
    finance: {
      totalProjectValue,
      totalProjectExpenses,
      netProjectProfit: totalProjectValue - totalProjectExpenses,
      totalReceiptsSum,
      categoryBreakdown,
    },
  };
}

function buildSystemPrompt(agent, userContext) {
  const { user, projects, finance } = userContext;

  const base =
    agent.systemPrompt ||
    `You are ${agent.name}, a personal AI accountant and business assistant for ${user.name || "the user"}.
You work exclusively for this user and have full access to their business data.
Always answer in the user's preferred language. Be practical, concise, and professional.
You can create quotes, generate financial reports, summarize expenses and income, help with invoices, and answer any business finance questions.
Always use the user's currency (${user.currency}) and their business context.`;

  const context = `
## Current Business Context
Business: ${user.businessName || user.name}
Currency: ${user.currency}
Total income recorded: ${user.totalIncomes || 0}
Total expenses recorded: ${user.totalExpenses || 0}

## Projects (${projects.length})
${projects.map((p) => `- ${p.name}: value ${p.payment}, expenses ${p.expenses}, profit ${p.profit}`).join("\n") || "No projects yet."}

## Finance Summary
Total project value: ${finance.totalProjectValue}
Total project expenses: ${finance.totalProjectExpenses}
Net project profit: ${finance.netProjectProfit}
Total receipts sum: ${finance.totalReceiptsSum}

Expense categories:
${Object.entries(finance.categoryBreakdown).map(([k, v]) => `- ${k}: ${v}`).join("\n") || "No expense categories yet."}
`;

  return base + "\n\n" + context;
}

async function getCashflowReportData(userId, period = "month") {
  const IncomesModel = getIncomesModel();
  const startDate = getPeriodStartDate(period);

  const [incomeData, expenseData, user] = await Promise.all([
    IncomesModel
      ? IncomesModel.find({ userId, createdAt: { $gte: startDate } })
          .sort({ createdAt: -1 })
          .limit(100)
          .lean()
          .catch(() => [])
      : Promise.resolve([]),
    ReceiptModel.find({ userId, createdAt: { $gte: startDate } })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
      .catch(() => []),
    UserModel.findById(userId).select("name businessName currency locale"),
  ]);

  const incomes = incomeData.map((i) => ({
    description: i.payer || i.customerName || i.projectName || "Income",
    name: i.payer || i.customerName || i.projectName || "Income",
    amount: Number(i.amount || i.total || i.subtotal || 0),
    date: i.date || i.createdAt,
  }));

  const expenses = expenseData.map((e) => ({
    category: e.category || "Expense",
    description: e.category || "Expense",
    amount: Number(e.sumOfReceipt || e.amount || 0),
    date: e.occurrenceDate || e.createdAt,
    createdAt: e.createdAt,
  }));

  const totalIncome = incomes.reduce((s, i) => s + i.amount, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  return {
    businessName: user?.businessName || user?.name || "Your Business",
    period: getPeriodLabel(period),
    currency: user?.currency || "USD",
    totalIncome,
    totalExpenses,
    netCashFlow: totalIncome - totalExpenses,
    incomes,
    expenses,
    generatedAt: new Date().toLocaleDateString(),
  };
}

async function getProjectsReportData(userId, period = "month") {
  const startDate = getPeriodStartDate(period);
  return ProjectModel.find({ userId, createdAt: { $gte: startDate } })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
}

async function getExpensesReportData(userId, period = "month") {
  const startDate = getPeriodStartDate(period);
  return ReceiptModel.find({ userId, createdAt: { $gte: startDate } })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
}

async function extractExcelText(fileBuffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer);

  const sections = [];
  workbook.eachSheet((worksheet) => {
    const rows = [];
    worksheet.eachRow((row) => {
      const values = row.values
        .slice(1)
        .map((value) => {
          if (value == null) return "";
          if (typeof value === "object") {
            if (value.text) return value.text;
            if (value.result) return String(value.result);
            return JSON.stringify(value);
          }
          return String(value);
        })
        .filter(Boolean);

      if (values.length) rows.push(values.join(" | "));
    });

    sections.push(`Sheet: ${worksheet.name}\n${rows.join("\n")}`);
  });

  return sections.join("\n\n").trim();
}

async function saveUploadedFileMessage({ conversationId, userId, filename, text }) {
  if (!conversationId) return;

  const conversation = await ConversationModel.findOne({
    _id: conversationId,
    userId,
  });

  if (!conversation) return;

  conversation.messages.push({
    role: "user",
    content: `[File uploaded: ${filename}]\n\n${(text || "").slice(0, 3000)}`,
  });
  conversation.lastMessageAt = new Date();
  await conversation.save();
}

// ─── Agent CRUD ──────────────────────────────────────────────────────────────

router.get("/agent", authMiddleware, async (req, res) => {
  try {
    let agent = await AgentModel.findOne({ userId: req.userId });

    if (!agent) {
      const user = await UserModel.findById(req.userId).select("name");
      agent = await AgentModel.create({
        userId: req.userId,
        name: `${user?.name ? user.name + "'s" : "My"} Assistant`,
        persona: "accountant",
      });
    }

    res.json(agent);
  } catch (err) {
    console.error("GET /agent error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/agent", authMiddleware, async (req, res) => {
  try {
    const { name, persona, systemPrompt, language } = req.body;

    const agent = await AgentModel.findOneAndUpdate(
      { userId: req.userId },
      { name, persona, systemPrompt, language },
      { new: true, upsert: true }
    );

    res.json(agent);
  } catch (err) {
    console.error("PUT /agent error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── Conversations ───────────────────────────────────────────────────────────

router.get("/agent/conversations", authMiddleware, async (req, res) => {
  try {
    const conversations = await ConversationModel.find({ userId: req.userId })
      .select("title lastMessageAt createdAt")
      .sort({ lastMessageAt: -1 })
      .limit(30);

    res.json(conversations);
  } catch (err) {
    console.error("GET /agent/conversations error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/agent/conversations", authMiddleware, async (req, res) => {
  try {
    const { title } = req.body;

    let agent = await AgentModel.findOne({ userId: req.userId });
    if (!agent) {
      const user = await UserModel.findById(req.userId).select("name");
      agent = await AgentModel.create({
        userId: req.userId,
        name: `${user?.name ? user.name + "'s" : "My"} Assistant`,
        persona: "accountant",
      });
    }

    const conversation = await ConversationModel.create({
      userId: req.userId,
      agentId: agent._id,
      title: title || "New conversation",
      messages: [],
    });

    res.status(201).json(conversation);
  } catch (err) {
    console.error("POST /agent/conversations error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/agent/conversations/:id", authMiddleware, async (req, res) => {
  try {
    const conversation = await ConversationModel.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    res.json(conversation);
  } catch (err) {
    console.error("GET /agent/conversations/:id error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/agent/conversations/:id", authMiddleware, async (req, res) => {
  try {
    await ConversationModel.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /agent/conversations/:id error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post(
  "/agent/upload",
  authMiddleware,
  upload.single("file"),
  async (req, res) => {
    try {
      const file = req.file;
      const conversationId = req.body?.conversationId || null;

      if (!file) {
        return res.status(400).json({ message: "File is required" });
      }

      const originalName = file.originalname || "upload";
      const ext = originalName.split(".").pop()?.toLowerCase();
      const mime = file.mimetype;
      let type;
      let text = "";

      if (mime === "application/pdf" || ext === "pdf") {
        type = "pdf";
        const parsed = await pdfParse(file.buffer);
        text = parsed.text?.trim() || "";
      } else if (
        mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        ext === "xlsx"
      ) {
        type = "excel";
        text = await extractExcelText(file.buffer);
      } else if (mime === "text/csv" || ext === "csv") {
        type = "csv";
        text = file.buffer.toString("utf8");
      } else if (mime === "text/plain" || ext === "txt") {
        type = "txt";
        text = file.buffer.toString("utf8");
      } else {
        return res.status(400).json({ message: "Unsupported file type" });
      }

      await saveUploadedFileMessage({
        conversationId,
        userId: req.userId,
        filename: originalName,
        text,
      });

      return res.json({
        type,
        text,
        filename: originalName,
      });
    } catch (err) {
      console.error("POST /agent/upload error:", err);
      return res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// ─── Agent tools (generic) ───────────────────────────────────────────────────

const AGENT_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_business_data",
      description:
        "Fetch real financial data from the database for a given period. " +
        "ALWAYS call this first before generating any PDF or Excel file that involves financial figures, transactions, projects, or expenses. " +
        "Returns actual income entries, expense entries, projects, and summary totals.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            enum: ["month", "quarter", "year"],
            description: "Time period to fetch data for",
          },
          include: {
            type: "array",
            items: { type: "string", enum: ["cashflow", "projects", "expenses"] },
            description: "Which data sets to include",
          },
        },
        required: ["period", "include"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_pdf",
      description:
        "Generate any PDF document the user asks for — reports, invoices, summaries, analyses, cash flow, anything. " +
        "You define the full document structure: title, subtitle, and sections. Each section can have a heading, text content, and/or a table. " +
        "If the document needs real financial data, call get_business_data first, then use that data to fill the sections. " +
        "Call this whenever the user wants a PDF, report, or printable document.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Document title" },
          subtitle: { type: "string", description: "Optional subtitle or period description" },
          sections: {
            type: "array",
            description: "Ordered list of document sections",
            items: {
              type: "object",
              properties: {
                heading: { type: "string" },
                content: { type: "string", description: "Paragraph text for this section" },
                table: {
                  type: "object",
                  properties: {
                    headers: { type: "array", items: { type: "string" } },
                    rows: {
                      type: "array",
                      items: { type: "array", items: { type: "string" } }
                    }
                  }
                }
              }
            }
          }
        },
        required: ["title", "sections"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_excel",
      description:
        "Generate any Excel (.xlsx) spreadsheet the user asks for — cashflow, expenses, projects, employees, custom tables, anything. " +
        "You define the full workbook: one or more sheets, each with headers and rows. " +
        "Use the business data you already know from context. Call this whenever the user wants an Excel file, spreadsheet, or XLSX export.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Workbook title (for filename)" },
          sheets: {
            type: "array",
            description: "List of worksheets",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Sheet tab name" },
                headers: { type: "array", items: { type: "string" } },
                rows: {
                  type: "array",
                  items: { type: "array", items: { type: "string" } }
                }
              },
              required: ["name", "headers", "rows"]
            }
          }
        },
        required: ["title", "sheets"]
      }
    }
  }
];

async function executeTool(toolName, toolArgs, userId) {
  if (toolName === "get_business_data") {
    const { period = "month", include = ["cashflow"] } = toolArgs;
    const result = {};

    if (include.includes("cashflow")) {
      const data = await getCashflowReportData(userId, period);
      result.cashflow = {
        period: getPeriodLabel(period),
        totalIncome: data.totalIncome,
        totalExpenses: data.totalExpenses,
        netCashFlow: data.netCashFlow,
        currency: data.currency,
        incomes: data.incomes.slice(0, 50).map((i) => ({
          description: i.name || i.description || "Income",
          date: i.date ? new Date(i.date).toLocaleDateString() : "",
          amount: i.amount,
        })),
        expenses: data.expenses.slice(0, 50).map((e) => ({
          category: e.category || "Expense",
          date: e.date ? new Date(e.date).toLocaleDateString() : "",
          amount: e.amount,
        })),
      };
    }

    if (include.includes("projects")) {
      const projects = await getProjectsReportData(userId, period);
      result.projects = projects.slice(0, 50).map((p) => ({
        name: p.name || "Untitled",
        client: p.client || "",
        status: p.status || "",
        value: Number(p.payment || 0),
        paid: Number(p.paid || 0),
        outstanding: Number(p.payment || 0) - Number(p.paid || 0),
        date: p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "",
      }));
    }

    if (include.includes("expenses")) {
      const expenses = await getExpensesReportData(userId, period);
      result.expenses = expenses.slice(0, 50).map((e) => ({
        category: e.category || "General",
        amount: Number(e.sumOfReceipt || e.amount || 0),
        date: e.createdAt ? new Date(e.createdAt).toLocaleDateString() : "",
      }));
    }

    return { type: "data", data: result };
  }

  if (toolName === "generate_pdf") {
    console.log("[PDF] generate_pdf called, sections:", JSON.stringify(toolArgs.sections?.length), "title:", toolArgs.title);
    const user = await UserModel.findById(userId).select("name businessName").lean().catch(() => null);
    try {
      const buf = await genericToPdf({
        title: toolArgs.title || "Report",
        subtitle: toolArgs.subtitle || "",
        businessName: user?.businessName || user?.name || "",
        sections: toolArgs.sections || [],
      });
      console.log("[PDF] buffer size:", buf?.length);
      if (!buf || buf.length < 100) throw new Error("PDF buffer is empty or too small");
      const slug = (toolArgs.title || "report").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 30);
      return {
        type: "pdf",
        buffer: buf,
        filename: `${slug}-${Date.now()}.pdf`,
        message: `Here is your PDF: ${toolArgs.title}.`,
      };
    } catch (pdfErr) {
      console.error("[PDF] generation failed:", pdfErr.message);
      throw pdfErr;
    }
  }

  if (toolName === "generate_excel") {
    const buf = await genericToExcel({
      title: toolArgs.title || "Report",
      sheets: toolArgs.sheets || [],
    });
    const slug = (toolArgs.title || "report").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 30);
    return {
      type: "excel",
      buffer: buf,
      filename: `${slug}-${Date.now()}.xlsx`,
      message: `Here is your Excel file: ${toolArgs.title}.`,
    };
  }

  return null;
}


// ─── Chat ────────────────────────────────────────────────────────────────────

router.post("/agent/chat", authMiddleware, async (req, res) => {
  try {
    const { conversationId, message } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ message: "Message is required" });
    }

    let conversation;
    if (conversationId) {
      conversation = await ConversationModel.findOne({
        _id: conversationId,
        userId: req.userId,
      });
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
    } else {
      let agent = await AgentModel.findOne({ userId: req.userId });
      if (!agent) {
        const user = await UserModel.findById(req.userId).select("name");
        agent = await AgentModel.create({
          userId: req.userId,
          name: `${user?.name ? user.name + "'s" : "My"} Assistant`,
          persona: "accountant",
        });
      }
      conversation = await ConversationModel.create({
        userId: req.userId,
        agentId: agent._id,
        title: message.slice(0, 60),
        messages: [],
      });
    }

    const agent = await AgentModel.findById(conversation.agentId);
    const userContext = await buildUserContext(req.userId);
    const systemPrompt = buildSystemPrompt(agent, userContext);

    conversation.messages.push({ role: "user", content: message });

    const recentMessages = conversation.messages.slice(-20).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "system", content: systemPrompt }, ...recentMessages],
      tools: AGENT_TOOLS,
      tool_choice: "auto",
      max_tokens: 1200,
    });

    const choice = completion.choices?.[0];
    const toolCalls = choice?.message?.tool_calls;

    // ── Tool call path (multi-turn loop) ───────────────────────────────────
    if (toolCalls?.length > 0) {
      const openaiMessages = [{ role: "system", content: systemPrompt }, ...recentMessages];
      let currentChoice = choice;
      const MAX_TOOL_ROUNDS = 5;

      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const currentToolCalls = currentChoice?.message?.tool_calls;
        if (!currentToolCalls?.length) break;

        const toolCall = currentToolCalls[0];
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments || "{}");

        let toolResult;
        try {
          toolResult = await executeTool(toolName, toolArgs, req.userId);
        } catch (toolErr) {
          console.error(`Tool ${toolName} error:`, toolErr);
          toolResult = { error: toolErr.message };
        }

        // File produced — save to disk and return download URL
        if (["pdf", "excel", "csv"].includes(toolResult?.type)) {
          const filename = toolResult.filename || `report-${Date.now()}.${toolResult.type}`;
          const filePath = path.join(REPORTS_DIR, filename);

          if (toolResult.buffer) {
            fs.writeFileSync(filePath, toolResult.buffer);
          } else if (toolResult.content) {
            fs.writeFileSync(filePath, toolResult.content, "utf8");
          }

          // Auto-delete after 1 hour
          setTimeout(() => { try { fs.unlinkSync(filePath); } catch {} }, 60 * 60 * 1000);

          const attachment = {
            type: toolResult.type,
            filename,
            downloadUrl: `/agent/download/${encodeURIComponent(filename)}`,
          };

          const reply = toolResult.message || `Here is your ${toolResult.type.toUpperCase()} file.`;

          conversation.messages.push({ role: "assistant", content: reply, attachment });
          conversation.lastMessageAt = new Date();
          if (conversation.messages.length === 2) conversation.title = message.slice(0, 60);
          await conversation.save();

          return res.json({
            conversationId: conversation._id,
            reply,
            title: conversation.title,
            attachment,
          });
        }

        // Data result — feed back to model and let it continue
        const toolResultText = toolResult
          ? JSON.stringify(toolResult.data || toolResult)
          : "No result.";

        openaiMessages.push(currentChoice.message);
        openaiMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: toolResultText,
        });

        const next = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: openaiMessages,
          tools: AGENT_TOOLS,
          tool_choice: "auto",
          max_tokens: 2000,
        });

        currentChoice = next.choices?.[0];
      }

      // Final text reply after tool loop
      const reply = currentChoice?.message?.content?.trim() || "Done.";
      conversation.messages.push({ role: "assistant", content: reply });
      conversation.lastMessageAt = new Date();
      if (conversation.messages.length === 2) conversation.title = message.slice(0, 60);
      await conversation.save();

      return res.json({ conversationId: conversation._id, reply, title: conversation.title });
    }

    conversation.messages.push({ role: "assistant", content: reply });
    conversation.lastMessageAt = new Date();
    if (conversation.messages.length === 2) conversation.title = message.slice(0, 60);
    await conversation.save();

    res.json({ conversationId: conversation._id, reply, title: conversation.title });
  } catch (err) {
    console.error("POST /agent/chat error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ─── File download ───────────────────────────────────────────────────────────

router.get("/agent/download/:filename", authMiddleware, (req, res) => {
  const filename = decodeURIComponent(req.params.filename);
  const filePath = path.join(REPORTS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: "File not found or expired" });
  }

  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    ".pdf": "application/pdf",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".csv": "text/csv",
  };

  res.setHeader("Content-Type", mimeTypes[ext] || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.sendFile(filePath);
});

// ─── Tasks ───────────────────────────────────────────────────────────────────

router.get("/agent/tasks", authMiddleware, async (req, res) => {
  try {
    const tasks = await AgentTaskModel.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(tasks);
  } catch (err) {
    console.error("GET /agent/tasks error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/agent/tasks", authMiddleware, async (req, res) => {
  try {
    const { type, title, description, conversationId } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Task title is required" });
    }

    let agent = await AgentModel.findOne({ userId: req.userId });
    if (!agent) {
      const user = await UserModel.findById(req.userId).select("name");
      agent = await AgentModel.create({
        userId: req.userId,
        name: `${user?.name ? user.name + "'s" : "My"} Assistant`,
        persona: "accountant",
      });
    }

    const task = await AgentTaskModel.create({
      userId: req.userId,
      agentId: agent._id,
      conversationId: conversationId || null,
      type: type || "custom",
      title,
      description,
      status: "in_progress",
    });

    try {
      const userContext = await buildUserContext(req.userId);
      const systemPrompt = buildSystemPrompt(agent, userContext);

      const taskPrompt = `Task type: ${type || "custom"}
Task: ${title}
${description ? `Details: ${description}` : ""}

Please complete this task for the user. Return a clear, professional response.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: taskPrompt },
        ],
        max_tokens: 2000,
      });

      const result = completion.choices?.[0]?.message?.content?.trim();

      task.status = "completed";
      task.resultText = result;
      task.result = { text: result };
    } catch (aiErr) {
      console.error("Task AI error:", aiErr);
      task.status = "failed";
      task.result = { error: aiErr.message };
    }

    await task.save();
    res.status(201).json(task);
  } catch (err) {
    console.error("POST /agent/tasks error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/agent/tasks/:id", authMiddleware, async (req, res) => {
  try {
    await AgentTaskModel.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /agent/tasks/:id error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
