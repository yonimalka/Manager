module.exports = {
  presets: ['babel-preset-expo'],
  plugins: [
    ["module:react-native-dotenv", {
      "moduleName": "@env",
      "path": ".env"
    }],
    'react-native-reanimated/plugin',  // MUST be last
  ],
};