const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const Dotenv = require('dotenv-webpack');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: './src/index.tsx',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'bundle.[contenthash].js',
      clean: true,
      publicPath: '/'
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js', '.jsx']
    },
    module: {
      rules: [
        {
          test: /\.(ts|tsx|js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                '@babel/preset-env',
                '@babel/preset-react',
                '@babel/preset-typescript'
              ]
            }
          }
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
