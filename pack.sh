#!/bin/sh
npm ci
npx hereby configure-tsplus
npx hereby LKG
npx hereby clean
npm pack
