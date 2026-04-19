#!/usr/bin/env node
// Run: node scripts/generate-vapid-keys.js
// Then add the output to Vercel environment variables
const webpush = require('web-push')
const keys = webpush.generateVAPIDKeys()
console.log('\n=== VAPID Keys Generated ===')
console.log('NEXT_PUBLIC_VAPID_PUBLIC_KEY=' + keys.publicKey)
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey)
console.log('\nAdd both to Vercel environment variables.')
console.log('NEXT_PUBLIC_VAPID_PUBLIC_KEY is safe to expose publicly.')
console.log('VAPID_PRIVATE_KEY must remain secret (server-only).\n')
