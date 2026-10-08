import test from 'node:test'
import assert from 'node:assert/strict'
import { createClient, FunctionsHttpError } from '@supabase/supabase-js'
import { invokePushTest } from './invokePushTest.js'
import { PUSH_TEST_RESULTS, pushTestMessage, runPushOperation } from './pushResults.js'
import { bounded } from './pushUtils.js'

const reply = (body, status, type = 'application/json') => new Response(body, { status, headers: { 'Content-Type': type } })
const fallback = (error) => error.message === 'push_test_failed' && !error.cause && Object.keys(error).length === 0

for (const [result, contract] of Object.entries(PUSH_TEST_RESULTS)) {
  test(`actual SDK preserves allowlisted ${result} / HTTP ${contract.status}`, async () => {
    let calls = 0
    const client = createClient('http://localhost:55431', 'synthetic-anon', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async (_url, options) => {
        calls++
        assert.deepEqual(JSON.parse(options.body), { subscription_id: 'own-id' })
        return reply(JSON.stringify({ result }), contract.status)
      } },
    })
    assert.deepEqual(await invokePushTest((name, options) => client.functions.invoke(name, options), 'own-id'), { result })
    assert.equal(calls, 1)
    assert.equal(pushTestMessage(result), contract.message)
    assert.ok(!contract.message.includes('own-id'))
  })
}

test('malformed, extra fields, unknown codes, inconsistent statuses and transport fail closed', async () => {
  const secret = 'endpoint JWT VAPID PRIVATE STACK raw-provider-error'
  const responses = [
    reply(JSON.stringify({ result: secret }), 503),
    reply(JSON.stringify({ result: 'rate_limited', detail: secret }), 429),
    reply(JSON.stringify({ result: 'sent' }), 503),
    reply(JSON.stringify({ result: 'rate_limited' }), 200),
    reply(JSON.stringify({ result: ['sent'] }), 200),
    reply('["rate_limited"]', 429), reply('null', 429), reply('{bad', 429),
    reply(secret, 503, 'text/plain'), reply(' '.repeat(1025), 503),
  ]
  for (const response of responses) {
    const invoke = async () => response.ok ? { data: await response.json(), response }
      : { error: new FunctionsHttpError(response) }
    await assert.rejects(invokePushTest(invoke, 'own-id'), fallback)
  }
  for (const invoke of [async () => { throw new Error(secret) }, async () => ({ error: { name: 'FunctionsFetchError', message: secret } }),
    async () => ({ error: { name: 'FunctionsRelayError', context: secret } })]) {
    await assert.rejects(invokePushTest(invoke, 'own-id'), fallback)
  }
  assert.equal(pushTestMessage(secret), 'Não foi possível concluir o envio de teste.')
  assert.equal(pushTestMessage(['sent']), 'Não foi possível concluir o envio de teste.')
})

test('response stream abort is bounded and exposes no response context', async () => {
  let canceled = false
  const response = new Response(new ReadableStream({ cancel: () => { canceled = true } }),
    { status: 503, headers: { 'Content-Type': 'application/json' } })
  await assert.rejects(bounded((signal) => invokePushTest(async () => ({ error: new FunctionsHttpError(response) }), 'own-id', signal), 10),
    (error) => ['push_timeout', 'push_test_failed'].includes(error.message))
  assert.equal(canceled, true)
})

test('hook operation clears busy on semantic results, errors and timeouts without retaining raw errors', async () => {
  for (const code of Object.keys(PUSH_TEST_RESULTS)) {
    let state = { status: 'subscribed', subscriptionId: 'own-id', busy: false }
    const setState = (update) => { state = update(state) }
    const result = await runPushOperation({ action: async () => ({ result: code }), setState, isCurrent: () => true })
    assert.deepEqual(result, { result: code })
    assert.equal(state.busy, false)
    const invalidated = ['expired', 'subscription_changed', 'subscription_not_found'].includes(code)
    assert.equal(state.subscriptionId, invalidated ? null : 'own-id')
  }
  for (const action of [async () => { throw new Error('raw endpoint/private error') },
    () => bounded(() => new Promise(() => {}), 5)]) {
    let state = { busy: false }
    assert.equal(await runPushOperation({ action, setState: (update) => { state = update(state) }, isCurrent: () => true }), null)
    assert.equal(state.busy, false)
    assert.equal(state.error, 'push_operation_failed')
    assert.ok(!JSON.stringify(state).includes('raw'))
  }
})

test('an operation from a previous account cannot overwrite the new account state', async () => {
  let current = true
  let state = { busy: false }
  await runPushOperation({ action: async () => { current = false; state = { busy: false, subscriptionId: 'new-account' }; return { result: 'expired' } },
    setState: (update) => { state = update(state) }, isCurrent: () => current })
  assert.deepEqual(state, { busy: false, subscriptionId: 'new-account' })
})
