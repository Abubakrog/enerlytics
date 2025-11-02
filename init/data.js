module.exports = [
  {
    task: "Finish web dev project",
    priority: "high",
    dueDate: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours later
  },
  {
    task: "Buy groceries",
    priority: "medium",
    // no dueDate → will use default (12 hours)
  },
  {
    task: "Workout for 30 minutes",
    priority: "low",
    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day later
  },
  {
    task: "Call college friend",
    priority: "medium",
    // no dueDate → default kicks in
  },
  {
    task: "Plan Sunday trip",
    priority: "high",
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days later
  },
];
