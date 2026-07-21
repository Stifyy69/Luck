const Module = require('module');
const originalExpress = require('express');
const { installCityProgress } = require('./install.cjs');
const { installPlatformSystems } = require('../platform/install.cjs');

const originalLoad = Module._load;

function patchedExpress(...args) {
  const app = originalExpress(...args);
  installCityProgress(app, originalExpress);
  installPlatformSystems(app, originalExpress);
  return app;
}

Object.assign(patchedExpress, originalExpress);
Object.setPrototypeOf(patchedExpress, originalExpress);

Module._load = function cityProgressModuleLoader(request, parent, isMain) {
  if (request === 'express') return patchedExpress;
  return originalLoad.call(this, request, parent, isMain);
};
