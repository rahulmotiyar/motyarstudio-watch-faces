import {mountInstaller} from './app.js';

mountInstaller().catch(error=>{
  const status=document.getElementById('connect-status');
  status.textContent=`Could not open the collection: ${error.message}. Reload to try again.`;
  status.dataset.error='true';
});
