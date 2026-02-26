const mongoose= require("mongoose");

const toDoListSchema = new mongoose.Schema({
  task: String,
  details: String,
  checked: {type: Boolean, default: false}
}, { _id: true })

module.exports = toDoListSchema;