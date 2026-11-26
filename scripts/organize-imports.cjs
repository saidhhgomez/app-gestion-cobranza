const ts = require('typescript');
const fs = require('node:fs');
const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
const host = {
  getCompilationSettings: () => parsed.options,
  getScriptFileNames: () => parsed.fileNames,
  getScriptVersion: () => '0',
  getScriptSnapshot: (name) => {
    const text = ts.sys.readFile(name);
    return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
  },
  getCurrentDirectory: ts.sys.getCurrentDirectory,
  getDefaultLibFileName: ts.getDefaultLibFilePath,
  fileExists: ts.sys.fileExists,
  readFile: ts.sys.readFile,
  readDirectory: ts.sys.readDirectory,
  directoryExists: ts.sys.directoryExists,
  getDirectories: ts.sys.getDirectories,
};
const service = ts.createLanguageService(host);
for (const name of parsed.fileNames.filter((name) => /\.(ts|tsx)$/.test(name))) {
  const changes = service.organizeImports({ type: 'file', fileName: name }, {}, {});
  for (const change of changes) {
    let text = fs.readFileSync(change.fileName, 'utf8');
    for (const edit of [...change.textChanges].sort((a, b) => b.span.start - a.span.start)) {
      text =
        text.slice(0, edit.span.start) +
        edit.newText +
        text.slice(edit.span.start + edit.span.length);
    }
    fs.writeFileSync(change.fileName, text);
  }
}
service.dispose();
