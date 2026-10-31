import { describe, expect, it } from 'vitest'
import {
  signSnapshot,
  verifySnapshot,
  questionnaireVersion,
} from '../../src/lib/snapshot'
import { snapshot } from '../fixtures'
describe('immutable signed questionnaire sessions', () => {
  it('retains the exact question and consent content even if the active source changes', () => {
    const data = structuredClone(snapshot),
      token = signSnapshot(data)
    data.questions[0].text = 'ویرایش'
    expect(verifySnapshot(token).snapshot.questions[0].text).toBe(
      snapshot.questions[0].text,
    )
    expect(verifySnapshot(token).snapshot.consent).toEqual(snapshot.consent)
  })
  it('rejects forgery, malformed data, expiry and future issuance', () => {
    const token = signSnapshot(snapshot, 1000)
    expect(() => verifySnapshot(token.replace(/^./, 'x'), 1000)).toThrow()
    expect(() => verifySnapshot('bad')).toThrow()
    expect(() => verifySnapshot(token, 1000 + 86400000)).toThrow()
    expect(() => verifySnapshot(token, 999)).toThrow()
  })
  it('uses distinct retry identifiers for intentional repeat sessions', () =>
    expect(verifySnapshot(signSnapshot(snapshot)).submissionId).not.toBe(
      verifySnapshot(signSnapshot(snapshot)).submissionId,
    ))
  it('separates mode, question version and scoring definitions in analysis strata', () => {
    const base = questionnaireVersion(snapshot)
    expect(questionnaireVersion({ ...snapshot, mode: 'detailed' })).not.toBe(
      base,
    )
    expect(
      questionnaireVersion({
        ...snapshot,
        questions: snapshot.questions.map((q) => ({ ...q, version: 2 })),
      }),
    ).not.toBe(base)
    expect(
      questionnaireVersion({
        ...snapshot,
        questions: snapshot.questions.map((q) => ({
          ...q,
          reverseScored: !q.reverseScored,
        })),
      }),
    ).not.toBe(base)
    expect(questionnaireVersion({ ...snapshot, applications: [] })).toBe(base)
  })
})
