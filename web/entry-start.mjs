import {openRememberedEntry} from './google-entry.mjs?v=readspeed20261127';

// Returning users can go straight to the authenticated site before loading the ERP.
if (!openRememberedEntry()) {
  await import('./app.mjs?v=overviewCards1');
}
