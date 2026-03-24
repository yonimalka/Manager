const mongoose = require("mongoose");

const AgentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // one agent per user
    },
    name: {
      type: String,
      default: "My Assistant",
    },
    persona: {
      type: String,
      default: "accountant",
    },
    systemPrompt: {
      type: String,
      default: null,
    },
    language: {
      type: String,
      default: "en",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Agent", AgentSchema);
