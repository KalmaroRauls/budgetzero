import { buildPayeeMergeDocs } from '@/helper.js'
import budget from '@/store/modules/budget-module'
import { mount, createLocalVue } from '@vue/test-utils'
import Vuex from 'vuex'
import Vuetify from 'vuetify'
import Settings from '@/components/Settings.vue'
import store from '@/store'

const BUDGET_ID = '5a98dc44-7982-4ecc-aa50-146fc4dc4e16'

const targetPayee = {
  _id: `b_${BUDGET_ID}_payee_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`,
  name: 'Walmart',
  _rev: '3-target'
}
const sourcePayee1 = {
  _id: `b_${BUDGET_ID}_payee_bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb`,
  name: 'WALMART #1234',
  _rev: '1-source1'
}
const sourcePayee2 = {
  _id: `b_${BUDGET_ID}_payee_cccccccc-cccc-cccc-cccc-cccccccccccc`,
  name: 'Walmart Inc',
  _rev: '2-source2'
}

const source1ShortId = sourcePayee1._id.slice(-36)
const source2ShortId = sourcePayee2._id.slice(-36)
const targetShortId = targetPayee._id.slice(-36)

function makeTransactions() {
  return [
    { _id: 't1', payee: source1ShortId, value: -100 },
    { _id: 't2', payee: source2ShortId, value: -200 },
    { _id: 't3', payee: targetShortId, value: -300 },
    { _id: 't4', payee: null, value: 500 },
    { _id: 't5', payee: '--------------------initial-balance', value: 0 }
  ]
}

describe('buildPayeeMergeDocs', () => {
  it('reassigns only transactions that referenced a source payee', () => {
    const transactions = makeTransactions()
    const { updatedTransactions } = buildPayeeMergeDocs(
      transactions,
      [targetPayee, sourcePayee1, sourcePayee2],
      [sourcePayee1._id, sourcePayee2._id],
      targetPayee._id
    )

    expect(updatedTransactions.map(trn => trn._id).sort()).toEqual(['t1', 't2'])
    updatedTransactions.forEach(trn => expect(trn.payee).toBe(targetShortId))
  })

  it('flags the source payee docs for deletion and keeps the target', () => {
    const { deletedPayees } = buildPayeeMergeDocs(
      makeTransactions(),
      [targetPayee, sourcePayee1, sourcePayee2],
      [sourcePayee1._id, sourcePayee2._id],
      targetPayee._id
    )

    expect(deletedPayees.map(payee => payee._id).sort()).toEqual([sourcePayee1._id, sourcePayee2._id].sort())
    deletedPayees.forEach(payee => expect(payee._deleted).toBe(true))
    // The kept payee is never marked for deletion
    expect(deletedPayees.find(payee => payee._id === targetPayee._id)).toBeUndefined()
  })

  it('never deletes the target even when it is passed in the source list', () => {
    const { deletedPayees, updatedTransactions } = buildPayeeMergeDocs(
      makeTransactions(),
      [targetPayee, sourcePayee1],
      [targetPayee._id, sourcePayee1._id],
      targetPayee._id
    )

    expect(deletedPayees.map(payee => payee._id)).toEqual([sourcePayee1._id])
    // Transactions already pointing at the target are left alone
    expect(updatedTransactions.map(trn => trn._id)).toEqual(['t1'])
  })

  it('does not mutate the original documents (Vuex strict-safe)', () => {
    const transactions = makeTransactions()
    const payees = [targetPayee, sourcePayee1, sourcePayee2]

    const { updatedTransactions, deletedPayees } = buildPayeeMergeDocs(
      transactions,
      payees,
      [sourcePayee1._id],
      targetPayee._id
    )

    // Originals are untouched
    expect(transactions[0].payee).toBe(source1ShortId)
    expect(sourcePayee1._deleted).toBeUndefined()
    // Returned docs are fresh copies
    expect(updatedTransactions[0]).not.toBe(transactions[0])
    expect(deletedPayees[0]).not.toBe(sourcePayee1)
    // _rev is preserved so PouchDB can delete/update the docs
    expect(deletedPayees[0]._rev).toBe(sourcePayee1._rev)
  })
})

