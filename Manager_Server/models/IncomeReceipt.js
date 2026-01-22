const mongoose = require('mongoose');

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

    receiptNumber: {
      type: String,
      unique: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    currency: {
      type: String,
      default: "ILS",
    },

    payer: {
      type: String,
      required: true,
    },

    category: String,
    notes: String,

    imageUrl: String,
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