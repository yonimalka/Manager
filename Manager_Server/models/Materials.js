const mongoose = require("mongoose");

const MaterialItemSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
  item: String,
  qty: Number
});

const MaterialsSchema = new mongoose.Schema({
  items: [MaterialItemSchema]
});

module.exports = MaterialsSchema;