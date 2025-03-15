const path = require('path')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')

module.exports = (_, argv) => {
  const is_production = argv.mode == 'production'

  const plugins = [
    new MiniCssExtractPlugin({
      filename: '[name].css'
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'src/manifest.json', to: 'manifest.json' },
        { from: 'src/icons', to: 'icons' },
        { from: 'src/views/popup/index.html', to: 'popup.html' },
        { from: 'src/views/popup/index.css', to: 'index.css' }
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
      'get-parsed-html-content-script':
        './src/content-scripts/get-parsed-html-content-script.ts',
      background: './src/background/main.ts',
      popup: './src/views/popup/App.tsx'
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js'
    },
    module: {
      rules: [
        {
          test: /\.(ts|tsx)$/,
          use: 'ts-loader',
          exclude: /node_modules/
        },
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, 'css-loader']
        },
        {
          test: /\.scss$/,
          use: [
            MiniCssExtractPlugin.loader,
            {
              loader: 'css-loader',
              options: {
                modules: {
                  localIdentName: '[name]__[local]__[hash:base64:5]'
                },
                importLoaders: 1
              }
            },
            'sass-loader'
          ]
        }
      ]
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      plugins: [new TsconfigPathsPlugin()]
    },
    plugins
  }
}
