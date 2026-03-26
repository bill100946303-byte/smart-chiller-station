'use strict'
const path = require('path')
const webpack = require('webpack')
const defaultSettings = require('./src/settings.js')

function resolve(dir) {
  return path.join(__dirname, dir)
}

function readCliOption(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const name = defaultSettings.title || '冷站智慧管理平台' // page title

const host =
  readCliOption('--host') ||
  process.env.npm_config_host ||
  process.env.HOST ||
  '127.0.0.1'
const port =
  Number(readCliOption('--port')) ||
  Number(process.env.npm_config_port) ||
  Number(process.env.PORT) ||
  8080 // dev port

module.exports = {

  publicPath: './',
  outputDir: 'dist',
  assetsDir: 'static',
  lintOnSave: process.env.NODE_ENV === 'development',
  productionSourceMap: false,
  devServer: {
    host: host,
    port: port,
    public: `${host}:${port}`,
    sockHost: host,
    sockPort: port,
    open: false,
    overlay: {
      warnings: false,
      errors: true
    },
  },
  configureWebpack: {
    // provide the app's title in webpack's name field, so that
    // it can be accessed in index.html to inject the correct title.
    name: name,
    plugins: [
      // xlsx-style ships a fallback require('./cptable') path that webpack resolves
      // even though the bundled cpexcel payload already defines cptable at runtime.
      new webpack.NormalModuleReplacementPlugin(/^\.\/cptable$/, resource => {
        const context = resource.context || ''
        if (context.includes(`${path.sep}xlsx-style${path.sep}dist`)) {
          resource.request = path.resolve(__dirname, 'src/shims/xlsx-style-cptable.js')
        }
      })
    ],
    resolve: {
      extensions: ['.js', '.vue', '.json'],
      alias: {
        '@': resolve('src'),
        'vender': path.resolve(__dirname, '../src/vender'),//新增加一行
      }
    }
  },
  chainWebpack(config) {
    config.plugins.delete('preload') // TODO: need test
    config.plugins.delete('prefetch') // TODO: need test

    config.module
      .rule('swf')
      .test(/\.swf$/)
      .use('url-loader')
      .loader('url-loader')
      .options({
        limit: 10000
      })
      .end()

    // set svg-sprite-loader
    config.module
      .rule('svg')
      .exclude.add(resolve('src/icons'))
      .end()
    config.module
      .rule('icons')
      .test(/\.svg$/)
      .include.add(resolve('src/icons'))
      .end()
      .use('svg-sprite-loader')
      .loader('svg-sprite-loader')
      .options({
        symbolId: 'icon-[name]'
      })
      .end()

    // set preserveWhitespace
    config.module
      .rule('vue')
      .use('vue-loader')
      .loader('vue-loader')
      .tap(options => {
        options.compilerOptions.preserveWhitespace = true
        return options
      })
      .end()
    // config.module
    //   .rule('vue')
    //   .test('three/examples/js/controls/OrbitControls')
    //   .use('imports-loader?THREE=three')
    //   .end()
    // config.module
    //   .rule('vue')
    //   .test('three/examples/js/controls/OrbitControls')
    //   .use('imports-loader?THREE=three')
    //   .end()

    config
      // https://webpack.js.org/configuration/devtool/#development
      .when(process.env.NODE_ENV === 'development',
        config => config.devtool('cheap-source-map')
      )

    config
      .when(process.env.NODE_ENV !== 'development',
        config => {
          config
            .plugin('ScriptExtHtmlWebpackPlugin')
            .after('html')
            .use('script-ext-html-webpack-plugin', [{
              // `runtime` must same as runtimeChunk name. default is `runtime`
              inline: /runtime\..*\.js$/
            }])
            .end()
          config
            .optimization.splitChunks({
              chunks: 'all',
              cacheGroups: {
                libs: {
                  name: 'chunk-libs',
                  test: /[\\/]node_modules[\\/]/,
                  priority: 10,
                  chunks: 'initial' // only package third parties that are initially dependent
                },
                elementUI: {
                  name: 'chunk-elementUI', // split elementUI into a single package
                  priority: 20, // the weight needs to be larger than libs and app or it will be packaged into libs or app
                  test: /[\\/]node_modules[\\/]_?element-ui(.*)/ // in order to adapt to cnpm
                },
                commons: {
                  name: 'chunk-commons',
                  test: resolve('src/components'), // can customize your rules
                  minChunks: 3, //  minimum common number
                  priority: 5,
                  reuseExistingChunk: true
                }
              }
            })
          config.optimization.runtimeChunk('single')
        }
      )
  }
}
