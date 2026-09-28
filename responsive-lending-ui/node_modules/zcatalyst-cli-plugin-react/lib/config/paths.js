'use strict';

const path = require('path');
const fs = require('fs');
const getPublicUrlOrPath = require('react-dev-utils/getPublicUrlOrPath');

const resolveApp = (userDir) => (relativePath) =>
	path.resolve(fs.realpathSync(userDir), relativePath);

const buildPath = process.env.BUILD_PATH || 'build';

const moduleFileExtensions = [
	'web.mjs',
	'mjs',
	'web.js',
	'js',
	'web.ts',
	'ts',
	'web.tsx',
	'tsx',
	'json',
	'web.jsx',
	'jsx'
];

// Resolve file paths in the same order as webpack
const resolveModule = (resolveFn, filePath) => {
	const extension = moduleFileExtensions.find((extension) =>
		fs.existsSync(resolveFn(`${filePath}.${extension}`))
	);

	if (extension) {
		return resolveFn(`${filePath}.${extension}`);
	}

	return resolveFn(`${filePath}.js`);
};

module.exports = (userDir) => {
	userDir = userDir || process.env.X_CATALYST_WEBAPP_PATH;
	const packageJSONPth = resolveApp(userDir)('package.json');
	const packageJSONStr = fs.readFileSync(packageJSONPth);
	const packageJSON = JSON.parse(packageJSONStr);
	return {
		dotenv: resolveApp(userDir)('.env'),
		appPath: resolveApp(userDir)('.'),
		appBuild: resolveApp(userDir)(buildPath),
		appPublic: resolveApp(userDir)('public'),
		appHtml: resolveApp(userDir)('public/index.html'),
		appIndexJs: resolveModule(resolveApp(userDir), 'src/index'),
		appPackageJson: resolveApp(userDir)('package.json'),
		appSrc: resolveApp(userDir)('src'),
		appTsConfig: resolveApp(userDir)('tsconfig.json'),
		appJsConfig: resolveApp(userDir)('jsconfig.json'),
		yarnLockFile: resolveApp(userDir)('yarn.lock'),
		testsSetup: resolveModule(resolveApp(userDir), 'src/setupTests'),
		proxySetup: resolveApp(userDir)('src/setupProxy.js'),
		appNodeModules: resolveApp(userDir)('node_modules'),
		swSrc: resolveModule(resolveApp(userDir), 'src/service-worker'),
		publicUrlOrPath: getPublicUrlOrPath(
			process.env.NODE_ENV === 'development',
			packageJSON.homepage || '/app/',
			process.env.PUBLIC_URL
		),
		moduleFileExtensions
	};
};
