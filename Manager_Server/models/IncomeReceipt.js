const mongoose = require('mongoose');

const lineItemSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true,
    trim: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  lineTotal: {
    type: Number,
    required: true,
  },
});

const IncomeReceiptSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      ref: "User",
      required: true,
    },

    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
    },
     services: {
    type: [lineItemSchema],
    validate: [(val) => val.length > 0, "At least one line item required"],
  },
    receiptNumber: {
      type: String,
      unique: true,
      index: true,
    },

    // amount: {
    //   type: Number,
    //   required: true,
    // },
    subtotal: Number,
    tax: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    total: Number,

    currency: {
      type: String,
      default: "ILS",
    },

    payer: {
      type: String,
      required: true,
    },

    // category: String,
    notes: String,

    pdfUrl: String,
    paymentMethod: String,
    type: {
      type: String,
      default: "income",
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("IncomeReceipt", IncomeReceiptSchema);