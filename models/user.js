// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  address: {
    type: String,
    required: true,
  },
  noOfAppliances: {
    type: Number,
    default: 0,
  },
  typesOfAppliances: {
    type: [String], // example: ["Fan", "AC", "Fridge"]
    default: [],
  },
  lastMonthBill: {
    type: Number, // in ₹
    default: 0,
  },
  role: {
    type: String,
    enum: ['user', 'builder'],
    default: 'user',
  },
});

module.exports = mongoose.model("User", userSchema);
