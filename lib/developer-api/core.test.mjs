import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createApiKeyMaterial,
  hashApiKey,
  isUuid,
  parseDeveloperBearer,
  parseListingPageParams,
  toPublicListing,
  verifyApiKeyToken,
} from './core.ts'

test('creates a random, prefixed key that can be verified from its hash', () => {
  const first = createApiKeyMaterial()
  const second = createApiKeyMaterial()

  assert.match(first.token, /^ft_live_[A-Za-z0-9_-]{43}$/)
  assert.equal(first.prefix, first.token.slice(0, 20))
  assert.equal(first.secretHash, hashApiKey(first.token))
  assert.equal(first.secretHash.length, 64)
  assert.equal(verifyApiKeyToken(first.token, first.secretHash), true)
  assert.equal(verifyApiKeyToken(second.token, first.secretHash), false)
  assert.notEqual(first.token, second.token)
})

test('parses only exact-case FreeTrust key tokens while allowing a case-insensitive bearer scheme', () => {
  const token = createApiKeyMaterial().token
  assert.deepEqual(parseDeveloperBearer(`bearer ${token}`), {
    token,
    prefix: token.slice(0, 20),
  })
  assert.equal(parseDeveloperBearer(`Bearer ${token.toUpperCase()}`), null)
  assert.equal(parseDeveloperBearer('Bearer ft_live_short'), null)
  assert.equal(parseDeveloperBearer(`Basic ${token}`), null)
  assert.equal(parseDeveloperBearer(`Bearer ${token} extra`), null)
  assert.equal(parseDeveloperBearer(`Bearer ${token}${'x'.repeat(100)}`), null)
})

test('validates UUID route identifiers', () => {
  assert.equal(isUuid('2f4a6e80-2e67-4d31-a377-b0b0b0b0b0b0'), true)
  assert.equal(isUuid('not-a-uuid'), false)
  assert.equal(isUuid('00000000-0000-0000-0000-000000000000'), false)
})

test('parses listing parameters with documented defaults and bounds', () => {
  assert.deepEqual(parseListingPageParams(new URL('https://freetrust.co/api/v1/listings?type=product')), {
    ok: true,
    value: { type: 'product', page: 1, perPage: 20, category: null },
  })
  assert.deepEqual(parseListingPageParams(new URL('https://freetrust.co/api/v1/listings?type=service&page=3&per_page=50&category=%20Home%20')),
    { ok: true, value: { type: 'service', page: 3, perPage: 50, category: 'Home' } })
  assert.equal(parseListingPageParams(new URL('https://freetrust.co/api/v1/listings')).ok, false)
  assert.equal(parseListingPageParams(new URL('https://freetrust.co/api/v1/listings?type=experience')).ok, false)
  assert.equal(parseListingPageParams(new URL('https://freetrust.co/api/v1/listings?type=product&page=0')).ok, false)
  assert.equal(parseListingPageParams(new URL('https://freetrust.co/api/v1/listings?type=product&page=1001')).ok, false)
  assert.equal(parseListingPageParams(new URL('https://freetrust.co/api/v1/listings?type=product&per_page=51')).ok, false)
  assert.equal(parseListingPageParams(new URL(`https://freetrust.co/api/v1/listings?type=product&category=${'x'.repeat(81)}`)).ok, false)
})

test('public listing projection is allowlisted and omits precise free-form location data', () => {
  const result = toPublicListing({
    id: '2f4a6e80-2e67-4d31-a377-b0b0b0b0b0b0',
    product_type: 'service',
    title: 'Repair service',
    description: 'A public description',
    price: '45.00',
    currency_code: 'EUR',
    category: 'Home',
    cover_image: null,
    images: ['https://cdn.example.test/service.png', 12],
    tags: ['plumbing', null, 'repair'],
    location: '12 Private Lane, Cork',
    location_label: '12 Private Lane, Cork',
    city: 'Cork',
    region: 'Munster',
    country: 'Ireland',
    is_remote: false,
    service_mode: 'in_person',
    avg_rating: '4.8',
    review_count: '12',
    created_at: '2026-11-18T12:00:00.000Z',
    seller: [{ full_name: 'Public seller', avatar_url: 'https://cdn.example.test/avatar.png', email: 'private@example.test' }],
    owner_id: 'private-owner-id',
  })

  assert.deepEqual(result.location, {
    label: 'Cork, Munster, Ireland', city: 'Cork', region: 'Munster', country: 'Ireland', remote: false,
  })
  assert.deepEqual(result.seller, { name: 'Public seller', avatarUrl: 'https://cdn.example.test/avatar.png' })
  assert.deepEqual(result.service, { mode: 'in_person', tags: ['plumbing', 'repair'] })
  assert.deepEqual(result.rating, { average: 4.8, count: 12 })
  assert.equal(result.price.amount, '45.00')
  assert.equal('owner_id' in result, false)
  assert.equal(JSON.stringify(result).includes('Private Lane'), false)
  assert.equal(JSON.stringify(result).includes('private@example.test'), false)

  const deletedSeller = toPublicListing({ product_type: 'product', seller: { full_name: 'Deleted member', deleted_at: '2026-11-17T00:00:00Z' } })
  assert.equal(deletedSeller.seller, null)
})
