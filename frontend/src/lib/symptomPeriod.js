// Dates entered in the health form are local calendar dates, not UTC dates.
// Keep the exact selected dates and (if requested) times for later reporting.
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
const DAY = /^\d{4}-\d{2}-\d{2}$/

export function localCalendarDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

function readDate(day, time) {
  if (!DAY.test(day) || !HHMM.test(time)) throw new Error('Datum oder Uhrzeit fehlt.')
  const parsed = new Date(`${day}T${time}:00`)
  if (Number.isNaN(parsed.getTime()) || localCalendarDay(parsed) !== day ||
      parsed.getHours() !== Number(time.slice(0,2)) ||
      parsed.getMinutes() !== Number(time.slice(3,5))) {
    throw new Error('Bitte ein gültiges Datum und eine gültige Uhrzeit auswählen.')
  }
  return parsed
}

export function buildSymptomPeriod({
  fromDate, untilMode = 'same', untilDate = '',
  useTime = false, fromTime = '', untilTime = '',
}, now = new Date()) {
  if (!['same','date','ongoing'].includes(untilMode)) throw new Error('Ungültiger Beschwerdezeitraum.')
  const endDate = untilMode === 'same' ? fromDate : untilMode === 'date' ? untilDate : null
  const start = readDate(fromDate, useTime ? fromTime : '00:00')
  const end = endDate ? readDate(endDate, useTime ? untilTime : '23:59') : null

  // Recording later is allowed; future complaints and reversed ranges are not.
  if (start.getTime() > now.getTime()) {
    throw new Error('Der Beginn darf nicht in der Zukunft liegen.')
  }
  if (end && end.getTime() < start.getTime()) {
    throw new Error('Das Enddatum muss gleich oder nach dem Beginn liegen.')
  }
  if (end && endDate > localCalendarDay(now)) {
    throw new Error('Ein zukünftiges Enddatum ist für Beschwerden nicht möglich.')
  }

  const period = {
    from_date: fromDate,
    to_date: endDate,
    from_time: useTime ? fromTime : null,
    to_time: useTime && end ? untilTime : null,
    precision: useTime ? 'minute' : 'day',
    ongoing: untilMode === 'ongoing',
  }
  return {
    occurred_at: start.toISOString(),
    details: { period, ...(end ? { end_at: end.toISOString() } : {}) },
  }
}

export function symptomPeriodLabel(row) {
  const period = row?.details?.period
  if (!period || !DAY.test(period.from_date)) {
    return row?.occurred_at ? new Date(row.occurred_at).toLocaleString('de-CH',{
      dateStyle:'short',timeStyle:'short',
    }) : ''
  }
  function formatDay(day) {
    const [y,m,d] = day.split('-')
    return `${d}.${m}.${y}`
  }
  const clock = period.precision === 'minute' && period.from_time ? ` · ${period.from_time} Uhr` : ''
  const start = `${formatDay(period.from_date)}${clock}`
  if (period.ongoing) return `Seit ${start} · dauert noch an`
  if (period.to_date === period.from_date) {
    if (period.precision === 'minute' && period.to_time) {
      return `${formatDay(period.from_date)}, ${period.from_time}–${period.to_time} Uhr`
    }
    return formatDay(period.from_date)
  }
  const finish = period.to_date ? formatDay(period.to_date) : ''
  const endClock = period.precision === 'minute' && period.to_time ? ` · ${period.to_time} Uhr` : ''
  return `Von ${start} bis ${finish}${endClock}`
}
