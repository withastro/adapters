import http from 'http';
import https from 'node:https';

export const onRequest = (context, next) => {
	context.locals.title = 'Middleware';
	context.locals.nodeUnprefixedImportExists = !!http;
	context.locals.nodePrefixedImportExists = !!https;

	return next();
};
