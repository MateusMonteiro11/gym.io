import { useId } from 'react'

export default function ChartDataTable({ label, columns, rows, emptyMessage, notes = [] }) {
  const notesId = `chart-data-notes-${useId().replace(/[^a-z0-9_-]/gi, '')}`
  const identityColumn = columns[0]
  const primaryColumn = columns.find((column, index) => index > 0 && column.primary) || columns[1]
  const secondaryColumns = columns.filter((column) => column !== identityColumn && column !== primaryColumn)

  function cellContent(cell) {
    return <><span className="history-data-value">{cell.value}</span>{cell.note && <small>{cell.note}</small>}</>
  }

  return <div className="history-data">
    <div className="history-data-frame">
      <div className="history-data-scroll history-data-desktop" role="region" aria-label={label} tabIndex={0}>
        <table className="history-data-table" data-column-count={columns.length} aria-describedby={notes.length ? notesId : undefined}>
          <caption className="history-sr-only">{label}</caption>
          <thead><tr>{columns.map((column) => <th
            key={column.key}
            scope="col"
            className={column.numeric ? 'is-numeric' : undefined}
          >{column.label}</th>)}</tr></thead>
          <tbody>
            {rows.map((row) => <tr key={row.id}>
              {columns.map((column, index) => {
                const cell = row.cells[column.key]
                const Cell = index === 0 ? 'th' : 'td'
                return <Cell
                  key={column.key}
                  scope={index === 0 ? 'row' : undefined}
                  className={[column.numeric && 'is-numeric', column.primary && 'is-primary'].filter(Boolean).join(' ')}
                >
                  {cellContent(cell)}
                </Cell>
              })}
            </tr>)}
            {!rows.length && emptyMessage && <tr><td colSpan={columns.length} className="history-data-empty">{emptyMessage}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="history-data-mobile" role="region" aria-label={label} aria-describedby={notes.length ? notesId : undefined}>
        <ol className="history-data-records" role="list">
          {rows.map((row) => <li key={row.id}>
            <dl className="history-data-record">
              <div className="history-data-record-identity">
                <dt>{identityColumn.label}</dt><dd>{cellContent(row.cells[identityColumn.key])}</dd>
              </div>
              {primaryColumn && <div className="history-data-record-primary">
                <dt>{primaryColumn.label}</dt><dd>{cellContent(row.cells[primaryColumn.key])}</dd>
              </div>}
              {secondaryColumns.map((column) => <div className="history-data-record-secondary" key={column.key}>
                <dt>{column.label}</dt><dd>{cellContent(row.cells[column.key])}</dd>
              </div>)}
            </dl>
          </li>)}
        </ol>
        {!rows.length && emptyMessage && <p className="history-data-empty">{emptyMessage}</p>}
      </div>
    </div>
    {notes.length > 0 && <ul id={notesId} className="history-data-notes" role="list">
      {notes.map((note) => <li key={note.id}>{note.text}</li>)}
    </ul>}
  </div>
}
