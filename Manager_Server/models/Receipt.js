const mongoose = require("mongoose");

const ReceiptSchema = new mongoose.Schema({
userId: {
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User",
      required: true
    },
    projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project",
    default: null,
    // required: true,
    },
    imageUrl: {
      type: String,
      // required: true, // Firebase download URL
    },

    sumOfReceipt: {
      type: Number,
      // required: true,
    },

    category: {
      type: String,
      default: "General",
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true })
ReceiptSchema.index({ userId: 1, createdAt: 1 });

module.exports = mongoose.model("Receipt", ReceiptSchema)