// Iron Screens — Metro config
// O Metro (watcher de arquivos do Expo/RN) tentava observar pastas de build
// nativo (.cxx, .gradle, build/) dentro de node_modules e do android/. Essas
// pastas são geradas e apagadas o tempo todo pelo CMake/Gradle durante um
// build, então o watcher quebrava com ENOENT sempre que uma delas sumia no
// meio de uma varredura. Bloqueando essas pastas o Metro nem tenta observá-las.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  /android[\\/]\.cxx[\\/].*/,
  /android[\\/]\.gradle[\\/].*/,
  /android[\\/]app[\\/]build[\\/].*/,
  /android[\\/].*[\\/]\.cxx[\\/].*/,
  /android[\\/].*[\\/]build[\\/].*/,
];

module.exports = config;
