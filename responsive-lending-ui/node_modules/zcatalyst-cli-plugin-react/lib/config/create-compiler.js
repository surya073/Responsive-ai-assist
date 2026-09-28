'use strict';

const formatWebpackMessages = require('react-dev-utils/formatWebpackMessages');
const forkTsCheckerWebpackPlugin = require('react-dev-utils/ForkTsCheckerWebpackPlugin');
const clearConsole = require('react-dev-utils/clearConsole');
const chalk = require('react-dev-utils/chalk');
const log = require('../utils/logger').logger;

const isInteractive = process.stdout.isTTY;

function printInstructions(appName, urls, useYarn) {
	log();
	log(`You can now view ${chalk.bold(appName)} in the browser.`);
	log();

	if (urls.lanUrlForTerminal) {
		log(`  ${chalk.bold('Local:')}            ${urls.localUrlForTerminal}`);
		log(`  ${chalk.bold('On Your Network:')}  ${urls.lanUrlForTerminal}`);
	} else {
		log(`  ${urls.localUrlForTerminal}`);
	}

	log();
	log('Note that the development build is not optimized.');
	log(
		`To create a production build, use ` +
			`${chalk.cyan(`${useYarn ? 'yarn' : 'npm run'} build`)}.`
	);
	log();
}

module.exports = function createCompiler({
	appName,
	config,
	urls,
	useYarn,
	useTypeScript,
	webpack,
	watch
}) {
	// "Compiler" is a low-level interface to webpack.
	// It lets us listen to some events and provide our own custom messages.
	let compiler;
	try {
		compiler = webpack(config);
	} catch (err) {
		log(chalk.red('Failed to compile.'));
		log();
		log(err.message || err);
		log();
		process.exit(1);
	}

	// "invalid" event fires when you have changed a file, and webpack is
	// recompiling a bundle. WebpackDevServer takes care to pause serving the
	// bundle, so if you refresh, it'll wait instead of serving the old one.
	// "invalid" is short for "bundle invalidated", it doesn't imply any errors.
	compiler.hooks.invalid.tap('invalid', () => {
		if (isInteractive) {
			clearConsole();
		}
		log('Compiling...');
	});

	let isFirstCompile = true;
	let tsMessagesPromise;

	if (useTypeScript) {
		forkTsCheckerWebpackPlugin
			.getCompilerHooks(compiler)
			.waiting.tap('awaitingTypeScriptCheck', () => {
				log(chalk.yellow('Files successfully emitted, waiting for typecheck results...'));
			});
	}

	// "done" event fires when webpack has finished recompiling the bundle.
	// Whether or not you have warnings or errors, you will get this event.
	compiler.hooks.done.tap('done', async (stats) => {
		if (isInteractive) {
			clearConsole();
		}

		// We have switched off the default webpack output in WebpackDevServer
		// options so we are going to "massage" the warnings and errors and present
		// them in a readable focused way.
		// We only construct the warnings and errors for speed:
		// https://github.com/facebook/create-react-app/issues/4492#issuecomment-421959548
		const statsData = stats.toJson({
			all: false,
			warnings: true,
			errors: true
		});

		const messages = formatWebpackMessages(statsData);
		const isSuccessful = !messages.errors.length && !messages.warnings.length;
		if (isSuccessful) {
			log(chalk.green('Compiled successfully!'));
		}
		if (isSuccessful && (isInteractive || isFirstCompile)) {
			printInstructions(appName, urls, useYarn);
		}
		if (!watch && isFirstCompile) {
			// this is an async process but we dont need to wait for it to complete
			compiler.watching.close();
		}
		isFirstCompile = false;

		// If errors exist, only show errors.
		if (messages.errors.length) {
			// Only keep the first error. Others are often indicative
			// of the same problem, but confuse the reader with noise.
			if (messages.errors.length > 1) {
				messages.errors.length = 1;
			}
			log(chalk.red('Failed to compile.\n'));
			log(messages.errors.join('\n\n'));
			return;
		}

		// Show warnings if no errors were found.
		if (messages.warnings.length) {
			log(chalk.yellow('Compiled with warnings.\n'));
			log(messages.warnings.join('\n\n'));

			// Teach some ESLint tricks.
			log(
				'\nSearch for the ' +
					chalk.underline(chalk.yellow('keywords')) +
					' to learn more about each warning.'
			);
			log(
				'To ignore, add ' +
					chalk.cyan('// eslint-disable-next-line') +
					' to the line before.\n'
			);
		}
	});

	// You can safely remove this after ejecting.
	// We only use this block for testing of Create React App itself:
	const isSmokeTest = process.argv.some((arg) => arg.indexOf('--smoke-test') > -1);
	if (isSmokeTest) {
		compiler.hooks.failed.tap('smokeTest', async () => {
			await tsMessagesPromise;
			process.exit(1);
		});
		compiler.hooks.done.tap('smokeTest', async (stats) => {
			await tsMessagesPromise;
			if (stats.hasErrors() || stats.hasWarnings()) {
				process.exit(1);
			} else {
				process.exit(0);
			}
		});
	}

	return compiler;
};
