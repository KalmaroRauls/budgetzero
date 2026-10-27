import { mount, createLocalVue } from "@vue/test-utils";
import Vuex from "vuex";
import Vuetify from "vuetify";
import Piechart from "@/components/Piechart.vue";
import store from "@/store";

import Vue from "vue";
Vue.use(Vuetify);
Vue.config.productionTip = false;

const localVue = createLocalVue();
localVue.use(Vuex);
// vue2-filters is registered globally in main.js, register a stub here so the totals table renders
localVue.filter("currency", value => Number(value).toFixed(2));

const BUDGET_ID = "cc28ac0b-19fe-4735-a2e7-9bb91d54b6cc";
const SAVINGS_ID = "38e690f8-198f-4735-96fb-3a2ab15081c2";
const OFF_BUDGET_ID = "99999999-8888-7777-6666-555555555555";
const MASTER_ID = "2b8b142a-588f-407d-a54d-88d7d30e3564";
const GROCERIES_ID = "aaaaaaaa-1111-2222-3333-444444444444";
const FUEL_ID = "bbbbbbbb-1111-2222-3333-444444444444";
const RENT_ID = "cccccccc-1111-2222-3333-444444444444";

const accounts = [
  {
    type: "CHECKING",
    checkNumber: true,
    closed: false,
    name: "Savings",
    note: "Savings account",
    sort: 0,
    onBudget: true,
    balanceIsNegative: false,
    _id: `b_${BUDGET_ID}_account_${SAVINGS_ID}`
  },
  {
    type: "CHECKING",
    checkNumber: true,
    closed: false,
    name: "Off Budget Account",
    note: null,
    sort: 1,
    onBudget: false,
    balanceIsNegative: false,
    _id: `b_${BUDGET_ID}_account_${OFF_BUDGET_ID}`
  }
];

const masterCategories = [
  { name: "Everyday Expenses", sort: 0, collapsed: false, _id: `b_${BUDGET_ID}_master-category_${MASTER_ID}` }
];

const categories = [
  {
    name: "Groceries",
    hidden: false,
    masterCategory: MASTER_ID,
    sort: 0,
    _id: `b_${BUDGET_ID}_category_${GROCERIES_ID}`
  },
  { name: "Fuel", hidden: false, masterCategory: MASTER_ID, sort: 1, _id: `b_${BUDGET_ID}_category_${FUEL_ID}` },
  {
    name: "Rent/Mortgage",
    hidden: false,
    masterCategory: MASTER_ID,
    sort: 2,
    _id: `b_${BUDGET_ID}_category_${RENT_ID}`
  }
];

function transaction({ id, date, value, category, account = SAVINGS_ID }) {
  return {
    account,
    category,
    cleared: true,
    approved: true,
    value,
    date,
    memo: "",
    reconciled: false,
    flag: "#ffffff",
    payee: null,
    transfer: null,
    splits: [],
    _id: `b_${BUDGET_ID}_transaction_${id}`,
    _rev: ""
  };
}

const transactions = [
  transaction({
    id: "00000001-0000-0000-0000-000000000000",
    date: "2020-01-15",
    value: -10000,
    category: GROCERIES_ID
  }),
  // A refund nets against the purchases in the same category
  transaction({
    id: "00000002-0000-0000-0000-000000000000",
    date: "2020-01-25",
    value: 2000,
    category: GROCERIES_ID
  }),
  transaction({
    id: "00000003-0000-0000-0000-000000000000",
    date: "2020-03-05",
    value: -5000,
    category: GROCERIES_ID
  }),
  transaction({ id: "00000004-0000-0000-0000-000000000000", date: "2020-02-10", value: -2500, category: FUEL_ID }),
  transaction({ id: "00000005-0000-0000-0000-000000000000", date: "2020-06-01", value: -20000, category: RENT_ID }),
  transaction({ id: "00000006-0000-0000-0000-000000000000", date: "2020-01-20", value: -1200, category: null }),
  transaction({ id: "00000007-0000-0000-0000-000000000000", date: "2020-01-01", value: 50000, category: "income" }),
  // Off budget accounts are not purchases
  transaction({
    id: "00000008-0000-0000-0000-000000000000",
    date: "2020-01-10",
    value: -9999,
    category: GROCERIES_ID,
    account: OFF_BUDGET_ID
  })
];