describe('mergePayees store action', () => {
  function makeContext(transactions, payees) {
    const committedDocs = []
    const committedMutations = []
    return {
      committedDocs,
      committedMutations,
      context: {
        getters: { transactions, payees },
        dispatch: (action, payload) => {
          if (action === 'commitBulkDocsToPouchAndVuex') {
            committedDocs.push(...payload)
            return Promise.resolve()
          }
          return Promise.resolve()
        },
        commit: (type, payload) => committedMutations.push({ type, payload })
      }
    }
  }

  it('commits reassigned transactions and deleted payees in one bulk write', async () => {
    const transactions = makeTransactions()
    const { context, committedDocs, committedMutations } = makeContext(transactions, [
      targetPayee,
      sourcePayee1,
      sourcePayee2
    ])

    await budget.actions.mergePayees(context, {
      sourcePayeeIds: [sourcePayee1._id, sourcePayee2._id],
      targetPayeeId: targetPayee._id
    })

    const updated = committedDocs.filter(doc => !doc._deleted && doc._id.startsWith('t'))
    const deleted = committedDocs.filter(doc => doc._deleted)

    expect(updated.map(doc => doc._id).sort()).toEqual(['t1', 't2'])
    updated.forEach(doc => expect(doc.payee).toBe(targetShortId))
    expect(deleted.map(doc => doc._id).sort()).toEqual([sourcePayee1._id, sourcePayee2._id].sort())
    expect(committedMutations.some(m => m.type === 'SET_SNACKBAR_MESSAGE')).toBe(true)
  })

  it('does not write anything when there are no source payees to merge', async () => {
    const { context, committedDocs } = makeContext(makeTransactions(), [targetPayee])

    await budget.actions.mergePayees(context, {
      sourcePayeeIds: [targetPayee._id],
      targetPayeeId: targetPayee._id
    })

    expect(committedDocs.length).toBe(0)
  })
})

describe('Settings merge payee UI', () => {
  const localVue = createLocalVue()
  localVue.use(Vuex)

  const payees = [
    { _id: `b_${BUDGET_ID}_payee_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`, name: 'Walmart' },
    { _id: `b_${BUDGET_ID}_payee_bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb`, name: 'WALMART #1234' },
    { _id: `b_${BUDGET_ID}_payee_cccccccc-cccc-cccc-cccc-cccccccccccc`, name: 'Whole Foods' }
  ]
  const walmartId = payees[0]._id
  const walmart2Id = payees[1]._id
  const wholeFoodsId = payees[2]._id

  let vuetify
  let wrapper

  beforeEach(() => {
    vuetify = new Vuetify()
    localVue.use(vuetify)
    store.state.pouchdb.payees = payees.map(payee => Object.assign({}, payee))
    wrapper = mount(Settings, { store, localVue, vuetify })
  })

  it('offers every real payee in the "payees to merge" selector', () => {
    const ids = wrapper.vm.selectablePayees.map(payee => payee._id)
    expect(ids).toHaveLength(3)
    expect(ids).toEqual(expect.arrayContaining([walmartId, walmart2Id, wholeFoodsId]))
  })

  it('only offers the selected payees as "keep this payee" options', async () => {
    // Nothing selected to merge yet -> nothing to keep
    expect(wrapper.vm.mergeTargetOptions).toEqual([])

    wrapper.vm.payeesToMerge = [walmartId, walmart2Id]
    await wrapper.vm.$nextTick()

    const mergeNames = wrapper.vm.mergeTargetOptions.map(payee => payee.name)
    expect(mergeNames).toHaveLength(2)
    expect(mergeNames).toEqual(expect.arrayContaining(['Walmart', 'WALMART #1234']))
    // The payee that is not part of the merge selection is never offered
    expect(wrapper.vm.mergeTargetOptions.map(payee => payee._id)).not.toContain(wholeFoodsId)
  })

  it('requires a kept payee that is part of the merge selection', async () => {
    wrapper.vm.payeesToMerge = [walmartId, walmart2Id]
    wrapper.vm.mergeTarget = walmartId
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.canMerge).toBe(true)

    // A single payee cannot be merged into itself
    wrapper.vm.payeesToMerge = [walmartId]
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.canMerge).toBe(false)

    // A kept payee outside the selection is not valid
    wrapper.vm.payeesToMerge = [walmartId, walmart2Id]
    wrapper.vm.mergeTarget = wholeFoodsId
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.canMerge).toBe(false)
  })

  it('clears the kept payee when it is removed from the merge selection', async () => {
    wrapper.vm.payeesToMerge = [walmartId, walmart2Id]
    wrapper.vm.mergeTarget = walmartId
    await wrapper.vm.$nextTick()

    wrapper.vm.payeesToMerge = [walmart2Id]
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.mergeTarget).toBe(null)
  })

  it('opens the merge dialog from the Settings button', async () => {
    await wrapper.find('#mergePayeesBtn').trigger('click')
    expect(wrapper.vm.mergeDialogVisible).toBe(true)
  })
})
