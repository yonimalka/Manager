const mongoose = require("mongoose");

const paymentDetailsSchema = new mongoose.Schema({
    amount: Number,
    method: String,
    date: { type: Date, default: Date.now },
})

module.exports = paymentDetailsSchema;