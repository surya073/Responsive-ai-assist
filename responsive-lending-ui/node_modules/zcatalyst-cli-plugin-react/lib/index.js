'use strict';

const path = require('path');

function addNodePath(sourceDir) {
	const modDir = path.join(sourceDir, 'node_modules');
	process.env.NODE_PATH = process.env.NODE_PATH
		? [process.env.NODE_PATH, modDir].join(path.delimiter)
		: modDir;
}

async function validate(command, sourceDir, runtime) {
	addNodePath(sourceDir);
	const validateMod = require('./validate');
	return validateMod(command, sourceDir, runtime.get('cli.package.version', undefined));
}

async function build(sourceDir, runtime) {
	addNodePath(sourceDir);
	const buildMod = require('./build');
	const packageJsonFile = runtime.get('context.client.package_json');
	return buildMod(sourceDir, packageJsonFile);
}

async function start(targetDetails, masterPort) {
	addNodePath(targetDetails.target.source);
	const openBrowser = require('react-dev-utils/openBrowser');
	const startMod = require('./start');
	const { eventListener, urls } = await startMod(
		targetDetails.target.source,
		targetDetails.httpPort,
		masterPort,
		targetDetails.target.opts.watch
	);
	eventListener.once(
		'start',
		() =>
			targetDetails.target.opts.open &&
			urls.localUrlForBrowser &&
			openBrowser(urls.localUrlForBrowser)
	);
	return eventListener;
}

async function logs() {
	return require('./utils/logger').logStream;
}

module.exports = {
	start,
	validate,
	build,
	logs
};
