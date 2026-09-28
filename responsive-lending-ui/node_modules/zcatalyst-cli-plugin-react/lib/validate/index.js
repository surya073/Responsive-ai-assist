'use strict';

const checkRequiredFiles = require('react-dev-utils/checkRequiredFiles');
const semver = require('semver');
const packageJson = require('../../package.json');
const log = require('../utils/logger').logger;
const ansi = require('ansi-colors');

module.exports = async (command, userDir, cliVersion) => {
	const paths = require('../config/paths')(userDir);
	const { checkBrowsers } = require('react-dev-utils/browsersHelper');
	await checkBrowsers(paths.appPath, process.stdout.isTTY);
	let react;
	try {
		react = require(require.resolve('react', { paths: [paths.appPath] }));
	} catch (e) {
		throw new Error('react module missing in ' + paths.appPath);
	}
	// Warn and crash if required files are missing
	if (!checkRequiredFiles([paths.appHtml, paths.appIndexJs])) {
		throw new Error('Required files are not present.');
	}
	if (command === 'serve' && process.env.HOST) {
		log(`This plugin does not support host binding. Please remove "process.env.HOST".`);
		throw new Error('process.env.HOST variable not supported');
	}
	if (command === 'serve' && semver.lt(react.version, '16.10.0')) {
		log(`Fast Refresh requires React 16.10 or higher. You are using React ${react.version}.`);
		throw new Error('React version incompatible!');
	}

	if (cliVersion && !semver.satisfies(cliVersion, packageJson.compatibility['zcatalyst-cli'])) {
		log(ansi.bold.yellow('Warning: React Plugin may not work properly!'));
		log(
			ansi.yellow(
				`This version of ZCATALYST-CLI(${cliVersion}) is not compatible with the version of ZCATALYST-CLI-PLUGIN-REACT being used.`
			)
		);
		log(
			ansi.yellow('Compatible version(s): ZCATALYST-CLI: ') +
				ansi.green(packageJson.compatibility['zcatalyst-cli'])
		);
	}
	return true;
};
