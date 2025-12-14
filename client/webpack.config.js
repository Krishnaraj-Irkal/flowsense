const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const Dotenv = require('dotenv-webpack');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: './src/index.tsx',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isProduction ? '[name].[contenthash].js' : '[name].js',
      chunkFilename: isProduction ? '[name].[contenthash].chunk.js' : '[name].chunk.js',
      clean: true,
      publicPath: '/'
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js', '.jsx']
    },
    optimization: {
      moduleIds: 'deterministic',
      runtimeChunk: 'single',
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          // Vendor libraries (node_modules)
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: 10,
            reuseExistingChunk: true
          },
          // Chart libraries (large dependencies)
          charts: {
            test: /[\\/]node_modules[\\/](lightweight-charts|recharts)[\\/]/,
            name: 'charts',
            priority: 20,
            reuseExistingChunk: true
          },
          // React libraries
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom|react-router-dom)[\\/]/,
            name: 'react',
            priority: 15,
            reuseExistingChunk: true
          },
          // Socket.io
          socketio: {
            test: /[\\/]node_modules[\\/](socket\.io-client)[\\/]/,
            name: 'socketio',
            priority: 15,
            reuseExistingChunk: true
          },
          // Common shared code
          common: {
            minChunks: 2,
            priority: 5,
            reuseExistingChunk: true,
            enforce: true
          }
        }
      }
    },
    performance: {
      hints: isProduction ? 'warning' : false,
      maxEntrypointSize: 512000, // 500 KB
      maxAssetSize: 512000 // 500 KB
    },
    module: {
      rules: [
        {
          test: /\.(ts|tsx|js|jsx)$/,
          exclude: /node_modules/,
          use: 'babel-loader'
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader']
        }
      ]
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './public/index.html',
        favicon: './public/favicon.ico'
      }),
      new Dotenv({
        path: './.env',
        safe: false,
        systemvars: true
      })
    ],
    devServer: {
      static: {
        directory: path.join(__dirname, 'public')
      },
      historyApiFallback: true,
      port: 3000,
      hot: true,
      open: true
    },
    devtool: isProduction ? 'source-map' : 'eval-source-map'
  };
};