describe("piechart page", () => {
  let vuetify;
  let wrapper;

  beforeAll(() => {
    store.state.selectedBudgetID = BUDGET_ID;
    store.state.month_selected = "2020-01";
    store.commit(
      "SET_POUCHDB_DOCS",
      accounts
        .concat(masterCategories)
        .concat(categories)
        .concat(transactions)
        .map(doc => ({ doc }))
    );
  });

  beforeEach(() => {
    vuetify = new Vuetify();
    localVue.use(vuetify);

    wrapper = mount(Piechart, {
      store,
      localVue,
      vuetify,
      stubs: {
        PieChart: true
      }
    });
  });

  it("renders the category and date range filters with everything off by default", () => {
    expect(wrapper.find("#piechart-category-select").exists()).toBeTruthy();
    // The category picker narrows down as you type instead of being a plain dropdown
    expect(wrapper.findComponent({ name: "v-autocomplete" }).exists()).toBeTruthy();
    expect(wrapper.find("#piechart-category-select").element.tagName).toBe("INPUT");
    // Uncategorized purchases can be picked too, income cannot
    expect(wrapper.vm.categoryItems.map(item => item.text)).toEqual([
      "Fuel",
      "Groceries",
      "Rent/Mortgage",
      "Uncategorized"
    ]);
    expect(wrapper.vm.categoryItems.map(item => item.value)).not.toContain("income");

    // Nothing is picked by default so the user chooses what to see
    expect(wrapper.vm.selectedCategories).toEqual([]);
    expect(wrapper.vm.pieChartData).toEqual([]);
    expect(wrapper.find("#piechart-select-categories-msg").exists()).toBeTruthy();
    expect(wrapper.find("#piechart-no-data-msg").exists()).toBeFalsy();
  });

  it("sums purchases per category when every category is picked", async () => {
    wrapper.vm.selectedCategories = wrapper.vm.categoryItems.map(item => item.value);
    await localVue.nextTick();

    expect(wrapper.vm.categoryTotals.map(row => row.label)).toEqual([
      "Rent/Mortgage",
      "Groceries",
      "Fuel",
      "Uncategorized"
    ]);

    const [rent, groceries, fuel, uncategorized] = wrapper.vm.categoryTotals;
    expect(rent.value).toBe(200);
    expect(groceries.value).toBe(130);
    expect(fuel.value).toBe(25);
    expect(uncategorized.value).toBe(12);

    // Percentages are relative to the total spent
    expect(wrapper.vm.totalSpent).toBe(367);
    expect(rent.percent).toBeCloseTo((200 / 367) * 100, 5);
    expect(groceries.percent).toBeCloseTo((130 / 367) * 100, 5);
  });

  it("never includes income in the piechart", async () => {
    wrapper.vm.selectedCategories = wrapper.vm.categoryItems.map(item => item.value);
    await localVue.nextTick();

    expect(wrapper.vm.categoryTotals.map(row => row.label)).not.toContain("Income This Month");
    expect(wrapper.vm.filteredTransactions.map(trn => trn.category)).not.toContain("income");
  });

  it("filters purchases by date range, both ends included", async () => {
    wrapper.vm.selectedCategories = wrapper.vm.categoryItems.map(item => item.value);
    wrapper.vm.dateRange = ["2020-01-01", "2020-03-31"];
    await localVue.nextTick();

    expect(wrapper.vm.categoryTotals.map(row => row.label)).toEqual(["Groceries", "Fuel", "Uncategorized"]);
    expect(wrapper.vm.totalSpent).toBe(167);
  });

  it("matches the spent amount the budget page shows for a month", async () => {
    wrapper.vm.selectedCategories = [GROCERIES_ID];
    wrapper.vm.dateRange = ["2020-01-01", "2020-01-31"];
    await localVue.nextTick();

    //The budget page reads its Spent column from monthlyData
    await store.dispatch("calculateMonthlyData");
    const budgetPageSpent = store.getters.monthlyData["2020-01"].categories[GROCERIES_ID].spent;

    //January is a 100.00 purchase less a 20.00 refund
    expect(budgetPageSpent).toBe(-8000);
    expect(wrapper.vm.categoryTotals[0].value).toBe(80);
    expect(wrapper.vm.rangeCaption).toBe("2 purchases from 2020-01-01 to 2020-01-31");
  });

  it("filters by individual days inside a month", async () => {
    wrapper.vm.selectedCategories = [GROCERIES_ID];
    wrapper.vm.dateRange = ["2020-01-01", "2020-01-20"];
    await localVue.nextTick();

    //The 2020-01-25 refund falls outside the picked days
    expect(wrapper.vm.filteredTransactions.length).toBe(1);
    expect(wrapper.vm.categoryTotals[0].value).toBe(100);
  });

  it("treats a single picked day as that one day only", async () => {
    wrapper.vm.selectedCategories = [GROCERIES_ID];
    wrapper.vm.dateRange = ["2020-01-15"];
    await localVue.nextTick();

    //Regression: one picked date used to skip the date filter and total every month
    expect(wrapper.vm.filteredTransactions.length).toBe(1);
    expect(wrapper.vm.categoryTotals[0].value).toBe(100);
    expect(wrapper.vm.rangeCaption).toBe("1 purchase from 2020-01-15");
  });

  it("filters purchases by selected category", async () => {
    wrapper.vm.selectedCategories = [GROCERIES_ID];
    await localVue.nextTick();

    expect(wrapper.vm.categoryTotals.length).toBe(1);
    expect(wrapper.vm.categoryTotals[0].label).toBe("Groceries");
    expect(wrapper.vm.categoryTotals[0].value).toBe(130);
    expect(wrapper.vm.categoryTotals[0].percent).toBe(100);
  });

  it("groups uncategorized purchases together", async () => {
    wrapper.vm.selectedCategories = ["uncategorized"];
    await localVue.nextTick();

    expect(wrapper.vm.categoryTotals.length).toBe(1);
    expect(wrapper.vm.categoryTotals[0].label).toBe("Uncategorized");
    expect(wrapper.vm.categoryTotals[0].value).toBe(12);
  });

  it("shows the chart data and totals table when categories are picked", async () => {
    wrapper.vm.selectedCategories = wrapper.vm.categoryItems.map(item => item.value);
    await localVue.nextTick();

    expect(wrapper.vm.pieChartData.length).toBe(4);
    expect(wrapper.find("#piechart-no-data-msg").exists()).toBeFalsy();
    expect(wrapper.find("#piechart-select-categories-msg").exists()).toBeFalsy();
    expect(wrapper.text()).toContain("Rent/Mortgage");
    expect(wrapper.text()).toContain("200.00");
  });

  it("shows a message when the picked categories have no purchases in the date range", async () => {
    wrapper.vm.selectedCategories = [FUEL_ID];
    wrapper.vm.dateRange = ["1990-01-01", "1990-02-28"];
    await localVue.nextTick();

    expect(wrapper.vm.pieChartData.length).toBe(0);
    expect(wrapper.find("#piechart-no-data-msg").exists()).toBeTruthy();
    expect(wrapper.find("#piechart-select-categories-msg").exists()).toBeFalsy();
  });

  it("clear button resets the filters", async () => {
    wrapper.vm.dateRange = ["2020-01-01", "2020-01-31"];
    wrapper.vm.selectedCategories = [FUEL_ID];
    await localVue.nextTick();

    await wrapper.find("#piechart-clear-filters-btn").trigger("click");

    expect(wrapper.vm.dateRange).toEqual([]);
    expect(wrapper.vm.selectedCategories).toEqual([]);
    expect(wrapper.vm.categoryTotals.length).toBe(0);
    expect(wrapper.find("#piechart-select-categories-msg").exists()).toBeTruthy();
  });
});
