const fs=require('fs');const p='src/data/simpleCopy.js';let c=fs.readFileSync(p,'utf8');const old=\
sosSmsNoGps:EMERGENCY ALERT [NammaDrishti]: Need urgent assistance in Bengaluru. GPS unavailable; contact me for my location.
\;const add=\
sosAcknowledged:Operator acknowledged your SOS location.
sosFailed:SOS dispatch failed. Please call 112 directly.
sosStatusUnknown:SOS status could not be confirmed. Please call 112 directly.
sosAuthNotReady:Sign-in/session not ready. Please call 112 directly.
sosRetrying:SOS location queued for dispatch. Please call 112 directly.
\;const enEnd=c.indexOf('kn:');if(c.indexOf(old)>-1 && c.indexOf('sosAcknowledged',0,enEnd)===-1){c=c.split(old).join(old+add);fs.writeFileSync(p,c);console.log('done');}
