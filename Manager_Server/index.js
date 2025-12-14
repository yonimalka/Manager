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
const authMiddleware = require('./authMiddleware');
const fs = require('fs');
const puppeteer = require('puppeteer');
const archiver = require("archiver");
const { ObjectId } = require("mongodb");

console.log('Chromium path:', puppeteer.executablePath());
console.log('Chromium exists?', fs.existsSync(puppeteer.executablePath()));
const app = express();
const PORT = process.env.PORT;
const JWT_SECRET = process.env.ACCESS_TOKEN_SECRET;
const JWT_REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET;
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



// openai API setup
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

let gfsBuckets = new Map(); // Store buckets by userId

async function connectToGridFS(userId) {
  if (gfsBuckets.has(userId)) return gfsBuckets.get(userId); // ✅ Reuse existing bucket

  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();

  const db = client.db('managoDB');
  const bucket = new GridFSBucket(db, {
    bucketName: `user_${userId}_bucket`
  });

  gfsBuckets.set(userId, bucket); // ✅ Store bucket for reuse
  console.log(`📦 GridFSBucket initialized for user ${userId}`);
  return bucket;
}

async function init() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: 'managoDB' });
    console.log('✅ Mongoose connected to MongoDB Atlas');
  } catch (err) {
    console.error('❌ Error connecting to MongoDB:', err);
  }
}

init();

const EmployeeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  role: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
  },
  email: {
    type: String,
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  // 👇 Salary Info
  salaryType: {
    type: String,
    enum: ["hourly", "daily"],
    required: true,
  },
  salaryRate: {
    type: Number,
    required: true, // e.g. 50 (₪50 per hour or day)
  },
  // track work hours or days
  totalHoursWorked: {
    type: Number,
    default: 0,
  },
  totalDaysWorked: {
    type: Number,
    default: 0,
  },
  // auto-calc or store total pay
  totalPay: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ["active", "inactive", "on_leave"],
    default: "active",
  },
});

const ReceiptSchema = new mongoose.Schema({
  filename: String,
  sumOfReceipt: Number,
  contentType: String,
  date: { type: Date, default: Date.now },
});

const MaterialsSchema = new mongoose.Schema({
  items: {type: Array, default: []}
})

const toDoListSchema = new mongoose.Schema({
  task: String,
  details: String,
  checked: {type: Boolean, default: false}
}, { _id: true });

const paymentDetailsSchema = new mongoose.Schema({
  amount: Number,
  method: String,
  date: { type: Date, default: Date.now },
})

const ProjectSchema = new mongoose.Schema({
  name: {type: String, required: true},
  payment: {type: Number, required: true},
  paid: {type: Number, default: 0},
  paymentDetails: [paymentDetailsSchema],
  days: {type: Number, required: true},
  materials: [MaterialsSchema],
  receipts: [ReceiptSchema],
  expenses: {type: Number},
  toDoList: [toDoListSchema],
})

const UserSchema = new mongoose.Schema({
  name: String,
  businessName: String,
  id: Number,
  email: String,
  password: { type: String, default: null },
  projects: [ProjectSchema],
  totalExpenses: Number,
  totalIncomes: {type: Number},
  employees: [EmployeeSchema],  
})

const UserModel = mongoose.model("users", UserSchema);

const createNewUser = async () =>{
  const user = new UserModel({
    name: "Yonatan",
    email: "y.yonatanmalka@gmail.com",
    projects: [
      {
        name: "Ariel",
        payment: 100000,
        days: 45
      }
    ],
    totalExpenses: 0
  });
  try {
    // const result = await user.save();
    // console.log("User with projects created:", result);
  } catch (err) {
    console.error("Error creating user with projects:", error.message);
  }
}
createNewUser();

const generateAccessToken = (user) => {
  return jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "7d" });
};

const generateRefreshToken = (user) => {
  return jwt.sign({ userId: user._id }, JWT_REFRESH_SECRET, { expiresIn: "15d" });
};
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.get("/ping", (req, res) => res.send("pong"));

