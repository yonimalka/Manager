const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const mongo = require('mongodb');
const { MongoClient} = require('mongodb')
const bodyParser = require('body-parser');
const { GridFSBucket } = require('mongodb');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const { OpenAI } = require('openai');
require('dotenv').config();
const { jsonToPdf } = require('./pdf/jsonToPdf');
const { log } = require('handlebars');
const jwt = require('jsonwebtoken');
const jwksClient = require("jwks-rsa");
const authMiddleware = require('./authMiddleware');
const fs = require('fs');
const puppeteer = require('puppeteer');
const archiver = require("archiver");
const { ObjectId } = require("mongodb");
const fetch = require("node-fetch");
const crypto = require("crypto");
const UserModel = require("./models/User");
const FixedExpenseModel = require("./models/FixedExpense");
const ReceiptModel = require ("./models/Receipt");
const ProjectModel = require("./models/Project");
const IncomeReceipt = require('./models/IncomeReceipt');
const IncomeModel = require("./models/Incomes");
const InvoiceModel = require("./models/Invoice");
const MaterialPriceHistory = require("./models/MaterialPriceHistory");
const generateReceiptNumber = require('./utils/generateReceiptNumber');
const { calcIncomesForPeriod, calcExpensesForPeriod } = require("./utils/financialCalculations");
const { ACTIVE_STATUSES, requireSubscription, hasActiveEntitlement } = require('./middleware/requireSubscription');
const { Expo } = require("expo-server-sdk");
const cron = require("node-cron");
const expo = new Expo();

const sendPush = async (pushToken, title, body, data = {}) => {
  if (!pushToken || !Expo.isExpoPushToken(pushToken)) return;
  try {
    await expo.sendPushNotificationsAsync([{
      to: pushToken,
      sound: "default",
      title,
      body,
      data,
    }]);
  } catch (err) {
    console.error("[PUSH] Error:", err.message);
  }
};

// ── PostHog server-side analytics ─────────────────────────────────────────────
let phClient = null;
try {
  const { PostHog } = require("posthog-node");
  if (process.env.POSTHOG_API_KEY) {
    phClient = new PostHog(process.env.POSTHOG_API_KEY, { host: "https://us.i.posthog.com" });
    process.on("beforeExit", () => phClient.shutdown());
  }
} catch (_) {}
function phCapture(distinctId, event, properties = {}) {
  if (!phClient || !distinctId) return;
  try { phClient.capture({ distinctId: String(distinctId), event, properties }); } catch (_) {}
}

// ── Invoice public-token helper ───────────────────────────────────────────────
function randomToken() {
  return crypto.randomBytes(6).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
async function generateInvoiceToken() {
  for (let i = 0; i < 10; i++) {
    const t = randomToken();
    const exists = await InvoiceModel.exists({ publicToken: t });
    if (!exists) return t;
  }
  throw new Error("Could not generate unique invoice token");
}

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.ACCESS_TOKEN_SECRET;
const JWT_REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET;
const client = jwksClient({
  jwksUri: "https://appleid.apple.com/auth/keys",
});
// issue token

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true}));

const path = require('path');
const { ref } = require('process');
const { auth } = require('google-auth-library');
app.use(express.static(path.join(__dirname, 'public')));

const taxRoutes = require("./routes/tax");
app.use(taxRoutes);

const agentRoutes = require("./routes/agent");
app.use(agentRoutes);

app.use((req, res, next) => {
  const allowedOrigins = [
    'http://localhost:3000',
    'https://manager-asqh.onrender.com' 
  ];

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  next();
});


function normalizeDate(date) {
  const d = new Date(date);
  d.setHours(0,0,0,0);
  return d.getTime();
}

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["trialing", "active", "grace_period"]);

function normalizeSubscriptionStatus(status) {
  if (!status) return "inactive";

  const normalized = String(status).toLowerCase();

  if (["trialing", "active", "grace_period", "cancelled", "expired", "inactive"].includes(normalized)) {
    return normalized;
  }

  if (["billing_issue", "in_grace_period"].includes(normalized)) {
    return "grace_period";
  }

  return "inactive";
}

function buildSubscriptionResponse(user) {
  const subscription = user?.subscription || {};
  const status = normalizeSubscriptionStatus(subscription.status);
  const expiresAt = subscription.expiresAt ? new Date(subscription.expiresAt) : null;
  const trialEndsAt = subscription.trialEndsAt ? new Date(subscription.trialEndsAt) : null;

  return {
    provider: subscription.provider || "revenuecat",
    entitlement: subscription.entitlement || "MaggoPro",
    productId: subscription.productId || null,
    status,
    trialEndsAt,
    expiresAt,
    willRenew: !!subscription.willRenew,
    hasAccess: ACTIVE_SUBSCRIPTION_STATUSES.has(status),
    lastEventType: subscription.lastEventType || null,
    lastSyncedAt: subscription.lastSyncedAt || null,
  };
}

function extractRevenueCatPayload(body = {}) {
  const event = body.event || body;
  const aliases = Array.isArray(event.aliases) ? event.aliases : [];
  const appUserId = event.app_user_id || event.appUserId || aliases[0] || null;

  const entitlement =
    event.entitlement_id ||
    event.entitlement ||
    event.entitlement_identifier ||
    "MaggoPro";

  const eventType = event.type || "";
  const periodType = String(event.period_type || "").toUpperCase();
  let resolvedStatus;
  if (["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "SUBSCRIBER_ALIAS"].includes(eventType)) {
    resolvedStatus = periodType === "TRIAL" ? "trialing" : "active";
  } else if (eventType === "CANCELLATION") {
    resolvedStatus = "cancelled";
  } else if (eventType === "EXPIRATION") {
    resolvedStatus = "expired";
  } else if (eventType === "BILLING_ISSUE") {
    resolvedStatus = "grace_period";
  } else if (periodType === "TRIAL") {
    resolvedStatus = "trialing";
  } else if (["NORMAL", "INTRO"].includes(periodType)) {
    resolvedStatus = "active";
  } else {
    resolvedStatus = event.status || "inactive";
  }
  const status = normalizeSubscriptionStatus(resolvedStatus);

  return {
    appUserId,
    provider: "revenuecat",
    entitlement,
    productId: event.product_id || event.productId || null,
    status,
    trialEndsAt: event.trial_end_at_ms ? new Date(Number(event.trial_end_at_ms)) : null,
    expiresAt: event.expiration_at_ms ? new Date(Number(event.expiration_at_ms)) : null,
    willRenew: !!event.renewal_status,
    lastEventType: event.type || "SYNC",
    rawEvent: event,
  };
}

// openai API setup
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function init() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: 'managoDB' });
    console.log('✅ Mongoose connected to MongoDB Atlas');
  } catch (err) {
    console.error('❌ Error connecting to MongoDB:', err);
  }
}

init();


const generateAccessToken = (user) => {
  return jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "2d" });
};

const generateRefreshToken = (user) => {
  return jwt.sign({ userId: user._id }, JWT_REFRESH_SECRET, { expiresIn: "30d" });
};
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.get("/ping", (req, res) => res.send("pong"));

