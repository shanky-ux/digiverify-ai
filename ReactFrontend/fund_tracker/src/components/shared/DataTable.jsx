import { DataTable as PrimeDataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';

export default function DataTable({ columns, rows, emptyMessage = 'No data available.' }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <PrimeDataTable
        value={rows}
        emptyMessage={emptyMessage}
        stripedRows
        style={{ fontSize: 14 }}
        tableStyle={{ minWidth: '100%' }}
      >
        {columns.map((col) => (
          <Column
            key={col.key}
            field={col.key}
            header={col.label}
            body={col.render ? (row) => col.render(row[col.key], row) : undefined}
            style={{ padding: '10px 12px' }}
          />
        ))}
      </PrimeDataTable>
    </div>
  );
}

// Also export raw table for components that need simple HTML table rendering
export function SimpleTable({ columns, rows, emptyMessage = 'No data available.' }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ background: 'linear-gradient(90deg, #e8f4ff, #f0f6ff)', color: '#1e3a5f' }}>
            {columns.map((col) => (
              <th key={col.key} style={{ padding: '11px 14px', textAlign: 'left', borderBottom: '2px solid #3b82f6', whiteSpace: 'nowrap', fontWeight: 700, fontSize: 13 }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                {emptyMessage}
              </td>
            </tr>
          ) : rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f8faff', borderBottom: '1px solid #e8f0fe' }}>
              {columns.map((col) => (
                <td key={col.key} style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                  {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
