#!/bin/sh
cd "$(dirname "$0")"
if ! curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8090/health; then
 python3 portal_collector.py >>/tmp/homezee-collector.log 2>&1 &
fi
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then exit 0; fi
HOMEZEE_DEMO=true npm run dev >>/tmp/homezee-unified.log 2>&1 &