app.post("/NewUser", async (req, res) => {
  const {name, surname, email, password} = req.body;
  console.log(name, surname, email, password);
  
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new UserModel({
    name: name,
    surname: surname,
    email: email,
    password: hashedPassword,
    totalExpenses: 0,
    totalIncomes: 0,
  });
  user.save()
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
  console.log(googleId, email, name);
  
  try {
    let user = await UserModel.findOne({ email })
    if (!user) {
       user = new UserModel({
        name: name,
        email: email,
        password: null,
        totalExpenses: 0,
        totalIncomes: 0,
      });
      await user.save();
      console.log("User Created:", user);
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

app.post("/refresh", (req, res) => {
  const { token } = req.body; // refresh token

  if (!token) return res.status(401).json({ message: "No refresh token provided" });

  jwt.verify(token, JWT_REFRESH_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid refresh token" });

    const newAccessToken = generateAccessToken({ _id: user.userId });
    res.json({ accessToken: newAccessToken });
  });
});
app.get("/getUserDetails/:userId", async (req, res) => {
   const userId = req.params.userId;
  //  console.log(userId);
   
   await UserModel.findById(userId)
   .then((user)=>{
    const userDetails = {
      name: user.name,
      surname: user.surname,
      email: user.email
    }
    res.json(userDetails)
   }).catch((err) =>{
    console.log("error occurd on getUserDetails",err);
  } )
});

// JWT-protected route
app.get("/getUser", authMiddleware, async (req, res) => {
  try {
    console.log(req.userId);
    
    const user = await UserModel.findById(req.userId).populate("projects").select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/updateDetails/", authMiddleware, async (req, res) =>{
    const userId = req.userId;
    const {name, payment, days, materialsList, toDoList} = req.body;
    
    const user = await UserModel.findById(userId);
    
    const newProjectData = {
      name: name,
      payment: payment,
      days: days,
      materials: [{items: materialsList}],
      toDoList: toDoList,
      expenses: 0,
    }
    //[{task: {type: String}}, {length: {type: Number}}]
    user.projects.push(newProjectData);
    const result = await user.save();
    console.log("Updated user with new project:", result);
    res.status(200).json({ message: "Success" });
});

app.post("/updateTasks/:projectId", authMiddleware, async (req, res) => {
  const userId = req.userId;
  const projectId = req.params.projectId;
  const updatedTask = req.body;
  // console.log(updatedTask);
  
  UserModel.findById(userId)
  .then(user => { 
    const project = user.projects.find((p) => p._id.toString() == projectId);
    if(!project){
      throw new Error('Project not found');
    }
    const task = project.toDoList.find((t) => t._id.toString() == updatedTask._id);
    if(!task){
      throw new Error('Task not found');
    }
    task.checked = updatedTask.checked;
    project.toDoList.sort((a,b) => {
      return (a.checked - b.checked);
    });
    user.save();
  })
  
})
app.get("/getProject/:Id", authMiddleware, async (req, res) => {
  
   UserModel.findById(req.userId)
  .then(user => { 
    const project = user.projects.find((p) => p._id.toString() == req.params.Id);
    if(!project){
      throw new Error('Project not found');
    }
    res.json(project);
  });
  
});

  app.post("/uploadReceipt", authMiddleware, upload.single('image'), async (req, res) =>{
    const userId = req.userId;
    const {sumOfReceipt, category, projectId} = req.body;
    const { file } = req;
    // console.log(file);
    
    if (!file){
      return res.status(400).send('No file uploaded');
    }
    
    // console.log(userId);
    const gfsBucket = await connectToGridFS(userId);
      // Upload file to GridFS
      const stream = gfsBucket.openUploadStream(req.file.originalname, {
        contentType: req.file.mimetype,
        metadata: { projectId  }
      });

    stream.on('finish', () => {
      if (stream.id) {
        console.log(`Image uploaded to GridFS with ID: ${stream.id}`);
      } else {
        console.error('Stream ID is not defined.');
      }
    // Save image metadata in the Image collection
    const now = new Date();
    // const date = now.toLocaleDateString();     // e.g., "5/23/2025"
    const time = now.toLocaleTimeString();     // e.g., "2:35:42 PM"

    const receiptImage = {
      filename: category,
      sumOfReceipt: Number(sumOfReceipt), 
      contentType: req.file.mimetype,
      date: now,
    };
    
    UserModel.findById(userId)
    .then(user => {
      const project = user.projects.find((p) => p._id.toString() === projectId)
      
      project.receipts.push(receiptImage)
      project.expenses += Number(sumOfReceipt);
      // console.log(project.expenses)
      res.status(200).json({ message: "Success" });
      return user.save(); 
    });
    // const expensesUpdate = mongoose
    // .connection
    // .collection('users')
    
  // user.projects.filter((p) => p._id == projectId)
  // .then(function(p){
  //   const project = p;
  //   console.log(project);
    
  // })
  // console.log(project);
  
})
stream.on('error', (err) => {
  console.error('Error in upload stream:', err);
});
stream.end(req.file.buffer);

await UserModel.findByIdAndUpdate(
      userId,
      {$inc: {'totalExpenses': Number(sumOfReceipt)}},
      // { returnDocument: 'after', upsert: false }
    )
});

app.get('/getReceipts/:projectId', authMiddleware, async (req, res) =>{
  const projectId = req.params.projectId;
  const userId = req.userId;

try {
  // Step 1: Connect to GridFS bucket only if not already
  if (!gfsBuckets.has(userId)) {
    await connectToGridFS(userId);
  }
  const bucket = gfsBuckets.get(userId);

  // Step 2: Query files for the project
  const files = await mongoose.connection.db
    .collection(`user_${userId}_bucket.files`)
    .find({ 'metadata.projectId': projectId })
    .toArray();

  if (!files || files.length === 0) {
    return res.status(404).json({ message: 'No files found' });
  }

  // Step 3: Stream and convert files in parallel
  const images = await Promise.all(files.map(file => {
    return new Promise((resolve, reject) => {
      const chunks = [];
      const stream = bucket.openDownloadStreamByName(file.filename);

      stream.on('data', chunk => chunks.push(chunk));
      stream.on('end', () => {
        const imageBase64 = Buffer.concat(chunks).toString('base64');
        resolve({
          filename: file.filename,
          contentType: file.contentType,
          data: `data:${file.contentType};base64,${imageBase64}`,
        });
      });
      stream.on('error', reject);
    });
  }));

  res.json(images ? images : null);
} catch (err) {
  console.error(err);
  res.status(500).send('Error fetching images');
}
})

app.get('/getTotalExpenses', authMiddleware, async (req, res) => {
  const userId = req.userId;
  UserModel.findById(userId)
  .then((user) => {
    const getExpenses = user.totalExpenses;
    res.json(getExpenses)
  })
});

app.get("/downloadAllReceiptsZip", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    // 1️⃣ Make sure GridFS bucket exists
    if (!gfsBuckets.has(userId)) {
      await connectToGridFS(userId);
    }
    const bucket = gfsBuckets.get(userId);

    // 2️⃣ Fetch all files from GridFS for this user
    const files = await mongoose.connection.db
      .collection(`user_${userId}_bucket.files`)
      .find({})
      .toArray();

    if (!files.length) {
      return res.status(404).json({ message: "No receipts found" });
    }

    // 3️⃣ Set ZIP headers
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=receipts_${Date.now()}.zip`
    );

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(res);

    // 4️⃣ Add each file from GridFS into the ZIP
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Stream file from GridFS
      const downloadStream = bucket.openDownloadStream(file._id);

      archive.append(downloadStream, {
        name: `receipt_${i + 1}${file.filename ? path.extname(file.filename) : ".jpg"}`,
      });
    }

    // 5️⃣ Finalize the ZIP stream
    archive.finalize();
  } catch (err) {
    console.error("ZIP generation error:", err);
    res.status(500).json({ message: "Server error generating ZIP" });
  }
});

app.get('/getTotalIncomes', authMiddleware, async (req, res) => {
  const userId = req.userId;
  UserModel.findById(userId)
  .then((user) => {
    const getIncomes = user.totalIncomes;
    res.json(getIncomes)
  })
})
app.post('/AddTask/:projectId', authMiddleware, async (req, res) => {
  const userId = req.userId;
  const Id = req.params.projectId;
  const addTask = req.body;
  await UserModel.findById(userId)
    .then(user => {
      const project = user.projects.find((p) => p._id.toString() === Id)
      project.toDoList.push(addTask);
      return user.save();
    });
})

app.post('/AddItem/:projectId', authMiddleware, async (req, res) => {
  const userId = req.userId;
  const Id = req.params.projectId;
  const addItem = req.body;
  // console.log(addItem);
  
  UserModel.findById(userId)
    .then(user => {
      const project = user.projects.find((p) => p._id.toString() == Id)
      project.materials[0].items.push(addItem)
      return user.save();
    });
})

app.get('/GetMaterialsList/:projectId', async (req, res) => {
  const Id = req.params.projectId;
  // console.log(Id);
  
    await UserModel.findOne({email: "y.yonatanmalka@gmail.com"})
    .then(function(user){
      const project = user.projects.find((p)=> p._id.toString() === Id);
      // console.log(project.materials[0].items);
      
      const materialsList = project.materials[0].items;
      
      res.send(materialsList)
    }).catch((err) =>{
      console.log(err);
      
    })
  }
)
app.post('/UpdatePayment/:projectId', authMiddleware, async (req, res) =>{
  const userId = req.userId;
  const Id = req.params.projectId;
  const {paidAmount} = req.body;
  // console.log(paidAmount);
  const now = new Date();
  const time = now.toLocaleTimeString();
  UserModel.findById(userId)
  .then(user => {
    const project = user.projects.find((p) => p._id.toString() == Id)
    // console.log(project);
    // console.log(typeof(project.paid));
    project.paid += Number(paidAmount);
    project.paymentDetails.push({
      amount: Number(paidAmount),
      date: now,
    })
    user.totalIncomes += paidAmount; 
    res.json(user.totalIncomes);
    return user.save();
    
  });
});

// GET /getCashFlowIncomes/:userId?period=month|quarter|year
app.get("/getCashFlowIncomes", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const raw = req.query.period || "month"; // default month
    const now = new Date();

    // Only English values expected
    const validPeriods = ["month", "quarter", "year"];
    const period = validPeriods.includes(raw) ? raw : "month";

    let startDate;
    if (period === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === "quarter") {
      startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1); // current + 2 months back
    } else {
      startDate = new Date(now.getFullYear(), 0, 1); // start of year
    }

    const user = await UserModel.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const incomes = (user.projects || []).flatMap((project) =>
      (project.paymentDetails || [])
        .filter((p) => {
          const d = new Date(p.date);
          return !isNaN(d) && d >= startDate && d <= now;
        })
        .map((p) => ({
          payments: p, // keep full object
          projectName: project.name,
        }))
    );

    incomes.sort((a, b) => new Date(a.payments.date) - new Date(b.payments.date));
    res.json(incomes);
  } catch (err) {
    console.error("Error fetching cash flow incomes:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /getCashFlowExpenses/:userId?period=month|quarter|year
app.get("/getCashFlowExpenses", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const raw = req.query.period || "month";
    const now = new Date();

    const validPeriods = ["month", "quarter", "year"];
    const period = validPeriods.includes(raw) ? raw : "month";

    let startDate;
    if (period === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === "quarter") {
      startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    } else {
      startDate = new Date(now.getFullYear(), 0, 1);
    }

    const user = await UserModel.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const expenses = (user.projects || []).flatMap((project) =>
      (project.receipts || [])
        .filter((r) => {
          const d = new Date(r.date);
          return !isNaN(d) && d >= startDate && d <= now;
        })
        .map((r) => ({
          payments: r, // keep full object
          projectName: project.name,
        }))
    );

    expenses.sort((a, b) => new Date(a.payments.date) - new Date(b.payments.date));
    res.json(expenses);
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


app.delete("/deleteProject/:projectId", authMiddleware, async (req, res) =>{
  const userId = req.userId;
  const projectId = req.params.projectId;

  try {
    const result = await UserModel.updateOne(
      {
        _id: userId,
      },
      {
        $pull: {
          projects: { _id: projectId },
        },
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: "Project not found or already deleted." });
    }

    res.status(200).json({ message: "Project deleted successfully." });
  } catch (error) {
    console.error("Error deleting nested project:", error);
    res.status(500).json({ message: "Internal server error." });
  }
  
})

app.delete("/deleteUser/:userId", async (req, res) => {
 const userId = req.params.userId;

 
 const deleteUser = await UserModel.findByIdAndDelete(userId);
 if (!deleteUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'User deleted successfully', user: deleteUser });

})

app.listen(PORT, () => {
    console.log(`server is running on port ${PORT}`);
});


//אני צריך עכשיו ליצור בכל aboutProject סהכ הוצאות שמתעדכן כל פעם שמוסיפים חשבונית