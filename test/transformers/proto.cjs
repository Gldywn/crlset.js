const fs = require('fs');

module.exports = {
  process(_sourceText, sourcePath) {
    const fileContent = fs.readFileSync(sourcePath, 'utf8');
    return {
      code: `module.exports = ${JSON.stringify(fileContent)};`,
    };
  },
};
