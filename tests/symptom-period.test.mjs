import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSymptomPeriod, symptomPeriodLabel } from '../frontend/src/lib/symptomPeriod.js'

const now = new Date('2026-10-18T15:30:00')

test('a complaint can be entered several weeks later with an inclusive From/To calendar interval', () => {
  const entry = buildSymptomPeriod({
    fromDate:'2026-08-01', untilMode:'date', untilDate:'2026-08-08',
  }, now)
  assert.equal(entry.details.period.from_date,'2026-08-01')
  assert.equal(entry.details.period.to_date,'2026-08-08')
  assert.equal(entry.details.period.precision,'day')
  assert.equal(entry.details.period.ongoing,false)
  assert.equal(new Date(entry.occurred_at).getDate(),1)
  assert.equal(new Date(entry.details.end_at).getDate(),8)
  assert.equal(symptomPeriodLabel({details:entry.details,occurred_at:entry.occurred_at}),
    'Von 01.08.2026 bis 08.08.2026')
})

test('optional start and end times are kept explicitly for historical entries', () => {
  const entry = buildSymptomPeriod({
    fromDate:'2026-09-02',untilMode:'date',untilDate:'2026-09-03',
    useTime:true,fromTime:'22:10',untilTime:'07:45',
  },now)
  assert.equal(entry.details.period.from_time,'22:10')
  assert.equal(entry.details.period.to_time,'07:45')
  assert.equal(entry.details.period.precision,'minute')
  assert.equal(new Date(entry.occurred_at).getHours(),22)
  assert.equal(new Date(entry.details.end_at).getHours(),7)
  assert.equal(symptomPeriodLabel({details:entry.details}), 'Von 02.09.2026 · 22:10 Uhr bis 03.09.2026 · 07:45 Uhr')
})

test('a complaint can still be ongoing after starting in the past', () => {
  const entry=buildSymptomPeriod({
    fromDate:'2026-09-10',untilMode:'ongoing',
  },now)
  assert.equal(entry.details.period.ongoing,true)
  assert.equal(entry.details.period.to_date,null)
  assert.equal(Object.hasOwn(entry.details,'end_at'),false)
  assert.match(symptomPeriodLabel({details:entry.details}),/dauert noch an/)
})

test('reject reversed ranges and future dates', () => {
  assert.throws(()=>buildSymptomPeriod({
    fromDate:'2026-10-05',untilMode:'date',untilDate:'2026-10-04',
  },now),/Enddatum/)
  assert.throws(()=>buildSymptomPeriod({
    fromDate:'2026-10-19',untilMode:'same',
  },now),/Zukunft/)
  assert.throws(()=>buildSymptomPeriod({
    fromDate:'2026-10-18',untilMode:'date',untilDate:'2026-10-21',
  },now),/zukünftiges Enddatum/)
})

test('time entry is optional, but once selected must be complete and ordered', () => {
  assert.throws(()=>buildSymptomPeriod({
    fromDate:'2026-08-01',untilMode:'same',useTime:true,
    fromTime:'13:00',untilTime:'',
  },now),/Uhrzeit fehlt/)
  assert.throws(()=>buildSymptomPeriod({
    fromDate:'2026-08-01',untilMode:'same',useTime:true,
    fromTime:'19:00',untilTime:'18:00',
  },now),/Enddatum/)
  const onlyDay=buildSymptomPeriod({fromDate:'2026-08-01',untilMode:'same'},now)
  assert.equal(onlyDay.details.period.from_time,null)
  assert.equal(onlyDay.details.period.to_time,null)
  assert.equal(symptomPeriodLabel({details:onlyDay.details}), '01.08.2026')
})
