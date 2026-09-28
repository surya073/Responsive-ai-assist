'use strict';
const { PassThrough } = require('stream');

const logStream = new PassThrough();

function logger(message = '') {
	const logStr = `[react-plugin]: ${message}`;
	logStream.push(logStr);
}

module.exports = {
	logger,
	logStream
};
