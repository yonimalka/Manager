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
const UserModel = require("./models/User");
const FixedExpenseModel = require("./models/FixedExpense");
const ReceiptModel = require ("./models/Receipt");
const ProjectModel = require("./models/Project");
const IncomeReceipt = require('./models/IncomeReceipt');
const IncomeModel = require("./models/Incomes");
const generateReceiptNumber = require('./utils/generateReceiptNumber');

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
    
    res.status(200).json({ token, refreshToken });
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

    if (!user) {

      user = new UserModel({
        appleId,
        email,
        name: fullName?.givenName || "Apple User",
      });

      await user.save();

    }

    const token = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.json({ token, refreshToken });

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
  //  console.log(userId);
   
   await UserModel.findById(userId)
   .then((user)=>{
    const userDetails = {
      name: user.name,
      businessName: user.businessName,
      businessId: user.businessId,
      address: user.address,
      email: user.email,
      logo: user.logo,
      currency: user.currency,
    }
    res.json(userDetails)
   }).catch((err) =>{
    console.log("error occurd on getUserDetails",err);
  } )
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
    ];

    const updateData = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

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
    // console.log(req.userId);
    
   const user = await UserModel.findById(req.userId)
  .select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
   const projects = await ProjectModel.find({ userId: req.userId });

res.json({
  ...user.toObject(),
  projects
});
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/newProject", authMiddleware, async (req, res) => {
  try {
    const { name, payment, days, materialsList, toDoList } = req.body;

    const project = await ProjectModel.create({
      userId: req.userId,
      name,
      payment,
      days,
      materials: { items: materialsList || [] },
      toDoList: toDoList || [],
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

    res.json({
      ...project.toObject(),
      expenses
    });

  } catch (err) {
    console.error(err);
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
app.patch("/incomeReceipt/:id/pdf", authMiddleware, async (req, res) => {
  try {
    const { pdfUrl } = req.body;

    if (!pdfUrl) {
      return res.status(400).json({ error: "pdfUrl is required" });
    }

    const receipt = await IncomeReceipt.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { pdfUrl },
      { new: true }
    );

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

app.get("/downloadReceiptsZip", authMiddleware, async (req, res) => {
  try {
  
    const { from, to } = req.query;

    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;

    // Build query
    let query = {
  userId: req.userId
};
    if (fromDate && toDate) {
      query.createdAt = { $gte: fromDate, $lte: toDate };
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

      const fileName = `${r.category}_${Date.now()}.jpg`;
      archive.append(buffer, { name: fileName });
      // console.log("Appended:", fileName);
    }

    await archive.finalize();
  } catch (err) {
    console.error("ZIP generation error:", err);
    res.status(500).json({ message: "Server error while creating ZIP" });
  }
});
app.get("/downloadIncomesReceiptsZip", authMiddleware, async (req, res) => {
  try {
    console.log("enter route on downloadIncomesReceiptsZip");
    
    const { from, to } = req.query;
     
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;

    // Build query
    let query = {
  userId: req.userId
};;
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

  const response = await fetch(r.pdfUrl);

  const buffer = await response.buffer();

  const fileName = `${r.receiptNumber}.pdf`;

  archive.append(buffer, { name: fileName });
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
      { new: true } // return updated project
    );

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
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
        category: receipt.category,
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
                category: fe.title,
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

app.post('/quoteGenerator', authMiddleware, upload.none(), async (req, res) => {
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
 app.get("/employees", authMiddleware, async (req, res) =>{
    const userId = req.userId;
    await UserModel.findById(userId)
    .then((user) =>{
      const employees = user.employees;
      res.json(employees);
    })
 })
app.post("/addEmployee", authMiddleware, async (req, res) =>{
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

 
 const deleteUser = await UserModel.findByIdAndDelete(userId);
 if (!deleteUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'User deleted successfully', user: deleteUser });

})

app.listen(PORT, () => {
    console.log(`server is running on port ${PORT}!!!`);
});


//אני צריך עכשיו ליצור בכל aboutProject סהכ הוצאות שמתעדכן כל פעם שמוסיפים חשבונית