// models/User.js

const mongoose = require("mongoose");
const ProjectSchema = require("./Project")
const EmployeeSchema = require("./Employee");

const UserSchema = new mongoose.Schema({
  name: String,
  businessName: String,
  address: {
    street: { type: String, trim: true },
    state: { type: String, uppercase: true, trim: true },
    country: { type: String, uppercase: true, trim: true },
    zip: { type: String, trim: true },
  },
  businessId: Number,

  taxSettings: {
    collectTax: { type: Boolean, default: false },
    businessState: { type: String, uppercase: true, trim: true },
  },

  email: String,
  logo: String,
  password: { type: String, default: null },
  googleId: { type: String, unique: true, sparse: true },
  appleId: { type: String, unique: true, sparse: true },
  projects: [ProjectSchema],
  totalExpenses: Number,
  totalIncomes: { type: Number },
  employees: [EmployeeSchema],
});

module.exports = mongoose.model("User", UserSchema);