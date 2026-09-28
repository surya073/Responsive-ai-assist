'use strict';

const fs = require('fs');
const evalSourceMapMiddleware = require('react-dev-utils/evalSourceMapMiddleware');
const noopServiceWorkerMiddleware = require('react-dev-utils/noopServiceWorkerMiddleware');
const ignoredFiles = require('react-dev-utils/ignoredFiles');
const redirectServedPath = require('react-dev-utils/redirectServedPathMiddleware');

const pathsMod = require('./paths');

const host = process.env.HOST || '0.0.0.0';
const sockHost = process.env.WDS_SOCKET_HOST;
const sockPath = process.env.WDS_SOCKET_PATH; // default: '/sockjs-node'
const sockPort = process.env.WDS_SOCKET_PORT;

module.exports = function server(proxy, allowedHost, userDir, watch) {
	const paths = pathsMod(userDir);
	const disableFirewall = !proxy || process.env.DANGEROUSLY_DISABLE_HOST_CHECK === 'true';
	return {
		allowedHosts: disableFirewall ? 'all' : [allowedHost],
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': '*',
			'Access-Control-Allow-Headers': '*'
		},
		// Enable gzip compression of generated files.
		compress: true,
		static: {
			directory: paths.appPublic,
			publicPath: [paths.publicUrlOrPath],
			watch: watch
				? {
						ignored: ignoredFiles(paths.appSrc)
				  }
				: false
		},
		client: {
			webSocketURL: {
				hostname: sockHost,
				pathname: sockPath,
				port: sockPort
			},
			overlay: {
				errors: true,
				warnings: false
			}
		},
		devMiddleware: {
			publicPath: paths.publicUrlOrPath.slice(0, -1)
		},
		https: false,
		host,
		historyApiFallback: {
			disableDotRule: true,
			index: paths.publicUrlOrPath
		},
		// `proxy` is run between `before` and `after` `webpack-dev-server` hooks
		proxy,
		onBeforeSetupMiddleware(devServer) {
			devServer.app.use(evalSourceMapMiddleware(devServer));
			if (fs.existsSync(paths.proxySetup)) {
				require(paths.proxySetup)(devServer.app);
			}
		},
		onAfterSetupMiddleware(devServer) {
			devServer.app.use(redirectServedPath(paths.publicUrlOrPath));
			devServer.app.use(noopServiceWorkerMiddleware(paths.publicUrlOrPath));
		}
	};
};
