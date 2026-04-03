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
const Anthropic = require("@anthropic-ai/sdk");
const authMiddleware = require("../authMiddleware");
const AgentModel = require("../models/Agent");
const ConversationModel = require("../models/Conversation");
const AgentTaskModel = require("../models/AgentTask");
const UserModel = require("../models/User");
const ProjectModel = require("../models/Project");
const ReceiptModel = require("../models/Receipt");
const { genericToPdf } = require("../pdf/genericToPdf");
const { genericToExcel } = require("../excel/genericToExcel");

const https = require("https");
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 30000,
  httpAgent: new https.Agent({ keepAlive: false }),
});
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-opus-4-5-20250514";

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
  const IncomesModel = getIncomesModel();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [user, projects, receipts, recentIncomes] = await Promise.all([
    UserModel.findById(userId).select(
      "name businessName currency locale totalIncomes totalExpenses subscription"
    ),
    ProjectModel.find({ userId })
      .select("name payment expenses days paid status client createdAt")
      .sort({ createdAt: -1 })
      .limit(30)
      .lean(),
    ReceiptModel.find({ userId })
      .select("category sumOfReceipt createdAt occurrenceDate")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
    IncomesModel
      ? IncomesModel.find({ userId, createdAt: { $gte: sixMonthsAgo } })
          .select("amount total payer customerName projectName date createdAt")
          .sort({ createdAt: -1 })
          .limit(50)
          .lean()
          .catch(() => [])
      : Promise.resolve([]),
  ]);

  const totalProjectValue = projects.reduce((s, p) => s + (Number(p.payment) || 0), 0);
  const totalProjectExpenses = projects.reduce((s, p) => s + (Number(p.expenses) || 0), 0);
  const totalReceiptsSum = receipts.reduce((s, r) => s + (Number(r.sumOfReceipt) || 0), 0);
  const unpaidProjects = projects.filter((p) => !p.paid);
  const totalOutstanding = unpaidProjects.reduce((s, p) => s + (Number(p.payment) || 0) - (Number(p.expenses) || 0), 0);

  const categoryBreakdown = receipts.reduce((acc, r) => {
    const cat = r.category || "Uncategorized";
    acc[cat] = (acc[cat] || 0) + Number(r.sumOfReceipt || 0);
    return acc;
  }, {});

  // Monthly trend — last 6 months
  const monthlyTrend = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyTrend[key] = { income: 0, expenses: 0 };
  }

  recentIncomes.forEach((inc) => {
    const d = new Date(inc.date || inc.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (monthlyTrend[key]) monthlyTrend[key].income += Number(inc.amount || inc.total || 0);
  });

  receipts.forEach((r) => {
    const d = new Date(r.occurrenceDate || r.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (monthlyTrend[key]) monthlyTrend[key].expenses += Number(r.sumOfReceipt || 0);
  });

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
      status: p.status,
      client: p.client,
    })),
    finance: {
      totalProjectValue,
      totalProjectExpenses,
      netProjectProfit: totalProjectValue - totalProjectExpenses,
      totalReceiptsSum,
      categoryBreakdown,
      unpaidProjectsCount: unpaidProjects.length,
      totalOutstanding,
      monthlyTrend,
    },
  };
}

