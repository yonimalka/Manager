const mongoose = require ("mongoose");

const EmployeeSchema = new mongoose.Schema({
    name: {
    type: String,
    required: true,
    trim: true,
  },
  role: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
  },
  email: {
    type: String,
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  // 👇 Salary Info
  salaryType: {
    type: String,
    enum: ["hourly", "daily"],
    required: true,
  },
  salaryRate: {
    type: Number,
    required: true, // e.g. 50 (₪50 per hour or day)
  },
  // track work hours or days
  totalHoursWorked: {
    type: Number,
    default: 0,
  },
  totalDaysWorked: {
    type: Number,
    default: 0,
  },
  // auto-calc or store total pay
  totalPay: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ["active", "inactive", "on_leave"],
    default: "active",
  },
});

module.exports = EmployeeSchema;