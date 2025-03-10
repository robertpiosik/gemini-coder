const path = require('path')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin')

module.exports = (_, argv) => {
  const is_production = argv.mode == 'production'

  const plugins = [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'src/manifest.json', to: 'manifest.json' },
        { from: 'src/icons', to: 'icons' }
      ]
    })
  ]

  if (is_production) {
    plugins.push(new CleanWebpackPlugin())
  }

  return {
    entry: {
      'send-prompt-content-script':
        './src/content-scripts/send-prompt-content-script.ts',
      background: './src/background/main.ts'
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js'
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/
        }
      ]
    },
    resolve: {
      extensions: ['.ts'],
      plugins: [new TsconfigPathsPlugin()]
    },
    plugins
  }
}
