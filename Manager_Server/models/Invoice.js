const mongoose = require("mongoose");

const InvoiceSchema = new mongoose.Schema(
  {
    userId:        { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    projectId:     { type: mongoose.Schema.Types.ObjectId, default: null },
    client:        { type: String, required: true, trim: true },
    clientPhone:   { type: String, default: null },
    description:   { type: String, default: null },
    amount:        { type: Number, required: true, min: 0.01 },
    currency:      { type: String, default: "USD" },
    dueDate:       { type: Date, required: true },
    status:        { type: String, enum: ["unpaid", "paid"], default: "unpaid" },
    paidAt:        { type: Date, default: null },
    incomeId:      { type: mongoose.Schema.Types.ObjectId, default: null },
    lastRemindedAt:{ type: Date, default: null },
    // Pay link
    publicToken:   { type: String, unique: true, sparse: true, index: true },
    claimedAt:     { type: Date, default: null },
    claimedMethod: { type: String, default: null },
    linkViews:     { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Invoice", InvoiceSchema);
