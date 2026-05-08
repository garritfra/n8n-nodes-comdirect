import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
} from 'n8n-workflow';

export const COMDIRECT_BASE_URL = 'https://api.comdirect.de';

export async function comdirectApiRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	resource: string,
	qs: IDataObject = {},
): Promise<unknown> {
	const options: IHttpRequestOptions = {
		method,
		qs,
		url: `${COMDIRECT_BASE_URL}${resource}`,
		json: true,
	};
	return this.helpers.httpRequestWithAuthentication.call(this, 'comdirectApi', options);
}
