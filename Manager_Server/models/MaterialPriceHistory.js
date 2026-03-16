const mongoose = require("mongoose");

const MaterialPriceHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  materialName: {
    type: String,
    required: true
  },

  price: {
    type: Number,
    required: true
  },

  supplier: {
    type: String,
    default: ""
  },

  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project"
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("MaterialPriceHistory", MaterialPriceHistorySchema);