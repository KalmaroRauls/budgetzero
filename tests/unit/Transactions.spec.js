import { shallowMount, mount, createLocalVue } from "@vue/test-utils";
import Vuex from "vuex";
import Transactions from "@/components/TransactionView/Transactions.vue";
import Vuetify from "vuetify";
import mock_budget from "@/../tests/__mockdata__/mock_budget.json";
import store from "@/store";

import Vue from "vue";
Vue.use(Vuetify);
Vue.config.productionTip = false;

const localVue = createLocalVue();
localVue.use(Vuex);

const $route = {
  path: "/fake/path",
  params: {
    account_id: "38e690f8-198f-4735-96fb-3a2ab15081c2"
  }
};

const data = mock_budget.rows.map(row => row.doc);
let numberOfTransactions = null

describe("transaction table", () => {
  let vuetify;
  let wrapper;

  beforeAll(() => {
    // state.monthCategoryBudgets = data.filter(row => row._id.includes("_m_category_"));
    // state.payees = data.filter(row => row._id.includes("_payee_"));

    store.state.pouchdb.payees = data.filter(row => row._id.includes("_payee_"));
    store.state.pouchdb.accounts = data.filter(row => row._id.includes("_account_"));
    store.state.pouchdb.transactions = data.filter(row => row._id.includes("_transaction_"));
    store.state.pouchdb.masterCategories = data.filter(row =>
      row._id.includes("_master-category_")
    );
    store.state.pouchdb.categories = data
      .filter(row => row._id.includes("_category_"))
      .filter(row => !row._id.includes("m_category"));
    // store.state.pouchdb.month_selected = "2020-12",
    // store.state.pouchdb.selectedBudgetID = "79de488f-448e-4b4d-97ad-61e5e4f5df31",
    
    numberOfTransactions = data.filter(row => row._id.includes("_transaction_")).length
  });

  
  beforeEach(() => {
    vuetify = new Vuetify();
    localVue.use(vuetify)

    store.state.month_selected = "2020-12";
    wrapper = shallowMount(Transactions, {
      store,
      localVue,
      vuetify,
      mocks: {
        $route
      },
      stubs: {
        ImportModalComponent: true
      },
    });
  });



  it("renders correct snapshot", () => {
    expect(wrapper.html()).toMatchSnapshot();
  });

  /**
   * Picks a search field and waits for the field change to settle, the same way
   * it happens in the app before the user types anything
   */
  async function pickSearchField(field) {
    wrapper.vm.searchField = field;
    await localVue.nextTick();
  }

  it("transaction list for table is correct length", () => {
    expect(wrapper.vm.transactionListForTable.length).toBe(numberOfTransactions);
  });
  
  it("add transaction btn exists", () => {
    expect(wrapper.find("#addTransactionBtn").exists()).toBeTruthy();
  });

  it("search select offers payee, category, memo, inflow and outflow", () => {
    expect(wrapper.vm.searchFields.map(field => field.text)).toEqual([
      "All fields",
      "Payee",
      "Category",
      "Memo",
      "Inflow",
      "Outflow"
    ]);
    // "All fields" is the default so the previous search behaviour is unchanged
    expect(wrapper.vm.searchField).toBe("all");
    expect(wrapper.find("#searchFieldSelect").exists()).toBeTruthy();
    expect(wrapper.find("#searchInput").exists()).toBeTruthy();
  });

  it("offers autocomplete suggestions for payee, category and memo", async () => {
    await pickSearchField("payee");
    // Real payees plus account names (transfers are stored against the account)
    expect(wrapper.vm.searchSuggestions).toContain("Test Payee 4");
    expect(wrapper.vm.searchSuggestions).toContain("Savings");
    // The "no payee" placeholder would never match anything useful
    expect(wrapper.vm.searchSuggestions).not.toContain("Payee not selected.");

    await pickSearchField("category");
    expect(wrapper.vm.searchSuggestions).toContain("Uncategorized");
    expect(wrapper.vm.searchSuggestions.length).toBe(store.getters.categories.length);

    await pickSearchField("memo");
    expect(wrapper.vm.searchSuggestions).toEqual(["memo"]);

    // Amounts are typed, not picked from a list
    await pickSearchField("inflow");
    expect(wrapper.vm.searchSuggestions).toEqual([]);
    await pickSearchField("outflow");
    expect(wrapper.vm.searchSuggestions).toEqual([]);
  });

  it("clears the search text when another search field is picked", async () => {
    wrapper.vm.search = "memo";
    await pickSearchField("payee");
    expect(wrapper.vm.search).toBe("");
  });

  it("only matches the picked search field", async () => {
    const coffee = { memo: "Coffee", value: -500, category: null, payee: null };

    await pickSearchField("memo");
    wrapper.vm.search = "coffee";
    expect(wrapper.vm.transactionMatchesSearch(coffee)).toBe(true);
    wrapper.vm.search = "groceries";
    expect(wrapper.vm.transactionMatchesSearch(coffee)).toBe(false);

    // A memo hit does not count as a category hit
    await pickSearchField("category");
    wrapper.vm.search = "coffee";
    expect(wrapper.vm.transactionMatchesSearch(coffee)).toBe(false);
    wrapper.vm.search = "uncategorized";
    expect(wrapper.vm.transactionMatchesSearch(coffee)).toBe(true);
    expect(wrapper.vm.transactionMatchesSearch({ category: "income", value: 100000, memo: "" })).toBe(false);
    wrapper.vm.search = "income this month";
    expect(wrapper.vm.transactionMatchesSearch({ category: "income", value: 100000, memo: "" })).toBe(true);
  });

  it("searches by payee including transfers", async () => {
    await pickSearchField("payee");
    wrapper.vm.search = "savings";
    // Transfers are stored against the account id
    expect(wrapper.vm.transactionMatchesSearch({ payee: "38e690f8-198f-4735-96fb-3a2ab15081c2", memo: "" })).toBe(
      true
    );

    wrapper.vm.search = "unmatched-payee";
    expect(wrapper.vm.transactionMatchesSearch({ payee: null, memo: "" })).toBe(false);
  });

  it("searches inflows and outflows by direction and amount", async () => {
    const outflow = { memo: "", category: null, payee: null, value: -3864 };
    const otherOutflow = { memo: "", category: null, payee: null, value: -999 };
    const inflow = { memo: "", category: null, payee: null, value: 50000 };

    await pickSearchField("outflow");
    // Picking a direction already hides the other direction
    expect(wrapper.vm.transactionMatchesSearch(outflow)).toBe(true);
    expect(wrapper.vm.transactionMatchesSearch(inflow)).toBe(false);

    wrapper.vm.search = "38.64";
    expect(wrapper.vm.transactionMatchesSearch(outflow)).toBe(true);
    expect(wrapper.vm.transactionMatchesSearch(otherOutflow)).toBe(false);

    await pickSearchField("inflow");
    wrapper.vm.search = "500";
    expect(wrapper.vm.transactionMatchesSearch(inflow)).toBe(true);
    expect(wrapper.vm.transactionMatchesSearch(outflow)).toBe(false);
  });

  it("filters the table using the picked search field", async () => {
    const accountId = "38e690f8-198f-4735-96fb-3a2ab15081c2";
    const accountTransactions = store.getters.transactions_by_account[accountId];

    // Searching all fields keeps working like before
    wrapper.vm.search = "no-such-text-anywhere";
    expect(wrapper.vm.transactionListForTable.length).toBe(0);
    wrapper.vm.search = "memo";
    expect(wrapper.vm.transactionListForTable.length).toBe(accountTransactions.length);

    await pickSearchField("inflow");
    expect(wrapper.vm.transactionListForTable.length).toBe(accountTransactions.filter(trn => trn.value > 0).length);

    await pickSearchField("outflow");
    wrapper.vm.search = "97.55";
    expect(wrapper.vm.transactionListForTable.map(trn => trn.value)).toEqual([-9755]);
  });

  // it("add transaction btn creates a new row when clicked", () => {
  //   expect(wrapper.vm.transactionListForTable.length).toBe(numberOfTransactions);
  //   wrapper.find("#addTransactionBtn").trigger('click')
  //   expect(wrapper.vm.transactionListForTable.length).toBe(numberOfTransactions+1);
  // });
  
});

