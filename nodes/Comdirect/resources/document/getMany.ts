import type { INodeProperties } from 'n8n-workflow';

const show = { resource: ['document'], operation: ['getMany'] };

export const documentGetManyDescription: INodeProperties[] = [
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		displayOptions: { show },
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		routing: {
			send: { paginate: '={{ $value }}' },
			operations: {
				pagination: {
					type: 'offset',
					properties: {
						limitParameter: 'paging-count',
						offsetParameter: 'paging-first',
						type: 'query',
						pageSize: 1000,
					},
				},
			},
		},
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 1000 },
		displayOptions: { show: { ...show, returnAll: [false] } },
		default: 50,
		description: 'Max number of results to return',
		routing: {
			send: { type: 'query', property: 'paging-count' },
			output: { maxResults: '={{$value}}' },
		},
	},
];