function buildSystemPrompt(agent, userContext) {
  const { user, projects, finance } = userContext;

  const trendLines = Object.entries(finance.monthlyTrend || {})
    .map(([month, d]) => `  ${month}: income ${d.income.toFixed(2)}, expenses ${d.expenses.toFixed(2)}, net ${(d.income - d.expenses).toFixed(2)}`)
    .join("\n");

  const topCategories = Object.entries(finance.categoryBreakdown || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([k, v]) => `  ${k}: ${v.toFixed(2)}`)
    .join("\n");

  const systemPrompt = agent.systemPrompt || `You are ${agent.name}, an elite financial AI assistant and CFO-level advisor for ${user.businessName || user.name || "this business"}.

## Your Expertise
You have deep mastery of:
- Business accounting, bookkeeping, P&L analysis, and financial reporting
- Cash flow management, revenue forecasting, and expense optimization
- Invoice management, accounts receivable, and outstanding payments
- Budget planning, KPI tracking, and business health diagnostics
- Financial document generation: reports, summaries, spreadsheets, invoices
- Business strategy, cost reduction, and profitability improvement

You apply universal financial principles — your knowledge is global and not tied to any specific country or tax system. When local tax or legal specifics are needed, you acknowledge them and advise the user to consult a local accountant.

## Your Behavior
- **Always fetch fresh data first** — before answering any financial question, call get_business_data or get_financial_trends to get real numbers. Never estimate from memory.
- **Be proactive** — when you see financial data, surface insights the user didn't ask about: unusual spikes, outstanding payments, negative cash flow months, high expense categories, etc.
- **Think like a CFO** — give strategic advice, not just numbers. If revenue is down 20% MoM, say so and suggest why and what to do.
- **Be direct and concise** — lead with the key insight, then supporting details. No filler.
- **Always use ${user.currency}** for all amounts.
- **Answer in the user's language** — detect from their message and respond in the same language.
- **When generating documents** — make them professional, comprehensive, and well-structured. Always call get_business_data first to populate with real figures.
- **Flag problems clearly** — if you see a financial risk or issue, say it directly and suggest a concrete fix.

## What You Are Not
- Not a generic chatbot — you are this specific business's dedicated financial expert
- Not a substitute for a licensed accountant for tax filings — advise accordingly when relevant`;

  const context = `
## Live Business Data — ${user.businessName || user.name}
Currency: ${user.currency}
Total lifetime income: ${user.totalIncomes || 0} ${user.currency}
Total lifetime expenses: ${user.totalExpenses || 0} ${user.currency}

## Projects Overview (${projects.length} total)
${projects.slice(0, 15).map((p) => `- ${p.name}${p.client ? ` [${p.client}]` : ""}: value ${p.payment || 0}, expenses ${p.expenses || 0}, profit ${p.profit || 0}, paid: ${p.paid ? "yes" : "no"}`).join("\n") || "No projects yet."}
${finance.unpaidProjectsCount > 0 ? `\n⚠️ OUTSTANDING: ${finance.unpaidProjectsCount} unpaid project(s) totaling ${finance.totalOutstanding.toFixed(2)} ${user.currency}` : ""}

## Financial Summary
Total project value: ${finance.totalProjectValue.toFixed(2)} ${user.currency}
Total project expenses: ${finance.totalProjectExpenses.toFixed(2)} ${user.currency}
Net project profit: ${finance.netProjectProfit.toFixed(2)} ${user.currency}
Total receipts/expenses logged: ${finance.totalReceiptsSum.toFixed(2)} ${user.currency}

## Expense Categories (recent)
${topCategories || "No expenses recorded yet."}

## Monthly Trend (last 6 months)
${trendLines || "No trend data available."}
`;

  return systemPrompt + "\n\n" + context;
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

// ─── Agent tools (Anthropic format) ─────────────────────────────────────────

const AGENT_TOOLS = [
  {
    name: "get_financial_trends",
    description:
      "Fetch month-by-month income and expense breakdown for trend analysis, forecasting, and growth insights. " +
      "Use this when the user asks about trends, growth, forecasts, comparisons between months, or when you want to proactively surface financial patterns.",
    input_schema: {
      type: "object",
      properties: {
        months: {
          type: "number",
          description: "Number of past months to include (default 6, max 12)",
        },
      },
      required: [],
    },
  },
  {
    name: "search_transactions",
    description:
      "Search income or expense transactions by keyword, category, or date range. " +
      "Use when the user asks about a specific client, category, expense type, or time period.",
    input_schema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["income", "expense", "both"],
          description: "Which transaction type to search",
        },
        keyword: {
          type: "string",
          description: "Optional keyword to filter by (client name, category, description)",
        },
        period: {
          type: "string",
          enum: ["month", "quarter", "year", "all"],
          description: "Time period to search within",
        },
      },
      required: ["type"],
    },
  },
  {
    name: "get_business_data",
    description:
      "Fetch real financial data from the database for a given period. " +
      "ALWAYS call this first before generating any PDF or Excel file that involves financial figures, transactions, projects, or expenses. " +
      "Returns actual income entries, expense entries, projects, and summary totals.",
    input_schema: {
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
  {
    name: "generate_pdf",
    description:
      "Generate any PDF document the user asks for — reports, invoices, summaries, cash flow, anything. " +
      "You define the full document structure: title, subtitle, and sections. Each section can have a heading, text content, and/or a table. " +
      "If the document needs real financial data, call get_business_data first, then use that data to fill the sections. " +
      "Call this whenever the user wants a PDF, report, or printable document.",
    input_schema: {
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
                  rows: { type: "array", items: { type: "array", items: { type: "string" } } },
                },
              },
            },
          },
        },
      },
      required: ["title", "sections"],
    },
  },
  {
    name: "generate_excel",
    description:
      "Generate any Excel (.xlsx) spreadsheet the user asks for — cashflow, expenses, projects, custom tables, anything. " +
      "You define the full workbook: one or more sheets, each with headers and rows. " +
      "If the document needs real financial data, call get_business_data first. " +
      "Call this whenever the user wants an Excel file, spreadsheet, or XLSX export.",
    input_schema: {
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
              rows: { type: "array", items: { type: "array", items: { type: "string" } } },
            },
            required: ["name", "headers", "rows"],
          },
        },
      },
      required: ["title", "sheets"],
    },
  },
];

