export default {
  title: 'Data Table',
  widget: '../../dist/data-table.html',
  scenarios: {
    default: {
      mocks: {
        get_rows: {
          kind: 'static',
          structuredContent: {
            columns: [
              { key: 'name', label: 'Name' },
              { key: 'role', label: 'Role' },
              { key: 'signups', label: 'Signups' },
            ],
            rows: [
              { name: 'Ann', role: 'Admin', signups: 34 },
              { name: 'Bob', role: 'Editor', signups: 28 },
              { name: 'Cid', role: 'Viewer', signups: 41 },
            ],
          },
        },
      },
    },
    empty: {
      mocks: {
        get_rows: { kind: 'static', structuredContent: { columns: [{ key: 'name', label: 'Name' }], rows: [] } },
      },
    },
    error: {
      mocks: {
        get_rows: { kind: 'error', message: 'Rows backend unavailable' },
      },
    },
  },
};
