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

const app = express();
const PORT = process.env.PORT;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true}));


app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'http://localhost:3000', process.env.MONGO_URI);
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Credentials', 'true');
    next();
  });



// openai API setup
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

let gfsBucket;

async function connectToGridFS(userId = 'default') {
  const client = new MongoClient(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  await client.connect();
  const db = client.db('managoDB'); // Must match your actual DB name
  gfsBucket = new GridFSBucket(db, {
    bucketName: `user_${userId}_bucket`
  });

  console.log('📦 GridFSBucket initialized');
}

async function init() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: 'managoDB',
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Mongoose connected to MongoDB Atlas');

    await connectToGridFS(); // Ensure GridFS connects after Mongoose
} catch (err) {
    console.error('❌ Error connecting:', err);
  }
}

init();


const ReceiptSchema = new mongoose.Schema({
  filename: String,
  sumOfReceipt: Number,
  contentType: String,
  date: {
    month: String,
    year: String,
    time: String,
  },
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
  date: {
    year: String,
    month: String,
    day: String,
  }
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
  surname: String,
  email: String,
  password: String,
  projects: [ProjectSchema],
  totalExpenses: Number,
  totalIncomes: {type: Number},  
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

const storage = multer.memoryStorage();
const upload = multer({ storage });

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
  console.log(email , password);
  
  const user = await UserModel.findOne({email: email});
  if(!user) {
    console.log("no user found");
    return res.status(401).json({ message: "Invalid email or password"})
    
    
  }
  const isPasswordValid = await bcrypt.compare(password, user.password);
  // const isPasswordValid = await user.password;
  if(!isPasswordValid){
    return res.status(401).json({ message: "Invalid email or password"})
  }
    console.log("userId: ",user._id);
    res.send({userId: user._id})
    // res.status(200).json({message: "Login successful!"})
})
app.get("/getUserDetails/:userId", async (req, res) => {
   const userId = req.params.userId;
   console.log(userId);
   
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
})
app.get("/getUsers/:userId", async (req, res) => {
  const userId = req.params.userId;
  // console.log(userId);
  
  // const user = await UserModel.findOne({email: userEmail})
  // res.json(user);

  await UserModel.findById(userId)
  .then(function(users){
    res.json(users)
    // console.log(users);
  }).catch((err) =>{
    console.log(err);
  } )
  
})

app.post("/updateDetails/:userId", async (req, res) =>{
    const userId = req.params.userId;
    const {name, payment, days, materialsList, toDoList} = req.body;
    console.log(toDoList);
    
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
})

