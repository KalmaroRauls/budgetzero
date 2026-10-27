const fs = require('fs')
const packageJson = fs.readFileSync('./package.json')
const version = JSON.parse(packageJson).version || 0
const webpack = require('webpack')

module.exports = {
  //Served from https://<user>.github.io/budgetzero/ in production, `/` during `npm run serve`
  publicPath: process.env.NODE_ENV === 'production' ? '/budgetzero/' : '/',
  pluginOptions: {
    electronBuilder: {
      builderOptions: {
        publish: ['github']
      },
      //Necessary for electron to render properly
      chainWebpackRendererProcess(config) {
        config.plugin('define').tap(args => {
          delete args[0]['process.env'].BASE_URL
          return args
        })
      }
    }
  },
  transpileDependencies: ['vuetify'],

  configureWebpack: {
    devtool: 'source-map',
    plugins: [
      new webpack.DefinePlugin({
        'process.env': {
          PACKAGE_VERSION: '"' + version + '"'
        }
      })
    ]
  },

  runtimeCompiler: true,
  lintOnSave: false
}
