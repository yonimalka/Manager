const mongoose = require("mongoose"); 
const paymentDetailsSchema = require("./PaymentDetails");
const MaterialsSchema = require("./Materials");
const toDoListSchema = require("./ToDoList");

const ProjectSchema = new mongoose.Schema({
    userId: {type: mongoose.Schema.Types.ObjectId, 
  ref: "User",
  required: true},
      name: {type: String, required: true},
      payment: {type: Number, required: true},
      paid: {type: Number, default: 0},
      paymentDetails: [paymentDetailsSchema],
      days: {type: Number, required: true},
      materials: [MaterialsSchema],
      expenses: {type: Number},
      toDoList: [toDoListSchema],
       createdAt: {
          type: Date,
          default: Date.now,
        },
      },
      { timestamps: true })

      module.exports = ProjectSchema;