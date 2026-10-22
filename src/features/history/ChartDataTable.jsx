import { useEffect, useId, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { HISTORY_LIMITS } from './historyLimits.js'

export default function ChartDataTable({ label, columns, rows, emptyMessage, notes = [] }) {
  const notesId = `chart-data-notes-${useId().replace(/[^a-z0-9_-]/gi, '')}`
  const [page, setPage] = useState(0)
  const identity = JSON.stringify([label, rows.length, rows[0]?.id, rows.at(-1)?.id])
  useEffect(() => setPage(0), [identity])
  const pages = Math.max(1, Math.ceil(rows.length / HISTORY_LIMITS.tablePageSize))
  const currentPage = Math.min(page, pages - 1)
  const start = currentPage * HISTORY_LIMITS.tablePageSize
  const visibleRows = rows.slice(start, start + HISTORY_LIMITS.tablePageSize)
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
            {visibleRows.map((row) => <tr key={row.id}>
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
          {visibleRows.map((row) => <li key={row.id}>
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
    {pages > 1 && <nav className="history-data-pagination" aria-label={`${label}: páginas`}>
      <span role="status">{start + 1}–{Math.min(start + HISTORY_LIMITS.tablePageSize, rows.length)} de {rows.length}</span>
      <div>
        <button type="button" className="history-button" aria-label="Página anterior" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={18} aria-hidden="true" /></button>
        <button type="button" className="history-button" aria-label="Próxima página" disabled={currentPage === pages - 1} onClick={() => setPage(currentPage + 1)}><ChevronRight size={18} aria-hidden="true" /></button>
      </div>
    </nav>}
    {notes.length > 0 && <ul id={notesId} className="history-data-notes" role="list">
      {notes.map((note) => <li key={note.id}>{note.text}</li>)}
    </ul>}
  </div>
}
