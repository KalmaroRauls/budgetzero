<template>
  <v-row class="px-3 pt-2">
    <v-col>
      <span class="text-h3 pt-4">Settings</span>
      <span class="subtitle pl-2">{{ packageVersion }}</span>
      <v-divider class="pb-4" />

      <h3 class="mx-2 py-2">
        Backup
      </h3>

      <v-btn color="grey darken-2" dark class="mb-2" small @click="$store.dispatch('exportBudgetAsJSON')">
        Backup Entire Database
      </v-btn>

      <span class="pl-2">Export data for backup.</span>
      <br />

      <v-btn color="grey darken-2" dark class="mb-2" small @click="$store.dispatch('exportSelectedBudgetAsJSON')">
        Backup Current Budget
      </v-btn>

      <span class="pl-2">Backup current budget: {{ this.$store.getters.selectedBudgetID }} </span>

      <h3 class="mx-2 pt-2">
        Restore
      </h3>

      <!-- <v-sheet
        
        class="ma-2 mr-4 pa-2"
        color="grey lighten-2"
        elevation="2"
        outlined
        rounded
        shaped
        justify="center"
      >
        <v-alert
          dense
          type="info"
        >
          Before restoring, delete your database or all documents
        </v-alert> -->
      <v-file-input v-model="backupFile" label="Restore Backup File" @change="onFileChange" />
      <v-btn
        color="accent"
        dark
        class="mb-1"
        small
        :disabled="!backupFileParsed"
        @click="$store.dispatch('commitBulkDocsToPouchAndVuex', backupFileParsed)"
      >
        Restore From File
      </v-btn>
      <!-- </v-sheet> -->

      <br />
      <v-btn
        id="refreshDbBtn"
        color="primary"
        outlined
        dark
        class="mb-3 "
        small
        @click="$store.dispatch('loadLocalBudgetRoot')"
      >
        Refresh Database
      </v-btn>

      <v-expansion-panels class="mb-4">
        <v-expansion-panel class="grey lighten-3">
          <v-expansion-panel-header>
            <h3>
              Advanced Sync <span class="subtitle-1 ml-3">{{ sync_state }}</span>
            </h3>
          </v-expansion-panel-header>
          <v-expansion-panel-content>
            <span
              >Sync to remote CouchDB server:
              <v-tooltip bottom>
                <template #activator="{ on }">
                  <v-icon color="grey" v-on="on">
                    mdi-information
                  </v-icon>
                </template>
                <span
                  >Examples: <code>http://localhost:5984/mybudget</code> or
                  <code>http://username:password@192.168.1.10:5984/mybudget</code>
                </span>
              </v-tooltip>
            </span>
            <v-row align="center" class="mt-2">
              <v-col cols="7">
                <v-text-field v-model="remoteSyncURLInput" label="Remote CouchDB URL" required />
              </v-col>
              <v-col cols="5">
                <v-btn color="primary" dark small @click="startRemoteSync()">
                  Set Custom Sync URL
                </v-btn>
                <v-btn color="primary" outlined dark class="ml-2" small @click="clearRemoteSync()">
                  Clear
                </v-btn>
              </v-col>
            </v-row>
          </v-expansion-panel-content>
        </v-expansion-panel>
      </v-expansion-panels>

      <!-- v-if="!isProd" -->
      <v-expansion-panels>
        <v-expansion-panel class="grey lighten-3">
          <v-expansion-panel-header>
            <h3>
              Debugging
            </h3>
          </v-expansion-panel-header>
          <v-expansion-panel-content>
            <tree-view :data="transactions" :options="{ maxDepth: 0 }" />
            <tree-view :data="accounts" :options="{ maxDepth: 0 }" />
            <tree-view :data="monthlyData" :options="{ maxDepth: 0 }" />
            <v-alert type="warning">
              Warning: Do not use these unless you know what you're doing.
            </v-alert>
            <v-btn color="red" dark class="mb-2" small data-cy="delete-local-db" @click="deleteLocalDatabase">
              Erase Local Database
            </v-btn>
            <span class="pl-2"
              >Deletes local PouchDB database. If connected to a remote database it will re-sync all the data.
            </span>

            <br />
            <v-btn color="primary" dark class="mb-2" small @click="$store.dispatch('createLocalPouchDB')">
              Create Local Database
            </v-btn>

            <br />
            <v-btn color="red" dark class="mb-2" small @click="deleteAllDocs">
              Delete All Docs from db
            </v-btn>

            <br />
            <v-btn color="red" dark class="mb-2" small @click="deleteAllDocs">
              Delete All Docs from db
            </v-btn>
            <span class="pl-2"
              >Deletes all docs (transactions, accounts, budget amounts, etc). This will replicate deletion to remote
              databases.</span
            >
            <br />
            <v-btn color="grey darken-2" dark class="mb-2" small @click="$store.dispatch('loadLocalBudgetRoot')">
              Reload Budget
            </v-btn>
            <span class="pl-2">Reload Budget Root (for debugging purposes)</span>
            <br />

            <v-btn id="loadMockDataBtn" color="purple" dark class="mb-2" small @click="loadMockData">
              Load Mock Data
            </v-btn>
            <span class="pl-2">Loads fake data for testing purposes.</span>
            <br />

            <v-btn color="purple" dark class="mb-2" small @click="$store.dispatch('createMockTransactions')">
              createMockTransactions
            </v-btn>
            <span class="pl-2">Loads fake data for testing purposes.</span>
          </v-expansion-panel-content>
        </v-expansion-panel>
      </v-expansion-panels>

    </v-col>

    <v-col cols="12">
      <h3 class="mx-2 py-2">
        Payees
        <v-btn id="mergePayeesBtn" color="accent" dark class="ml-2" small @click="openMergeDialog()">
          Merge Payees
        </v-btn>
      </h3>
      <v-data-table :headers="headers" :items="payees.sort((a, b) => (a.name > b.name ? 1 : -1))" class="elevation-1" />
    </v-col>

    <BaseDialogModalComponent v-model="mergeDialogVisible">
      <template #title>
        Merge Payees
      </template>
      <template #body>
        <p class="mb-2">
          Pick the duplicate payees you want to merge together, then choose which one's name to keep. Every transaction
          will be reassigned to the kept payee and the other payees will be permanently deleted.
        </p>
        <v-autocomplete
          id="mergePayeesSelect"
          v-model="payeesToMerge"
          :items="selectablePayees"
          item-text="name"
          item-value="_id"
          label="Payees to merge"
          multiple
          chips
          small-chips
          clearable
          auto-select-first
          dense
          data-cy="mergePayeesSelect"
        />
        <v-autocomplete
          id="mergeTargetSelect"
          v-model="mergeTarget"
          :items="mergeTargetOptions"
          item-text="name"
          item-value="_id"
          label="Keep this payee"
          :disabled="payeesToMerge.length === 0"
          :hint="payeesToMerge.length === 0 ? 'Select the payees to merge first' : 'The kept payee keeps its name'"
          persistent-hint
          clearable
          auto-select-first
          dense
          data-cy="mergeTargetSelect"
        />
      </template>
      <template #actions>
        <v-spacer />
        <v-btn color="grey" text @click="mergeDialogVisible = false">
          Cancel
        </v-btn>
        <v-btn color="accent" :disabled="!canMerge" @click="confirmMerge()">
          Merge
        </v-btn>
      </template>
    </BaseDialogModalComponent>
  </v-row>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'
