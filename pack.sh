#!/bin/sh
npm ci
npm run postprepare
npx hereby configure-tsplus
npx hereby LKG
npm run clean
npm pack
