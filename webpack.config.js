const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
      {
        test: /\.glsl$/i,
        use: [
          'raw-loader', 'glsl-module-loader'],
      },
      {
        test: /\.wgsl$/,
        use: 'webpack-wgsl-loader',
      },
      {
        test: /\.html$/i,
        loader: 'html-loader',  // Allows importing HTML files as modules (for partials)
      },
      {
        test: /\.(png|jpe?g|gif)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'images/[name][ext]',
        },
      },
      {
        test: /\.(woff2?)$/, // Load WOFF fonts
        type: 'asset/resource',
        generator: {
          filename: 'fonts/[name][ext]',
        },
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',  // This is your source HTML file
      filename: 'index.html',        // This will be the output HTML file
    }),
  ],
};