describe("reconcile function", () => {
  let vuetify;
  let wrapper;

  beforeAll(() => {
    // state.monthCategoryBudgets = data.filter(row => row._id.includes("_m_category_"));
    // state.payees = data.filter(row => row._id.includes("_payee_"));

    store.state.pouchdb.accounts = data.filter(row => row._id.includes("_account_"));
    store.state.pouchdb.transactions = data.filter(row => row._id.includes("_transaction_"));
    store.state.pouchdb.masterCategories = data.filter(row =>
      row._id.includes("_master-category_")
    );
    store.state.pouchdb.categories = data
      .filter(row => row._id.includes("_category_"))
      .filter(row => !row._id.includes("m_category"));
    // store.state.pouchdb.month_selected = "2020-12",
    // store.state.pouchdb.selectedBudgetID = "79de488f-448e-4b4d-97ad-61e5e4f5df31",

    store.state.route = $route
    
    numberOfTransactions = data.filter(row => row._id.includes("_transaction_")).length
  });

  
  beforeEach(() => {
    vuetify = new Vuetify();
    localVue.use(vuetify)

    store.state.month_selected = "2020-12";
    wrapper = mount(Transactions, {
      store,
      localVue,
      vuetify,
      mocks: {
        $route
      },
      stubs: {
        ImportModalComponent: true
      },
    });
  });

  it("reconcile button exists", () => {
    expect(wrapper.find('#btn-reconcile').exists()).toBeTruthy();
  });

  it("reconcile button exists", () => {
    wrapper.find('#btn-reconcile').trigger('click')
    
  });


});