import type { INodeProperties } from 'n8n-workflow';

const show = { resource: ['document'], operation: ['get'] };

export const documentGetDescription: INodeProperties[] = [
	{
		displayName: 'Document ID',
		name: 'documentId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show },
		description: 'The PostBox document UUID',
	},
];
