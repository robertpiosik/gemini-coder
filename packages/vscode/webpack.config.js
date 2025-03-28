const path = require('path')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')

/**
 * Creates a webpack configuration for React webviews
 * @param {string} name - Name of the entry (chat or api)
 * @param {string} entry_path - Path to the entry file
 * @returns {import('webpack').Configuration}
 */
function create_webview_config(name, entry_path) {
  return {
    name,
    mode: 'production',
    target: 'web',
    entry: {
      [name]: entry_path
    },
    output: {
      path: path.resolve(__dirname, 'out'),
      filename: '[name].js',
      devtoolModuleFilenameTemplate: '../[resource-path]'
    },
    performance: {
      hints: false
    },
    devtool: 'source-map',
    resolve: {
      extensions: ['.ts', '.tsx', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@shared': path.resolve(__dirname, '../shared/src'),
        '@ui': path.resolve(__dirname, '../ui/src')
      }
    },
    module: {
      rules: [
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
        },
        {
          test: /\.(ts|tsx)$/,
          exclude: /node_modules/,
          use: [
            {
              loader: 'babel-loader',
              options: {
                presets: [
                  '@babel/preset-env',
                  [
                    '@babel/preset-react',
                    {
                      runtime: 'automatic'
                    }
                  ],
                  '@babel/preset-typescript'
                ]
              }
            }
          ]
        }
      ]
    },
    plugins: [
      new MiniCssExtractPlugin({
        filename: '[name].css'
      })
    ],
    stats: 'errors-only'
  }
}

/**
 * @type {import('webpack').Configuration[]}
 */
const config = [
  {
    name: 'extension',
    mode: 'production',
    target: 'node',
    entry: {
      extension: './src/extension.ts',
      'websocket-server-process': './src/services/websocket-server-process.ts'
    },
    output: {
      path: path.resolve(__dirname, 'out'),
      filename: '[name].js',
      libraryTarget: 'commonjs2',
      devtoolModuleFilenameTemplate: '../[resource-path]'
    },
    devtool: 'source-map',
    externals: {
      vscode: 'commonjs vscode'
    },
    resolve: {
      extensions: ['.ts', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@shared': path.resolve(__dirname, '../shared/src')
      }
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: [
            {
              loader: 'babel-loader',
              options: {
                presets: ['@babel/preset-env', '@babel/preset-typescript']
              }
            }
          ]
        }
      ]
    },
    plugins: [
      new CleanWebpackPlugin({
        cleanOnceBeforeBuildPatterns: ['../*.vsix'],
        dangerouslyAllowCleanPatternsOutsideProject: true,
        dry: false
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: '../../README.md',
            to: '../README.md'
          }
        ]
      })
    ],
    stats: 'errors-only'
  },
  create_webview_config('chat', './src/chat-view/app.tsx'),
  create_webview_config('api', './src/api-view/app.tsx')
]

module.exports = config
