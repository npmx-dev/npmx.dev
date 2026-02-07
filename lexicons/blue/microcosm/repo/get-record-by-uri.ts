import {
  document,
  object,
  params,
  query,
  required,
  string,
  unknown,
} from '@atcute/lexicon-doc/builder'

export default document({
  id: 'blue.microcosm.repo.getRecordByUri',
  defs: {
    main: query({
      description:
        'Slingshot: ergonomic complement to com.atproto.repo.getRecord which accepts an at-uri instead of individual repo/collection/rkey params',
      parameters: params({
        properties: {
          at_uri: required(
            string({
              format: 'at-uri',
              description: 'the at-uri of the record (identifier can be a DID or handle)',
            }),
          ),
          cid: string({
            format: 'cid',
            description:
              'optional CID of the version of the record. if not specified, return the most recent version. if specified and a newer version exists, returns 404.',
          }),
        },
      }),
      output: {
        encoding: 'application/json',
        schema: object({
          properties: {
            uri: required(string({ format: 'at-uri', description: 'at-uri for this record' })),
            cid: string({ format: 'cid', description: 'CID for this exact version of the record' }),
            value: required(unknown({ description: 'the record itself' })),
          },
        }),
      },
    }),
  },
})
