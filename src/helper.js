// Clean/sanitize amount input
function sanitizeValueInput(value) {
  let amt = value.toString().replace(/[^0-9.-]/g, '') * 100
  return parseInt(amt) / 100
}

/**
 * Builds the list of documents needed to merge one or more payees into a single
 * target payee.
 *
 * Every transaction that references a source payee is reassigned to the target
 * payee's short (36 char) id, and each redundant payee document is flagged for
 * deletion. Plain copies are returned so Vuex strict mode is never violated and
 * the original state objects are left untouched.
 *
 * @param {Array} transactions All transactions for the current budget
 * @param {Array} payees All payee docs for the current budget
 * @param {Array<String>} sourcePayeeIds Full _ids of the payees to merge away
 * @param {String} targetPayeeId Full _id of the payee whose name is kept
 * @returns {{ updatedTransactions: Array, deletedPayees: Array }}
 */
function buildPayeeMergeDocs(transactions, payees, sourcePayeeIds, targetPayeeId) {
  const targetShortId = targetPayeeId.slice(-36)
  const sourceShortIds = sourcePayeeIds
    .filter(id => id && id !== targetPayeeId)
    .map(id => id.slice(-36))

  const updatedTransactions = transactions
    .filter(trn => sourceShortIds.includes(trn.payee))
    .map(trn => Object.assign({}, trn, { payee: targetShortId }))

  const deletedPayees = payees
    .filter(payee => payee._id && sourceShortIds.includes(payee._id.slice(-36)))
    .map(payee => Object.assign({}, payee, { _deleted: true }))

  return { updatedTransactions, deletedPayees }
}

export { sanitizeValueInput, buildPayeeMergeDocs }
