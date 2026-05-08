import type { INodeProperties } from 'n8n-workflow';

const show = { resource: ['depot'], operation: ['getTransactions'] };

export const depotTransactionsDescription: INodeProperties[] = [
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
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		displayOptions: { show },
		default: {},
		options: [
			{
				displayName: 'WKN',
				name: 'wkn',
				type: 'string',
				default: '',
				description: 'Wertpapierkennnummer of the instrument',
				routing: { request: { qs: { wkn: '={{$value}}' } } },
			},
			{
				displayName: 'ISIN',
				name: 'isin',
				type: 'string',
				default: '',
				description: 'International Securities Identification Number of the instrument',
				routing: { request: { qs: { isin: '={{$value}}' } } },
			},
			{
				displayName: 'Min Booking Date',
				name: 'minBookingDate',
				type: 'dateTime',
				default: '',
				description: 'Earliest booking date (inclusive). Date is sent as YYYY-MM-DD.',
				routing: {
					request: {
						qs: {
							'min-bookingDate':
								'={{ $value ? new Date($value).toISOString().slice(0, 10) : undefined }}',
						},
					},
				},
			},
			{
				displayName: 'Max Booking Date',
				name: 'maxBookingDate',
				type: 'dateTime',
				default: '',
				description: 'Latest booking date (inclusive). Date is sent as YYYY-MM-DD.',
				routing: {
					request: {
						qs: {
							'max-bookingDate':
								'={{ $value ? new Date($value).toISOString().slice(0, 10) : undefined }}',
						},
					},
				},
			},
		],
	},
];
