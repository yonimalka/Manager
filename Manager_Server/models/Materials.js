const mongoose = require("mongoose");

const MaterialItemSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, auto: true },

  item: {
    type: String,
    required: true
  },

  qty: {
    type: Number,
    required: true
  },

  estimatedUnitCost: {
    type: Number,
    default: 0
  },

  actualUnitCost: {
    type: Number,
    default: 0
  },

  supplier: {
    type: String,
    default: ""
  }
});

const MaterialsSchema = new mongoose.Schema({
  items: [MaterialItemSchema]
});

module.exports = MaterialsSchema;