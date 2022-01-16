#!/bin/sh
npm ci
npm run postprepare
npm run gulp configure-tsplus
npm run gulp LKG
npm run gulp clean
npm pack
