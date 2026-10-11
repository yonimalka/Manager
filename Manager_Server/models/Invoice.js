const mongoose = require("mongoose");

const InvoiceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, default: null },
    client: { type: String, required: true, trim: true },
    clientPhone: { type: String, default: null },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, default: "USD" },
    dueDate: { type: Date, required: true },
    status: { type: String, enum: ["unpaid", "paid"], default: "unpaid" },
    paidAt: { type: Date, default: null },
    incomeId: { type: mongoose.Schema.Types.ObjectId, default: null },
    lastRemindedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Invoice", InvoiceSchema);
