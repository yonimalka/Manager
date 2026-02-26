const mongoose = require("mongoose");

const MaterialsSchema = new mongoose.Schema({
   items: {type: Array, default: []}
})

module.exports = MaterialsSchema;