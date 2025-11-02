const mongoose = require("mongoose");
const data = require("./data.js");
const Task = require("../models/task.js");

const MONGO_URL = "mongodb://127.0.0.1:27017/todo";

main()
  .then(() => {
    console.log("Connected to DB");
  })
  .catch((err) => {
    console.log(err);
  });

async function main() {
  await mongoose.connect(MONGO_URL);
}

const initData = async () => {
  await Task.deleteMany({});
  await Task.insertMany(data);
  console.log("Data was inserted");
};

initData();
