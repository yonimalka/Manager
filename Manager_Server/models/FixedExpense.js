const mongoose = require("mongoose");

const FixedExpenseSchema = new mongoose.Schema({
      userId: {
          type: mongoose.Schema.Types.ObjectId, 
        ref: "User",
        required: true
      },
      title: String,              // "Office Rent"
      category: String,           // "Rent", "Software", "Car"
      amount: Number,
    
      frequency: {
        type: String,
        enum: ["monthly", "weekly", "yearly", "custom"],
        default: "monthly",
      },
    
      startDate: Date,
      endDate: Date,              // optional
      dayOfMonth: Number,         // for monthly (e.g. 10th)
      dayOfWeek: Number,          // for weekly (0–6)
    
      projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "projects",
        required: false,
      },
    
      isActive: { type: Boolean, default: true },
    }, { timestamps: true })
    FixedExpenseSchema.index({ userId: 1, isActive: 1, createdAt: 1 });

    module.exports = mongoose.model("FixedExpense", FixedExpenseSchema);