import BaseDialogModalComponent from './Modals/BaseDialogModalComponent.vue'

export default {
  name: 'Settings',
  components: { BaseDialogModalComponent },
  data() {
    return {
      remoteSyncURLInput: null,
      backupFile: null,
      backupFileParsed: null,
      newBudgetModal: false,
      tab: null,
      selected_budget: null,
      headers: [
        { text: 'Name', value: 'name' },
        { text: 'id', value: '_id' }
      ],
      mergeDialogVisible: false,
      payeesToMerge: [],
      mergeTarget: null,
      isProd: process.env.NODE_ENV === 'production'
    }
  },
  computed: {
    ...mapGetters([
      'transactions',
      'accounts',
      'monthlyData',
      'payees',
      'selectedBudgetID',
      'remoteSyncURL',
      'sync_state'
    ]),
    packageVersion() {
      return process.env.PACKAGE_VERSION || '0'
    },
    /* Real payees only - the store prepends a placeholder with no _id */
    selectablePayees() {
      return this.payees.filter(payee => payee._id)
    },
    /* The payee to keep must be one of the payees being merged */
    mergeTargetOptions() {
      return this.selectablePayees.filter(payee => this.payeesToMerge.includes(payee._id))
    },
    canMerge() {
      return this.payeesToMerge.length > 1 && this.payeesToMerge.includes(this.mergeTarget)
    }
  },
  watch: {
    // whenever question changes, this function will run
    remoteSyncURL: function(newQuestion, oldQuestion) {
      this.remoteSyncURLInput = newQuestion
    },
    // If the currently kept payee is un-checked, clear the selection
    payeesToMerge(newSelection) {
      if (this.mergeTarget && !newSelection.includes(this.mergeTarget)) {
        this.mergeTarget = null
      }
    }
  },
  mounted() {
    this.remoteSyncURLInput = this.remoteSyncURL
  },
  methods: {
    ...mapActions(['deleteAllDocs', 'eraseAllDocs', 'deleteLocalDatabase', 'loadMockData']),
    startRemoteSync() {
      this.$store.dispatch('startRemoteSyncToCustomURL', this.remoteSyncURLInput)
    },
    clearRemoteSync() {
      this.remoteSyncURLInput = ''
      this.$store.dispatch('clearRemoteSync')
    },
    onFileChange() {
      console.log(this.backupFile)

      const reader = new FileReader()
      this.accountsForImport = []
      this.selectedAccount = {}

      reader.onload = e => {
        const vm = this
        let data = JSON.parse(e.target.result)

        vm.backupFileParsed = data
      }
      reader.readAsText(this.backupFile)
    },
    createBudget(budgetName) {
      console.log('create called', budgetName)
      this.$store.dispatch('createBudget', budgetName)
    },
    openMergeDialog() {
      this.payeesToMerge = []
      this.mergeTarget = null
      this.mergeDialogVisible = true
    },
    async confirmMerge() {
      if (!this.canMerge) {
        return
      }
      // Only prompt when the global confirm dialog is available (it is mounted in App.vue)
      const confirmed =
        typeof this.$root.$confirm !== 'function' ||
        (await this.$root.$confirm(
          'Merge Payees?',
          'Every transaction will be reassigned to the kept payee and the merged-away payees will be permanently deleted.',
          { agreeBtnColor: 'accent', agreeBtnText: 'Merge', cancelBtnColor: 'grey' }
        ))
      if (!confirmed) {
        return
      }
      this.$store.dispatch('mergePayees', {
        sourcePayeeIds: this.payeesToMerge,
        targetPayeeId: this.mergeTarget
      })
      this.mergeDialogVisible = false
      this.payeesToMerge = []
      this.mergeTarget = null
    }
  }
}
</script>

<style></style>
