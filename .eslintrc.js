module.exports = {
  "parser": "babel-eslint",
  "parserOptions": {
    "sourceType": "module",
    "allowImportExportEverywhere": true
  },
  "extends": ["airbnb-base"],
  "env": {
    "node": true
  },
  "rules": {
    "arrow-parens": ["off"],
    "consistent-return": "off",
    "import/no-unresolved": "off",
    "import/no-extraneous-dependencies": "off",
    "import/named": "off",
    "no-await-in-loop": "off",
    "no-console": "off",
    "no-multi-assign": "off",
    "promise/param-names": "error",
    "promise/always-return": "error",
    "promise/catch-or-return": "error",
    "promise/no-native": "off",
    "no-param-reassign": "off",
    "no-restricted-syntax": "off",
    "no-constant-condition": "off",
    "no-confusing-arrow": "off",
    "no-use-before-define": "off",
    "import/extensions": "off",
    "no-continue": "off",
    "class-methods-use-this": "off",
    "import/prefer-default-export": "off",
    "no-underscore-dangle": "off",
    "no-unused-expressions": "off",
    "import/no-duplicates": "off",
    "max-len": [
      "error",
      {
        "code": 100,
        "ignoreComments": true,
        "ignoreStrings": true,
        "ignoreTemplateLiterals": true
      }
    ]
  },
  "plugins": ["promise"]
};