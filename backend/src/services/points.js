export function getPointBalance(db, userId) {
  return db.pointTransactions
    .filter((transaction) => transaction.userId === userId)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
}