app.post("/NewUser", async (req, res) => {
  try {
  const {name, businessName, businessId, address, logo, email, password} = req.body;
  
  const validateUser = await UserModel.findOne({ email });
  if (validateUser) {
    return res.status(401).json({ message: "user already exist" });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new UserModel({
    name,
    businessName,
    businessId,
    address,
    email,
    password: hashedPassword,
    totalExpenses: 0,
    totalIncomes: 0,
    logo,
  });
  console.log(user);
  await user.save()
  const token = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  res.status(200).json({ token, refreshToken });

  } catch(err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
  
})

app.post("/SignInDetails", async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const user = await UserModel.findOne({ email });
    if (!user) {
      console.log("no user found");
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Create JWT
    const token = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    
    res.status(200).json({ token, refreshToken });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/GoogleSignIn", async (req, res)=>{
  const { googleId, email, name, avatar } = req.body;
  
  try {
      let user = await UserModel.findOne({
      $or: [{ googleId }, { email }]
    });

    const isNewUser = !user;

    if (!user) {

      user = new UserModel({
        googleId,
        email,
        name,
        logo: avatar,
      });

      await user.save();
    }


    // Create JWT
    const token = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.status(200).json({ token, refreshToken, isNewUser });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  
  }
});

function getAppleKey(header, callback) {
  client.getSigningKey(header.kid, function (err, key) {
    callback(null, key.getPublicKey());
  });
}

function verifyAppleToken(identityToken) {
  return new Promise((resolve, reject) => {

    jwt.verify(
      identityToken,
      getAppleKey,
      {
        algorithms: ["RS256"],
        issuer: "https://appleid.apple.com",
        audience: process.env.APPLE_BUNDLE_ID,
      },
      (err, decoded) => {
        if (err) reject(err);
        else resolve(decoded);
      }
    );

  });
}
app.post("/AppleSignIn", async (req, res) => {

  try {

    const { identityToken, fullName } = req.body;

    const appleData = await verifyAppleToken(identityToken);

    const appleId = appleData.sub;
    const email = appleData.email;

    let user = await UserModel.findOne({
      $or: [{ appleId }, { email }]
    });

    const isNewUser = !user;

    if (!user) {

      user = new UserModel({
        appleId,
        email,
        name: [fullName?.givenName, fullName?.familyName].filter(Boolean).join(" ") || "Apple User",
      });

      await user.save();

    }

    const token = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.json({ token, refreshToken, isNewUser });

  } catch (err) {

    res.status(401).json({
      message: "Invalid Apple login"
    });

  }

});

app.post("/refresh", (req, res) => {
  const { token } = req.body; // refresh token

  if (!token) return res.status(401).json({ message: "No refresh token provided" });

  jwt.verify(token, JWT_REFRESH_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid refresh token" });

    const newAccessToken = generateAccessToken({ _id: user.userId });
    res.json({ accessToken: newAccessToken });
  });
});
app.get("/getUserDetails", authMiddleware, async (req, res) => {
  const userId = req.userId;
  try {
    const user = await UserModel.findById(userId).lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    const [projectsCount, incomesLoggedCount, invoicesGeneratedCount] = await Promise.all([
      ProjectModel.countDocuments({ userId }),
      IncomeModel.countDocuments({ userId }),
      IncomeReceipt.countDocuments({ userId }),
    ]);

    const daysSinceSignup = user.createdAt
      ? Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    const subscriptionStatus = user.subscriptionStatus || "free";

    res.json({
      name: user.name,
      businessName: user.businessName,
      businessId: user.businessId,
      address: user.address,
      email: user.email,
      logo: user.logo,
      currency: user.currency,
      userType: user.userType,
      createdAt: user.createdAt,
      analytics: {
        projectsCount,
        incomesLoggedCount,
        invoicesGeneratedCount,
        daysSinceSignup,
        subscriptionStatus,
      },
    });
  } catch (err) {
    console.error("getUserDetails error:", err);
    res.status(500).json({ error: err.message });
  }
});
app.post("/updateUser", authMiddleware, async (req, res) => {
  try {
    const allowedFields = [
      "name",
      "businessName",
      "businessId",
      "address",
      "logo",
      "currency",
      "taxSettings",
      "userType",
      "zip",
    ];

    const updateData = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    // Map top-level zip into address.zip
    if (req.body.zip) {
      updateData.address = {
        ...updateData.address,
        zip: req.body.zip,
      };
    }

    // Convert businessId to Number if present
    if (updateData.businessId !== undefined) {
      updateData.businessId = Number(updateData.businessId);
    }

    // 🔹 Auto-sync businessState from address if taxSettings exists
    if (updateData.address?.state) {
      updateData.taxSettings = {
        ...updateData.taxSettings,
        businessState: updateData.address.state,
      };
    }

    const updatedUser = await UserModel.findByIdAndUpdate(
      req.userId,
      { $set: updateData },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(updatedUser);

  } catch (err) {
    console.log("error occurred on updateUser", err);
    res.status(500).json({ message: "Server error" });
  }
});
app.put("/updateCurrency", authMiddleware, async (req, res) => {
  try {
    const { currency, locale } = req.body;

    if (!currency || !locale) {
      return res.status(400).json({ message: "Currency and locale required" });
    }

    const user = await UserModel.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.currency = currency;
    user.locale = locale;

    await user.save();

    res.json({ message: "Currency updated", currency, locale });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});
// JWT-protected route
app.get("/getUser", authMiddleware, async (req, res) => {
  try {
    const user = await UserModel.findById(req.userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    const projects = await ProjectModel.find({ userId: req.userId });

    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const yearStart  = new Date(now.getFullYear(), 0, 1);
    const yearEnd    = new Date(now.getFullYear() + 1, 0, 1);

    const [
      totalIncomes,
      totalExpenses,
      monthlyIncomes,
      monthlyExpenses,
    ] = await Promise.all([
      calcIncomesForPeriod(req.userId, yearStart, yearEnd),
      calcExpensesForPeriod(req.userId, yearStart, yearEnd),
      calcIncomesForPeriod(req.userId, monthStart, monthEnd),
      calcExpensesForPeriod(req.userId, monthStart, monthEnd),
    ]);

    res.json({
      ...user.toObject(),
      projects,
      totalIncomes,
      totalExpenses,
      monthlyIncomes,
      monthlyExpenses,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/newProject", authMiddleware, async (req, res) => {
  try {
    const { name, payment, days, materialsList, toDoList, isDemo } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Project name is required" });
    }
    if (payment === undefined || payment === null || payment === "" || isNaN(Number(payment))) {
      return res.status(400).json({ message: "Payment must be a valid number" });
    }
    if (days === undefined || days === null || days === "" || isNaN(Number(days)) || Number(days) <= 0) {
      return res.status(400).json({ message: "Days must be a positive number" });
    }

    const user = await UserModel.findById(req.userId).select("subscription");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const existingProjectsCount = await ProjectModel.countDocuments({ userId: req.userId });
    const isPro = hasActiveEntitlement(user.subscription || {}, "MaggoPro");

    if (!isPro && existingProjectsCount >= 2) {
      return res.status(402).json({
        message: "Maggo Pro is required for unlimited projects",
        code: "SUBSCRIPTION_REQUIRED",
        feature: "unlimited_projects",
        freeProjectLimit: 2,
        currentProjectCount: existingProjectsCount,
      });
    }

    const project = await ProjectModel.create({
      userId: req.userId,
      name,
      payment,
      days,
      materials: { items: materialsList || [] },
      toDoList: toDoList || [],
      isDemo: !!isDemo,
      expenses: 0,
      paid: 0,
      paymentDetails: [],
    });

    res.status(201).json(project);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create project" });
  }
});
app.get("/materials/suggestion/:name", authMiddleware, async (req,res)=>{
  
 const material = req.params.name

 const prices = await MaterialPriceHistory.find({
   userId: req.userId,
   materialName: material
 })

 if(!prices.length) return res.json(null)

 const avg =
 prices.reduce((a,b)=>a+b.price,0)/prices.length

 res.json({
   averagePrice: avg,
   lastPrice: prices[prices.length-1].price,
   supplier: prices[prices.length-1].supplier
 })
})
app.get("/getProject/:projectId", authMiddleware, async (req, res) => {
  try {

    const projectId = new mongoose.Types.ObjectId(req.params.projectId);

    const project = await ProjectModel.findOne({
      _id: projectId,
      userId: req.userId
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // calculate expenses from receipts
    const receipts = await ReceiptModel.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(req.userId),
          projectId: projectId
        }
      },
      {
        $group: {
          _id: null,
          totalExpenses: { $sum: "$sumOfReceipt" }
        }
      }
    ]);

    const expenses = receipts[0]?.totalExpenses || 0;

    const [incomeDocs, receiptDocs, openInvoices] = await Promise.all([
      IncomeModel.find({ userId: req.userId, projectId }).sort({ date: -1 }).limit(50).lean(),
      ReceiptModel.find({ userId: req.userId, projectId }).sort({ createdAt: -1 }).limit(50).lean(),
      InvoiceModel.find({ userId: req.userId, projectId, status: "unpaid" }).sort({ dueDate: 1 }).lean(),
    ]);

    const money = [
      ...incomeDocs.map((i) => ({ type: "payment", id: i._id, title: i.services?.[0]?.description || i.payer || "Payment", amount: i.total, date: i.date })),
      ...receiptDocs.map((r) => ({ type: "expense", id: r._id, title: r.category || "Expense", amount: r.sumOfReceipt || 0, date: r.createdAt, imageUrl: r.imageUrl || null })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      ...project.toObject(),
      expenses,
      money,
      billed: openInvoices.reduce((sum, inv) => sum + inv.amount, 0),
      nextDue: openInvoices[0]?.dueDate || null,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.patch("/projects/:projectId", authMiddleware, async (req, res) => {
  try {
    const update = {};
    if (typeof req.body.name === "string" && req.body.name.trim()) update.name = req.body.name.trim();
    if (typeof req.body.client === "string") update.client = req.body.client.trim();
    if (typeof req.body.clientPhone === "string") update.clientPhone = req.body.clientPhone.trim();
    if (req.body.payment !== undefined) {
      const p = Number(req.body.payment);
      if (isNaN(p) || p < 0) return res.status(400).json({ message: "Job value must be a number" });
      update.payment = p;
    }
    if (req.body.days !== undefined) {
      const d = Number(req.body.days);
      if (isNaN(d) || d <= 0) return res.status(400).json({ message: "Days must be a positive number" });
      update.days = d;
    }
    if (req.body.status === "active" || req.body.status === "complete") {
      update.status = req.body.status;
      update.completedAt = req.body.status === "complete" ? new Date() : null;
    }
    if (!Object.keys(update).length) return res.status(400).json({ message: "Nothing to update" });
    const project = await ProjectModel.findOneAndUpdate(
      { _id: req.params.projectId, userId: req.userId },
      { $set: update },
      { new: true }
    );
    if (!project) return res.status(404).json({ message: "Project not found" });
    res.json(project);
  } catch (err) {
    console.error("Update project error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/fixedExpense", authMiddleware, async (req, res) => {
  try {
    const {
      title,
      amount,
      category,
      frequency = "monthly",
      dayOfMonth,
      dayOfWeek,
      projectId,
    } = req.body;

    if (!title || !amount) {
      return res.status(400).json({ message: "Title and amount are required" });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let calculatedStartDate = new Date(today);

    if (frequency === "monthly") {
      const day = dayOfMonth || today.getDate();

      calculatedStartDate = new Date(
        today.getFullYear(),
        today.getMonth(),
        day
      );

      if (calculatedStartDate < today) {
        calculatedStartDate = new Date(
          today.getFullYear(),
          today.getMonth() + 1,
          day
        );
      }
    }

    else if (frequency === "weekly") {
      const targetDay =
        typeof dayOfWeek === "number" ? dayOfWeek : today.getDay();

      const diff = (targetDay - today.getDay() + 7) % 7;

      calculatedStartDate = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + diff
      );
    }

    else if (frequency === "yearly") {
      calculatedStartDate = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );
    }

    calculatedStartDate.setHours(0, 0, 0, 0);

    const newFixedExpense = await FixedExpenseModel.create({
      userId: req.userId,
      title,
      amount: Number(amount),
      category,
      frequency,
      dayOfMonth,
      dayOfWeek,
      startDate: calculatedStartDate,
      isActive: true,
      projectId: projectId || null,
    });

    res.status(201).json({
      message: "Fixed expense saved successfully",
      newFixedExpense,
    });

  } catch (error) {
    console.error("Upload fixed expense error:", error);
    res.status(500).json({ message: "Server error on fixed expense" });
  }
});
app.get("/fixedExpenses", authMiddleware, async (req, res) => {
  try {
    const expenses = await FixedExpenseModel.find({
      userId: req.userId,
    })
      .sort({ createdAt: -1 }); // newest first

    res.json(expenses);

  } catch (error) {
    console.error("Get fixed expenses error:", error);
    res.status(500).json({ message: "Server error" });
  }
});
app.patch("/fixedExpense/:id/toggle", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const expense = await FixedExpenseModel.findOne({
      _id: id,
      userId: req.userId,
    });

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    expense.isActive = !expense.isActive;
    await expense.save();

    res.json({ message: "Updated", expense });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
app.get("/fixedExpenseOccurrences/:id", authMiddleware, async (req, res) => {
  try {

    const expense = await FixedExpenseModel.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    const now = new Date();
    const occurrences = [];

    let occurrenceDate = new Date(expense.startDate);
    occurrenceDate.setHours(0,0,0,0);

    // fetch ALL receipts for this fixed expense once
    const receipts = await ReceiptModel.find({
      fixedExpenseId: expense._id
    });

    const receiptMap = new Map(
      receipts.map(r => [
        new Date(r.occurrenceDate).setHours(0,0,0,0),
        r
      ])
    );

    while (occurrenceDate <= now) {

      const key = new Date(occurrenceDate).setHours(0,0,0,0);

      const receipt = receiptMap.get(key);

      occurrences.push({
        date: new Date(occurrenceDate),
        receiptId: receipt?._id || null,
        hasReceipt: !!receipt
      });

      if (expense.frequency === "monthly") {
        occurrenceDate = new Date(
          occurrenceDate.getFullYear(),
          occurrenceDate.getMonth() + 1,
          expense.dayOfMonth || occurrenceDate.getDate()
        );
      } 
      else if (expense.frequency === "weekly") {
        occurrenceDate = new Date(
          occurrenceDate.getFullYear(),
          occurrenceDate.getMonth(),
          occurrenceDate.getDate() + 7
        );
      } 
      else if (expense.frequency === "yearly") {
        occurrenceDate = new Date(
          occurrenceDate.getFullYear() + 1,
          occurrenceDate.getMonth(),
          occurrenceDate.getDate()
        );
      }
    }

    res.json(occurrences.reverse());

  } catch (err) {
    console.error("fixedExpenseOccurrences error:", err);
    res.status(500).json({ message: "Server error" });
  }
});
app.post("/receipts/create", authMiddleware, async (req, res) => {

  const {
    projectId,
    category,
    sumOfReceipt,
    fixedExpenseId,
    occurrenceDate
  } = req.body;

  try {

    const receipt = await ReceiptModel.create({
      userId: req.userId,
      projectId: projectId || null,
      category,
      sumOfReceipt,
      fixedExpenseId: fixedExpenseId || null,
      occurrenceDate: occurrenceDate || null,
      status: "pending"
    });

    res.json(receipt);

  } catch (err) {
    res.status(500).json({ message: "Failed to create receipt" });
  }

});
app.patch("/receipts/:id/image", authMiddleware, async (req, res) => {

  const { imageUrl } = req.body;

  try {

    const receipt = await ReceiptModel.findByIdAndUpdate(
      req.params.id,
      {
        imageUrl,
        status: "uploaded"
      },
      { new: true }
    );

    res.json(receipt);

  } catch (err) {
    res.status(500).json({ message: "Failed to update receipt" });
  }

});
app.post("/uploadReceipt", authMiddleware, async (req, res) => {
  try {
    const { sumOfReceipt, category, projectId, imageUrl, fixedExpenseId,
      occurrenceDate } = req.body;
    const existing = await ReceiptModel.findOne({
        fixedExpenseId,
        occurrenceDate
      });

      if (existing) {
        return res.status(400).json({
          message: "Receipt already uploaded for this occurrence"
        });
      }
    const receipt = await ReceiptModel.create({
      userId: req.userId,
      projectId: projectId || null,
      imageUrl,
      sumOfReceipt,
      category,
      fixedExpenseId: fixedExpenseId || null,
      occurrenceDate: occurrenceDate || null
    });

    if (projectId) {
      await ProjectModel.findOneAndUpdate(
        { _id: projectId, userId: req.userId },
        { $inc: { expenses: Number(sumOfReceipt) } }
      );
    }

    await UserModel.findByIdAndUpdate(req.userId, {
      $inc: { totalExpenses: Number(sumOfReceipt) }
    });

    res.status(201).json(receipt);

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});
app.get("/receipt/:id", authMiddleware, async (req, res) => {
  try {
    const receipt = await ReceiptModel.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!receipt) {
      return res.status(404).json({ message: "Receipt not found" });
    }

    res.json(receipt);

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});
app.post("/incomeReceipt", authMiddleware, async (req, res) => {
  try {
    const {
      services = [],
      taxRate = 0,
      date,
      projectId,
      payer,
      ...rest
    } = req.body;

    if (!services.length) {
      return res.status(400).json({ error: "At least one service is required" });
    }

    // ✅ Validate + Calculate safely on backend
    let subtotal = 0;

    const normalizedServices = services.map((item) => {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);

      if (!item.description || quantity <= 0 || unitPrice < 0) {
        throw new Error("Invalid service line item");
      }

      const lineTotal = quantity * unitPrice;
      subtotal += lineTotal;

      return {
        description: item.description,
        quantity,
        unitPrice,
        lineTotal,
      };
    });

    const numericTaxRate = Number(taxRate) || 0;
    const tax = +(subtotal * (numericTaxRate / 100)).toFixed(2);
    const total = +(subtotal + tax).toFixed(2);

    // ✅ Create receipt (trusted values only)
    const receipt = await IncomeReceipt.create({
      ...rest,
      services: normalizedServices,
      subtotal,
      taxRate: numericTaxRate,
      tax,
      total,
      userId: req.userId,
      receiptNumber: generateReceiptNumber(),
      projectId: projectId || null,
      payer,
      date: date ? new Date(date) : new Date(),
    });

   
    await IncomeModel.create({
      userId: req.userId,
      projectId: projectId || null,
      source: projectId ? "project" : "standalone",
      services: normalizedServices,   
      subtotal,                   
      taxRate: numericTaxRate,
      tax,
      total,                         
      currency: rest.currency || "USD",
      payer,
      referenceId: receipt._id,
      date: date ? new Date(date) : new Date(),
    });

    // Update project paid
    if (projectId && mongoose.Types.ObjectId.isValid(projectId)) {
      await ProjectModel.findByIdAndUpdate(projectId, {
        $inc: { paid: total },
      });
    }

    res.status(201).json(receipt);

  } catch (err) {
    console.error("Income receipt error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Shared helper — creates an Income record and optionally increments Project.paid
const createIncomeRecord = async ({ userId, amount, description, projectId, date, currency, referenceId }) => {
  const parsed = Number(amount);
  const income = await IncomeModel.create({
    userId,
    projectId: projectId || null,
    source: projectId ? "project" : "standalone",
    services: [{ description: description || "Income", quantity: 1, unitPrice: parsed, lineTotal: parsed }],
    subtotal: parsed,
    taxRate: 0,
    tax: 0,
    total: parsed,
    currency: currency || "USD",
    payer: description || "client",
    date: date ? new Date(date) : new Date(),
    ...(referenceId ? { referenceId } : {}),
  });
  if (projectId && mongoose.Types.ObjectId.isValid(projectId)) {
    await ProjectModel.findByIdAndUpdate(projectId, { $inc: { paid: parsed } });
  }
  return income;
};

app.post("/income", authMiddleware, async (req, res) => {
  try {
    const { amount, description, projectId, date, currency } = req.body;
    const parsed = Number(amount);
    if (!parsed || parsed <= 0) {
      return res.status(400).json({ error: "Valid amount is required" });
    }
    const income = await createIncomeRecord({ userId: req.userId, amount: parsed, description, projectId, date, currency });
    res.status(201).json(income);
  } catch (err) {
    console.error("Log income error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Invoice routes ──────────────────────────────────────────────────────────

app.post("/invoices", authMiddleware, async (req, res) => {
  try {
    const { client, clientPhone, amount, currency, projectId, dueDays, dueDate, description } = req.body;
    if (!client || !client.trim()) return res.status(400).json({ error: "Client name is required" });
    const parsed = Number(amount);
    if (!parsed || parsed <= 0) return res.status(400).json({ error: "Valid amount is required" });

    let due;
    if (dueDate) {
      due = new Date(dueDate);
    } else {
      const days = Number(dueDays) || 14;
      due = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }
    if (isNaN(due.getTime())) return res.status(400).json({ error: "Invalid due date" });

    const user = await UserModel.findById(req.userId).select("currency");
    const invoice = await InvoiceModel.create({
      userId: req.userId,
      projectId: projectId || null,
      client: client.trim(),
      clientPhone: clientPhone || null,
      description: description ? String(description).trim().slice(0, 300) : null,
      amount: parsed,
      currency: currency || user?.currency || "USD",
      dueDate: due,
      publicToken: await generateInvoiceToken(),
    });
    res.status(201).json(invoice);
  } catch (err) {
    console.error("Create invoice error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/invoices/summary", authMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const unpaid = await InvoiceModel.find({ userId: req.userId, status: "unpaid" })
      .sort({ dueDate: 1 })
      .lean();

    const totalOwed = unpaid.reduce((sum, inv) => sum + inv.amount, 0);
    const overdueCount = unpaid.filter((inv) => inv.dueDate < now).length;

    // Overdue first, then by dueDate ascending; cap at 5
    const overdue = unpaid.filter((inv) => inv.dueDate < now).sort((a, b) => a.dueDate - b.dueDate);
    const upcoming = unpaid.filter((inv) => inv.dueDate >= now).sort((a, b) => a.dueDate - b.dueDate);
    const items = [...overdue, ...upcoming].slice(0, 5);

    res.json({ totalOwed, overdueCount, items });
  } catch (err) {
    console.error("Invoice summary error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.patch("/invoices/:id/pay", authMiddleware, async (req, res) => {
  try {
    const invoice = await InvoiceModel.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId, status: "unpaid" },
      { status: "paid", paidAt: new Date() },
      { new: true }
    );
    if (!invoice) return res.status(409).json({ error: "Invoice not found or already paid" });

    let income;
    try {
      income = await createIncomeRecord({
        userId: req.userId,
        amount: invoice.amount,
        description: invoice.client,
        projectId: invoice.projectId,
        currency: invoice.currency,
        referenceId: invoice._id,
      });
      await InvoiceModel.findByIdAndUpdate(invoice._id, { incomeId: income._id });
    } catch (incomeErr) {
      // Revert the status change if income creation fails
      await InvoiceModel.findByIdAndUpdate(invoice._id, { status: "unpaid", paidAt: null });
      console.error("Income creation failed, reverted invoice:", incomeErr);
      return res.status(500).json({ error: "Failed to record income" });
    }

    res.json({ invoice, income });
  } catch (err) {
    console.error("Mark paid error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.patch("/invoices/:id/remind", authMiddleware, async (req, res) => {
  try {
    const invoice = await InvoiceModel.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { lastRemindedAt: new Date() },
      { new: true }
    );
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    res.json(invoice);
  } catch (err) {
    console.error("Remind error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.patch("/invoices/:id", authMiddleware, async (req, res) => {
  try {
    const update = {};
    if (typeof req.body.clientPhone === "string") update.clientPhone = req.body.clientPhone.trim() || null;
    if (!Object.keys(update).length) return res.status(400).json({ error: "Nothing to update" });
    const invoice = await InvoiceModel.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: update },
      { new: true }
    );
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    res.json(invoice);
  } catch (err) {
    console.error("Update invoice error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/invoices/:id", authMiddleware, async (req, res) => {
  try {
    const invoice = await InvoiceModel.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
      status: "unpaid",
    });
    if (!invoice) return res.status(404).json({ error: "Invoice not found or already paid" });
    res.json({ deleted: true });
  } catch (err) {
    console.error("Delete invoice error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.patch("/users/business-details", authMiddleware, async (req, res) => {
  try {
    const { businessId, businessAddress, businessState, businessCountry, businessZip } = req.body;
    const update = {};
    if (businessId !== undefined && businessId !== "") {
      const parsed = Number(String(businessId).replace(/[\s\-]/g, ""));
      if (!isNaN(parsed)) update.businessId = parsed;
    }
    if (businessAddress !== undefined) update["address.street"] = businessAddress;
    if (businessState !== undefined) update["address.state"] = businessState.toUpperCase();
    if (businessCountry !== undefined) update["address.country"] = businessCountry.toUpperCase();
    if (businessZip !== undefined) update["address.zip"] = businessZip;
    await UserModel.findByIdAndUpdate(req.userId, { $set: update });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.patch("/incomeReceipt/:id/pdf", authMiddleware, async (req, res) => {
  try {
    const { pdfUrl } = req.body;

    if (!pdfUrl) {
      return res.status(400).json({ error: "pdfUrl is required" });
    }
    console.log("[PDF] PATCH called — id:", req.params.id, "userId:", req.userId, "pdfUrl:", pdfUrl);
    const receipt = await IncomeReceipt.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { pdfUrl },
      { new: true }
    );
    console.log("[PDF] findOneAndUpdate result:", receipt ? "found" : "NOT FOUND");
    if (!receipt) {
      return res.status(404).json({ error: "Receipt not found" });
    }

    res.json(receipt);
  } catch (err) {
    console.error("PDF update error:", err);
    res.status(500).json({ error: err.message });
  }
});
app.get("/getReceipts/:projectId", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { projectId } = req.params;

    const receipts = await ReceiptModel.find({
    userId,
    projectId
  });

  res.json(receipts);
  } catch (error) {
    console.error("Fetch receipts error:", error);
    res.status(500).json({ message: "Failed to fetch receipts" });
  }
});

app.get('/getTotalExpenses', authMiddleware, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);

    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const startOfNextYear = new Date(now.getFullYear() + 1, 0, 1);

    const fixedExpenses = await FixedExpenseModel.find({
      userId,
      isActive: true,
      startDate: { $lte: now },
    });

    let fixedTotal = 0;

    for (const expense of fixedExpenses) {
      const start = new Date(
        Math.max(expense.startDate, startOfYear)
      );

      const end =
        expense.endDate && expense.endDate < now
          ? expense.endDate
          : now;

      if (start > end) continue;

      let occurrences = 0;

      if (expense.frequency === "monthly") {
        const months =
          (end.getFullYear() - start.getFullYear()) * 12 +
          (end.getMonth() - start.getMonth());

        occurrences = months + 1;
      }

      if (expense.frequency === "weekly") {
        const diffTime = end - start;
        const weeks = Math.floor(
          diffTime / (1000 * 60 * 60 * 24 * 7)
        );
        occurrences = weeks + 1;
      }

      if (expense.frequency === "yearly") {
        const years =
          end.getFullYear() - start.getFullYear();
        occurrences = years + 1;
      }

      fixedTotal += occurrences * expense.amount;
    }
    const receiptsResult = await ReceiptModel.aggregate([
      {
        $match: {
          userId: userId,
          createdAt: {
            $gte: startOfYear,
            $lt: startOfNextYear,
          },
        },
      },
      {
        $lookup: {
          from: "fixedexpenses",
          localField: "fixedExpenseId",
          foreignField: "_id",
          as: "fixedExpense",
        },
      },
      {
        $match: {
          $or: [
            { fixedExpenseId: null },
            { "fixedExpense.isActive": false }
          ]
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$sumOfReceipt" },
        },
      },
    ]);

    const receiptsTotal = receiptsResult[0]?.total || 0;

    const totalExpenses = receiptsTotal + fixedTotal;

    res.json({
      totalExpenses,
      breakdown: {
        receipts: receiptsTotal,
        fixed: fixedTotal,
      },
    });

  } catch (error) {
    console.error("getTotalExpenses error:", error);
    res.status(500).json({ message: "Failed to get total expenses" });
  }
});
app.get('/getTotalIncomes', authMiddleware, async (req, res) => {
  const userId = req.userId;
  const startOfYear = new Date(new Date().getFullYear(), 0, 1);
    const startOfNextYear = new Date(new Date().getFullYear() + 1, 0, 1);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const receiptsResult = await IncomeReceipt.aggregate([
      {
        $match: {
          userId: userId,
          createdAt: {
            $gte: startOfYear,
            $lt: startOfNextYear,
          },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$total" },
        },
      },
    ]);
   
     const receiptsTotal = receiptsResult[0]?.total || 0;
     res.json(receiptsTotal)
  // UserModel.findById(userId)
  // .then((user) => {
  //   const getIncomes = user.totalIncomes;
  //   res.json(getIncomes)
  // })
})
// requireSubscription("MaggoPro"),
app.get("/downloadReceiptsZip", authMiddleware, async (req, res) => {
  try {
  
    const { from, to } = req.query;

    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    
    // Push toDate to end of day so the full day is included
    if (toDate) {
     toDate.setHours(23, 59, 59, 999);
    }
    // Build query
    let query = {
      userId: new mongoose.Types.ObjectId(req.userId),
      status: "uploaded",
      imageUrl: { $ne: null },
    };
    if (fromDate && toDate) {
      query.createdAt = { $gte: fromDate, $lte: toDate };
    }
    if (req.query.projectId && mongoose.Types.ObjectId.isValid(req.query.projectId)) {
      query.projectId = new mongoose.Types.ObjectId(req.query.projectId);
    }

    const receipts = await ReceiptModel.find(query);
    
    if (!receipts.length) return res.status(404).json({ message: "No receipts found for this date range" });

    res.setHeader("Content-Disposition", "attachment; filename=receipts.zip");
    res.setHeader("Content-Type", "application/zip");

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(res);

    for (const r of receipts) {

      const response = await fetch(r.imageUrl);

      const buffer = await response.buffer();

      const fileName = `${r.category}_${r.sumOfReceipt}.jpg`;
      archive.append(buffer, { name: fileName });
      // console.log("Appended:", fileName);
    }

    await archive.finalize();
  } catch (err) {
    console.error("ZIP generation error:", err);
    res.status(500).json({ message: "Server error while creating ZIP" });
  }
});
// requireSubscription("MaggoPro"),
app.get("/downloadIncomesReceiptsZip", authMiddleware, async (req, res) => {
  try {
    console.log("enter route on downloadIncomesReceiptsZip");
    
    const { from, to } = req.query;
     
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    // Push toDate to end of day so the full day is included
    if (toDate) {
     toDate.setHours(23, 59, 59, 999);
    }
    // Build query
    let query = {
      userId: req.userId,
      pdfUrl: { $ne: null },
      // status: "uploaded",
      // imageUrl: { $ne: null },
    };
    if (fromDate && toDate) {
      query.createdAt = { $gte: fromDate, $lte: toDate };
    }

const receipts = await IncomeReceipt.find(query);

    if (!receipts.length) return res.status(404).json({ message: "No receipts found for this date range" });
    
    res.setHeader("Content-Disposition", "attachment; filename=receipts.zip");
    res.setHeader("Content-Type", "application/zip");

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(res);

   for (const r of receipts) {

  try {
    const response = await fetch(r.pdfUrl);
    const buffer = await response.buffer();
    const fileName = `${r.receiptNumber || r._id}.pdf`;
    archive.append(buffer, { name: fileName });
  } catch (fetchErr) {
    console.error("Skipping receipt, fetch failed:", r._id, fetchErr.message);
  }
}

    await archive.finalize();
  } catch (err) {
    console.error("ZIP generation error:", err);
    res.status(500).json({ message: "Server error while creating ZIP" });
  }
});

app.post('/AddTask/:projectId', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const projectId = req.params.projectId;
    const addTask = req.body;

    const project = await ProjectModel.findOne({
      _id: projectId,
      userId
    });

    if (!project)
      return res.status(404).json({ message: "Project not found" });

    project.toDoList.push(addTask);

    await project.save();

    res.json({ message: "Task added successfully", project });

  } catch (err) {
    console.error("AddTask error:", err);
    res.status(500).json({ message: "Server error" });
  }
});
app.post("/updateTasks/:projectId", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const projectId = req.params.projectId;
    const updatedTask = req.body;

    const project = await ProjectModel.findOne({
      _id: projectId,
      userId: userId
    });

    if (!project)
      return res.status(404).json({ message: "Project not found" });

    const task = project.toDoList.id(updatedTask._id);

    if (!task)
      return res.status(404).json({ message: "Task not found" });

    task.checked = updatedTask.checked;

    // Sort unchecked first
    project.toDoList.sort((a, b) => a.checked - b.checked);

    await project.save();

    res.json({ message: "Task updated successfully" });

  } catch (err) {
    console.error("updateTasks error:", err);
    res.status(500).json({ message: "Server error" });
  }
});
app.post("/AddItem/:projectId", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const projectId = req.params.projectId;

    const addItem = req.body;

    const project = await ProjectModel.findOneAndUpdate(
      { _id: projectId, userId },
      {
        $push: { "materials.items": addItem }
      },
      { new: true }
    );

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // save price history
    if (addItem.estimatedUnitCost) {
      await MaterialPriceHistory.create({
        userId,
        materialName: addItem.item,
        price: addItem.estimatedUnitCost,
        supplier: addItem.supplier,
        projectId
      });
    }

    res.json({
      message: "Item added successfully",
      materials: project.materials.items
    });

  } catch (err) {
    console.error("AddItem error:", err);
    res.status(500).json({ message: "Server error" });
  }
});
app.delete("/projects/:projectId/materials/:materialId", authMiddleware, async (req, res) => {
    try {
      const { projectId, materialId } = req.params;

      const project = await ProjectModel.findOneAndUpdate(
        { _id: projectId, userId: req.userId },
        {
          $pull: {
            "materials.items": { _id: materialId }
          }
        },
        { new: true }
      );

      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      res.json({
        message: "Material removed",
        materials: project.materials.items
      });

    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  }
);
app.get('/GetMaterialsList/:projectId', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const projectId = req.params.projectId;

    const project = await ProjectModel.findOne({
      _id: projectId,
      userId
    }).lean();

    if (!project)
      return res.status(404).json({ message: "Project not found" });

    const materialsList = project.materials?.[0]?.items || [];

    res.json(materialsList);

  } catch (err) {
    console.error("GetMaterialsList error:", err);
    res.status(500).json({ message: "Server error" });
  }
});
app.post('/uploadLogo', authMiddleware, async (req, res) => {
  const userId = req.userId;
  const {imageUrl} = req.params;
  UserModel.findById(userId)
  .then (user => {
    user.logo = imageUrl;
  })
  return user.save();
})
app.post("/updatePayment/:projectId", authMiddleware, async (req, res) => {
  try {
    const { paidAmount } = req.body;
    const amount = Number(paidAmount);

    const project = await ProjectModel.findOne({
      _id: req.params.projectId,
      userId: req.userId,
    });

    if (!project)
      return res.status(404).json({ message: "Project not found" });

    project.paid += amount;
    await project.save();

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update payment" });
  }
});


const normalizeCategory = (str) => {
  if (!str || !str.trim()) return "General";
  const s = str.trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

app.get("/getCashFlowIncomes", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const raw = req.query.period || "month";
    const now = new Date();

    let startDate;

    if (raw === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (raw === "quarter") {
      startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    } else {
      startDate = new Date(now.getFullYear(), 0, 1);
    }

    const incomes = await IncomeModel.find({
      userId,
      date: { $gte: startDate, $lte: now },
    })
      .populate("projectId", "name")
      .lean();

    const formatted = incomes.map((inc) => ({
      payments: {
        amount: inc.total,
        date: inc.date,
      },
      payer: inc.payer,
      category: inc.category,
      projectName: inc.projectId?.name || "General Income",
      source: inc.source,
      type: "income",
    }));
    console.log("formatted:", formatted);
    
    formatted.sort(
      (a, b) => new Date(a.payments.date) - new Date(b.payments.date)
    );

    res.json(formatted);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/getCashFlowExpenses", authMiddleware, async (req, res) => {
  try {

    const userId = req.userId;
    const raw = req.query.period || "month";

    const now = new Date();
    now.setHours(23, 59, 59, 999);

    const validPeriods = ["month", "quarter", "year"];
    const period = validPeriods.includes(raw) ? raw : "month";

    let startDate;

    if (period === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } 
    else if (period === "quarter") {
      startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    } 
    else {
      startDate = new Date(now.getFullYear(), 0, 1);
    }

    startDate.setHours(0,0,0,0);

    // console.log("NOW:", now);
    // console.log("START DATE:", startDate);

    const receipts = await ReceiptModel.find({
      userId
    }).populate("projectId", "name");

    const expenses = receipts
      .filter((receipt) => {
    const d = new Date(receipt.createdAt);
    return !isNaN(d) && d >= startDate && d <= now;
  })
  .map((receipt) => {

    const isFixed = !!receipt.fixedExpenseId;

    return {
      payments: {
        sumOfReceipt: receipt.sumOfReceipt,
        category: normalizeCategory(receipt.category),
        date: receipt.createdAt,
        isFixed
      },
      projectName: isFixed
        ? "Fixed Expense"
        : (receipt.projectId?.name || "General"),
      type: "expense",
    };
  });

    console.log("NORMAL EXPENSES:", expenses);

    /* ---------------- FIXED RECEIPTS ---------------- */

    const fixedReceipts = await ReceiptModel.find({
      userId,
      fixedExpenseId: { $ne: null }
    }).lean();

    console.log("FIXED RECEIPTS:", fixedReceipts);

    const receiptSet = new Set(
      fixedReceipts.map(r =>
        `${String(r.fixedExpenseId)}_${normalizeDate(r.occurrenceDate || r.createdAt)}`
      )
    );

    console.log("RECEIPT SET:", receiptSet);

    /* ---------------- FIXED EXPENSES ---------------- */

    const fixedExpenses = await FixedExpenseModel.find({
      userId,
      isActive: true
    }).lean();

    console.log("FIXED EXPENSES FOUND:", fixedExpenses);

    const fixedExpenseItems = [];

    for (const fe of fixedExpenses) {

      console.log("Processing fixed expense:", fe.title);

      let occurrenceDate = new Date(fe.startDate || fe.createdAt);
      occurrenceDate.setHours(0,0,0,0);

      console.log("Initial occurrence:", occurrenceDate);

      while (occurrenceDate <= now) {

        console.log("Checking occurrence:", occurrenceDate);

        if (occurrenceDate >= startDate) {

          const key = `${String(fe._id)}_${normalizeDate(occurrenceDate)}`;

          console.log("Generated key:", key);

          if (!receiptSet.has(key)) {

            console.log("ADDING FIXED EXPENSE:", fe.title);

            fixedExpenseItems.push({
              payments: {
                sumOfReceipt: fe.amount,
                category: normalizeCategory(fe.category || fe.title),
                date: new Date(occurrenceDate),
                isFixed: true,
              },
              projectName: "Fixed Expense",
              type: "expense",
            });

          } else {

            console.log("SKIPPED (receipt already exists)");

          }

        }

        /* ---------- NEXT OCCURRENCE ---------- */

        if (fe.frequency === "monthly") {
          occurrenceDate.setMonth(occurrenceDate.getMonth() + 1);
        } 
        else if (fe.frequency === "weekly") {
          occurrenceDate.setDate(occurrenceDate.getDate() + 7);
        } 
        else if (fe.frequency === "yearly") {
          occurrenceDate.setFullYear(occurrenceDate.getFullYear() + 1);
        } 
        else {
          break;
        }

      }
    }

    console.log("FIXED EXPENSE ITEMS:", fixedExpenseItems);

    /* ---------------- COMBINE ---------------- */

    const combinedExpenses = [...expenses, ...fixedExpenseItems];

    combinedExpenses.sort(
      (a, b) => new Date(a.payments.date) - new Date(b.payments.date)
    );

    console.log("FINAL COMBINED EXPENSES:", combinedExpenses);

    res.json(combinedExpenses);

  } catch (err) {
    console.error("Error fetching cash flow expenses:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post('/quoteGenerator', authMiddleware, requireSubscription("MaggoPro"), upload.none(), async (req, res) => {
  try {
    const userId = req.userId;

    const company = await UserModel.findById(userId).then(user => user?.name || "Unknown Company");
    
    const {
      clientName,
      projectTitle,
      projectType,
      projectDetails,
      additionalCosts,
      paymentTerms,
      totalPrice,
    } = req.body;

    const parsedCosts = additionalCosts ? JSON.parse(additionalCosts) : {};
    console.log("Received quote request from:", company, "for client:", clientName);

    const schema = `
Return ONLY valid JSON that matches exactly:

{
  "header": {
    "quoteNo": "string",
    "date": "YYYY-MM-DD",
    "company": "${company}",
    "phoneNumber": "number",
    "client": "string"
  },
  "projectTitle": "string",
  "items": [
    { "desc": "string", "qty": number, "unit": "string", "unitPrice": number }
  ],
  "totals": { "sub": "totalPrice", "vat": sub*0.18, "grand": sub+vat },
  "details": "string",
  "paymentTerms": "string"
}

Do NOT wrap in markdown, do NOT add commentary.
`;

    const prompt = `write a professional quote for client name: ${clientName}, 
    project type: ${projectType}, 
    project details: ${projectDetails}, 
    additional costs: ${parsedCosts}, 
    total price: ${totalPrice}, 
    payment terms: ${paymentTerms}. 
    Style it like a professional quote with color and formatting, based on this schema: ${schema}`;

    console.log("Sending request to OpenAI...");

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: "json_object" },
      messages: [
        { role: 'system', content: `אתה יועץ עסקי שכותב הצעות מחיר יפות ומקצועיות בעברית` },
        { role: 'user', content: prompt },
      ],
    });

    const content = completion?.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned empty response");

    let quote;
    try {
      quote = JSON.parse(content);
    } catch (err) {
      console.error("Failed to parse OpenAI response:", content);
      throw new Error("Invalid JSON from OpenAI");
    }

    const pdfBuf = await jsonToPdf(quote);
    console.log("PDF buffer created, size:", pdfBuf.length);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename=quote_${quote.header.date}.pdf`,
    });

    res.send(pdfBuf);

  } catch (error) {
    console.error("Quote generation error:", error);
    res.status(500).json({ error: "Server error while generating quote", details: error.message });
  }
});
 app.get("/employees", authMiddleware, requireSubscription("MaggoPro"), async (req, res) =>{
    const userId = req.userId;
    await UserModel.findById(userId)
    .then((user) =>{
      const employees = user.employees;
      res.json(employees);
    })
 })
app.post("/addEmployee", authMiddleware, requireSubscription("MaggoPro"), async (req, res) =>{
  const userId = req.userId;
  const { name, role, phone, email, salaryType, salaryRate } = req.body;

  const user = await UserModel.findById(userId);

  const newEmployee = {
        name,
        role,
        phone,
        email,
        salaryType,
        salaryRate,
  }
  user.employees.push(newEmployee);
  const result = await user.save();
  console.log("Updated user with new employee:", result);
  res.status(200).json({ message: "Success" });
})


app.delete("/deleteProject/:projectId", authMiddleware, async (req, res) => {
  try {
    const result = await ProjectModel.deleteOne({
      _id: req.params.projectId,
      userId: req.userId
    });

    if (!result.deletedCount)
      return res.status(404).json({ message: "Project not found" });

    res.json({ message: "Project deleted successfully" });

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.delete("/deleteUser/:userId", async (req, res) => {
  const userId = req.params.userId;

  const deletedUser = await UserModel.findByIdAndDelete(userId);
  if (!deletedUser) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Cascade-delete all data belonging to this user
  await Promise.all([
    ProjectModel.deleteMany({ userId }),
    ReceiptModel.deleteMany({ userId }),
    IncomeReceipt.deleteMany({ userId }),
    IncomeModel.deleteMany({ userId }),
    InvoiceModel.deleteMany({ userId }),
    FixedExpenseModel.deleteMany({ userId }),
    MaterialPriceHistory.deleteMany({ userId }),
    mongoose.connection.collection("agents").deleteMany({ userId: new mongoose.Types.ObjectId(userId) }),
    mongoose.connection.collection("agenttasks").deleteMany({ userId: new mongoose.Types.ObjectId(userId) }),
    mongoose.connection.collection("conversations").deleteMany({ userId: new mongoose.Types.ObjectId(userId) }),
  ]);

  res.json({ message: 'User and all related data deleted successfully' });
})

app.get("/subscription/status", authMiddleware, async (req, res) => {
  try {
    const user = await UserModel.findById(req.userId).select("subscription email name");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const projectCount = await ProjectModel.countDocuments({ userId: req.userId });
    const subResponse = buildSubscriptionResponse(user);
    console.log("[STATUS] userId:", req.userId, "status:", subResponse.status, "hasAccess:", subResponse.hasAccess, "entitlement:", subResponse.entitlement);

    res.json({
      userId: req.userId,
      email: user.email,
      name: user.name,
      subscription: subResponse,
      limits: {
        freeProjectLimit: 2,
        projectCount,
      },
    });
  } catch (error) {
    console.error("subscription/status error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/subscription/sync", authMiddleware, async (req, res) => {
  try {
    console.log("[SYNC] userId:", req.userId, "body:", JSON.stringify(req.body));
    const {
      productId = null,
      entitlement = "MaggoPro",
      status = "inactive",
      trialEndsAt = null,
      expiresAt = null,
      willRenew = false,
      lastEventType = "APP_SYNC",
    } = req.body || {};

    const normalizedStatus = normalizeSubscriptionStatus(status);

    const user = await UserModel.findByIdAndUpdate(
      req.userId,
      {
        $set: {
          subscription: {
            provider: "revenuecat",
            entitlement,
            productId,
            status: normalizedStatus,
            trialEndsAt,
            expiresAt,
            willRenew,
            lastEventType,
            lastSyncedAt: new Date(),
          },
        },
      },
      { new: true }
    ).select("subscription");

    res.json({
      message: "Subscription synced",
      subscription: buildSubscriptionResponse(user),
    });
  } catch (error) {
    console.error("subscription/sync error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/webhooks/revenuecat", async (req, res) => {
  try {
    const configuredWebhookSecret = process.env.REVENUECAT_WEBHOOK_SECRET;
    const incomingWebhookSecret = req.headers["x-revenuecat-signature"] || req.headers["authorization"];

    if (configuredWebhookSecret && incomingWebhookSecret !== configuredWebhookSecret) {
      return res.status(401).json({ message: "Invalid webhook signature" });
    }

    const payload = extractRevenueCatPayload(req.body || {});

    if (!payload.appUserId) {
      return res.status(400).json({ message: "appUserId is required" });
    }

    const user = await UserModel.findByIdAndUpdate(
      payload.appUserId,
      {
        $set: {
          subscription: {
            provider: payload.provider,
            entitlement: payload.entitlement,
            productId: payload.productId,
            status: payload.status,
            trialEndsAt: payload.trialEndsAt,
            expiresAt: payload.expiresAt,
            willRenew: payload.willRenew,
            lastEventType: payload.lastEventType,
            lastSyncedAt: new Date(),
          },
        },
      },
      { new: true }
    ).select("subscription");

    if (!user) {
      return res.status(404).json({ message: "User not found for RevenueCat event" });
    }

    res.json({
      ok: true,
      subscription: buildSubscriptionResponse(user),
    });
  } catch (error) {
    console.error("RevenueCat webhook error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/user/push-token", authMiddleware, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "Token required" });
    await UserModel.findByIdAndUpdate(req.userId, { pushToken: token });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/user/ping", authMiddleware, async (req, res) => {
  try {
    await UserModel.findByIdAndUpdate(req.userId, { lastOpenedAt: new Date() });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Activation Notification Scheduler ───────────────────────────────────────
cron.schedule("0 * * * *", async () => {
  console.log("[CRON] Running activation notification check...");
  try {
    const now = new Date();
    const users = await UserModel.find({ pushToken: { $ne: null } }).lean();

    for (const user of users) {
      if (!user.pushToken || !user.createdAt) continue;

      const hoursSinceSignup = (now - new Date(user.createdAt)) / (1000 * 60 * 60);
      const n = user.notificationsSent || {};
      const firstName = user.name?.split(" ")[0] || "there";

      if (!n.welcome && hoursSinceSignup >= 2 && hoursSinceSignup < 48) {
        await sendPush(
          user.pushToken,
          `Your workspace is ready, ${firstName} 👋`,
          "Log your first payment and see your balance update live.",
          { screen: "Home", type: "welcome_nudge" }
        );
        await UserModel.findByIdAndUpdate(user._id, { "notificationsSent.welcome": true });
        continue;
      }

      if (!n.firstProject && hoursSinceSignup >= 24 && hoursSinceSignup < 72) {
        const projectCount = await ProjectModel.countDocuments({
          userId: user._id.toString(),
          isDemo: { $ne: true },
        });
        if (projectCount === 0) {
          await sendPush(
            user.pushToken,
            "Jobs don't track themselves",
            "Add your first real project and keep all your work in one place.",
            { screen: "NewProject", type: "first_project_nudge" }
          );
        }
        await UserModel.findByIdAndUpdate(user._id, { "notificationsSent.firstProject": true });
        continue;
      }

      if (!n.firstIncome && hoursSinceSignup >= 72 && hoursSinceSignup < 120) {
        const incomeCount = await IncomeModel.countDocuments({ userId: user._id.toString() });
        if (incomeCount === 0) {
          await sendPush(
            user.pushToken,
            "Have you been paid recently?",
            "Log a payment in 20 seconds. Your balance updates instantly.",
            { screen: "Home", type: "first_income_nudge" }
          );
        }
        await UserModel.findByIdAndUpdate(user._id, { "notificationsSent.firstIncome": true });
        continue;
      }

      if (!n.reengagement && hoursSinceSignup >= 168) {
        const lastOpen = user.lastOpenedAt ? new Date(user.lastOpenedAt) : new Date(user.createdAt);
        const daysSinceOpen = (now - lastOpen) / (1000 * 60 * 60 * 24);
        if (daysSinceOpen >= 4) {
          await sendPush(
            user.pushToken,
            "Your business doesn't stop.",
            "Check in on your projects and see where your money stands.",
            { screen: "Home", type: "reengagement_nudge" }
          );
        }
        await UserModel.findByIdAndUpdate(user._id, { "notificationsSent.reengagement": true });
        continue;
      }
    }

    console.log(`[CRON] Notification check complete — ${users.length} users evaluated`);
  } catch (err) {
    console.error("[CRON] Scheduler error:", err.message);
  }
});

// ─── Weekly Monday nudge — runs every Monday at 8am UTC ──────────────────────
cron.schedule("0 8 * * 1", async () => {
  console.log("[CRON] Running weekly Monday nudge...");
  try {
    const users = await UserModel.find({ pushToken: { $ne: null } }).lean();
    for (const user of users) {
      if (!user.pushToken) continue;
      const hoursSinceSignup = (new Date() - new Date(user.createdAt)) / (1000 * 60 * 60);
      if (hoursSinceSignup < 168) continue;
      await sendPush(
        user.pushToken,
        "New week, new jobs? 📋",
        "Log any work from last week and stay on top of your cash flow.",
        { screen: "Home", type: "weekly_nudge" }
      );
    }
    console.log("[CRON] Weekly nudge sent");
  } catch (err) {
    console.error("[CRON] Weekly nudge error:", err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PAY LINK — authenticated routes
// ─────────────────────────────────────────────────────────────────────────────

// GET /invoices/:id/link — returns (or lazily creates) the public pay URL
app.get("/invoices/:id/link", authMiddleware, async (req, res) => {
  try {
    const invoice = await InvoiceModel.findOne({ _id: req.params.id, userId: req.userId });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    if (!invoice.publicToken) {
      invoice.publicToken = await generateInvoiceToken();
      await invoice.save();
    }
    const base = (process.env.PAY_BASE_URL || "https://pay.maggoapp.com").replace(/\/$/, "");
    res.json({ url: `${base}/${invoice.publicToken}` });
  } catch (err) {
    console.error("[PAY] link error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /users/payment-methods — save/update the owner's payment method handles
app.patch("/users/payment-methods", authMiddleware, async (req, res) => {
  const VALID_KEYS = ["paypalMe", "venmo", "cashApp", "zelle", "bank"];
  const update = {};
  for (const key of VALID_KEYS) {
    if (typeof req.body[key] === "string") {
      update[`paymentMethods.${key}`] = req.body[key].trim().slice(0, 120);
    }
  }
  if (!Object.keys(update).length) return res.status(400).json({ error: "Nothing to update" });
  try {
    const user = await UserModel.findByIdAndUpdate(
      req.userId,
      { $set: update },
      { new: true, select: "-password" }
    );
    res.json({ paymentMethods: user.paymentMethods });
  } catch (err) {
    console.error("[PAY] payment-methods error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PAY PAGE — public helpers
// ─────────────────────────────────────────────────────────────────────────────

function esc(s) {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function page404() {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="robots" content="noindex"><style>body{font-family:-apple-system,sans-serif;background:#F8FAFC;color:#0F172A;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px}</style></head><body><div><div style="font-size:52px;margin-bottom:16px">🔗</div><h2 style="margin-bottom:8px;font-size:20px">This link is no longer active.</h2><p style="color:#64748B;font-size:15px">The payment request may have been removed or expired.</p></div></body></html>`;
}

function buildPayPage({ invoice, user, token }) {
  const isPaid  = invoice.status === "paid";
  const claimed = !isPaid && !!invoice.claimedAt;
  const pm      = user.paymentMethods || {};

  const displayName = esc(user.businessName || user.name || "");
  const firstName   = esc(((user.businessName || user.name || "Us").trim().split(/\s+/)[0]));
  const clientName  = esc(invoice.client || "");
  const descText    = esc(invoice.description || "");

  let amtStr;
  try {
    amtStr = new Intl.NumberFormat("en-US", {
      style: "currency", currency: invoice.currency || "USD", minimumFractionDigits: 2,
    }).format(invoice.amount);
  } catch (_) { amtStr = `${invoice.currency || "USD"} ${invoice.amount}`; }

  const now      = new Date();
  const due      = new Date(invoice.dueDate);
  const daysLate = Math.floor((now - due) / 86400000);
  const isLate   = daysLate > 0;
  const dateStr  = due.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const dueChip  = isLate
    ? `<span class="chip red">Due ${esc(dateStr)} · ${daysLate} day${daysLate !== 1 ? "s" : ""} late</span>`
    : `<span class="chip green">Due ${esc(dateStr)}</span>`;

  const initials = ((user.businessName || user.name || "M").trim().slice(0, 2)).toUpperCase();
  const logoHtml = user.logo
    ? `<img class="logo" src="${esc(user.logo)}" alt="">`
    : `<div class="logo init">${esc(initials)}</div>`;

  // ── Payment method rows ───────────────────────────────────────────────────
  const methods = [];
  if (pm.paypalMe && pm.paypalMe.trim())
    methods.push(`<a class="meth-btn paypal" href="/p/${token}/go/paypal">Pay with PayPal</a>`);
  if (pm.venmo && pm.venmo.trim())
    methods.push(`<a class="meth-btn venmo" href="/p/${token}/go/venmo">Pay with Venmo</a>`);
  if (pm.cashApp && pm.cashApp.trim())
    methods.push(`<a class="meth-btn cash" href="/p/${token}/go/cashapp">Pay with Cash App</a>`);
  if (pm.zelle && pm.zelle.trim())
    methods.push(`<div class="copy-row"><span class="clbl">Zelle</span><span class="cval">${esc(pm.zelle)}</span><button class="copy-btn" data-copy="${esc(pm.zelle)}" onclick="doCopy(this)">Copy</button></div>`);
  if (pm.bank && pm.bank.trim())
    methods.push(`<div class="copy-row"><span class="clbl">Bank</span><span class="cval">${esc(pm.bank)}</span><button class="copy-btn" data-copy="${esc(pm.bank)}" onclick="doCopy(this)">Copy</button></div>`);

  const methodsSection = !isPaid
    ? (methods.length > 0
        ? `<div class="methods"><p class="sec-lbl">Pay ${firstName} with:</p>${methods.join("")}</div>`
        : `<div class="no-methods"><p>Ask ${firstName} how to pay</p></div>`)
    : "";

  // ── Method picker (claim form) ────────────────────────────────────────────
  const PM_KEY    = { paypal: "paypalMe", venmo: "venmo", cashapp: "cashApp", zelle: "zelle", bank: "bank" };
  const M_LABELS  = { paypal: "PayPal", venmo: "Venmo", cashapp: "Cash App", zelle: "Zelle", bank: "Bank", other: "Other" };
  const CLAIM_OPTS = ["paypal", "venmo", "cashapp", "zelle", "bank", "other"];

  const radioOptions = CLAIM_OPTS
    .filter(m => m === "other" || (pm[PM_KEY[m]] && pm[PM_KEY[m]].trim()))
    .map(m => `<label class="radio"><input type="radio" name="method" value="${m}" required> ${M_LABELS[m]}</label>`)
    .join("") || `<label class="radio"><input type="radio" name="method" value="other" required> Other</label>`;

  const claimSection = isPaid
    ? ""
    : claimed
    ? `<div class="claimed">Thanks, ${firstName} has been notified.</div>`
    : `<div class="claim-wrap">
        <button class="claim-btn" onclick="showPicker(this)">I've paid, let ${firstName} know</button>
        <div id="picker" hidden>
          <p class="picker-lbl">How did you pay?</p>
          <form method="POST" action="/p/${token}/claim">
            <div class="radio-grid">${radioOptions}</div>
            <button type="submit" class="confirm-btn">Confirm</button>
          </form>
        </div>
       </div>`;

  const cardContent = isPaid
    ? `<div class="paid-done">&#10003; Paid. Thank you!</div>`
    : `<p class="hi">Hi ${clientName}, this is for</p>
       <p class="desc-txt">${descText || "your job"}</p>
       <p class="amt">${esc(amtStr)}</p>
       ${dueChip}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta name="robots" content="noindex">
<title>Payment request — ${displayName}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#F8FAFC;color:#0F172A;min-height:100vh;padding:0 0 48px}
.wrap{max-width:480px;margin:0 auto;padding:16px}
.hdr{display:flex;align-items:center;gap:12px;padding:16px 0 20px}
.logo{width:52px;height:52px;border-radius:14px;object-fit:cover;flex-shrink:0}
.init{background:#0F172A;color:#fff;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:700}
.biz{font-size:17px;font-weight:700;color:#0F172A;margin-bottom:2px}
.sub{font-size:13px;color:#64748B}
.card{background:#fff;border-radius:20px;border:1px solid #E2E8F0;padding:20px 20px 24px;margin-bottom:14px}
.hi{font-size:15px;color:#64748B;margin-bottom:8px}
.desc-txt{font-size:20px;font-weight:600;color:#0F172A;margin-bottom:14px;line-height:1.3}
.amt{font-size:40px;font-weight:700;color:#0F172A;letter-spacing:-1px;margin-bottom:14px}
.chip{display:inline-flex;align-items:center;padding:6px 14px;border-radius:999px;font-size:13px;font-weight:600}
.red{background:#FEF2F2;color:#B91C1C;border:1px solid #FECACA}
.green{background:#F0FDF4;color:#15803D;border:1px solid #BBF7D0}
.paid-done{text-align:center;padding:24px 0;font-size:22px;font-weight:700;color:#15803D}
.methods{margin-bottom:14px}
.sec-lbl{font-size:15px;font-weight:600;color:#0F172A;margin-bottom:12px}
.meth-btn{display:block;padding:16px;border-radius:14px;text-align:center;font-size:16px;font-weight:600;text-decoration:none;margin-bottom:10px;color:#fff}
.paypal{background:#003087}
.venmo{background:#3D95CE}
.cash{background:#00D64F;color:#000}
.copy-row{display:flex;align-items:center;gap:10px;background:#F8FAFC;border-radius:12px;padding:14px;margin-bottom:10px;border:1px solid #E2E8F0}
.clbl{font-size:13px;font-weight:700;color:#0F172A;min-width:40px}
.cval{flex:1;font-size:14px;color:#475569;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.copy-btn{background:#0F172A;color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;flex-shrink:0}
.no-methods{text-align:center;color:#64748B;padding:8px 0 14px;font-size:15px}
.claim-wrap{margin-bottom:14px}
.claim-btn{width:100%;padding:18px;border-radius:16px;background:#0F172A;color:#fff;font-size:16px;font-weight:700;border:none;cursor:pointer}
.picker-lbl{font-size:15px;font-weight:600;color:#0F172A;margin:16px 0 12px}
.radio-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
.radio{display:flex;align-items:center;gap:8px;background:#F8FAFC;border-radius:12px;padding:12px 14px;font-size:15px;cursor:pointer;border:1px solid #E2E8F0}
.confirm-btn{width:100%;padding:16px;border-radius:14px;background:#059669;color:#fff;font-size:16px;font-weight:700;border:none;cursor:pointer}
.claimed{background:#F0FDF4;border:1px solid #BBF7D0;border-radius:16px;padding:20px;text-align:center;font-size:16px;font-weight:600;color:#15803D;margin-bottom:14px}
.footer{text-align:center;padding:24px 0 0}
.footer a{font-size:13px;color:#94A3B8;text-decoration:none}
</style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    ${logoHtml}
    <div><div class="biz">${displayName}</div><div class="sub">Payment request</div></div>
  </div>
  <div class="card">${cardContent}</div>
  ${methodsSection}
  ${claimSection}
  <div class="footer"><a href="/p/${token}/app">Sent with Maggo &middot; free money app for contractors</a></div>
</div>
<script>
function showPicker(b){document.getElementById('picker').removeAttribute('hidden');b.style.display='none';}
function doCopy(b){if(navigator.clipboard)navigator.clipboard.writeText(b.dataset.copy).then(function(){b.textContent='Copied!'});else b.textContent='Copied!';}
</script>
</body>
</html>`;
}

async function servePayPage(req, res, token) {
  if (!/^[A-Za-z0-9_-]{8}$/.test(token)) return res.status(404).send(page404());
  try {
    const invoice = await InvoiceModel.findOneAndUpdate(
      { publicToken: token },
      { $inc: { linkViews: 1 } },
      { new: true }
    ).lean();
    if (!invoice) return res.status(404).send(page404());

    const user = await UserModel.findById(invoice.userId).select("-password").lean();
    if (!user) return res.status(404).send(page404());

    phCapture(String(invoice.userId), "pay_link_viewed", { invoiceId: String(invoice._id) });

    const html = buildPayPage({ invoice, user, token });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-Robots-Tag", "noindex");
    res.send(html);
  } catch (err) {
    console.error("[PAY] page error:", err.message);
    res.status(500).send("Server error");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PAY PAGE — public routes (registered LAST to avoid shadowing existing routes)
// ─────────────────────────────────────────────────────────────────────────────

// POST /p/:token/claim — client reports they've paid
app.post("/p/:token/claim", async (req, res) => {
  const { token } = req.params;
  if (!/^[A-Za-z0-9_-]{8}$/.test(token)) return res.status(404).send(page404());
  const VALID_METHODS = ["paypal", "venmo", "cashapp", "zelle", "bank", "other"];
  const method = req.body.method;
  if (!VALID_METHODS.includes(method)) return res.redirect(303, `/p/${token}`);
  try {
    const invoice = await InvoiceModel.findOne({ publicToken: token }).lean();
    if (!invoice) return res.status(404).send(page404());
    if (invoice.status !== "unpaid") return res.redirect(303, `/p/${token}`);
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    if (invoice.claimedAt && invoice.claimedAt > tenMinAgo) return res.redirect(303, `/p/${token}`);

    await InvoiceModel.findByIdAndUpdate(invoice._id, { claimedAt: new Date(), claimedMethod: method });

    // Push to invoice owner
    const owner = await UserModel.findById(invoice.userId).select("pushToken currency").lean();
    if (owner?.pushToken) {
      let amtStr;
      try {
        amtStr = new Intl.NumberFormat("en-US", {
          style: "currency", currency: invoice.currency || "USD",
        }).format(invoice.amount);
      } catch (_) { amtStr = String(invoice.amount); }
      const methodLabel = { paypal: "PayPal", venmo: "Venmo", cashapp: "Cash App", zelle: "Zelle", bank: "bank transfer", other: "another method" }[method] || method;
      await sendPush(
        owner.pushToken,
        "Payment reported",
        `${invoice.client} says they paid ${amtStr} by ${methodLabel}. Tap to confirm.`,
        { type: "payment_claimed", invoiceId: String(invoice._id), screen: "Home" }
      );
    }

    phCapture(String(invoice.userId), "pay_link_claimed", { method, invoiceId: String(invoice._id) });
    res.redirect(303, `/p/${token}`);
  } catch (err) {
    console.error("[PAY] claim error:", err.message);
    res.redirect(303, `/p/${token}`);
  }
});

// GET /p/:token/go/:method — log tap + redirect to payment URL
app.get("/p/:token/go/:method", async (req, res) => {
  const { token, method } = req.params;
  if (!/^[A-Za-z0-9_-]{8}$/.test(token)) return res.status(404).send(page404());
  try {
    const invoice = await InvoiceModel.findOne({ publicToken: token }).lean();
    if (!invoice) return res.status(404).send(page404());
    const user = await UserModel.findById(invoice.userId).select("paymentMethods").lean();
    const pm   = user?.paymentMethods || {};
    const amt  = invoice.amount;
    const descEnc = encodeURIComponent(invoice.description || invoice.client || "payment");

    phCapture(String(invoice.userId), "pay_link_method_tapped", { method, invoiceId: String(invoice._id) });

    let url = null;
    if (method === "paypal" && pm.paypalMe && pm.paypalMe.trim()) {
      const handle = pm.paypalMe.trim().replace(/^https?:\/\/paypal\.me\/?/, "").replace(/^@/, "");
      if (handle) url = `https://paypal.me/${encodeURIComponent(handle)}/${amt}`;
    } else if (method === "venmo" && pm.venmo && pm.venmo.trim()) {
      const handle = pm.venmo.trim().replace(/^@/, "");
      url = `https://venmo.com/${encodeURIComponent(handle)}?txn=pay&amount=${amt}&note=${descEnc}`;
    } else if (method === "cashapp" && pm.cashApp && pm.cashApp.trim()) {
      url = `https://cash.app/${encodeURIComponent(pm.cashApp.trim())}/${amt}`;
    }

    if (url) return res.redirect(302, url);
    res.redirect(303, `/p/${token}`);
  } catch (err) {
    console.error("[PAY] go error:", err.message);
    res.redirect(303, `/p/${token}`);
  }
});

// GET /p/:token/app — footer link with tracking
app.get("/p/:token/app", async (req, res) => {
  const { token } = req.params;
  try {
    const invoice = await InvoiceModel.findOne({ publicToken: token }).select("userId _id").lean();
    if (invoice) phCapture(String(invoice.userId), "pay_link_footer_tapped", { invoiceId: String(invoice._id) });
  } catch (_) {}
  res.redirect(302, "https://apps.apple.com/app/id6748068683");
});

// GET /p/:token — public pay page
app.get("/p/:token", (req, res) => servePayPage(req, res, req.params.token));

// GET /:token on pay.* custom domain
app.get("/:token", (req, res, next) => {
  if (!req.hostname.startsWith("pay.")) return next();
  servePayPage(req, res, req.params.token);
});

app.listen(PORT, () => {
    console.log(`server is running on port ${PORT}!!!`);
});


//אני צריך עכשיו ליצור בכל aboutProject סהכ הוצאות שמתעדכן כל פעם שמוסיפים חשבונית