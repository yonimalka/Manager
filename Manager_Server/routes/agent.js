const express = require("express");
const router = express.Router();
const { OpenAI } = require("openai");
const authMiddleware = require("../authMiddleware");
const AgentModel = require("../models/Agent");
const ConversationModel = require("../models/Conversation");
const AgentTaskModel = require("../models/AgentTask");
const UserModel = require("../models/User");
const ProjectModel = require("../models/Project");
const ReceiptModel = require("../models/Receipt");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Helpers ────────────────────────────────────────────────────────────────

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

// ─── Agent CRUD ──────────────────────────────────────────────────────────────

// GET /agent — get or auto-create agent for logged-in user
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

// PUT /agent — update agent name/persona/systemPrompt/language
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

// GET /agent/conversations — list conversations
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

// POST /agent/conversations — create new conversation
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

// GET /agent/conversations/:id — get full conversation with messages
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

// DELETE /agent/conversations/:id
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

// ─── Chat ────────────────────────────────────────────────────────────────────

// POST /agent/chat — send message, get AI reply
router.post("/agent/chat", authMiddleware, async (req, res) => {
  try {
    const { conversationId, message } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ message: "Message is required" });
    }

    // Load or create conversation
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

    // Load agent + user context
    const agent = await AgentModel.findById(conversation.agentId);
    const userContext = await buildUserContext(req.userId);
    const systemPrompt = buildSystemPrompt(agent, userContext);

    // Append user message
    conversation.messages.push({ role: "user", content: message });

    // Build messages for OpenAI (keep last 20 for context window)
    const recentMessages = conversation.messages.slice(-20).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        ...recentMessages,
      ],
      max_tokens: 1200,
    });

    const reply = completion.choices?.[0]?.message?.content?.trim();
    if (!reply) throw new Error("Empty response from OpenAI");

    // Append assistant reply
    conversation.messages.push({ role: "assistant", content: reply });
    conversation.lastMessageAt = new Date();

    // Auto-title from first message
    if (conversation.messages.length === 2) {
      conversation.title = message.slice(0, 60);
    }

    await conversation.save();

    res.json({
      conversationId: conversation._id,
      reply,
      title: conversation.title,
    });
  } catch (err) {
    console.error("POST /agent/chat error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ─── Tasks ───────────────────────────────────────────────────────────────────

// GET /agent/tasks
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

// POST /agent/tasks — create and immediately run a task
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

    // Run task via OpenAI
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

// DELETE /agent/tasks/:id
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
