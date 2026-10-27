<template>
  <v-row class="px-3 pt-2">
    <v-col>
      <span class="text-h3 pt-4">Piechart</span>
      <v-divider class="pb-4" />

      <v-row>
        <v-col cols="4">
          <v-autocomplete
            id="piechart-category-select"
            v-model="selectedCategories"
            :items="categoryItems"
            label="Categories"
            prepend-icon="mdi-tag-multiple"
            class="pt-1"
            multiple
            chips
            small-chips
            clearable
            auto-select-first
          />
        </v-col>

        <v-col cols="3">
          <v-menu
            v-model="menu"
            :close-on-content-click="false"
            :nudge-right="40"
            transition="scale-transition"
            offset-y
            min-width="auto"
          >
            <template #activator="{ on, attrs }">
              <v-text-field
                :value="dateRangeText"
                clearable
                class="pt-1"
                label="Date Range"
                prepend-icon="mdi-calendar"
                readonly
                v-bind="attrs"
                v-on="on"
                @click:clear="dateRange = []"
              />
            </template>
            <v-date-picker v-model="dateRange" range @input="closeMenuWhenRangeComplete" />
          </v-menu>
        </v-col>

        <v-col cols="2">
          <v-btn id="piechart-clear-filters-btn" text color="primary" class="mt-3" @click="clearFilters">
            <v-icon left> mdi-filter-remove </v-icon>
            Clear
          </v-btn>
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="7">
          <div v-if="hasSelectedCategories" class="grey--text subtitle-2 mb-2">{{ rangeCaption }}</div>
          <v-card v-if="pieChartData.length > 0" flat>
            <pie-chart :chart-data="pieChartData" />
          </v-card>
          <v-alert
            v-else-if="!hasSelectedCategories"
            id="piechart-select-categories-msg"
            type="info"
            text
            class="mt-4"
          >
            Pick one or more categories above and budgetzero will arrange your purchases into a piechart.
          </v-alert>
          <v-alert v-else id="piechart-no-data-msg" type="info" text class="mt-4">
            No purchases found for those categories and date range. Try a different date range.
          </v-alert>
        </v-col>

        <v-col cols="5">
          <v-simple-table v-if="categoryTotals.length > 0">
            <template #default>
              <thead>
                <tr>
                  <th class="text-left">Category</th>
                  <th class="text-right">Spent</th>
                  <th class="text-right">% of Total</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in categoryTotals" :key="row.id">
                  <td>{{ row.label }}</td>
                  <td class="text-right">{{ row.value | currency }}</td>
                  <td class="text-right">{{ row.percent.toFixed(1) }}%</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td class="font-weight-bold">Total</td>
                  <td class="text-right font-weight-bold">{{ totalSpent | currency }}</td>
                  <td class="text-right font-weight-bold">100.0%</td>
                </tr>
              </tfoot>
            </template>
          </v-simple-table>
        </v-col>
      </v-row>
    </v-col>
  </v-row>
</template>

<script>
import { mapGetters } from 'vuex'
import PieChart from './Reports/PieChart.vue'

//Transactions without a category are grouped under this key
const UNCATEGORIZED = 'uncategorized'

/**
 * Normalize a category id. Transactions without a category have a null category.
 * Category documents store the full _id, so only keep the last 36 characters.
 */
function categoryID(category) {
  return category ? category.slice(-36) : UNCATEGORIZED
}

export default {
  name: 'Piechart',
  components: {
    PieChart
  },
  data() {
    return {
      menu: false,
      dateRange: [],
      selectedCategories: []
    }
  },
  computed: {
    ...mapGetters(['transactionsOnBudget', 'categories', 'category_map']),
    /**
     * Categories that can be picked as purchases (income is not a purchase)
     */
    categoryItems() {
      return this.categories
        .filter(cat => cat._id !== 'income' && cat._id !== 'incomeNextMonth')
        .map(cat => ({
          text: cat.name,
          value: categoryID(cat._id)
        }))
        .sort((a, b) => (a.text > b.text ? 1 : b.text > a.text ? -1 : 0))
    },
    dateRangeSorted() {
      return [...this.dateRange].sort()
    },
    dateRangeText() {
      return this.dateRangeSorted.join(' - ')
    },
    /**
     * Start/end day of the picked range. A single picked day means "that day only",
     * and no picked days means "the whole budget" (null).
     */
    dateRangeBounds() {
      const range = this.dateRangeSorted

      if (range.length === 0) {
        return null
      }

      return {
        start: range[0].slice(0, 10),
        end: range[range.length - 1].slice(0, 10)
      }
    },
    hasSelectedCategories() {
      return this.selectedCategories.length > 0
    },
    /**
     * Explains which purchases the totals are built from
     */
    rangeCaption() {
      const count = this.filteredTransactions.length
      const bounds = this.dateRangeBounds

      if (!bounds) {
        return `${count} purchase${count === 1 ? '' : 's'} in the whole budget (no date range picked)`
      }

      const range = bounds.start === bounds.end ? bounds.start : `${bounds.start} to ${bounds.end}`

      return `${count} purchase${count === 1 ? '' : 's'} from ${range}`
    },
    /**
     * On-budget purchases for the picked categories, within the picked days
     */
    filteredTransactions() {
      const bounds = this.dateRangeBounds

      return this.transactionsOnBudget.filter(trn => {
        //Nothing is picked by default, so the piechart starts out empty
        if (this.selectedCategories.length === 0) {
          return false
        }

        //Income is not a purchase, so it never belongs in the piechart
        if (trn.category === 'income' || trn.category === 'incomeNextMonth') {
          return false
        }

        const date = trn.date ? trn.date.slice(0, 10) : ''

        //Single picked day = that day only, and both ends of the range are included
        if (bounds && (date < bounds.start || date > bounds.end)) {
          return false
        }

        return this.selectedCategories.includes(categoryID(trn.category))
      })
    },
    /**
     * Array of {id, label, value, percent} -> purchases summed per category
     */
    categoryTotals() {
      const totals = {}

      this.filteredTransactions.forEach(trn => {
        const id = categoryID(trn.category)
        totals[id] = (totals[id] ? totals[id] : 0) + (trn.value ? trn.value : 0)
      })

      const rows = Object.keys(totals)
        .map(id => ({
          id,
          label: this.categoryLabel(id),
          //Purchases are negative amounts, so display them as positive values
          value: Math.abs(totals[id]) / 100,
          percent: 0
        }))
        .filter(row => row.value > 0)

      const grandTotal = rows.reduce((sum, row) => sum + row.value, 0)

      rows.forEach(row => {
        row.percent = grandTotal > 0 ? (row.value / grandTotal) * 100 : 0
      })

      return rows.sort((a, b) => b.value - a.value)
    },
    totalSpent() {
      return this.categoryTotals.reduce((sum, row) => sum + row.value, 0)
    },
    pieChartData() {
      return this.categoryTotals.map(row => ({ label: row.label, value: row.value }))
    }
  },
  watch: {},
  mounted() {},

  methods: {
    categoryLabel(id) {
      if (id === UNCATEGORIZED) {
        return 'Uncategorized'
      }

      return this.category_map[id] ? this.category_map[id] : 'Uncategorized'
    },
    closeMenuWhenRangeComplete() {
      //Keep the calendar open until both ends of the range are picked
      if (this.dateRange.length >= 2) {
        this.menu = false
      }
    },
    clearFilters() {
      this.dateRange = []
      this.selectedCategories = []
    }
  }
}
</script>