app.post("/updateTasks/:userId/:projectId", async (req, res) => {
  const userId = req.params.userId;
  const projectId = req.params.projectId;
  const updatedTask = req.body;
  console.log(updatedTask);
  
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
app.get("/getProject/:userId/:projectId", (req, res) => {
  const userId = req.params.userId;
  const Id = req.params.projectId;
  // console.log(Id);
  
  UserModel.findById(userId)
  .then(function(user){
    // console.log(user.projects);
    const project = user.projects.find((p) => p._id.toString() == Id);
    // console.log(project);
    res.send(project);
    
  }).catch((err) =>{
    console.log(err);
  } )
  });

  app.post("/uploadReceipt/:userId", upload.single('image'), async (req, res) =>{
    const userId = req.params.userId;
    const {sumOfReceipt, category, projectId} = req.body;
    const { file } = req;
    // console.log(file);
    
    if (!file){
      return res.status(400).send('No file uploaded');
    }
    
    console.log(userId);
    await connectToDB(userId);
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
    const date = now.toLocaleDateString();     // e.g., "5/23/2025"
    const time = now.toLocaleTimeString();     // e.g., "2:35:42 PM"

    const receiptImage = {
      filename: category,
      sumOfReceipt: sumOfReceipt, 
      contentType: req.file.mimetype,
      date: {
        day: now.getDay() +1,
        month: now.getMonth() +1,
        year: now.getFullYear(),
        time,
      },
    };
    
    UserModel.findById(userId)
    .then(user => {
      const project = user.projects.find((p) => p._id.toString() === projectId)
      
      project.receipts.push(receiptImage)
      project.expenses += Number(sumOfReceipt);
      console.log(project.expenses)
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

app.get('/getReceipts/:userId/:projectId', async (req, res) =>{
  const projectId = req.params.projectId;
  const userId = req.params.userId;
    
    try {
    const files = await mongoose.connection.db
    .collection(`user_${userId}_bucket.files`)
    .find({'metadata.projectId': projectId})
    .toArray();
    // console.log(files);  
    
    if (!files || files.length === 0) {
      return res.status(404).json({ message: 'No files found' });
    }
   await connectToDB(userId)
    const images = [];
    
    for (const file of files) {
      const chunks = [];
      const stream = gfsBucket.openDownloadStreamByName(file.filename);

      await new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', resolve);
        stream.on('error', reject);
      });

      const imageBase64 = Buffer.concat(chunks).toString('base64');

      images.push({
        filename: file.filename,
        contentType: file.contentType,
        data: `data:${file.contentType};base64,${imageBase64}`, // Embed Base64 image data
      });
    }
    res.json(images);
  } catch (err){
    console.error(err);
    res.status(500).send('Error fetching images');
  }
})

app.get('/getTotalExpenses/:userId', async (req, res) => {
  const userId = req.params.userId;
  UserModel.findById(userId)
  .then((user) => {
    const getExpenses = user.totalExpenses;
    res.json(getExpenses)
  })
  
})

app.get('/getTotalIncomes/:userId', (req, res) => {
  const userId = req.params.userId;
  UserModel.findById(userId)
  .then((user) => {
    const getIncomes = user.totalIncomes;
    res.json(getIncomes);
  })
})
app.post('/AddTask/:userId/:projectId', async (req, res) => {
  const userId = req.params.userId;
  const Id = req.params.projectId;
  const addTask = req.body;
  await UserModel.findById(userId)
    .then(user => {
      const project = user.projects.find((p) => p._id.toString() === Id)
      project.toDoList.push(addTask);
      return user.save();
    });
})

app.post('/AddItem/:userId/:projectId', async (req, res) => {
  const userId = req.params.userId;
  const Id = req.params.projectId;
  const addItem = req.body;
  console.log(addItem);
  
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
app.post('/UpdatePayment/:userId/:projectId', async (req, res) =>{
  const userId = req.params.userId;
  const Id = req.params.projectId;
  const {paidAmount} = req.body;
  // console.log(paidAmount);
  const now = new Date();

  UserModel.findById(userId)
  .then(user => {
    const project = user.projects.find((p) => p._id.toString() == Id)
    // console.log(project);
    // console.log(typeof(project.paid));
    project.paid += paidAmount;
    project.paymentDetails.push({
      amount: paidAmount,
      date: {
        year: now.getFullYear(),
        month: now.getMonth() +1,
        day: now.getDay()+1
      }
    })
    user.totalIncomes += paidAmount; 
    res.json(user.totalIncomes);
    return user.save();
    
  });
});

app.get("/getCashFlowIncomes/:userId", async (req, res) =>{
  const userId = req.params.userId;
  const now = new Date();
  const thisMonth = now.getMonth() +1;
 const thisDay = now.getDay() +1;
 console.log(thisDay);
 
  // const incomesDetailes = []
  UserModel.findById(userId)
  .then(user =>{
    // console.log(user.projects.length);
    const incomesDetailes = user.projects.flatMap(p =>
      p.paymentDetails
      .filter(m => m.date.month == thisMonth)
      .map(m => ({
        payments: m,
        projectName: p.name,
      })
    )
    )
    
    // console.log("incomes", incomesDetailes);
    
    res.send(incomesDetailes)
  })
  
})
app.get("/getCashFlowExpenses/:userId", async (req, res) =>{
  const userId = req.params.userId;
   const now = new Date();
  const thisMonth = now.getMonth() +1;
    const thisDay = now.getDay() +1;

   UserModel.findById(userId)
   .then(user =>{
    const receiptsDetails = user.projects.flatMap(p =>
      p.receipts
      .filter(m => m.date.month == thisMonth)
      .map(m => ({
        payments: m,
        projectName: p.name,
      })
    )
    )
    console.log(receiptsDetails);
    res.send(receiptsDetails)
    


   })
})

app.post('/quoteGenerator/:userId', upload.none(), async (req,res) =>{
  const userId = req.params.userId;
  
  const companyName = await UserModel.findById(userId)
  .then(user => user.name);

  const {
    clientName,
    projectTitle,
    projectType,
    projectDetails,
    additionalCosts,
    paymentTerms,
    totalPrice,
    } = req.body;
  try {
    const schema = `
Return ONLY valid JSON that matches exactly:

{
  "header": {
    "quoteNo": "string",          // e.g. "the year‑0042" 
    "date"   : "YYYY‑MM‑DD",      // ISO date (actuall date)
    "company": ${companyName},
    "phoneNumber": "number",
    "client" : "string"
  },
  projectTitle: "string"
  "items": [
    { "desc": "string", "qty": number, "unit": "string", "unitPrice": number }
  ],
  "totals": { "sub": "totalPrice", "vat": sub*0.18, "grand": sub+vat },
  "details": "string",
  "paymentTerms": "string"
}

Do NOT wrap in markdown, do NOT add commentary.
`;
    const prompt = `write a profesional quote for client name: ${clientName} with this details: project type: ${projectType},
     the description of the project: ${projectDetails} explain it with more extended and profesional details about the proccess and the project, additional costs: ${additionalCosts}, total price: ${totalPrice} and the payment terms: ${paymentTerms}. Generate a price according what is common to take on this kind of project. Formal, clear, pleasant. style it like a proffesional quote with styled color shapes and rely on ${schema}`
    //  console.log("Calling OpenAI with model:", model);
     const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object'},
      messages: [
        { role: 'system', content: `אתה יועץ עסקי שמתמחה בתחום ${projectType} שכותב הצעות מחיר יפות, מסודרות וצבעוניות בעברית` },
        { role: 'user', content: `${prompt}` },
      ],
    });
    const quote = JSON.parse(completion.choices[0].message.content);
    // console.log(quote);
    
    const pdfBuf = await jsonToPdf(quote);
    
    console.log('pdfBuf length:', pdfBuf.length);
    function safeFilename(str) {
      return String(str)
        .replace(/[^a-z0-9_\-\.]/gi, '_')   // keep letters, numbers, _ - .
        .slice(0, 60);                      // optional: max 60 chars
    }
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename= quote_${safeFilename(quote.header.date)}`,
      'Content-Length': pdfBuf.length
    });
    
                 
     res.end(pdfBuf);
    // console.log("Generated message from OpenAI:", message);

  } catch (error) {
    console.error('OpenAI error:', error);
    res.status(404).json({ error: 'Error generating quote' });
  }
});

app.delete("/deleteUser/:userId", async (req, res) => {
 const userId = req.params.userId;
 console.log(userId);
 
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