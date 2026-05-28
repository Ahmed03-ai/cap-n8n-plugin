module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./tsconfig.json'],
    sourceType: 'module',
    extraFileExtensions: ['.json'],
  },
  plugins: ['eslint-plugin-n8n-nodes-base'],
  extends: ['plugin:eslint-plugin-n8n-nodes-base/nodes'],
  rules: {
    'eslint-plugin-n8n-nodes-base/node-dirname-correct': 'off',
    'eslint-plugin-n8n-nodes-base/node-class-description-credentials-name-unsuffixed': 'off',
  },
};
