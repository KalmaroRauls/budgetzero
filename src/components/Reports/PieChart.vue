<template>
  <div class="ma-2">
    <div class="chart-container">
      <canvas id="pieChart" />
    </div>
  </div>
</template>

<script>
import Chart from 'chart.js/auto'

// Palette used for the pie slices. Loops around if there are more categories than colors.
const CHART_COLORS = [
  '#263238',
  '#8E292F',
  '#8FAAA0',
  '#455A64',
  '#6E479E',
  '#355B79',
  '#437548',
  '#FB8C00',
  '#B0BEC5',
  '#FF5252',
  '#7E57C2',
  '#26A69A',
  '#66BB6A',
  '#42A5F5',
  '#AB47BC',
  '#795548'
]

export default {
  name: 'PieChart',
  props: ['chartData'],
  data() {
    return {
      chart: null
    }
  },
  computed: {},
  watch: {
    chartData: {
      deep: true,
      handler: function() {
        this.renderPieChart()
      }
    }
  },
  mounted() {
    this.renderPieChart()
  },
  methods: {
    renderPieChart: function() {
      //Chart.js cannot update a pie chart in place, so rebuild it
      if (this.chart) {
        this.chart.destroy()
      }

      var labels = this.chartData.map(item => item.label)
      var values = this.chartData.map(item => item.value)

      var ctx = document.getElementById('pieChart').getContext('2d')
      this.chart = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: labels,
          datasets: [
            {
              data: values,
              backgroundColor: labels.map((label, index) => CHART_COLORS[index % CHART_COLORS.length]),
              borderColor: '#263238',
              borderWidth: 2
            }
          ]
        },
        options: {
          plugins: {
            legend: {
              position: 'right'
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  var total = context.dataset.data.reduce(function(sum, value) {
                    return sum + value
                  }, 0)
                  var percent = total > 0 ? Math.round((context.parsed / total) * 1000) / 10 : 0
                  var amount = new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD'
                  }).format(context.parsed)

                  return `${context.label}: ${amount} (${percent}%)`
                }
              }
            }
          }
        }
      })
    }
  }
}
</script>

<style scoped>
.chart-container {
  position: relative;
  margin: auto;
  height: 60vh;
  width: 100%;
}
</style>
