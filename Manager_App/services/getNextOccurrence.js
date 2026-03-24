export function getNextOccurrence(expense) {
  const now = new Date();

  if (!expense.startDate) return null;

  let next = new Date(expense.startDate);

  if (expense.frequency === "monthly") {
    next = new Date(
      now.getFullYear(),
      now.getMonth(),
      expense.dayOfMonth || next.getDate()
    );

    if (next < now) {
      next = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        expense.dayOfMonth || next.getDate()
      );
    }
  }

  if (expense.frequency === "weekly") {
    const today = now.getDay();
    const diff = (expense.dayOfWeek - today + 7) % 7 || 7;

    next = new Date(now);
    next.setDate(now.getDate() + diff);
  }

  if (expense.frequency === "yearly") {
    next = new Date(
      now.getFullYear(),
      new Date(expense.startDate).getMonth(),
      new Date(expense.startDate).getDate()
    );

    if (next < now) {
      next.setFullYear(now.getFullYear() + 1);
    }
  }

  return next;
}