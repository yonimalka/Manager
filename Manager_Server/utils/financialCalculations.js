const mongoose          = require("mongoose");
const IncomeReceipt     = require("../models/IncomeReceipt");
const IncomeModel       = require("../models/Incomes");
const ReceiptModel      = require("../models/Receipt");
const FixedExpenseModel = require("../models/FixedExpense");

function normalizeDate(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

async function calcIncomesForPeriod(userId, startDate, endDate) {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const start = new Date(startDate);
  const end   = new Date(endDate);

  const [incomeReceiptResult, incomeResult] = await Promise.all([
    IncomeReceipt.aggregate([
      { $match: { userId: userId, createdAt: { $gte: start, $lt: end } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
    IncomeModel.aggregate([
      { $match: { userId: userObjectId, date: { $gte: start, $lt: end } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
  ]);

  return (incomeReceiptResult[0]?.total ?? 0) + (incomeResult[0]?.total ?? 0);
}

async function calcExpensesForPeriod(userId, startDate, endDate) {
  const now = new Date(endDate);
  now.setHours(23, 59, 59, 999);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  // Regular receipts in period
  const receipts = await ReceiptModel.find({ userId }).lean();
  const regularTotal = receipts
    .filter(r => {
      const d = new Date(r.createdAt);
      return !isNaN(d) && d >= start && d <= now;
    })
    .reduce((sum, r) => sum + (r.sumOfReceipt || 0), 0);

  // Fixed expenses — iterate occurrences in period, dedupe against logged receipts
  const fixedExpenses  = await FixedExpenseModel.find({ userId, isActive: true }).lean();
  const fixedReceipts  = await ReceiptModel.find({ userId, fixedExpenseId: { $ne: null } }).lean();
  const receiptSet     = new Set(
    fixedReceipts.map(r => `${String(r.fixedExpenseId)}_${normalizeDate(r.occurrenceDate || r.createdAt)}`)
  );

  let fixedTotal = 0;
  for (const fe of fixedExpenses) {
    let occurrenceDate = new Date(fe.startDate || fe.createdAt);
    occurrenceDate.setHours(0, 0, 0, 0);
    while (occurrenceDate <= now) {
      if (occurrenceDate >= start) {
        const key = `${String(fe._id)}_${normalizeDate(occurrenceDate)}`;
        if (!receiptSet.has(key)) {
          fixedTotal += fe.amount || 0;
        }
      }
      if (fe.frequency === "monthly")      occurrenceDate.setMonth(occurrenceDate.getMonth() + 1);
      else if (fe.frequency === "weekly")  occurrenceDate.setDate(occurrenceDate.getDate() + 7);
      else if (fe.frequency === "yearly")  occurrenceDate.setFullYear(occurrenceDate.getFullYear() + 1);
      else break;
    }
  }

  return regularTotal + fixedTotal;
}

module.exports = { calcIncomesForPeriod, calcExpensesForPeriod };