async function executeTool(toolName, toolArgs, userId) {
  if (toolName === "get_financial_trends") {
    const IncomesModel = getIncomesModel();
    const months = Math.min(Number(toolArgs.months) || 6, 12);
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const [incomes, expenses, user] = await Promise.all([
      IncomesModel
        ? IncomesModel.find({ userId, createdAt: { $gte: startDate } })
            .select("amount total payer customerName projectName date createdAt")
            .lean()
            .catch(() => [])
        : Promise.resolve([]),
      ReceiptModel.find({ userId, createdAt: { $gte: startDate } })
        .select("category sumOfReceipt createdAt occurrenceDate")
        .lean(),
      UserModel.findById(userId).select("currency").lean(),
    ]);

    const currency = user?.currency || "USD";
    const trend = {};

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      trend[key] = { income: 0, expenses: 0, net: 0 };
    }

    incomes.forEach((inc) => {
      const d = new Date(inc.date || inc.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (trend[key]) trend[key].income += Number(inc.amount || inc.total || 0);
    });

    expenses.forEach((e) => {
      const d = new Date(e.occurrenceDate || e.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (trend[key]) trend[key].expenses += Number(e.sumOfReceipt || 0);
    });

    Object.keys(trend).forEach((k) => {
      trend[k].net = trend[k].income - trend[k].expenses;
    });

    const months_data = Object.entries(trend).map(([month, d]) => ({
      month,
      income: parseFloat(d.income.toFixed(2)),
      expenses: parseFloat(d.expenses.toFixed(2)),
      net: parseFloat(d.net.toFixed(2)),
    }));

    const totalIncome = months_data.reduce((s, m) => s + m.income, 0);
    const totalExpenses = months_data.reduce((s, m) => s + m.expenses, 0);
    const avgMonthlyIncome = totalIncome / months;
    const avgMonthlyExpenses = totalExpenses / months;

    // Simple linear forecast for next month
    const last3 = months_data.slice(-3);
    const forecastIncome = last3.length ? last3.reduce((s, m) => s + m.income, 0) / last3.length : avgMonthlyIncome;
    const forecastExpenses = last3.length ? last3.reduce((s, m) => s + m.expenses, 0) / last3.length : avgMonthlyExpenses;

    return {
      type: "data",
      data: {
        currency,
        periods: months_data,
        summary: {
          totalIncome: parseFloat(totalIncome.toFixed(2)),
          totalExpenses: parseFloat(totalExpenses.toFixed(2)),
          totalNet: parseFloat((totalIncome - totalExpenses).toFixed(2)),
          avgMonthlyIncome: parseFloat(avgMonthlyIncome.toFixed(2)),
          avgMonthlyExpenses: parseFloat(avgMonthlyExpenses.toFixed(2)),
        },
        forecast: {
          nextMonthIncome: parseFloat(forecastIncome.toFixed(2)),
          nextMonthExpenses: parseFloat(forecastExpenses.toFixed(2)),
          nextMonthNet: parseFloat((forecastIncome - forecastExpenses).toFixed(2)),
          note: "Forecast based on 3-month moving average",
        },
      },
    };
  }

  if (toolName === "search_transactions") {
    const { type = "both", keyword = "", period = "month" } = toolArgs;
    const IncomesModel = getIncomesModel();
    const startDate = period === "all" ? new Date(0) : getPeriodStartDate(period);
    const kw = keyword.toLowerCase();
    const results = { income: [], expense: [] };

    if ((type === "income" || type === "both") && IncomesModel) {
      const incomes = await IncomesModel.find({ userId, createdAt: { $gte: startDate } })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean()
        .catch(() => []);

      results.income = incomes
        .filter((i) => {
          if (!kw) return true;
          const searchable = [i.payer, i.customerName, i.projectName, i.description]
            .join(" ")
            .toLowerCase();
          return searchable.includes(kw);
        })
        .slice(0, 50)
        .map((i) => ({
          description: i.payer || i.customerName || i.projectName || "Income",
          amount: Number(i.amount || i.total || 0),
          date: i.date || i.createdAt,
        }));
    }

    if (type === "expense" || type === "both") {
      const expenses = await ReceiptModel.find({ userId, createdAt: { $gte: startDate } })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();

      results.expense = expenses
        .filter((e) => {
          if (!kw) return true;
          const searchable = [e.category, e.description, e.vendor, e.notes]
            .join(" ")
            .toLowerCase();
          return searchable.includes(kw);
        })
        .slice(0, 50)
        .map((e) => ({
          category: e.category || "Expense",
          amount: Number(e.sumOfReceipt || e.amount || 0),
          date: e.occurrenceDate || e.createdAt,
        }));
    }

    const totalIncome = results.income.reduce((s, i) => s + i.amount, 0);
    const totalExpense = results.expense.reduce((s, e) => s + e.amount, 0);

    return {
      type: "data",
      data: {
        keyword: keyword || "all",
        period: getPeriodLabel(period === "all" ? "year" : period),
        income: results.income,
        expense: results.expense,
        totals: {
          income: parseFloat(totalIncome.toFixed(2)),
          expense: parseFloat(totalExpense.toFixed(2)),
          net: parseFloat((totalIncome - totalExpense).toFixed(2)),
        },
      },
    };
  }

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
  console.log("[AGENT] /chat hit — userId:", req.userId);
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

    console.log("[AGENT] building context for userId:", req.userId);
    const agent = await AgentModel.findById(conversation.agentId);
    const userContext = await buildUserContext(req.userId);
    const systemPrompt = buildSystemPrompt(agent, userContext);
    console.log("[AGENT] context built, calling Claude model:", CLAUDE_MODEL);

    conversation.messages.push({ role: "user", content: message });

    const recentMessages = conversation.messages.slice(-20).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // ── First Claude call ──────────────────────────────────────────────────
    const claudeMessages = recentMessages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    }));

    // Anthropic requires messages to alternate user/assistant — ensure first is user
    const sanitizedMessages = claudeMessages.filter((m) =>
      ["user", "assistant"].includes(m.role)
    );

    const MAX_TOOL_ROUNDS = 5;
    let currentMessages = [...sanitizedMessages];
    let finalReply = null;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      console.log(`[AGENT] Claude round ${round + 1}, messages: ${currentMessages.length}`);
      const claudeCall = anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 2000,
        system: systemPrompt,
        messages: currentMessages,
        tools: AGENT_TOOLS,
      });
      const response = await Promise.race([
        claudeCall,
        new Promise((_, reject) => setTimeout(() => reject(new Error("Anthropic API timeout after 25s")), 25000)),
      ]);

      // Extract text and tool_use blocks
      const textBlock = response.content.find((b) => b.type === "text");
      const toolUseBlock = response.content.find((b) => b.type === "tool_use");

      if (!toolUseBlock) {
        // Pure text reply — done
        finalReply = textBlock?.text?.trim() || "Done.";
        break;
      }

      // Tool call
      const toolName = toolUseBlock.name;
      const toolArgs = toolUseBlock.input || {};
      console.log(`[Claude] tool call: ${toolName}`, JSON.stringify(toolArgs).slice(0, 120));

      let toolResult;
      try {
        toolResult = await executeTool(toolName, toolArgs, req.userId);
      } catch (toolErr) {
        console.error(`[Claude] tool ${toolName} error:`, toolErr.message);
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

      // Data result — feed back to Claude and continue
      const toolResultText = toolResult
        ? JSON.stringify(toolResult.data || toolResult)
        : "No result.";

      currentMessages.push({ role: "assistant", content: response.content });
      currentMessages.push({
        role: "user",
        content: [{
          type: "tool_result",
          tool_use_id: toolUseBlock.id,
          content: toolResultText,
        }],
      });
    }

    const reply = finalReply || "Done.";
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

      const completion = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: taskPrompt }],
      });

      const result = completion.content?.find((b) => b.type === "text")?.text?.trim();

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
